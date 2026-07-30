import base64
from types import SimpleNamespace
import unittest

from wqr.claude_pdf import (
    MODEL, TOOL_NAME, ClaudePDFResponseError,
    parse_school_water_pdf_with_claude, result_pages_from_samples,
)


class _FakeMessages:
    def __init__(self, payload):
        self.payload = payload
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(content=[SimpleNamespace(
            type="tool_use",
            name=TOOL_NAME,
            input=self.payload,
        )])


class _FakeClient:
    def __init__(self, payload):
        self.messages = _FakeMessages(payload)


def _payload():
    return {
        "school_name": "Example Elementary",
        "samples": [{
            "source_page": 9,
            "sample_id": "LAB-Z9/OUT-A7",
            "client_sample_id": "OUT-A7",
            "fixture_id": None,
            "building_name": "Main Building",
            "fixture_label": "Kitchen fountain, right",
            "collection_date": "2024-04-20",
            "analysis_date": "2024-05-09",
            "measurements": [{
                "analyte": "Pb",
                "reported_result": "<1",
                "unit": "µg/L",
                "method": "EPA 200.8",
            }],
        }],
    }


class ClaudePDFTests(unittest.TestCase):
    def test_uses_pinned_haiku_strict_schema_and_complete_document(self):
        client = _FakeClient(_payload())
        pdf_bytes = b"%PDF-1.7\nexample"
        samples = parse_school_water_pdf_with_claude(
            pdf_bytes,
            "results.pdf",
            client=client,
        )

        self.assertEqual(MODEL, "claude-haiku-4-5-20251001")
        self.assertEqual(len(client.messages.calls), 1)
        call = client.messages.calls[0]
        self.assertEqual(call["model"], MODEL)
        content = call["messages"][0]["content"]
        self.assertEqual(content[0]["type"], "document")
        self.assertEqual(content[0]["source"]["media_type"], "application/pdf")
        self.assertEqual(base64.b64decode(content[0]["source"]["data"]), pdf_bytes)
        self.assertIn("complete PDF", content[1]["text"])
        self.assertNotIn("Only pages", content[1]["text"])
        self.assertIn("Building Name", call["system"])
        self.assertEqual(call["tool_choice"]["name"], TOOL_NAME)
        self.assertTrue(call["tools"][0]["strict"])
        self.assertFalse(call["tools"][0]["input_schema"]["additionalProperties"])

        self.assertEqual(len(samples), 1)
        sample = samples[0]
        self.assertEqual(sample.sample_id, "LAB-Z9/OUT-A7")
        self.assertEqual(sample.fixture_id, "CLAUDE_LAB_Z9_OUT_A7")
        self.assertEqual(sample.collection_date.isoformat(), "2024-04-20")
        self.assertEqual(sample.building_name, "Main Building")
        self.assertEqual(sample.source_fields["building_name"], "Main Building")
        self.assertTrue(sample.measurement("Lead").below_dl)
        self.assertEqual(sample.measurement("Lead").detection_limit, 1.0)
        self.assertEqual(result_pages_from_samples(samples), [9])

    def test_rejects_invalid_result_instead_of_guessing(self):
        payload = _payload()
        payload["samples"][0]["measurements"][0]["reported_result"] = "about seven"
        with self.assertRaises(ClaudePDFResponseError):
            parse_school_water_pdf_with_claude(
                b"%PDF-1.7\nexample", "results.pdf", client=_FakeClient(payload)
            )


if __name__ == "__main__":
    unittest.main()
