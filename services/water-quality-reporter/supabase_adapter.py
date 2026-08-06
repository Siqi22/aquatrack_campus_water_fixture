"""Supabase-backed authentication, inventory, and temporary file storage."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable
from urllib.parse import quote

import requests
from flask import request

from wqr.models import Fixture


DEFAULT_SCHOOL_DISTRICT = "North Valley School District"
UNKNOWN_DISTRICTS = {
    "", "unknown", "unknown district", "unknown school district",
    "not recorded", "district not recorded", "school district",
}


def _district_name(value: str | None) -> str:
    district = (value or "").strip()
    return DEFAULT_SCHOOL_DISTRICT if district.casefold() in UNKNOWN_DISTRICTS else district


class SupabaseAdapter:
    def __init__(self):
        self.url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
        self.bucket = os.environ.get("COMMUNICATION_STORAGE_BUCKET", "communication-reports")

    @property
    def configured(self) -> bool:
        return bool(self.url and self.key)

    def token(self) -> str:
        return request.cookies.get("wqr_access_token", "")

    def headers(self, token: str | None = None) -> dict[str, str]:
        bearer = token or self.token()
        return {"apikey": self.key, "Authorization": f"Bearer {bearer}"}

    def verify_user(self, token: str) -> dict | None:
        if not self.configured or not token:
            return None
        response = requests.get(
            f"{self.url}/auth/v1/user",
            headers=self.headers(token),
            timeout=20,
        )
        return response.json() if response.ok else None

    def select(self, table: str, params: dict[str, str]) -> list[dict]:
        response = requests.get(
            f"{self.url}/rest/v1/{table}",
            headers={**self.headers(), "Accept": "application/json"},
            params=params,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def insert(self, table: str, row: dict) -> dict | None:
        response = requests.post(
            f"{self.url}/rest/v1/{table}",
            headers={
                **self.headers(),
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json=row,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        return data[0] if data else None

    def schools(self) -> list[dict]:
        rows = self.select("campuses", {
            "select": "id,name,school,school_district,address",
            "organization_mode": "eq.school_district",
            "order": "school.asc",
        })
        return [{**row, "school_district": _district_name(row.get("school_district"))} for row in rows]

    def school(self, campus_id: str) -> dict | None:
        rows = self.select("campuses", {
            "select": "id,name,school,school_district,address",
            "id": f"eq.{campus_id}",
            "organization_mode": "eq.school_district",
            "limit": "1",
        })
        return {**rows[0], "school_district": _district_name(rows[0].get("school_district"))} if rows else None

    def fixtures(self, campus_id: str | None = None) -> list[dict]:
        campuses = self.schools()
        allowed = {item["id"] for item in campuses}
        if campus_id:
            if campus_id not in allowed:
                return []
            allowed = {campus_id}
        if not allowed:
            return []
        buildings = self.select("buildings", {
            "select": "id,campus_id,name,floors",
            "campus_id": f"in.({','.join(allowed)})",
        })
        building_names = {item["id"]: item["name"] for item in buildings}
        rows = self.select("fixtures", {
            "select": (
                "id,campus_id,building_id,floor,nearest_room,"
                "category,brand,model,serial_number,current_result_ppb,"
                "current_lead_testing_status,current_required_action"
            ),
            "campus_id": f"in.({','.join(allowed)})",
            "order": "building_id.asc,floor.asc,nearest_room.asc",
        })
        for row in rows:
            row["building_name"] = building_names.get(row["building_id"], "Building")
        return rows

    def testing_rounds(self, fixture_ids: Iterable[str]) -> list[dict]:
        fixture_ids = list(fixture_ids)
        if not fixture_ids:
            return []
        allowed = {item["id"] for item in self.fixtures()}
        safe_ids = [item for item in fixture_ids if item in allowed]
        if not safe_ids:
            return []
        return self.select("lead_testing_rounds", {
            "select": (
                "id,fixture_id,round_type,round_number,status,sample_id,"
                "sample_draw_date,result_value,result_original_unit,result_ppb,"
                "result_category,required_action"
            ),
            "fixture_id": f"in.({','.join(safe_ids)})",
            "deleted_at": "is.null",
            "order": "fixture_id.asc,round_number.desc",
        })

    def upload_bytes(self, path: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        response = requests.post(
            f"{self.url}/storage/v1/object/{self.bucket}/{quote(path, safe='/')}",
            headers={**self.headers(), "Content-Type": content_type, "x-upsert": "true"},
            data=data,
            timeout=60,
        )
        response.raise_for_status()

    def download_bytes(self, path: str) -> bytes | None:
        response = requests.get(
            f"{self.url}/storage/v1/object/{self.bucket}/{quote(path, safe='/')}",
            headers=self.headers(),
            timeout=60,
        )
        return response.content if response.ok else None

    def materialize(self, path: str, destination: Path) -> bool:
        data = self.download_bytes(path)
        if data is None:
            return False
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        return True


class SupabaseFixtureRegistry:
    """Implements the original FixtureRegistry interface using AquaTrack rows."""

    def __init__(self, adapter: SupabaseAdapter):
        self.adapter = adapter

    def _selected_ids(self) -> set[str] | None:
        from flask import session
        selected = session.get("selected_fixture_ids") or []
        return set(selected) if selected else None

    def all(self) -> list[Fixture]:
        selected = self._selected_ids()
        output = []
        for row in self.adapter.fixtures():
            if selected is not None and row["id"] not in selected:
                continue
            output.append(Fixture(
                fixture_id=row.get("serial_number") or row["id"],
                building=row.get("building_name") or "Building",
                floor=str(row.get("floor") or ""),
                room=row.get("nearest_room") or "",
                fixture_type=str(row.get("category") or "Fixture"),
                notes=f"AquaTrack fixture {row['id']}",
            ))
        return output

    def get(self, fixture_id: str):
        return next((item for item in self.all() if item.fixture_id == fixture_id), None)

    def by_building(self, building: str) -> list[Fixture]:
        return [item for item in self.all() if item.building == building]

    def unknown_ids(self, sample_fixture_ids: list[str]) -> list[str]:
        known = {item.fixture_id for item in self.all()}
        return [item for item in sample_fixture_ids if item not in known]
