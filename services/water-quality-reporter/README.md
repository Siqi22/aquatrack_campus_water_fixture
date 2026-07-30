# AquaTrack Water Quality Reporter

This service preserves the refined Water Quality Reporter workflow while
opening securely from AquaTrack's Communication navigation.

## Workflow

1. Select an AquaTrack school.
2. Select that school's fixtures. All are selected by default.
3. Upload the communication-style sample and Word header template.
4. Review and edit the generated communication.
5. Download the editable Word report.

School, building, fixture, and lead-testing data come from the same Supabase
project as AquaTrack. The user's AquaTrack access token is exchanged for a
secure, HttpOnly Flask cookie, so existing Row Level Security policies remain
active.

## Environment

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
FLASK_SECRET_KEY=a-long-random-value
AQUATRACK_URL=https://your-aquatrack-domain.example
COMMUNICATION_STORAGE_BUCKET=communication-reports
CLAUDE_API_KEY=your-anthropic-key
```

Run `supabase/migrations/20260730000000_communication_report_storage.sql`
once before using saved drafts and generated reports in production.

## Local development

```bash
pip install -r requirements.txt
python app.py
```

The app runs at `http://127.0.0.1:5000`.
