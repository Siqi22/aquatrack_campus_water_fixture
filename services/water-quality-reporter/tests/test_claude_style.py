import base64
import json
from types import SimpleNamespace
import unittest

from wqr.claude_pdf import MODEL
from wqr.claude_style import (
    STYLE_SCHEMA, TOOL_NAME, draft_school_communication_from_reference,
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


class ClaudeStyleTests(unittest.TestCase):
    def test_pdf_reference_drives_strict_style_draft_from_locked_facts(self):
        payload = {
            "layout_type": "letter",
            "introduction_md": (
                "**Elevated Lead Levels Detected in School Drinking Water**\n\n"
                "Dear families and staff of Example School,\n\n"
                "**What We’ve Learned**\n\nThree outlets were above 5 ppb."
            ),
            "actions_md": "**What We’re Doing**\n\n- Confirm affected outlets are inaccessible.",
            "notes_md": "**Where to Learn More**\n\n[confirm district website]",
            "style_summary": "Family letter with short named sections and action bullets.",
        }
        client = _FakeClient(payload)
        facts = {
            "school_name": "Example School",
            "sample_count": 60,
            "outlets_above_5_ppb": 3,
            "confirmed_actions": [],
        }
        raw_pdf = b"%PDF-1.7\nstyle"

        draft = draft_school_communication_from_reference(
            raw_pdf, "family-letter.pdf", facts, client=client
        )

        self.assertEqual(draft["style_summary"], payload["style_summary"])
        self.assertEqual(draft["layout"], "letter")
        call = client.messages.calls[0]
        self.assertEqual(call["model"], MODEL)
        self.assertEqual(call["model"], "claude-haiku-4-5-20251001")
        self.assertTrue(call["tools"][0]["strict"])
        self.assertEqual(call["tools"][0]["input_schema"], STYLE_SCHEMA)
        content = call["messages"][0]["content"]
        self.assertEqual(content[0]["type"], "document")
        self.assertEqual(base64.b64decode(content[0]["source"]["data"]), raw_pdf)
        locked = content[-1]["text"].split("LOCKED FACTS:\n", 1)[1]
        self.assertEqual(json.loads(locked), facts)


if __name__ == "__main__":
    unittest.main()
