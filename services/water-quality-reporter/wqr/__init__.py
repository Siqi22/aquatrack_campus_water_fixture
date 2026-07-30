"""Water Quality Reporter — generate UW EH&S-style memos from lab data."""
from .models import (
    Fixture, Sample, Measurement, ActionLevel, ReportContext, CANONICAL_UNITS,
)
from .fixtures import FixtureRegistry
from .parsers import parse_ieh_xlsx, parse_ieh_wide_csv, parse_generic_lab_file
from .pdf_parser import parse_ieh_pdf, parse_generic_pdf, parse_doh_school_pdf
from .thresholds import load_profile, BUILTIN_PROFILES, evaluate_sample
from .report import render_html, render_pdf
from .docx_report import render_docx

__all__ = [
    "Fixture", "Sample", "Measurement", "ActionLevel", "ReportContext",
    "CANONICAL_UNITS", "FixtureRegistry",
    "parse_ieh_xlsx", "parse_ieh_wide_csv", "parse_ieh_pdf",
    "parse_generic_lab_file", "parse_generic_pdf", "parse_doh_school_pdf",
    "load_profile", "BUILTIN_PROFILES", "evaluate_sample",
    "render_html", "render_pdf", "render_docx",
]
