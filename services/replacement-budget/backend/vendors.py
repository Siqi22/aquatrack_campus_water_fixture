"""
Vendor lookup for school districts.

Loads certified vendors from mainData.xlsx and matches them to a district
using school cities from the lead dataset. Vendors in the same city are
listed first; remaining slots are filled by closest vendor cities (haversine
distance from the district centroid).
"""

from __future__ import annotations

import math
from pathlib import Path

import pandas as pd

from backend.query_engine import REPO_ROOT, search_district

VENDOR_XLSX = REPO_ROOT / "mainData.xlsx"
VENDOR_SHEET = "Contacts"

_vendors_cache: pd.DataFrame | None = None
_city_coords_cache: pd.DataFrame | None = None


def _normalize_city(city: str | float | None) -> str:
    if city is None or (isinstance(city, float) and math.isnan(city)):
        return ""
    return str(city).strip().casefold()


def _load_vendors() -> pd.DataFrame:
    global _vendors_cache
    if _vendors_cache is None:
        if not VENDOR_XLSX.exists():
            raise FileNotFoundError(f"Vendor file not found: {VENDOR_XLSX}")
        df = pd.read_excel(VENDOR_XLSX, sheet_name=VENDOR_SHEET)
        df["city_norm"] = df["City"].map(_normalize_city)
        _vendors_cache = df
    return _vendors_cache


def _load_city_coordinates() -> pd.DataFrame:
    """Mean lon/lat per school city from the lead dataset."""
    global _city_coords_cache
    if _city_coords_cache is None:
        from backend.query_engine import _load_data

        df = _load_data()[["school_city", "x", "y"]].dropna()
        df["city_norm"] = df["school_city"].map(_normalize_city)
        _city_coords_cache = (
            df.groupby("city_norm", as_index=False)
            .agg(lon=("x", "mean"), lat=("y", "mean"), city_display=("school_city", "first"))
        )
    return _city_coords_cache


def _haversine_miles(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    radius_miles = 3958.8
    lon1, lat1, lon2, lat2 = map(math.radians, (lon1, lat1, lon2, lat2))
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return radius_miles * 2 * math.asin(math.sqrt(a))


def _district_centroid(district_df: pd.DataFrame) -> tuple[float, float] | None:
    coords = district_df[["x", "y"]].dropna()
    if coords.empty:
        return None
    return float(coords["x"].mean()), float(coords["y"].mean())


def _serialize_vendor(row: pd.Series) -> dict:
    def _clean(value: object) -> str | None:
        if value is None or (isinstance(value, float) and math.isnan(value)):
            return None
        text = str(value).strip()
        return text or None

    return {
        "company_name": _clean(row.get("Company Name")) or "",
        "dba_name": _clean(row.get("DBA Name")),
        "email": _clean(row.get("Email Address")),
        "city": _clean(row.get("City")) or "",
        "state": _clean(row.get("State")),
        "web_address": _clean(row.get("Web Address")),
        "status": _clean(row.get("Status")),
        "phone": _clean(row.get("Phone")),
        "matched_city": _clean(row.get("matched_city")),
        "distance_miles": row.get("distance_miles"),
        "in_district_city": bool(row.get("in_district_city")),
    }


def get_vendors_for_district(district_name: str, limit: int = 10) -> dict:
    """
    Return vendors near a district, prioritizing same-city matches.

    Returns:
        {
            "district_cities": list[str],
            "vendors": list[dict],
        }
    """
    result = search_district(district_name)
    if not result["found"]:
        return {"district_cities": [], "vendors": []}

    district_df = result["all_rows"]
    district_cities = sorted(
        city.strip()
        for city in district_df["school_city"].dropna().unique().tolist()
        if str(city).strip()
    )
    district_city_norm = {_normalize_city(c) for c in district_cities}

    centroid = _district_centroid(district_df)
    city_coords = _load_city_coordinates()
    coord_lookup = city_coords.set_index("city_norm")

    vendors = _load_vendors().copy()
    ranked: list[dict] = []

    for _, row in vendors.iterrows():
        city_norm = row["city_norm"]
        if not city_norm:
            continue

        in_district_city = city_norm in district_city_norm
        matched_city = row["City"]
        distance_miles: float | None = None

        if in_district_city:
            for city in district_cities:
                if _normalize_city(city) == city_norm:
                    matched_city = city
                    break
            distance_miles = 0.0
        elif centroid and city_norm in coord_lookup.index:
            city_row = coord_lookup.loc[city_norm]
            distance_miles = round(
                _haversine_miles(centroid[0], centroid[1], city_row["lon"], city_row["lat"]),
                1,
            )

        if in_district_city or distance_miles is not None:
            ranked.append(
                {
                    **row.to_dict(),
                    "matched_city": matched_city,
                    "distance_miles": distance_miles,
                    "in_district_city": in_district_city,
                }
            )

    ranked.sort(
        key=lambda item: (
            0 if item["in_district_city"] else 1,
            item["distance_miles"] if item["distance_miles"] is not None else float("inf"),
            str(item.get("Company Name", "")).casefold(),
        )
    )

    return {
        "district_cities": district_cities,
        "vendors": [_serialize_vendor(pd.Series(v)) for v in ranked[:limit]],
    }
