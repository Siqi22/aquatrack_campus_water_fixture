"""Parsers for lab result files.

The IEH lab sends two shapes:
- xlsx in LONG format (one row per analyte per sample)
- csv/pdf-derived in WIDE format (one row per sample, one column per analyte)

Generic non-IEH CSV/XLS/XLSX files are also accepted when they expose
recognizable sample/analyte/result columns. Everything ends up as the same
canonical list[Sample].
"""
from __future__ import annotations
import re
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import pandas as pd

from .models import Sample, Measurement, CANONICAL_UNITS


# Mapping from IEH unit strings to canonical units, with conversion factor
# applied to numeric values. Lead is the tricky one: lab reports it as mg/L
# in xlsx but as ug/L in the wide csv. We always store as ppb.
_UNIT_NORMALIZE = {
    ("Lead", "mg/L"):  ("ppb", 1000.0),
    ("Lead", "ppm"):   ("ppb", 1000.0),
    ("Lead", "ug/L"):  ("ppb", 1.0),
    ("Lead", "ppb"):   ("ppb", 1.0),
    ("Copper", "mg/L"): ("mg/L", 1.0),
    ("Copper", "ppm"):  ("mg/L", 1.0),
    ("Copper", "ug/L"): ("mg/L", 0.001),
    ("Copper", "ppb"):  ("mg/L", 0.001),
    ("Iron", "mg/L"):  ("mg/L", 1.0),
    ("Iron", "ppm"):   ("mg/L", 1.0),
    ("Iron", "ug/L"):  ("mg/L", 0.001),
    ("Iron", "ppb"):   ("mg/L", 0.001),
    ("Manganese", "mg/L"): ("mg/L", 1.0),
    ("Manganese", "ppm"):  ("mg/L", 1.0),
    ("Manganese", "ug/L"): ("mg/L", 0.001),
    ("Manganese", "ppb"):  ("mg/L", 0.001),
    ("Zinc", "mg/L"):  ("mg/L", 1.0),
    ("Zinc", "ppm"):   ("mg/L", 1.0),
    ("Zinc", "ug/L"):  ("mg/L", 0.001),
    ("Zinc", "ppb"):   ("mg/L", 0.001),
}

_VALUE_PATTERN = re.compile(r"^\s*([<≤])?\s*([-+]?[0-9]*\.?[0-9]+)\s*$")
_VALUE_UNIT_SUFFIX_RE = re.compile(
    r"\s*(mg\s*/\s*l|ug\s*/\s*l|µg\s*/\s*l|μg\s*/\s*l|mcg\s*/\s*l|ppb|ppm|deg\s*c|°c|c)\s*$",
    re.IGNORECASE,
)

DEFAULT_ANALYTES = ["Lead", "Iron", "Copper", "Manganese", "Zinc"]
TRACKED_ANALYTES = DEFAULT_ANALYTES

_SAMPLE_ID_COLUMNS = [
    "Client Sample ID", "Customer SampleNo", "Customer Sample No",
    "Customer Sample ID", "Sample Name", "Sample ID", "Location ID",
    "Fixture ID",
]
_LAB_ID_COLUMNS = [
    "Lab Sample ID", "Lab SampleNo", "Lab Sample No", "Sample Number",
    "Laboratory Sample ID",
]
_ANALYTE_COLUMNS = ["Analyte", "Parameter", "Test"]
_RESULT_COLUMNS = ["Result", "Test Result", "Value", "Concentration"]
_UNIT_COLUMNS = ["Unit", "Units", "Test Unit", "Result Unit"]
_ANALYSIS_DATE_COLUMNS = [
    "Analysis Date", "AnalysisDate", "Date Analyzed", "Analyzed Date",
]
_SAMPLE_DATE_COLUMNS = [
    "Sample Date", "Collection Date", "Collected Date", "Date",
]
_BUILDING_COLUMNS = [
    "Building Name", "Building", "Facility Name", "Facility",
    "School Name", "School", "Site Name", "Site",
]

_ANALYTE_ALIASES = {
    "lead": "Lead",
    "pb": "Lead",
    "iron": "Iron",
    "fe": "Iron",
    "copper": "Copper",
    "cu": "Copper",
    "manganese": "Manganese",
    "mn": "Manganese",
    "zinc": "Zinc",
    "zn": "Zinc",
    "ph": "pH",
    "temperature": "Temperature",
    "temp": "Temperature",
    "watertemperature": "Temperature",
    "alkalinity": "Alkalinity",
    "totalalkalinity": "Alkalinity",
    "hardness": "Hardness",
    "calcium": "Calcium",
    "ca": "Calcium",
    "magnesium": "Magnesium",
    "mg": "Magnesium",
    "sodium": "Sodium",
    "na": "Sodium",
    "potassium": "Potassium",
    "k": "Potassium",
    "chloride": "Chloride",
    "cl": "Chloride",
    "sulfate": "Sulfate",
    "so4": "Sulfate",
    "nitrate": "Nitrate",
    "arsenic": "Arsenic",
    "as": "Arsenic",
}


def _default_unit_for(analyte: str) -> str:
    if analyte == "Lead":
        return "ppb"
    if analyte == "pH":
        return ""
    if analyte == "Temperature":
        return "C"
    return "mg/L"


def _normalize_unit(unit: str | None, analyte: str) -> str:
    if unit is None or (not isinstance(unit, str) and pd.isna(unit)):
        return _default_unit_for(analyte)

    s = str(unit).strip()
    if not s:
        return _default_unit_for(analyte)
    s = s.replace("µ", "u").replace("μ", "u")
    compact = re.sub(r"\s+", "", s.lower())
    if compact in {"mg/l", "mg/liter", "mg/litre", "mgperliter", "milligrams/liter"}:
        return "mg/L"
    if compact in {"ug/l", "mcg/l", "ug/liter", "micrograms/liter"}:
        return "ug/L"
    if compact == "ppm":
        return "ppm"
    if compact == "ppb":
        return "ppb"
    if compact in {"degc", "c", "celsius", "°c"}:
        return "C"
    return s


def _parse_value(raw, analyte: str, unit: str | None) -> Measurement:
    """Turn '<0.001' or 0.024 or '4' into a Measurement.

    Returns canonical units. Raises ValueError on unparseable input.
    """
    unit = _normalize_unit(unit, analyte)
    key = (analyte, unit)
    if key in _UNIT_NORMALIZE:
        canonical_unit, factor = _UNIT_NORMALIZE[key]
    elif analyte in CANONICAL_UNITS:
        raise ValueError(f"Unknown analyte/unit combination: {analyte} {unit!r}")
    else:
        canonical_unit, factor = unit, 1.0

    # Numeric value straight from xlsx
    if raw is None or (not isinstance(raw, str) and pd.isna(raw)):
        raise ValueError(f"Missing result for {analyte}")
    if isinstance(raw, (int, float)):
        return Measurement(
            analyte=analyte, value=float(raw) * factor, unit=canonical_unit,
            below_dl=False, detection_limit=None, method="EPA 200.8",
        )

    s = str(raw).strip().replace(",", "")
    if s.lower() in {"", "nan", "none", "n/a", "na", "nr", "--", "not reported"}:
        raise ValueError(f"Missing result for {analyte}")
    if s.upper() in {"ND", "N.D.", "NOT DETECTED", "NON-DETECT", "NON DETECT"}:
        return Measurement(
            analyte=analyte, value=None, unit=canonical_unit,
            below_dl=True, detection_limit=None, method="EPA 200.8",
        )
    s = _VALUE_UNIT_SUFFIX_RE.sub("", s)
    m = _VALUE_PATTERN.match(s)
    if not m:
        raise ValueError(f"Cannot parse value {raw!r} for {analyte}")
    is_below, num = m.group(1), float(m.group(2))
    converted = num * factor
    return Measurement(
        analyte=analyte,
        value=None if is_below else converted,
        unit=canonical_unit,
        below_dl=bool(is_below),
        detection_limit=converted if is_below else None,
        method="EPA 200.8",
    )


_VOLUME_PATTERNS = [
    # ART_PF_322_250mL  (most common)
    re.compile(r"^(?P<id>.+?)[_\s\-]+(?P<vol>\d+)\s*mL\s*$", re.IGNORECASE),
    # HUT_MF_166_1L     (1L = 1000 mL)
    re.compile(r"^(?P<id>.+?)[_\s\-]+(?P<vol>\d+)\s*L\s*$",  re.IGNORECASE),
    # SIG1 - BRS - 250mL  (older hyphen format)
    re.compile(r"^(?P<id>.+?)\s*-\s*(?P<vol>\d+)\s*mL\s*$",  re.IGNORECASE),
]

# Special: detect the older "SIG1 - BRS - 250mL" pattern and normalize to underscores
_HYPHEN_FORMAT = re.compile(r"\s*-\s*")


def _parse_client_id(client_id: str) -> tuple[str, int]:
    """Parse a Client Sample ID into (fixture_id, volume_ml).

    Handles every format we've seen from IEH:
      ART_PF_322_250mL    -> ('ART_PF_322', 250)
      HUT_MF_166_1L       -> ('HUT_MF_166', 1000)
      SIG_BRS_2_250mL     -> ('SIG_BRS_2', 250)
      SIG1 - BRS - 250mL  -> ('SIG1_BRS', 250)
      SIG1_PF_1L          -> ('SIG1_PF', 1000)
      SIG1_PF_200         -> ('SIG1_PF_200', 0)   # no volume suffix; treated as fixture id

    Returns volume=0 when no volume suffix is present.
    """
    s = client_id.strip()

    # Normalize hyphen-with-spaces format to underscores so the rest of the
    # pipeline (which keys fixtures by underscore-separated prefix) works.
    if " - " in s or "- " in s or " -" in s:
        s = _HYPHEN_FORMAT.sub("_", s)

    # Try volume patterns
    for pat in _VOLUME_PATTERNS:
        m = pat.match(s)
        if not m:
            continue
        fixture = m.group("id").rstrip("_- ").strip()
        vol = int(m.group("vol"))
        # Convert "L" suffix to mL
        if pat.pattern.endswith(r"L\s*$", ) or "L\\s*$" in pat.pattern:
            # crude check: pattern that matched ended in L, not mL
            if re.search(r"\d+\s*L\s*$", s, re.IGNORECASE) and \
               not re.search(r"\d+\s*mL\s*$", s, re.IGNORECASE):
                vol *= 1000
        return fixture, vol

    # No recognizable volume suffix — treat the whole thing as fixture_id
    return s, 0


def _to_date(v) -> Optional[date]:
    if v is None or pd.isna(v):
        return None
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, str):
        for fmt in (
            "%Y-%m-%d", "%m/%d/%Y", "%-m/%-d/%Y",
            "%m/%d/%y", "%-m/%-d/%y", "%B %d, %Y", "%b %d, %Y",
        ):
            try:
                return datetime.strptime(v.strip(), fmt).date()
            except ValueError:
                pass
    return None


def _clean_text(v) -> str:
    if v is None or (not isinstance(v, str) and pd.isna(v)):
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def _norm_header(v) -> str:
    s = _clean_text(v).replace("µ", "u").replace("μ", "u")
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def _dedupe_columns(columns) -> list[str]:
    seen: dict[str, int] = {}
    out: list[str] = []
    for i, col in enumerate(columns):
        base = _clean_text(col) or f"column_{i + 1}"
        count = seen.get(base, 0)
        seen[base] = count + 1
        out.append(base if count == 0 else f"{base}_{count + 1}")
    return out


def _prepare_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df = df.dropna(how="all").copy()
    df.columns = _dedupe_columns(df.columns)
    return df


def _find_col(columns, candidates: list[str]) -> str | None:
    by_norm = {_norm_header(c): c for c in columns}
    for candidate in candidates:
        hit = by_norm.get(_norm_header(candidate))
        if hit:
            return hit
    return None


def _canonical_analyte(label) -> str | None:
    raw = _clean_text(label)
    if not raw:
        return None
    without_parens = re.sub(r"\([^)]*\)", "", raw)
    norm = _norm_header(without_parens)
    for suffix in ("microgramsperliter", "milligramsperliter", "mgl", "ugl", "mcgl", "ppb", "ppm"):
        if norm.endswith(suffix):
            norm = norm[: -len(suffix)]
            break
    if norm in _ANALYTE_ALIASES:
        return _ANALYTE_ALIASES[norm]
    cleaned = re.sub(r"\([^)]*\)", "", raw).strip()
    if not cleaned:
        return None
    skip = {
        "date", "analysis date", "sample date", "units", "unit",
        "sample id", "sample name", "client sample id", "fixture id",
        "location id", "lab sample id", "test", ".",
    }
    if cleaned.lower() in skip:
        return None
    return cleaned[:1].upper() + cleaned[1:]


def _unit_from_text(label, analyte: str) -> str | None:
    raw = _clean_text(label)
    if not raw:
        return None
    paren = re.search(r"\(([^)]*)\)", raw)
    if paren:
        return _normalize_unit(paren.group(1), analyte)
    m = re.search(
        r"(mg\s*/\s*l|ug\s*/\s*l|µg\s*/\s*l|μg\s*/\s*l|mcg\s*/\s*l|ppb|ppm)",
        raw,
        re.IGNORECASE,
    )
    if m:
        return _normalize_unit(m.group(1), analyte)
    return None


def _date_from_row(row, columns: list[str]) -> tuple[Optional[date], Optional[date]]:
    analysis_col = _find_col(columns, _ANALYSIS_DATE_COLUMNS)
    sample_col = _find_col(columns, _SAMPLE_DATE_COLUMNS)
    analysis_date = _to_date(row.get(analysis_col)) if analysis_col else None
    collection_date = _to_date(row.get(sample_col)) if sample_col else None
    if sample_col == analysis_col:
        collection_date = None
    return collection_date, analysis_date


def _building_from_row(row, columns: list[str]) -> str:
    building_col = _find_col(columns, _BUILDING_COLUMNS)
    return _clean_text(row.get(building_col)) if building_col else ""


def _merge_measurement(sample: Sample, measurement: Measurement):
    """Keep one cell per analyte, replacing a previous generic duplicate."""
    for i, existing in enumerate(sample.measurements):
        if existing.analyte == measurement.analyte:
            sample.measurements[i] = measurement
            return
    sample.measurements.append(measurement)


def _parse_generic_long(df: pd.DataFrame) -> list[Sample]:
    columns = list(df.columns)
    sample_col = _find_col(columns, _SAMPLE_ID_COLUMNS)
    analyte_col = _find_col(columns, _ANALYTE_COLUMNS)
    result_col = _find_col(columns, _RESULT_COLUMNS)
    if not (sample_col and analyte_col and result_col):
        return []

    lab_col = _find_col(columns, _LAB_ID_COLUMNS)
    unit_col = _find_col(columns, _UNIT_COLUMNS)
    samples: dict[tuple[str, str], Sample] = {}

    for _, row in df.iterrows():
        client_id = _clean_text(row.get(sample_col))
        if not client_id:
            continue
        analyte = _canonical_analyte(row.get(analyte_col))
        if not analyte:
            continue

        unit = _clean_text(row.get(unit_col)) if unit_col else None
        unit = unit or _unit_from_text(row.get(analyte_col), analyte)
        try:
            meas = _parse_value(row.get(result_col), analyte, unit)
        except ValueError:
            continue

        lab_id = _clean_text(row.get(lab_col)) if lab_col else client_id
        key = (lab_id or client_id, client_id)
        if key not in samples:
            fixture_id, volume = _parse_client_id(client_id)
            collection_date, analysis_date = _date_from_row(row, columns)
            building_name = _building_from_row(row, columns)
            samples[key] = Sample(
                sample_id=lab_id or client_id,
                client_sample_id=client_id,
                fixture_id=fixture_id,
                volume_ml=volume,
                collection_date=collection_date,
                analysis_date=analysis_date,
                measurements=[],
                building_name=building_name,
                source_fields=(
                    {"building_name": building_name} if building_name else {}
                ),
            )
        _merge_measurement(samples[key], meas)

    return [s for s in samples.values() if s.measurements]


def _parse_generic_wide(df: pd.DataFrame) -> list[Sample]:
    columns = list(df.columns)
    sample_col = _find_col(columns, _SAMPLE_ID_COLUMNS)
    if not sample_col:
        return []

    lab_col = _find_col(columns, _LAB_ID_COLUMNS)
    unit_col = _find_col(columns, _UNIT_COLUMNS)
    building_col = _find_col(columns, _BUILDING_COLUMNS)
    analyte_cols: dict[str, str] = {}
    for col in columns:
        if col in {sample_col, lab_col, unit_col, building_col}:
            continue
        if _find_col([col], _ANALYSIS_DATE_COLUMNS + _SAMPLE_DATE_COLUMNS):
            continue
        analyte = _canonical_analyte(col)
        if analyte and analyte not in analyte_cols:
            analyte_cols[analyte] = col

    if not analyte_cols:
        return []

    samples: list[Sample] = []
    for _, row in df.iterrows():
        client_id = _clean_text(row.get(sample_col))
        if not client_id:
            continue
        lab_id = _clean_text(row.get(lab_col)) if lab_col else client_id
        fixture_id, volume = _parse_client_id(client_id)
        collection_date, analysis_date = _date_from_row(row, columns)
        building_name = _building_from_row(row, columns)
        s = Sample(
            sample_id=lab_id or client_id,
            client_sample_id=client_id,
            fixture_id=fixture_id,
            volume_ml=volume,
            collection_date=collection_date,
            analysis_date=analysis_date,
            measurements=[],
            building_name=building_name,
            source_fields=(
                {"building_name": building_name} if building_name else {}
            ),
        )
        ordered_analytes = [a for a in DEFAULT_ANALYTES if a in analyte_cols]
        ordered_analytes.extend(a for a in analyte_cols if a not in ordered_analytes)
        for analyte in ordered_analytes:
            col = analyte_cols.get(analyte)
            unit = _unit_from_text(col, analyte)
            if not unit and unit_col and analyte not in {"pH", "Temperature"}:
                unit = _clean_text(row.get(unit_col))
            try:
                _merge_measurement(s, _parse_value(row.get(col), analyte, unit))
            except ValueError:
                continue
        if s.measurements:
            samples.append(s)
    return samples


def parse_generic_dataframe(df: pd.DataFrame) -> list[Sample]:
    """Parse a generic lab results table in either long or wide format.

    Raises ValueError when the table does not expose enough recognizable
    columns to parse confidently.
    """
    df = _prepare_dataframe(df)
    long_samples = _parse_generic_long(df)
    wide_samples = _parse_generic_wide(df)

    def measurement_count(samples: list[Sample]) -> int:
        return sum(len(s.measurements) for s in samples)

    samples = (
        long_samples
        if measurement_count(long_samples) >= measurement_count(wide_samples)
        else wide_samples
    )
    if not samples:
        raise ValueError(
            "No recognizable generic lab table found. Expected either long "
            "format columns like Sample Name, Parameter, Result, Units, Date "
            "or wide format columns like Sample ID, Lead/Pb, Iron/Fe, "
            "Copper/Cu, Manganese/Mn, Zinc/Zn."
        )
    return samples


def parse_generic_lab_file(path: str | Path) -> list[Sample]:
    """Parse a generic non-IEH CSV/XLS/XLSX lab file."""
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == ".csv":
        df = pd.read_csv(path)
    elif suffix in {".xlsx", ".xls"}:
        df = pd.read_excel(path)
    else:
        raise ValueError(f"Unsupported generic lab file type: {suffix}")
    return parse_generic_dataframe(df)


def parse_ieh_xlsx(path: str | Path) -> list[Sample]:
    """Parse the long-format IEH xlsx export."""
    df = pd.read_excel(path)
    required = {"Lab SampleNo", "Customer SampleNo", "Test", "Test Result", "Test Unit"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"xlsx missing required columns: {missing}")

    samples: dict[str, Sample] = {}
    for _, row in df.iterrows():
        lab_id = str(row["Lab SampleNo"])
        client_id = str(row["Customer SampleNo"])
        analyte = str(row["Test"])
        if analyte not in CANONICAL_UNITS:
            continue  # skip analytes we don't track

        fixture_id, volume = _parse_client_id(client_id)

        if lab_id not in samples:
            samples[lab_id] = Sample(
                sample_id=lab_id,
                client_sample_id=client_id,
                fixture_id=fixture_id,
                volume_ml=volume,
                collection_date=_to_date(row.get("Receiving Date")),
                analysis_date=_to_date(row.get("AnalysisDate")),
                measurements=[],
            )

        meas = _parse_value(row["Test Result"], analyte, str(row["Test Unit"]))
        meas.method = str(row.get("Test Method", "EPA 200.8"))
        samples[lab_id].measurements.append(meas)

    return list(samples.values())


def parse_ieh_wide_csv(path: str | Path) -> list[Sample]:
    """Parse the wide-format IEH csv (one row per sample, columns per analyte).

    Expected columns: Lab Sample ID, Client Sample ID, Analysis Date,
    Copper (mg/L), Iron (mg/L), Lead (ug/L), Manganese (mg/L), Zinc (mg/L)
    """
    df = pd.read_csv(path)
    samples = []
    column_specs = [
        ("Lead", "ug/L"),
        ("Copper", "mg/L"),
        ("Iron", "mg/L"),
        ("Manganese", "mg/L"),
        ("Zinc", "mg/L"),
    ]

    for _, row in df.iterrows():
        client_id = str(row["Client Sample ID"])
        fixture_id, volume = _parse_client_id(client_id)
        s = Sample(
            sample_id=str(row["Lab Sample ID"]),
            client_sample_id=client_id,
            fixture_id=fixture_id,
            volume_ml=volume,
            collection_date=None,
            analysis_date=_to_date(row.get("Analysis Date")),
            measurements=[],
        )
        for analyte, unit in column_specs:
            # Find the column matching this analyte (handles "Lead (ug/L)" etc)
            col = next((c for c in df.columns if c.startswith(analyte)), None)
            if col is None:
                continue
            try:
                s.measurements.append(_parse_value(row[col], analyte, unit))
            except ValueError:
                continue
        samples.append(s)
    return samples
