"""Action level evaluation. Thresholds are config, not code.

Multiple ActionLevel entries can apply to the same analyte (e.g., Cu has both
a 1.0 mg/L secondary aesthetic standard AND a 1.3 mg/L primary action level).
When evaluating a measurement, we pick the highest severity exceeded.

Severity ranking: ok < warn < violation. A 'violation' wins over a 'warn' on
the same analyte; an unhighlighted value (ok) means no threshold was exceeded.
"""
from __future__ import annotations
import json
from pathlib import Path
from typing import Optional

from .models import ActionLevel, Sample, Measurement


_SEVERITY_RANK = {"ok": 0, "warn": 1, "violation": 2}


# Built-in profiles. The Flask app uses wa_k12_default without asking the
# author to choose; the older names remain as aliases for compatibility.
#
# The Cu thresholds match the UW master spec:
#   - 1.0 mg/L secondary (aesthetic) -> warn
#   - 1.3 mg/L primary action level  -> violation
# This means Cu values 1.0-1.3 highlight orange; >1.3 highlights red.
#
# Aesthetic standards for Fe (0.3), Mn (0.05), Zn (5.0) are 'warn' only.
# Lead is the only field that meaningfully changes between profiles.

_AESTHETIC_AND_CU = [
    ActionLevel("Iron",      0.3,  "mg/L", "EPA Secondary MCL (aesthetic)", "warn"),
    ActionLevel("Manganese", 0.05, "mg/L", "EPA Secondary MCL (aesthetic)", "warn"),
    ActionLevel("Zinc",      5.0,  "mg/L", "EPA Secondary MCL (aesthetic)", "warn"),
    ActionLevel("Copper",    1.0,  "mg/L", "EPA Secondary MCL (aesthetic)", "warn"),
    ActionLevel("Copper",    1.3,  "mg/L", "EPA primary action level",      "violation"),
]


BUILTIN_PROFILES: dict[str, list[ActionLevel]] = {
    # Default UW review profile for this tool:
    # Pb > 5 ppb is a red action-level exceedance, and Pb > 15 ppb is also
    # red with separate shutoff-concern prose in the DOCX findings section.
    "wa_k12_default": [
        ActionLevel("Lead", 5.0, "ppb",
                    "WA RCW 28A.210.410 (K-12 schools, voluntary for higher-ed)",
                    "violation"),
        ActionLevel("Lead", 15.0, "ppb",
                    "EPA Lead and Copper Rule immediate shutoff concern",
                    "violation"),
        *_AESTHETIC_AND_CU,
    ],

    # WA RCW 28A.210.410 K-12 lead standard - strictest single-tier
    "wa_k12_5ppb": [
        ActionLevel("Lead", 5.0, "ppb",
                    "WA RCW 28A.210.410 (K-12 schools, voluntary for higher-ed)",
                    "violation"),
        *_AESTHETIC_AND_CU,
    ],

    # EPA LCRI 2027 lead action level
    "epa_lcri_10ppb": [
        ActionLevel("Lead", 10.0, "ppb",
                    "EPA Lead and Copper Rule Improvements (effective Nov 2027)",
                    "violation"),
        *_AESTHETIC_AND_CU,
    ],

    # EPA LCR (current rule, still in effect until LCRI compliance)
    "epa_lcr_15ppb": [
        ActionLevel("Lead", 15.0, "ppb",
                    "EPA Lead and Copper Rule (current)",
                    "violation"),
        *_AESTHETIC_AND_CU,
    ],

    # All three Pb thresholds layered: 5 (warn), 10 (warn), 15 (violation).
    # Use this when the report needs to show all three tiers visually.
    "tiered_pb_5_10_15": [
        ActionLevel("Lead",  5.0, "ppb",
                    "WA RCW 28A.210.410 (K-12 voluntary)",
                    "warn"),
        ActionLevel("Lead", 10.0, "ppb",
                    "EPA LCRI (effective Nov 2027)",
                    "warn"),
        ActionLevel("Lead", 15.0, "ppb",
                    "EPA Lead and Copper Rule (current)",
                    "violation"),
        *_AESTHETIC_AND_CU,
    ],
}


def load_profile(name_or_path: str) -> list[ActionLevel]:
    """Load by builtin name or from a JSON file."""
    if name_or_path in BUILTIN_PROFILES:
        return BUILTIN_PROFILES[name_or_path]
    p = Path(name_or_path)
    if p.exists():
        return [ActionLevel(**a) for a in json.loads(p.read_text())]
    raise ValueError(f"Unknown profile: {name_or_path}")


def evaluate_measurement(m: Measurement, levels: list[ActionLevel]) -> str:
    """Return 'ok' | 'warn' | 'violation' for one measurement.

    When multiple levels apply to the same analyte, returns the most severe
    severity that the value exceeds.
    """
    matching = [l for l in levels if l.analyte == m.analyte]
    if not matching:
        return "ok"

    worst = "ok"
    for level in matching:
        if m.exceeds(level.threshold):
            if _SEVERITY_RANK[level.severity] > _SEVERITY_RANK[worst]:
                worst = level.severity
    return worst


def evaluate_sample(sample: Sample, levels: list[ActionLevel]) -> dict[str, str]:
    """Return {analyte: severity} for each analyte measured in this sample."""
    return {m.analyte: evaluate_measurement(m, levels) for m in sample.measurements}


def violation_summary(samples: list[Sample], levels: list[ActionLevel]) -> dict:
    """Aggregate stats for the report's auto-generated prose.

    Groups by (analyte, threshold) so a tiered Pb profile generates one
    summary line per tier.
    """
    by_key: dict = {}
    seen_order: list = []
    for level in levels:
        key = (level.analyte, level.threshold, level.unit)
        if key not in by_key:
            seen_order.append(key)
            by_key[key] = {
                "level": level,
                "violators": [],
                "count": 0,
            }
        for s in samples:
            mm = s.measurement(level.analyte)
            if mm and mm.exceeds(level.threshold):
                if s not in by_key[key]["violators"]:
                    by_key[key]["violators"].append(s)
                    by_key[key]["count"] += 1
    # Return only the analyte-level summary used by the existing template:
    # collapse by analyte, take the most-severe level that anyone exceeded.
    out: dict[str, dict] = {}
    for key in seen_order:
        analyte = key[0]
        info = by_key[key]
        if info["count"] == 0:
            continue
        # Keep the most severe per analyte (last-written wins if same severity)
        existing = out.get(analyte)
        if (existing is None
                or _SEVERITY_RANK[info["level"].severity]
                   > _SEVERITY_RANK[existing["level"].severity]):
            out[analyte] = info
    return out
