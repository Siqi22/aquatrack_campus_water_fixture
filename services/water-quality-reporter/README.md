# UW Water Quality Reporter

Multi-user Flask web app. Upload IEH lab data (PDF, xlsx, or CSV),
generate a UW EH&S-style memo as an editable Word document.

## AquaTrack integration

This copy is deployed independently and opened from AquaTrack's Communication
navigation. AquaTrack passes the current Supabase session through a URL
fragment; `/auth/launch` exchanges it for a secure, HttpOnly Flask cookie.
The Flask app then queries schools, buildings, fixtures, and testing records
with the user's own JWT so existing Supabase RLS policies remain active.

Required environment variables:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
FLASK_SECRET_KEY=a-long-random-value
AQUATRACK_URL=https://your-aquatrack-domain.example
COMMUNICATION_STORAGE_BUCKET=communication-reports
```

Before production use, run
`supabase/migrations/20260730000000_communication_report_storage.sql`
from the AquaTrack repository.


## Project structure

```
wqr_project/
├── app.py                   # Flask launcher (run: python app.py)
├── flask_app.py             # Flask web app
├── flask_templates/         # HTML templates for the web UI
├── generate_demo.py         # CLI demo that renders sample DOCX + PDF
├── data/
│   ├── fixtures.json        # Master fixture registry (edit this)
│   └── ieh_april2026.csv    # Sample data
├── work/                    # Per-upload scratch (auto-created, ephemeral)
├── output/                  # Generated reports
└── wqr/                     # Framework-agnostic core library
    ├── models.py            # Fixture, Sample, Measurement, etc.
    ├── parsers.py           # IEH xlsx + wide csv parsers
    ├── pdf_parser.py        # IEH lab PDF parser (pdfplumber)
    ├── fixtures.py          # FixtureRegistry
    ├── thresholds.py        # ActionLevel + builtin profiles
    ├── docx_report.py       # python-docx renderer (PRIMARY)
    ├── report.py            # Jinja2 + wkhtmltopdf renderer (secondary)
    └── templates/eh_s_memo.html
```

## Running

```bash
pip install -r requirements.txt
# Optional: apt install wkhtmltopdf  (only if you want PDF output too)

# CLI: regenerate the sample memo
python generate_demo.py

# Web app: start Flask
python app.py
# Then visit http://127.0.0.1:5000
```

The first screen asks whether you are making a UW report or a neutral
school/district report. Choose UW to keep the UW header, contacts, and
wording. For other schools, enter the school/building name before uploading.
School/district reports then go to a separate reference-sample page where you
upload a sample of the school or district's report style and a sample/reference
lab output format. After that, upload the current lab/results file and optional
COC/sampling form.

Do not open files inside `flask_templates/` directly in a browser. Those are
templates that Flask fills in after you start the app.

## What to add next

1. **Fixture admin UI.** Right now you edit `data/fixtures.json` by hand.
   When tracking future fixtures across different buildings, you'll want
   a /fixtures page in the Flask app to add/edit them.
2. **SQLite for samples + reports.** Each report is currently regenerated
   from scratch. Persist parsed samples and generated reports keyed by
   sampling event so you can: compare two events for the same fixture
   over time, regenerate a report after correcting a typo, keep a
   compliance audit trail.
3. **Auth.** Werkzeug dev-server (what powers flask) isn't deployable. Even minimal HTTP
   basic auth or UW SSO is a prerequisite to making this "the team's tool."
4. **Building profiles.** Option to hardcode  contacts and building-specific
   intro defaults for any building.

## Things deliberately NOT done

- LLM-generated narrative. Since EH&S memos are signed by people, wording is
  a real responsibility, not a templating problem.
- Auto-averaging duplicate samples. EPA 3Ts intentionally collects 250 mL
  and 1 L from the same fixture; both appear as separate rows.
