"""Flask launcher for the Water Quality Reporter.

Run:
    python app.py

Then open:
    http://127.0.0.1:5000
"""
from __future__ import annotations

import os

from flask_app import app


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "").lower() in {"1", "true", "yes", "on"}
    # flask_app loads only the two explicit server-side .env locations. Disable
    # Flask's automatic upward search so the packaged app never tries to open a
    # project-directory .env outside its Application Support sandbox.
    app.run(debug=debug, port=port, use_reloader=False, load_dotenv=False)
