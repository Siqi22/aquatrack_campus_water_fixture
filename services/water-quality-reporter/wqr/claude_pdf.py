"""Format-agnostic Claude extraction for school water-testing PDFs.

Claude reads the PDF visually and is forced to return a strict, canonical
fixture-result schema.  Format-specific local parsers live elsewhere and are
only an offline/service-failure fallback; no PDF column positions, table
headers, or page numbers are used in this primary extraction path.
"""
from __future__ import annotations

import base64
import os
import re
from pathlib import Path
from typing import Any

from .models import CANONICAL_UNITS, Sample
from .parsers import _canonical_analyte, _parse_client_id, _parse_value, _to_date


# Anthropic API ID (not a caller-selected alias) keeps extraction reproducible.
MODEL = "claude-haiku-4-5-20251001"
TOOL_NAME = "record_school_water_results"
MAX_PDF_BYTES = 23 * 1024 * 1024
MAX_SAMPLES = 3000
MAX_TEXT = 500


class ClaudePDFError(RuntimeError):
    """Safe base error for PDF extraction failures."""


class ClaudePDFConfigurationError(ClaudePDFError):
    """Raised when the server-side Claude API configuration is unavailable."""


class ClaudePDFResponseError(ClaudePDFError):
    """Raised when Claude's output cannot be validated."""


# Every object is closed and every property is required because Anthropic's
# strict tool mode validates the model output against this schema. Fields that
# may be absent in a source document are explicitly nullable.
EXTRACTION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "school_name": {"type": ["string", "null"]},
        "samples": {
            "type": "array",
            "maxItems": MAX_SAMPLES,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "source_page": {"type": ["integer", "null"], "minimum": 1},
                    "sample_id": {"type": "string"},
                    "client_sample_id": {"type": ["string", "null"]},
                    "fixture_id": {"type": ["string", "null"]},
                    "building_name": {"type": ["string", "null"]},
                    "fixture_label": {"type": ["string", "null"]},
                    "collection_date": {"type": ["string", "null"]},
                    "analysis_date": {"type": ["string", "null"]},
                    "measurements": {
                        "type": "array",
                        "minItems": 1,
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "analyte": {"type": "string"},
                                "reported_result": {"type": "string"},
                                "unit": {"type": ["string", "null"]},
                                "method": {"type": ["string", "null"]},
                            },
                            "required": ["analyte", "reported_result", "unit", "method"],
                        },
                    },
                },
                "required": [
                    "source_page", "sample_id", "client_sample_id", "fixture_id",
                    "building_name", "fixture_label", "collection_date",
                    "analysis_date", "measurements",
                ],
            },
        },
    },
    "required": ["school_name", "samples"],
}


_SYSTEM_PROMPT = """You extract fixture-level school drinking-water test results.
The PDF may come from any laboratory, state agency, school, or district and may
use any visual layout, table structure, headings, identifier style, or order.

Read the entire PDF semantically. Record only rows tied to an actual sampled
fixture, outlet, tap, fountain, sink, or other sampling location. Ignore cover
letters, definitions, thresholds, explanatory examples, health guidance,
recommendations, remediation text, and narrative numbers. A page belongs in
the result set only when at least one returned sample row is visibly on it.

Preserve source sample identifiers, reported result strings, inequality signs,
units, dates, fixture descriptions, and locations. Never invent, calculate, or
convert a result. Use the visible 1-based PDF page number for source_page. If a
source field is absent, return null; sample_id must use the best visible row or
fixture identifier and must never be fabricated. Return all supported water
measurements visible for each sampled fixture. For each sample's building_name,
use the value in that row's Building Name, Building, Facility, School, or
equivalent column. Use the document-level school_name only when the row has no
building field.
"""


def _limited_text(value: Any, field: str, *, required: bool = False) -> str:
    if value is None:
        value = ""
    if not isinstance(value, (str, int, float)):
        raise ClaudePDFResponseError(f"Claude returned an invalid {field}.")
    text = re.sub(r"\s+", " ", str(value)).strip()
    if required and not text:
        raise ClaudePDFResponseError(f"Claude omitted {field}.")
    return text[:MAX_TEXT]


def _tool_payload(response: Any) -> dict:
    for block in getattr(response, "content", []) or []:
        if (
            getattr(block, "type", None) == "tool_use"
            and getattr(block, "name", None) == TOOL_NAME
        ):
            payload = getattr(block, "input", None)
            if isinstance(payload, dict):
                return payload
    raise ClaudePDFResponseError("Claude returned no schema-validated extraction.")


def _validated_samples(payload: dict) -> list[Sample]:
    raw_samples = payload.get("samples")
    if not isinstance(raw_samples, list) or not raw_samples:
        raise ClaudePDFResponseError("Claude returned no testing result rows.")
    if len(raw_samples) > MAX_SAMPLES:
        raise ClaudePDFResponseError("The PDF contains too many result rows.")

    document_school = _limited_text(payload.get("school_name"), "school name")
    samples: list[Sample] = []
    for row_index, row in enumerate(raw_samples, start=1):
        if not isinstance(row, dict):
            raise ClaudePDFResponseError(f"Claude returned an invalid row {row_index}.")
        source_page = row.get("source_page")
        if source_page is not None and (
            isinstance(source_page, bool)
            or not isinstance(source_page, int)
            or source_page < 1
        ):
            raise ClaudePDFResponseError(f"Claude returned an invalid source page in row {row_index}.")

        sample_id = _limited_text(row.get("sample_id"), "sample ID", required=True)
        client_id = _limited_text(row.get("client_sample_id"), "client sample ID") or sample_id
        fixture_id = _limited_text(row.get("fixture_id"), "fixture ID")
        if not fixture_id:
            safe_id = re.sub(r"[^A-Za-z0-9]+", "_", sample_id).strip("_")
            fixture_id = f"CLAUDE_{safe_id or row_index}"
        parsed_fixture, volume_ml = _parse_client_id(fixture_id)

        raw_measurements = row.get("measurements")
        if not isinstance(raw_measurements, list) or not raw_measurements:
            raise ClaudePDFResponseError(f"Claude omitted measurements for row {row_index}.")
        measurements = []
        for raw_measurement in raw_measurements:
            if not isinstance(raw_measurement, dict):
                raise ClaudePDFResponseError(f"Claude returned an invalid measurement in row {row_index}.")
            source_analyte = _limited_text(
                raw_measurement.get("analyte"), "analyte", required=True
            )
            analyte = _canonical_analyte(source_analyte)
            if analyte not in CANONICAL_UNITS:
                continue
            reported = _limited_text(
                raw_measurement.get("reported_result"), "reported result", required=True
            )
            unit = _limited_text(raw_measurement.get("unit"), "unit", required=True)
            try:
                measurement = _parse_value(reported, analyte, unit)
            except ValueError as exc:
                raise ClaudePDFResponseError(
                    f"Claude returned an invalid result in row {row_index}."
                ) from exc
            method = _limited_text(raw_measurement.get("method"), "method")
            if method:
                measurement.method = method
            measurements.append(measurement)
        if not measurements:
            raise ClaudePDFResponseError(
                f"Claude returned no supported measurements in row {row_index}."
            )

        collection_date = _to_date(row.get("collection_date"))
        analysis_date = _to_date(row.get("analysis_date"))
        for field_name, raw_date, parsed_date in (
            ("collection date", row.get("collection_date"), collection_date),
            ("analysis date", row.get("analysis_date"), analysis_date),
        ):
            if raw_date is not None and raw_date != "" and parsed_date is None:
                raise ClaudePDFResponseError(
                    f"Claude returned an invalid {field_name} in row {row_index}."
                )

        reported_building = _limited_text(row.get("building_name"), "building name")
        source_fields = {
            "parser": "claude_pdf",
            "source_row": row_index,
            "source_analytes": [
                _limited_text(m.get("analyte"), "analyte")
                for m in raw_measurements
                if isinstance(m, dict)
            ],
        }
        if reported_building:
            source_fields["building_name"] = reported_building
        if source_page is not None:
            source_fields["source_page"] = source_page
        samples.append(Sample(
            sample_id=sample_id,
            client_sample_id=client_id,
            fixture_id=parsed_fixture,
            volume_ml=volume_ml,
            collection_date=collection_date,
            analysis_date=analysis_date,
            measurements=measurements,
            building_name=reported_building or document_school,
            fixture_label=_limited_text(row.get("fixture_label"), "fixture label"),
            source_fields=source_fields,
        ))
    return samples


def result_pages_from_samples(samples: list[Sample]) -> list[int]:
    """Return sorted PDF pages proven by extracted fixture-level rows."""
    return sorted({
        page
        for sample in samples
        for page in [sample.source_fields.get("source_page")]
        if isinstance(page, int) and not isinstance(page, bool) and page >= 1
    })


def parse_school_water_pdf_with_claude(
    pdf_bytes: bytes,
    filename: str,
    *,
    client: Any | None = None,
) -> list[Sample]:
    """Extract any school testing PDF with pinned Claude Haiku 4.5."""
    if not pdf_bytes.startswith(b"%PDF-"):
        raise ClaudePDFError("The uploaded file does not appear to be a valid PDF.")
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise ClaudePDFError(
            "This PDF is too large for secure inline processing. Please split it into smaller files."
        )

    if client is None:
        api_key = os.environ.get("CLAUDE_API_KEY")
        if not api_key:
            raise ClaudePDFConfigurationError(
                "CLAUDE_API_KEY is not configured for format-agnostic PDF parsing."
            )
        try:
            from anthropic import Anthropic
        except ImportError as exc:
            raise ClaudePDFConfigurationError(
                "Claude PDF dependencies are not installed."
            ) from exc
        client = Anthropic(api_key=api_key)

    encoded = base64.standard_b64encode(pdf_bytes).decode("ascii")
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=16000,
            temperature=0,
            system=_SYSTEM_PROMPT,
            tools=[{
                "name": TOOL_NAME,
                "description": (
                    "Record all fixture-level school drinking-water testing "
                    "rows found anywhere in the supplied PDF."
                ),
                "strict": True,
                "input_schema": EXTRACTION_SCHEMA,
            }],
            tool_choice={
                "type": "tool",
                "name": TOOL_NAME,
                "disable_parallel_tool_use": True,
            },
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": encoded,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "Extract every fixture-level school water-testing "
                            f"result from the complete PDF named {Path(filename).name!r}. "
                            "Use source_page to identify the pages that actually contain "
                            "the returned rows; do not treat introductory or explanatory "
                            "pages as result pages."
                        ),
                    },
                ],
            }],
        )
    except Exception as exc:
        raise ClaudePDFError("Claude PDF parsing is temporarily unavailable.") from exc
    return _validated_samples(_tool_payload(response))
