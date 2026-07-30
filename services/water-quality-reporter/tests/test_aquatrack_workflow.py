from io import BytesIO
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from docx import Document


class FakeSupabase:
    configured = True

    def __init__(self):
        self.files = {}
        self.generated_reports = []

    def token(self):
        return "test-token"

    def verify_user(self, _token):
        return {"id": "test-user"}

    def schools(self):
        return [{
            "id": "campus-1",
            "name": "Example Elementary",
            "school": "Example Elementary",
            "school_district": "Example District",
            "address": "1 Example Way",
        }]

    def school(self, campus_id):
        return self.schools()[0] if campus_id == "campus-1" else None

    def fixtures(self, campus_id=None):
        if campus_id not in (None, "campus-1"):
            return []
        return [{
            "id": "fixture-1",
            "campus_id": "campus-1",
            "building_id": "building-1",
            "building_name": "Learning Center",
            "floor": "1",
            "nearest_room": "Hallway A",
            "category": "drinking_fountain",
            "brand": "Example",
            "model": "F100",
            "serial_number": "EX-001",
            "current_result_ppb": 6.125,
            "current_lead_testing_status": "action_required",
            "current_required_action": "Remediation required",
        }]

    def testing_rounds(self, fixture_ids):
        if "fixture-1" not in fixture_ids:
            return []
        return [{
            "id": "round-1",
            "fixture_id": "fixture-1",
            "round_type": "initial_test",
            "round_number": 1,
            "status": "action_required",
            "sample_id": "SAMPLE-001",
            "sample_draw_date": "2026-03-12",
            "result_value": "6.125",
            "result_original_unit": "ppb",
            "result_ppb": 6.125,
            "result_category": "Greater than 5 through 15 ppb",
            "required_action": "Remediation required",
        }]

    def upload_bytes(self, path, data, _content_type="application/octet-stream"):
        self.files[path] = data

    def download_bytes(self, path):
        return self.files.get(path)

    def materialize(self, path, destination):
        data = self.download_bytes(path)
        if data is None:
            return False
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        return True

    def insert(self, table, row):
        if table == "communication_generated_reports":
            self.generated_reports.append(row)
        return row


def docx_bytes(header_text=None):
    output = BytesIO()
    document = Document()
    if header_text:
        document.sections[0].header.paragraphs[0].text = header_text
    document.add_paragraph("Example communication style")
    document.save(output)
    return output.getvalue()


class AquaTrackWorkflowTests(unittest.TestCase):
    def test_database_selection_and_original_report_workflow(self):
        import flask_app
        from supabase_adapter import SupabaseFixtureRegistry

        fake = FakeSupabase()
        with tempfile.TemporaryDirectory() as temp_dir, patch.object(
            flask_app, "supabase", fake
        ), patch.object(
            flask_app, "registry", SupabaseFixtureRegistry(fake)
        ), patch.object(
            flask_app, "WORK", Path(temp_dir)
        ), patch.object(
            flask_app,
            "draft_school_communication_from_reference",
            return_value={
                "layout": "report",
                "intro": "Example introduction.",
                "actions": "Example actions.",
                "notes": "",
                "style_summary": "Example district communication.",
            },
        ):
            client = flask_app.app.test_client()

            start = client.get("/")
            self.assertEqual(start.status_code, 200)
            self.assertIn(b"Example Elementary", start.data)
            self.assertNotIn(b"University of Washington", start.data)
            self.assertNotIn(b'value="uw"', start.data)

            setup = client.post(
                "/upload-options",
                data={"campus_id": "campus-1"},
                follow_redirects=False,
            )
            self.assertEqual(setup.status_code, 302)
            self.assertIn("/reference-upload/", setup.headers["Location"])

            fixture_page = client.get(setup.headers["Location"])
            self.assertEqual(fixture_page.status_code, 200)
            self.assertIn(b"Learning Center", fixture_page.data)
            self.assertIn(b"6.125 ppb", fixture_page.data)
            self.assertIn(b"checked", fixture_page.data)

            fixture_selection = client.post(
                setup.headers["Location"],
                data={"fixture_ids": ["fixture-1"]},
                follow_redirects=False,
            )
            self.assertIn("/report-style/", fixture_selection.headers["Location"])
            upload_id = fixture_selection.headers["Location"].rstrip("/").split("/")[-1]

            style = client.post(
                fixture_selection.headers["Location"],
                data={
                    "style_report_file": (
                        BytesIO(docx_bytes()),
                        "style.docx",
                    ),
                    "header_template_file": (
                        BytesIO(docx_bytes("Example District Header")),
                        "header.docx",
                    ),
                },
                content_type="multipart/form-data",
                follow_redirects=False,
            )
            self.assertIn("/compose/", style.headers["Location"])

            review = client.get(style.headers["Location"])
            self.assertEqual(review.status_code, 200)
            self.assertIn(b"Review and Edit", review.data)
            self.assertIn(b"6", review.data)
            self.assertNotIn(b"University of Washington", review.data)

            generated = client.post(
                style.headers["Location"],
                data={
                    "building": ["Learning Center"],
                    "school_name": "Example Elementary",
                    "organization": "Example District",
                    "sampling_dates": "March 12, 2026",
                    "introduction": "Example introduction.",
                    "actions_taken": "Example actions.",
                    "notes": "",
                },
            )
            self.assertEqual(generated.status_code, 200)
            self.assertEqual(
                generated.mimetype,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
            report = Document(BytesIO(generated.data))
            self.assertIn(
                "Example District Header",
                [p.text for p in report.sections[0].header.paragraphs],
            )
            self.assertEqual(len(fake.generated_reports), 1)


if __name__ == "__main__":
    unittest.main()
