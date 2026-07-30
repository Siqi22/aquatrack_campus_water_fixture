"""Report generator: data + template -> HTML -> PDF."""
from __future__ import annotations
import re
from pathlib import Path
from typing import Optional

import jinja2
from markupsafe import Markup, escape
import pdfkit

from .models import ReportContext, Sample, ActionLevel, CANONICAL_UNITS
from .fixtures import FixtureRegistry
from .thresholds import evaluate_sample, violation_summary


_TEMPLATE_DIR = Path(__file__).parent / "templates"


def _format_sample_volume(volume_ml: int | None) -> str:
    if not volume_ml:
        return "not specified"
    if volume_ml == 1000:
        return "1 L"
    if volume_ml % 1000 == 0:
        return f"{volume_ml // 1000} L"
    return f"{volume_ml} mL"


def _md_to_html(text: str) -> Markup:
    """Tiny markdown subset: paragraphs and bold. Avoids a markdown dep
    while letting EH&S authors use simple formatting.

    Escapes user content first, then re-injects only the markup we generate."""
    if not text:
        return Markup("")
    paras = [p.strip() for p in text.strip().split("\n\n") if p.strip()]
    out = []
    for p in paras:
        p = str(escape(p))
        p = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", p)
        p = re.sub(r"\*(.+?)\*", r"<em>\1</em>", p)
        out.append(f"<p>{p}</p>")
    return Markup("\n".join(out))


def _placeholder_fixture(fixture_id: str) -> "Fixture":
    """Build a stand-in Fixture for samples whose IDs aren't in the registry.

    Pulls the building-code prefix from the ID and emits generic location text.
    Used when generating draft reports for buildings whose fixtures haven't
    been registered yet — keeps the renderer running without forcing the
    author to populate the registry first.
    """
    from .models import Fixture
    import re
    code_match = re.match(r"^([A-Z]+\d*)", (fixture_id or "").upper())
    code = code_match.group(1) if code_match else "UNKNOWN"
    # Try to infer a fixture type from the second segment of the ID
    parts = (fixture_id or "").split("_")
    type_map = {
        "PF": "porcelain fountain",
        "MF": "metal fountain",
        "BRS": "bottle refill station",
        "WBF": "water bottle filler",
    }
    fixture_type = "drinking water fixture"
    for p in parts[1:]:
        if p.upper() in type_map:
            fixture_type = type_map[p.upper()]
            break
    # Last segment often looks like a room number
    room = parts[-1] if len(parts) > 1 else ""
    if room and not room.isalpha():
        room = f"Rm {room}"
    else:
        room = ""
    return Fixture(
        fixture_id=fixture_id,
        building=code,
        floor="",
        room=room,
        fixture_type=fixture_type,
        notes="Auto-generated placeholder; fixture not in registry.",
    )


def _build_rows(samples: list[Sample], registry: FixtureRegistry,
                levels: list[ActionLevel], analytes: list[str]) -> list[dict]:
    """Build template-friendly row data, sorted by lead descending.

    Fixtures missing from the registry get a placeholder so reports still
    render. The placeholder infers a fixture type and room from the ID where
    possible, without adding location placeholder wording.
    """
    rows = []
    for s in samples:
        fixture = registry.get(s.fixture_id)
        if fixture is None:
            fixture = _placeholder_fixture(s.fixture_id)
        if getattr(s, "fixture_label", ""):
            from .models import Fixture
            fixture = Fixture(
                fixture_id=s.fixture_id,
                building=getattr(s, "building_name", "") or fixture.building,
                floor="",
                room="",
                fixture_type=s.fixture_label,
                notes="Source-provided fixture/location label.",
            )
        severity_map = evaluate_sample(s, levels)
        cells = {}
        for a in analytes:
            m = s.measurement(a)
            display = ""
            if m and not (m.below_dl and m.detection_limit is None):
                display = m.display
            cells[a] = {
                "display": display,
                "severity": severity_map.get(a, "ok") if m else "ok",
            }
        rows.append({
            "sample": s,
            "fixture": fixture,
            "sample_volume": _format_sample_volume(s.volume_ml),
            "cells": cells,
        })

    # Sort by lead value desc; below-DL last
    def lead_key(r):
        m = r["sample"].measurement("Lead")
        if not m or m.below_dl or m.value is None:
            return -1.0
        return -m.value  # negative for descending
    rows.sort(key=lead_key)
    return rows


def _display_unit(unit: str) -> str:
    """Map canonical storage units to UW report display labels.
    Mirrors wqr.docx_report._display_unit."""
    return "ppm" if unit == "mg/L" else unit


def _thresholds_paragraph(levels: list[ActionLevel], analytes: list[str]) -> str:
    """Auto-generate the 'action levels in effect' sentence."""
    parts = []
    for a in analytes:
        level = next((l for l in levels if l.analyte == a), None)
        if level is None:
            continue
        parts.append(
            f"<strong>{a}:</strong> {level.threshold:g} "
            f"{_display_unit(level.unit)} ({level.source})"
        )
    return "Action levels applied in this report: " + "; ".join(parts) + "."


def _violation_prose(samples: list[Sample], levels: list[ActionLevel]) -> str:
    """Auto-generate the 'X fixtures exceeded Y' sentences."""
    summary = violation_summary(samples, levels)
    lines = []
    for analyte, info in summary.items():
        if info["count"] == 0:
            continue
        level = info["level"]
        verb = "exceeded" if info["count"] > 1 else "exceeded"
        plural = "fixtures" if info["count"] > 1 else "fixture"
        lines.append(
            f"<strong>{analyte}</strong> {verb} the action level of "
            f"{level.threshold:g} {_display_unit(level.unit)} in "
            f"<strong>{info['count']} {plural}</strong>."
        )
    if not lines:
        return ("All measured analytes were below the action levels listed "
                "above.")
    return " ".join(lines)


def render_html(ctx: ReportContext, registry: FixtureRegistry) -> str:
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=jinja2.select_autoescape(["html"]),
    )
    env.filters["md"] = _md_to_html

    rows = _build_rows(ctx.samples, registry, ctx.action_levels,
                       ctx.analytes_shown)
    template = env.get_template("eh_s_memo.html")
    return template.render(
        ctx=ctx,
        rows=rows,
        thresholds_paragraph=_thresholds_paragraph(ctx.action_levels,
                                                   ctx.analytes_shown),
        violation_prose=_violation_prose(ctx.samples, ctx.action_levels),
    )


def render_pdf(ctx: ReportContext, registry: FixtureRegistry,
               output_path: str | Path) -> Path:
    html = render_html(ctx, registry)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    options = {
        "page-size": "Letter",
        "margin-top": "0.5in",
        "margin-bottom": "0.5in",
        "margin-left": "0.5in",
        "margin-right": "0.5in",
        "encoding": "UTF-8",
        "quiet": "",
    }
    pdfkit.from_string(html, str(output_path), options=options)
    return output_path
