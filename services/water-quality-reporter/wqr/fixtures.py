"""Fixtures registry. JSON-backed master list of physical fixtures.

Lab sample IDs map to fixtures by prefix (the volume suffix is stripped first).
This is the source of truth for human-readable location info.
"""
from __future__ import annotations
import json
from pathlib import Path
from typing import Optional

from .models import Fixture


class FixtureRegistry:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self._fixtures: dict[str, Fixture] = {}
        if self.path.exists():
            self._load()

    def _load(self):
        data = json.loads(self.path.read_text())
        self._fixtures = {f["fixture_id"]: Fixture(**f) for f in data}

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = [vars(f) for f in self._fixtures.values()]
        self.path.write_text(json.dumps(data, indent=2))

    def get(self, fixture_id: str) -> Optional[Fixture]:
        return self._fixtures.get(fixture_id)

    def upsert(self, fixture: Fixture):
        self._fixtures[fixture.fixture_id] = fixture

    def all(self) -> list[Fixture]:
        return list(self._fixtures.values())

    def by_building(self, building: str) -> list[Fixture]:
        return [f for f in self._fixtures.values() if f.building == building]

    def unknown_ids(self, sample_fixture_ids: list[str]) -> list[str]:
        """Return fixture_ids referenced by samples but not in registry.

        Use this to fail loudly when a lab sample references a fixture
        you haven't registered — better than silently rendering blank rows.
        """
        return [fid for fid in sample_fixture_ids if fid not in self._fixtures]
