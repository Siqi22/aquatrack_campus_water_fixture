import os
import unittest
from unittest.mock import Mock, patch

from supabase_adapter import SupabaseAdapter


class SupabaseBudgetCatalogTests(unittest.TestCase):
    def test_verify_user_uses_the_current_aquatrack_token(self):
        with patch.dict(
            os.environ,
            {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_PUBLISHABLE_KEY": "key"},
        ):
            adapter = SupabaseAdapter()

        response = Mock(ok=True)
        response.json.return_value = {"id": "user-1"}
        with patch("supabase_adapter.requests.get", return_value=response) as get:
            user = adapter.verify_user("fresh-access-token")

        self.assertEqual(user, {"id": "user-1"})
        self.assertEqual(get.call_args[1]["headers"]["Authorization"], "Bearer fresh-access-token")
        self.assertEqual(get.call_args[1]["headers"]["apikey"], "key")

    def test_verify_user_rejects_an_invalid_token(self):
        with patch.dict(
            os.environ,
            {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_PUBLISHABLE_KEY": "key"},
        ):
            adapter = SupabaseAdapter()

        with patch("supabase_adapter.requests.get", return_value=Mock(ok=False, status_code=401)):
            self.assertIsNone(adapter.verify_user("expired-token"))

    def test_catalog_maps_aquatrack_inventory_into_original_budget_shape(self):
        with patch.dict(
            os.environ,
            {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_PUBLISHABLE_KEY": "key"},
        ):
            adapter = SupabaseAdapter()

        def rows(table, _params):
            if table == "campuses":
                self.assertEqual(_params["organization_mode"], "eq.school_district")
                self.assertNotIn("school_district", _params)
                return [
                    {
                        "id": "school-1",
                        "name": "Campus 1",
                        "school": "Maple Grove Middle School",
                        "school_district": "North Valley School District",
                        "address": "100 School Way",
                    },
                    {
                        "id": "school-2",
                        "name": "Outside Campus",
                        "school": "Cedarhome Elementary School",
                        "school_district": "Stanwood-Camano School District",
                        "address": "200 Other Way",
                    },
                    {
                        "id": "school-without-results",
                        "name": "New Campus",
                        "school": "New School",
                        "school_district": "North Valley School District",
                        "address": "300 New Way",
                    },
                    {
                        "id": "school-without-fixtures",
                        "name": "Empty Campus",
                        "school": "Empty School",
                        "school_district": "North Valley School District",
                        "address": "400 Empty Way",
                    },
                ]
            if table == "buildings":
                return [
                    {"id": "building-1", "campus_id": "school-1", "name": "Learning Commons"},
                    {"id": "building-2", "campus_id": "school-2", "name": "Main Building"},
                    {"id": "building-3", "campus_id": "school-without-results", "name": "New Building"},
                ]
            if table == "fixtures":
                self.assertNotIn("current_result_ppb", _params)
                return [
                    {
                        "id": "fixture-1",
                        "campus_id": "school-1",
                        "building_id": "building-1",
                        "floor": "2",
                        "nearest_room": "Hallway 210",
                        "category": "BottleRefillStation",
                        "serial_number": "NV-210",
                        "current_result_ppb": 12,
                    },
                    {
                        "id": "fixture-2",
                        "campus_id": "school-2",
                        "building_id": "building-2",
                        "floor": "1",
                        "nearest_room": "Hallway 100",
                        "category": "MetalFountain",
                        "serial_number": "SC-100",
                        "current_result_ppb": 7,
                    },
                    {
                        "id": "fixture-without-result",
                        "campus_id": "school-without-results",
                        "building_id": "building-3",
                        "floor": "1",
                        "nearest_room": "Classroom 101",
                        "category": "FilteredTap",
                        "serial_number": "NEW-101",
                        "current_result_ppb": None,
                    },
                ]
            if table == "lead_testing_rounds":
                return [
                    {"fixture_id": "fixture-1", "sample_draw_date": "2026-04-10", "round_number": 1},
                    {"fixture_id": "fixture-2", "sample_draw_date": "2026-05-10", "round_number": 1},
                ]
            raise AssertionError(table)

        with patch.object(adapter, "select", side_effect=rows):
            catalog = adapter.catalog()

        self.assertEqual(catalog["district_name"], "Multiple School Districts")
        self.assertEqual(len(catalog["schools"]), 3)
        self.assertEqual(catalog["schools"][0]["name"], "Maple Grove Middle School")
        self.assertEqual(
            {school["name"] for school in catalog["schools"]},
            {"Maple Grove Middle School", "Cedarhome Elementary School", "New School"},
        )
        self.assertEqual(len(catalog["fixtures"]), 2)
        fixture = catalog["fixtures"][0]
        self.assertEqual(fixture["display_id"], "NV-210")
        self.assertEqual(fixture["fixture_type"], "Bottle Refill Station")
        self.assertEqual(fixture["location"], "Learning Commons · Floor 2 · Hallway 210")
        self.assertEqual(fixture["lead_ppb"], 12)
        self.assertEqual(fixture["sample_date"], "2026-04-10")


if __name__ == "__main__":
    unittest.main()
