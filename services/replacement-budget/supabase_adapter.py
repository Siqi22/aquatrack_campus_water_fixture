"""Authenticated AquaTrack inventory access for the replacement budget tool."""

from __future__ import annotations

import os
import json
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import request


CATEGORY_TO_BUDGET_TYPE = {
    "PorcelainFountain": "Water Fountain",
    "MetalFountain": "Water Fountain",
    "VendingMachine": "Water Cooler",
    "BottleRefillStation": "Bottle Refill Station",
    "BottleFiller": "Bottle Refill Station",
    "CombinationUnit": "Bottle Refill Station",
    "FilteredTap": "Tap/Sink",
    "WallFountain": "Water Fountain",
    "Other": "Other",
}


def _school_type(name: str) -> str:
    normalized = name.casefold()
    if "elementary" in normalized or "primary" in normalized:
        return "Elementary School"
    if "middle" in normalized or "junior" in normalized:
        return "Middle School"
    if "high" in normalized or "secondary" in normalized:
        return "High School"
    return "School"


class SupabaseAdapter:
    """Use the AquaTrack user's JWT so database RLS remains authoritative."""

    def __init__(self):
        self.url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")

    @property
    def configured(self) -> bool:
        return bool(self.url and self.key)

    def token(self) -> str:
        return request.cookies.get("replacement_budget_access_token", "")

    def headers(self, token: str | None = None) -> dict[str, str]:
        bearer = token or self.token()
        return {"apikey": self.key, "Authorization": f"Bearer {bearer}"}

    def verify_user(self, token: str) -> dict | None:
        if not self.configured or not token:
            return None
        try:
            request_object = Request(
                f"{self.url}/auth/v1/user",
                headers=self.headers(token),
                method="GET",
            )
            with urlopen(request_object, timeout=20) as response:
                return json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, ValueError):
            return None

    def select(self, table: str, params: dict[str, str]) -> list[dict]:
        url = f"{self.url}/rest/v1/{table}?{urlencode(params)}"
        request_object = Request(
            url,
            headers={**self.headers(), "Accept": "application/json"},
            method="GET",
        )
        with urlopen(request_object, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))

    def schools(self) -> list[dict]:
        rows = self.select(
            "campuses",
            {
                "select": "id,name,school,school_district,address",
                "organization_mode": "eq.school_district",
                "order": "school.asc",
            },
        )
        return [
            {
                "id": row["id"],
                "name": row.get("school") or row.get("name") or "School",
                "type": _school_type(row.get("school") or row.get("name") or ""),
                "address": row.get("address") or "Address not recorded",
                "district_name": row.get("school_district") or "School District",
            }
            for row in rows
        ]

    def _sample_dates(self, fixture_ids: Iterable[str]) -> dict[str, str]:
        fixture_ids = list(fixture_ids)
        if not fixture_ids:
            return {}
        rows = self.select(
            "lead_testing_rounds",
            {
                "select": "fixture_id,sample_draw_date,round_number",
                "fixture_id": f"in.({','.join(fixture_ids)})",
                "sample_draw_date": "not.is.null",
                "deleted_at": "is.null",
                "order": "fixture_id.asc,round_number.desc",
            },
        )
        dates: dict[str, str] = {}
        for row in rows:
            dates.setdefault(row["fixture_id"], row.get("sample_draw_date") or "")
        return dates

    def catalog(self) -> dict:
        schools = self.schools()
        school_ids = [school["id"] for school in schools]
        if not school_ids:
            return {
                "district_name": "School District",
                "schools": [],
                "school_by_id": {},
                "fixtures": [],
                "fixture_by_id": {},
            }

        rows = self.select(
            "fixtures",
            {
                "select": (
                    "id,campus_id,building_id,floor,nearest_room,category,"
                    "serial_number,current_result_ppb"
                ),
                "campus_id": f"in.({','.join(school_ids)})",
                "order": "campus_id.asc,building_id.asc,floor.asc,nearest_room.asc",
            },
        )
        fixture_school_ids = {row.get("campus_id") for row in rows}
        schools = [school for school in schools if school["id"] in fixture_school_ids]
        school_ids = [school["id"] for school in schools]
        if not school_ids:
            return {
                "district_name": "School District",
                "schools": [],
                "school_by_id": {},
                "fixtures": [],
                "fixture_by_id": {},
            }

        buildings = self.select(
            "buildings",
            {
                "select": "id,campus_id,name",
                "campus_id": f"in.({','.join(school_ids)})",
            },
        )
        building_names = {row["id"]: row.get("name") or "Building" for row in buildings}
        rows_with_results = [
            row
            for row in rows
            if row.get("campus_id") in fixture_school_ids
            and row.get("current_result_ppb") is not None
        ]
        sample_dates = self._sample_dates(row["id"] for row in rows_with_results)
        fixtures = []
        for row in rows_with_results:
            building = building_names.get(row.get("building_id"), "Building")
            floor = str(row.get("floor") or "").strip()
            room = str(row.get("nearest_room") or "").strip()
            location_parts = [building]
            if floor:
                location_parts.append(f"Floor {floor}")
            if room:
                location_parts.append(room)
            fixtures.append(
                {
                    "id": row["id"],
                    "display_id": row.get("serial_number") or row["id"][:8],
                    "school_id": row["campus_id"],
                    "location": " · ".join(location_parts),
                    "fixture_type": CATEGORY_TO_BUDGET_TYPE.get(
                        str(row.get("category") or "Other"), "Other"
                    ),
                    "lead_ppb": float(row["current_result_ppb"]),
                    "sample_date": sample_dates.get(row["id"]) or "—",
                }
            )

        school_by_id = {school["id"]: school for school in schools}
        fixture_by_id = {fixture["id"]: fixture for fixture in fixtures}
        district_names = sorted(
            {
                school["district_name"].strip()
                for school in schools
                if school.get("district_name")
                and school["district_name"].strip()
                and school["district_name"] != "School District"
            }
        )
        return {
            "district_name": district_names[0] if len(district_names) == 1 else "Multiple School Districts",
            "schools": schools,
            "school_by_id": school_by_id,
            "fixtures": fixtures,
            "fixture_by_id": fixture_by_id,
        }
