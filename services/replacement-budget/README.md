# AquaTrack Replacement Budget

This service preserves the original four-step Flask replacement-budget workflow:

1. Select schools.
2. Select fixtures with lead results above 5 ppb.
3. Choose replacement parts and edit material/labor estimates.
4. Review and export the Excel budget workbook.

The service opens from AquaTrack through a one-time access-token handoff. It
uses the user's JWT for Supabase REST requests, so the same Row Level Security
rules control which schools, fixtures, and testing results are available.

## Environment

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
FLASK_SECRET_KEY=a-long-random-value
AQUATRACK_URL=https://your-aquatrack-domain.example
COMMUNICATION_URL=https://your-communication-tool.example
```

## Local development

```bash
pip install -r requirements.txt
python app.py
```

Without Supabase environment variables, the original placeholder district data
is used for local development and regression tests.

In production, the school picker uses the signed-in user's Supabase/RLS scope.
Every school-district campus with at least one fixture record is available;
schools without fixture inventory are omitted.
