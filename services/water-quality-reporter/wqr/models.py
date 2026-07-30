"""Canonical data models. Everything else converts to/from these."""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date
from typing import Optional, Literal


# Analytes we track. Lead is canonical in ppb (µg/L); others in mg/L.
# This is a deliberate choice — it matches how regulators write thresholds,
# so we don't have to convert units every time we render or compare.
CANONICAL_UNITS = {
    "Lead": "ppb",
    "Copper": "mg/L",
    "Iron": "mg/L",
    "Manganese": "mg/L",
    "Zinc": "mg/L",
}


@dataclass
class Fixture:
    """A physical drinking water fixture. Looked up by sample_id_prefix."""
    fixture_id: str                    # e.g. "ART_PF_025"
    building: str                      # e.g. "Art Building"
    floor: str                         # e.g. "Basement", "First Floor"
    room: str                          # e.g. "Rm 25"
    fixture_type: str                  # e.g. "porcelain fountain", "bottle filler"
    notes: str = ""                    # free-text for quirks


@dataclass
class Measurement:
    """One analyte result for one sample."""
    analyte: str                       # "Lead", "Copper", etc.
    value: Optional[float]             # None if below detection limit
    unit: str                          # canonical unit
    below_dl: bool                     # True if reported as "<X"
    detection_limit: Optional[float]   # the X in "<X", in canonical unit
    method: str                        # e.g. "EPA 200.8"

    @property
    def display(self) -> str:
        """How to render in a report cell."""
        if self.below_dl and self.value is None:
            if self.detection_limit is None:
                return "not detected"
            return f"<{self._fmt(self.detection_limit)}"
        return self._fmt(self.value)

    def _fmt(self, v: Optional[float]) -> str:
        if v is None:
            return ""
        # Lead: integer ppb. Others: 3 decimals trimmed.
        if self.analyte == "Lead":
            return str(int(round(v)))
        return f"{v:.3f}".rstrip("0").rstrip(".")

    def exceeds(self, threshold: float) -> bool:
        """Below-DL never exceeds, even if DL >= threshold (we don't know)."""
        if self.below_dl or self.value is None:
            return False
        return self.value > threshold


@dataclass
class Sample:
    """One physical sample taken from a fixture."""
    sample_id: str                     # lab's ID, e.g. "1766731-211512"
    client_sample_id: str              # e.g. "ART_PF_322_250mL"
    fixture_id: str                    # FK to Fixture
    volume_ml: int                     # 250 or 1000 typically
    collection_date: Optional[date]
    analysis_date: Optional[date]
    measurements: list[Measurement] = field(default_factory=list)
    building_name: str = ""            # source-provided school/building name
    fixture_label: str = ""            # source-provided fixture/location text
    source_fields: dict = field(default_factory=dict)

    def measurement(self, analyte: str) -> Optional[Measurement]:
        for m in self.measurements:
            if m.analyte == analyte:
                return m
        return None


@dataclass
class ActionLevel:
    """A regulatory or policy threshold for one analyte."""
    analyte: str
    threshold: float
    unit: str
    source: str                        # "EPA LCR", "WA RCW 28A.210.410", etc.
    severity: Literal["warn", "violation"] = "violation"


@dataclass
class ReportContext:
    """Everything needed to render one report."""
    building: str
    report_date: Optional[date]        # None = author fills in date manually in Word
    sampling_date_range: str           # e.g. "April 7, 2026"
    introduction_md: str               # human-written narrative
    actions_taken_md: str              # human-written narrative
    contacts: list[dict]               # [{name, title, phone, email}, ...]
    samples: list[Sample]
    action_levels: list[ActionLevel]
    analytes_shown: list[str]          # which columns to render
    notes_md: str = ""                 # optional footer notes
    report_style: str = "uw"           # "uw" or "wa_school"
    organization: str = ""
    reference_style_applied: bool = False
    reference_layout: str = "report"
    header_template_path: str = ""       # optional DOCX header or PDF letterhead
