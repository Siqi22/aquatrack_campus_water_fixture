"""IEH PDF parser. Extracts the lab table from a Certificate of Analysis."""
from __future__ import annotations
import re
from pathlib import Path
from datetime import datetime, date
from typing import Optional

import pdfplumber
import pandas as pd

from .models import Sample, Measurement
from .parsers import (
    _parse_value, _parse_client_id, _to_date, parse_generic_dataframe,
)


# Map IEH column header text to (analyte, unit)
_HEADER_MAP = {
    "Copper (mg/L)": ("Copper", "mg/L"),
    "Iron (mg/L)": ("Iron", "mg/L"),
    "Lead (ug/L)": ("Lead", "ug/L"),
    "Lead (µg/L)": ("Lead", "ug/L"),
    "Manganese (mg/L)": ("Manganese", "mg/L"),
    "Zinc (mg/L)": ("Zinc", "mg/L"),
}


def parse_ieh_pdf(path: str | Path) -> list[Sample]:
    """Extract samples from an IEH Certificate of Analysis PDF.

    Looks for the table with columns: Lab Sample ID | Client Sample ID |
    Analysis Date | Copper | Iron | Lead | Manganese | Zinc.
    """
    samples = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for tbl in tables:
                samples.extend(_parse_table(tbl))
    if not samples:
        raise ValueError(
            f"No recognizable IEH lab table found in {path}. "
            "Is this an IEH Certificate of Analysis?"
        )
    return samples


def parse_generic_pdf(path: str | Path) -> list[Sample]:
    """Parse a non-IEH PDF only when a structured table is recognizable.

    PDF text extraction can be fragile. This intentionally refuses loose text
    and only accepts extracted tables whose headers match the same generic
    long/wide schemas used for CSV/XLSX.
    """
    samples: list[Sample] = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            for tbl in page.extract_tables():
                samples.extend(_parse_generic_pdf_table(tbl))

    if not samples:
        raise ValueError(
            "Could not confidently parse this non-IEH PDF. Please upload the "
            "lab results as CSV or XLSX, or use an IEH Certificate of Analysis "
            "PDF with a recognizable results table."
        )
    return samples


def parse_doh_school_pdf(path: str | Path) -> list[Sample]:
    """Parse WA DOH Lead in School Drinking Water Report PDFs.

    These are not lab certificates. They contain a multi-page results table
    with columns such as Sample ID, Building Name, Fixture Housing Type,
    Fixture Location, Fixture Type, and Lead Test Result (ppb).
    """
    path = Path(path)
    samples: list[Sample] = []
    school_name = ""
    collected = None
    analyzed = None
    with pdfplumber.open(str(path)) as pdf:
        if pdf.pages:
            first_text = pdf.pages[0].extract_text() or ""
            school_name = _extract_doh_school_name(first_text)
        for page in pdf.pages:
            text = page.extract_text() or ""
            collected = collected or _extract_first_date(text, "Date(s) collected:")
            analyzed = analyzed or _extract_first_date(text, "Date(s) analyzed:")
            for tbl in page.extract_tables():
                samples.extend(_parse_doh_table(tbl, school_name, collected, analyzed))

    if not samples:
        raise ValueError("No recognizable WA DOH school drinking-water results table found.")
    return samples


def _extract_doh_school_name(text: str) -> str:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for i, line in enumerate(lines):
        if line.lower().startswith("lead in school drinking water report") and i + 1 < len(lines):
            return lines[i + 1]
    return ""


def _extract_first_date(text: str, label: str):
    idx = text.find(label)
    if idx == -1:
        return None
    tail = text[idx + len(label):].strip().splitlines()[0]
    first = tail.split(",")[0].strip()
    return _to_date(first)


def _parse_doh_table(tbl: list[list[str]], school_name: str, collection_date, analysis_date) -> list[Sample]:
    if not tbl or len(tbl) < 2:
        return []
    samples: list[Sample] = []
    for row in tbl:
        if not row or len(row) < 9:
            continue
        ordinal = _clean(row[0])
        sample_id = _clean(row[1])
        if not ordinal.isdigit() or not sample_id.isdigit():
            continue
        building = _clean(row[2]) or school_name
        housing_type = _clean(row[3])
        location = _clean(row[4])
        details = _clean(row[5])
        fixture_type = _clean(row[6])
        position = _clean(row[7])
        result = _clean(row[8])
        try:
            lead = _parse_value(result, "Lead", "ppb")
        except ValueError:
            continue

        source_name = school_name or building or "School"
        fixture_id = f"DOH_{sample_id}"
        label_bits = [b for b in (fixture_type, location, housing_type) if b]
        fixture_label = " - ".join(label_bits) if label_bits else "drinking water outlet"
        detail_bits = []
        if details:
            detail_bits.append(details)
        if position:
            detail_bits.append(f"position: {position}")
        if detail_bits:
            fixture_label += f" ({'; '.join(detail_bits)})"

        samples.append(Sample(
            sample_id=sample_id,
            client_sample_id=sample_id,
            fixture_id=fixture_id,
            volume_ml=0,
            collection_date=collection_date,
            analysis_date=analysis_date,
            measurements=[lead],
            building_name=source_name,
            fixture_label=fixture_label,
            source_fields={
                "doh_row": ordinal,
                "building_name": building,
                "fixture_housing_type": housing_type,
                "fixture_location": location,
                "fixture_location_details": details,
                "fixture_type": fixture_type,
                "fixture_position": position,
            },
        ))
    return samples


def _parse_generic_pdf_table(tbl: list[list[str]]) -> list[Sample]:
    if not tbl or len(tbl) < 2:
        return []

    # Try the first few rows as possible headers. This handles PDFs that put a
    # title row above the actual table headings.
    for header_idx in range(min(4, len(tbl) - 1)):
        headers = [_clean(c) for c in tbl[header_idx]]
        if not any(headers):
            continue
        rows = tbl[header_idx + 1:]
        try:
            df = pd.DataFrame(rows, columns=_dedupe_headers(headers))
        except ValueError:
            continue
        try:
            return parse_generic_dataframe(df)
        except ValueError:
            continue
    return []


def _parse_table(tbl: list[list[str]]) -> list[Sample]:
    """Parse one extracted table; return [] if it's not the lab results table."""
    if not tbl or len(tbl) < 2:
        return []

    # Find the header row by looking for "Lab Sample ID" column
    header_row_idx = None
    for i, row in enumerate(tbl):
        if row and any(c and "Lab Sample ID" in c for c in row if c):
            header_row_idx = i
            break
    if header_row_idx is None:
        return []

    headers = [_clean(c) for c in tbl[header_row_idx]]
    # Map column indexes
    try:
        idx_lab = headers.index("Lab Sample ID")
        idx_client = headers.index("Client Sample ID")
    except ValueError:
        return []
    idx_analysis = _find_idx(headers, "Analysis Date")

    # Map analyte columns
    analyte_cols: dict[int, tuple[str, str]] = {}
    for i, h in enumerate(headers):
        for key, (analyte, unit) in _HEADER_MAP.items():
            # Be forgiving about whitespace/newlines in headers
            if _normalize(h) == _normalize(key):
                analyte_cols[i] = (analyte, unit)

    samples = []
    for row in tbl[header_row_idx + 1:]:
        if not row or len(row) <= idx_lab:
            continue
        lab_id = _clean(row[idx_lab])
        client_id = _clean(row[idx_client]) if idx_client < len(row) else ""
        # Skip footer/method rows
        if not lab_id or not re.match(r"^\d", lab_id):
            continue
        if not client_id:
            continue

        fixture_id, volume = _parse_client_id(client_id)
        analysis_date = None
        if idx_analysis is not None and idx_analysis < len(row):
            analysis_date = _to_date(_clean(row[idx_analysis]))

        s = Sample(
            sample_id=lab_id, client_sample_id=client_id,
            fixture_id=fixture_id, volume_ml=volume,
            collection_date=None, analysis_date=analysis_date,
            measurements=[],
        )
        for col_idx, (analyte, unit) in analyte_cols.items():
            if col_idx >= len(row):
                continue
            raw = _clean(row[col_idx])
            if not raw:
                continue
            try:
                s.measurements.append(_parse_value(raw, analyte, unit))
            except ValueError:
                continue
        if s.measurements:
            samples.append(s)
    return samples


def _clean(s) -> str:
    if s is None:
        return ""
    return str(s).replace("\n", " ").strip()


def _dedupe_headers(headers: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    out: list[str] = []
    for i, header in enumerate(headers):
        base = header or f"column_{i + 1}"
        count = seen.get(base, 0)
        seen[base] = count + 1
        out.append(base if count == 0 else f"{base}_{count + 1}")
    return out


def _normalize(s: str) -> str:
    """For header matching: lowercase, collapse whitespace, strip parens spacing."""
    return re.sub(r"\s+", "", s.lower()).replace("μ", "u").replace("µ", "u")


def _find_idx(headers: list[str], target: str) -> Optional[int]:
    for i, h in enumerate(headers):
        if _normalize(h) == _normalize(target):
            return i
    return None
