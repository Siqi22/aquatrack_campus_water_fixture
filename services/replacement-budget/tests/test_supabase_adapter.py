import os
import unittest
from unittest.mock import patch

from supabase_adapter import SupabaseAdapter


class SupabaseBudgetCatalogTests(unittest.TestCase):
    def test_catalog_maps_aquatrack_inventory_into_original_budget_shape(self):
        with patch.dict(
            os.environ,
            {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_PUBLISHABLE_KEY": "key"},
        ):
            adapter = SupabaseAdapter()

        def rows(table, _params):
            if table == "campuses":
                self.assertEqual(
                    _params["school_district"],
                    "eq.North Valley School District",
                )
                return [
                    {
                        "id": "school-1",
                        "name": "Campus 1",
                        "school": "Maple Grove Middle School",
                        "school_district": "North Valley School District",
                        "address": "100 School Way",
                    },
                    {
                        "id": "school-outside-district",
                        "name": "Outside Campus",
                        "school": "Cedarhome Elementary School",
                        "school_district": "Stanwood-Camano School District",
                        "address": "200 Other Way",
                    },
                ]
            if table == "buildings":
                return [{"id": "building-1", "campus_id": "school-1", "name": "Learning Commons"}]
            if table == "fixtures":
                return [{
                    "id": "fixture-1",
                    "campus_id": "school-1",
                    "building_id": "building-1",
                    "floor": "2",
                    "nearest_room": "Hallway 210",
                    "category": "BottleRefillStation",
                    "serial_number": "NV-210",
                    "current_result_ppb": 12,
                }]
            if table == "lead_testing_rounds":
                return [{"fixture_id": "fixture-1", "sample_draw_date": "2026-04-10", "round_number": 1}]
            raise AssertionError(table)

        with patch.object(adapter, "select", side_effect=rows):
            catalog = adapter.catalog()

        self.assertEqual(catalog["district_name"], "North Valley School District")
        self.assertEqual(len(catalog["schools"]), 1)
        self.assertEqual(catalog["schools"][0]["name"], "Maple Grove Middle School")
        fixture = catalog["fixtures"][0]
        self.assertEqual(fixture["display_id"], "NV-210")
        self.assertEqual(fixture["fixture_type"], "Bottle Refill Station")
        self.assertEqual(fixture["location"], "Learning Commons · Floor 2 · Hallway 210")
        self.assertEqual(fixture["lead_ppb"], 12)
        self.assertEqual(fixture["sample_date"], "2026-04-10")


if __name__ == "__main__":
    unittest.main()
