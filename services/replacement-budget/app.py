"""AquaTrack replacement-budget service based on the original Flask tool."""

from __future__ import annotations

import io
import os
import secrets
from pathlib import Path

from flask import (
    Flask,
    g,
    jsonify,
    make_response,
    redirect,
    render_template,
    request,
    send_file,
    send_from_directory,
    session,
    url_for,
)
from werkzeug.middleware.proxy_fix import ProxyFix

from backend.budgeting import (
    DISTRICT_NAME,
    FIXTURE_BY_ID,
    SCHOOLS,
    SCHOOL_BY_ID,
    VENDORS,
    budget_totals,
    build_budget_lines,
    default_replacement,
    fixtures_for_schools,
    generate_budget_xlsx,
    normalize_fixture_ids,
    normalize_school_ids,
    replacement_options,
)
from backend.csv_generator import generate_district_xlsx_bytes
from backend.query_engine import CONTAMINATION_THRESHOLD_PPB, match_districts, resolve_district, search_district
from backend.vendors import get_vendors_for_district
from supabase_adapter import SupabaseAdapter


ROOT = Path(__file__).resolve().parent
BUILD_ID = "2026-08-04-aquatrack-budget-v4"

app = Flask(
    __name__,
    template_folder=str(ROOT / "desktop_templates"),
    static_folder=None,
)
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY") or secrets.token_hex(32)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=bool(os.environ.get("VERCEL") or os.environ.get("SESSION_COOKIE_SECURE")),
)

supabase = SupabaseAdapter()
AQUATRACK_URL = os.environ.get(
    "AQUATRACK_URL",
    "https://aquatrack-campus-water-fixture.vercel.app",
).rstrip("/")
COMMUNICATION_URL = os.environ.get(
    "COMMUNICATION_URL",
    "https://aquatrack-water-quality-reporter.vercel.app",
).rstrip("/")


def _placeholder_catalog() -> dict:
    return {
        "district_name": DISTRICT_NAME,
        "schools": SCHOOLS,
        "school_by_id": SCHOOL_BY_ID,
        "fixtures": list(FIXTURE_BY_ID.values()),
        "fixture_by_id": FIXTURE_BY_ID,
    }


def _catalog() -> dict:
    catalog = getattr(g, "budget_catalog", None)
    if catalog is None:
        catalog = supabase.catalog() if supabase.configured else _placeholder_catalog()
        g.budget_catalog = catalog
    return catalog


@app.context_processor
def inject_aquatrack_navigation():
    catalog = _catalog() if request.endpoint not in {"auth_launch", "auth_session", "health"} else None
    return {
        "aquatrack_url": AQUATRACK_URL,
        "communication_url": COMMUNICATION_URL,
        "organization_name": (catalog or {}).get("district_name", "School District"),
        "build_id": BUILD_ID,
    }


@app.before_request
def require_aquatrack_user():
    public_endpoints = {"auth_launch", "auth_session", "health", "frontend_asset", "desktop_health"}
    if request.endpoint in public_endpoints:
        return None
    token = supabase.token()
    user = supabase.verify_user(token) if supabase.configured else {"id": "local-development"}
    if not user:
        return make_response(
            "<!doctype html><title>Sign in required</title>"
            "<body style='font-family:system-ui;max-width:560px;margin:60px auto;padding:20px'>"
            "<h1>Return to AquaTrack</h1><p>Your replacement-budget session has expired.</p>"
            f"<a href='{AQUATRACK_URL}' style='color:#087c92'>Open AquaTrack</a></body>",
            401,
        )
    g.current_user = user
    session["user_id"] = user.get("id")


@app.get("/health")
def health():
    return {"status": "ok", "supabase_configured": supabase.configured}


@app.get("/auth/launch")
def auth_launch():
    return """<!doctype html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Opening AquaTrack</title></head>
    <body style="font-family:system-ui;display:grid;place-items:center;min-height:80vh;color:#172333">
    <p id="status">Opening AquaTrack Replacement Budget…</p>
    <script>
      const token = new URLSearchParams(location.hash.slice(1)).get('access_token');
      history.replaceState(null, '', location.pathname);
      if (!token) {
        document.getElementById('status').textContent = 'Return to AquaTrack and try again.';
      } else {
        fetch('./session', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({access_token: token})
        }).then(async response => {
          if (!response.ok) throw new Error(await response.text());
          location.replace('../');
        }).catch(() => {
          document.getElementById('status').textContent =
            'Your AquaTrack session could not be verified.';
        });
      }
    </script></body></html>"""


@app.post("/auth/session")
def auth_session():
    token = (request.get_json(silent=True) or {}).get("access_token", "")
    user = supabase.verify_user(token)
    if not user:
        return {"error": "Invalid or expired AquaTrack session"}, 401
    response = make_response({"ok": True})
    response.set_cookie(
        "replacement_budget_access_token",
        token,
        max_age=3600,
        httponly=True,
        secure=bool(os.environ.get("VERCEL") or request.is_secure),
        samesite="Lax",
    )
    return response


@app.template_filter("currency")
def format_currency(value: int | float) -> str:
    return f"${value:,.0f}"


@app.get("/assets/<path:filename>")
def frontend_asset(filename: str):
    if filename in {"App.css", "index.css"}:
        return send_from_directory(ROOT / "frontend" / "src", filename)
    return send_from_directory(ROOT / "desktop_static", filename)


def _budget_state() -> dict:
    catalog = _catalog()
    defaults = {
        "district_name": catalog["district_name"],
        "selected_schools": [],
        "selected_fixtures": [],
        "fixtures_initialized": False,
        "replacements": {},
        "labor_cost": 0,
        "completed_step": 0,
    }
    stored = session.get("budget_state")
    if isinstance(stored, dict) and stored.get("district_name") == catalog["district_name"]:
        defaults.update(stored)
    return defaults


def _save_budget_state(state: dict) -> None:
    session["budget_state"] = state
    session.modified = True


def _ensure_default_fixture_selection(state: dict) -> None:
    if state.get("fixtures_initialized"):
        return
    catalog = _catalog()
    state["selected_fixtures"] = [
        fixture["id"]
        for fixture in fixtures_for_schools(
            state.get("selected_schools", []),
            catalog["fixtures"],
            catalog["school_by_id"],
        )
        if fixture["eligible"]
    ]
    state["fixtures_initialized"] = True
    _save_budget_state(state)


def _ensure_replacements(state: dict) -> None:
    catalog = _catalog()
    replacements = dict(state.get("replacements", {}))
    selected = set(state.get("selected_fixtures", []))
    replacements = {
        fixture_id: replacement
        for fixture_id, replacement in replacements.items()
        if fixture_id in selected
    }
    for fixture_id in selected:
        fixture = catalog["fixture_by_id"].get(fixture_id)
        if fixture and fixture_id not in replacements:
            replacements[fixture_id] = default_replacement(fixture)
    state["replacements"] = replacements
    _save_budget_state(state)


@app.route("/", methods=["GET", "POST"])
@app.route("/budget/schools", methods=["GET", "POST"])
def budget_schools():
    catalog = _catalog()
    state = _budget_state()
    error = None
    if request.method == "POST":
        previous_schools = set(state.get("selected_schools", []))
        selected_schools = normalize_school_ids(
            request.form.getlist("school_id"), catalog["schools"]
        )
        if not selected_schools:
            error = "Select at least one school to continue."
        else:
            schools_changed = set(selected_schools) != previous_schools
            added_schools = set(selected_schools) - previous_schools
            valid_fixtures = fixtures_for_schools(
                selected_schools, catalog["fixtures"], catalog["school_by_id"]
            )
            valid_ids = {fixture["id"] for fixture in valid_fixtures if fixture["eligible"]}
            selected_fixtures = [
                fixture_id
                for fixture_id in state.get("selected_fixtures", [])
                if fixture_id in valid_ids
            ]
            for fixture in valid_fixtures:
                if fixture["eligible"] and fixture["school_id"] in added_schools:
                    if fixture["id"] not in selected_fixtures:
                        selected_fixtures.append(fixture["id"])
            if not state.get("fixtures_initialized"):
                selected_fixtures = [fixture["id"] for fixture in valid_fixtures if fixture["eligible"]]
            state["selected_schools"] = selected_schools
            state["selected_fixtures"] = selected_fixtures
            state["fixtures_initialized"] = True
            state["completed_step"] = 1 if schools_changed else max(1, int(state.get("completed_step", 0)))
            state["replacements"] = {
                fixture_id: replacement
                for fixture_id, replacement in state.get("replacements", {}).items()
                if fixture_id in selected_fixtures
            }
            _save_budget_state(state)
            return redirect(url_for("budget_fixtures"))

    selected_school_names = [
        school["name"]
        for school in catalog["schools"]
        if school["id"] in state.get("selected_schools", [])
    ]
    return render_template(
        "budget_schools.html",
        district_name=catalog["district_name"],
        schools=catalog["schools"],
        selected_school_names=selected_school_names,
        state=state,
        error=error,
        current_step=1,
    )


@app.route("/budget/fixtures", methods=["GET", "POST"])
def budget_fixtures():
    catalog = _catalog()
    state = _budget_state()
    if not state.get("selected_schools"):
        return redirect(url_for("budget_schools"))
    _ensure_default_fixture_selection(state)
    fixtures = fixtures_for_schools(
        state["selected_schools"], catalog["fixtures"], catalog["school_by_id"]
    )
    error = None
    if request.method == "POST":
        previous_fixtures = set(state.get("selected_fixtures", []))
        selected_fixtures = normalize_fixture_ids(
            request.form.getlist("fixture_id"),
            state["selected_schools"],
            catalog["fixtures"],
            catalog["school_by_id"],
        )
        if not selected_fixtures:
            error = "Select at least one fixture above 5 ppb to continue."
        else:
            fixtures_changed = set(selected_fixtures) != previous_fixtures
            state["selected_fixtures"] = selected_fixtures
            state["fixtures_initialized"] = True
            state["completed_step"] = (
                2 if fixtures_changed else max(2, int(state.get("completed_step", 0)))
            )
            state["replacements"] = {
                fixture_id: replacement
                for fixture_id, replacement in state.get("replacements", {}).items()
                if fixture_id in selected_fixtures
            }
            _save_budget_state(state)
            return redirect(url_for("budget_replacements"))

    selected_school_names = [
        catalog["school_by_id"][school_id]["name"]
        for school_id in state["selected_schools"]
        if school_id in catalog["school_by_id"]
    ]
    return render_template(
        "budget_fixtures.html",
        district_name=catalog["district_name"],
        fixtures=fixtures,
        selected_school_names=selected_school_names,
        threshold=CONTAMINATION_THRESHOLD_PPB,
        state=state,
        error=error,
        current_step=2,
    )


@app.route("/budget/replacements", methods=["GET", "POST"])
def budget_replacements():
    catalog = _catalog()
    state = _budget_state()
    if not state.get("selected_schools"):
        return redirect(url_for("budget_schools"))
    if int(state.get("completed_step", 0)) < 2:
        return redirect(url_for("budget_fixtures"))
    if not state.get("selected_fixtures"):
        return redirect(url_for("budget_fixtures"))
    _ensure_replacements(state)
    options = replacement_options()
    option_names = {option["name"] for option in options}
    error = None

    if request.method == "POST":
        replacements = {}
        for fixture_id in state["selected_fixtures"]:
            fixture = catalog["fixture_by_id"].get(fixture_id)
            if not fixture:
                continue
            fallback = default_replacement(fixture)
            part = request.form.get(f"part_{fixture_id}", str(fallback["part"]))
            if part not in option_names:
                part = str(fallback["part"])
            try:
                unit_cost = float(request.form.get(f"cost_{fixture_id}", fallback["unit_cost"]))
                if unit_cost < 0:
                    raise ValueError
            except (TypeError, ValueError):
                error = "Estimated costs must be zero or greater."
                break
            replacements[fixture_id] = {"part": part, "unit_cost": round(unit_cost, 2)}

        try:
            labor_cost = float(request.form.get("labor_cost", "0") or 0)
            if labor_cost < 0:
                raise ValueError
        except ValueError:
            error = "Labor cost must be zero or greater."
            labor_cost = float(state.get("labor_cost", 0) or 0)

        if not error:
            state["replacements"] = replacements
            state["labor_cost"] = round(labor_cost, 2)
            state["completed_step"] = max(3, int(state.get("completed_step", 0)))
            _save_budget_state(state)
            return redirect(url_for("budget_review"))

    lines = build_budget_lines(state, catalog["fixture_by_id"], catalog["school_by_id"])
    return render_template(
        "budget_replacements.html",
        district_name=catalog["district_name"],
        lines=lines,
        options=options,
        vendors=VENDORS,
        totals=budget_totals(state, catalog["fixture_by_id"], catalog["school_by_id"]),
        state=state,
        error=error,
        current_step=3,
    )


@app.get("/budget/review")
def budget_review():
    catalog = _catalog()
    state = _budget_state()
    if not state.get("selected_schools"):
        return redirect(url_for("budget_schools"))
    if not state.get("selected_fixtures"):
        return redirect(url_for("budget_fixtures"))
    if int(state.get("completed_step", 0)) < 3:
        return redirect(url_for("budget_replacements"))
    _ensure_replacements(state)
    selected_schools = [
        catalog["school_by_id"][school_id]
        for school_id in state["selected_schools"]
        if school_id in catalog["school_by_id"]
    ]
    return render_template(
        "budget_review.html",
        district_name=catalog["district_name"],
        selected_schools=selected_schools,
        lines=build_budget_lines(state, catalog["fixture_by_id"], catalog["school_by_id"]),
        totals=budget_totals(state, catalog["fixture_by_id"], catalog["school_by_id"]),
        threshold=CONTAMINATION_THRESHOLD_PPB,
        state=state,
        current_step=4,
    )


@app.post("/budget/export")
def export_budget():
    catalog = _catalog()
    state = _budget_state()
    if not state.get("selected_schools") or not state.get("selected_fixtures"):
        return redirect(url_for("budget_schools"))
    _ensure_replacements(state)
    file_bytes, filename = generate_budget_xlsx(
        state,
        catalog["district_name"],
        catalog["fixture_by_id"],
        catalog["school_by_id"],
    )
    return send_file(
        io.BytesIO(file_bytes),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )


@app.get("/district-search")
def index():
    return render_template("search.html", initial_query="", search_error=None)


@app.get("/search")
def search():
    query = request.args.get("q", "").strip()
    district_name = resolve_district(query)
    if not district_name:
        return render_template(
            "search.html",
            initial_query=query,
            search_error="Enter a valid Washington school district name.",
        ), 404
    return redirect(url_for("district_results", district_name=district_name))


@app.get("/results/<path:district_name>")
def district_results(district_name: str):
    resolved = resolve_district(district_name)
    if not resolved:
        return render_template(
            "results.html",
            district_name=district_name,
            initial_query=district_name,
            error="District not found. Try another spelling or choose a suggestion.",
            result=None,
            summary=None,
        ), 404

    result = search_district(resolved)
    vendor_data = get_vendors_for_district(resolved)
    result["district_cities"] = vendor_data["district_cities"]
    result["vendors"] = vendor_data["vendors"]
    return render_template(
        "results.html",
        district_name=resolved,
        initial_query=resolved,
        error=None,
        result=result,
        summary=result["summary"],
    )


@app.get("/api/districts/suggest")
def suggest_districts():
    query = request.args.get("q", "")
    try:
        limit = max(1, min(int(request.args.get("limit", "10")), 50))
    except ValueError:
        limit = 10
    districts = match_districts(query, limit=limit)
    return jsonify({"count": len(districts), "districts": districts})


@app.get("/download/<path:district_name>")
def download_report(district_name: str):
    resolved = resolve_district(district_name)
    if not resolved:
        return "District not found", 404

    result = search_district(resolved)
    file_bytes, filename = generate_district_xlsx_bytes(result)
    return send_file(
        io.BytesIO(file_bytes),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )


@app.get("/__school_water_lead_health__")
def desktop_health():
    return f"school-water-lead:{BUILD_ID}"


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "51300"))
    app.run(
        host="127.0.0.1",
        port=port,
        debug=False,
        use_reloader=False,
        load_dotenv=False,
    )
