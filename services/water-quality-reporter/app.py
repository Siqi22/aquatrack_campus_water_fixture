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
    app.run(debug=True, port=port)
