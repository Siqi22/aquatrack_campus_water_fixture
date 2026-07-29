import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_ANTHROPIC_MODEL,
  getSupabaseServerEnv,
  verifySupabaseUser,
  type ScanHandlerResult,
} from "./scanFixtureLabelHandler";

const TOOL_NAME = "record_lead_testing_results";
const MAX_PDF_BYTES = 23 * 1024 * 1024;
const MAX_ROWS = 3000;

const SYSTEM_PROMPT = `You extract fixture-level lead testing results from school drinking-water PDF reports.
Read the complete PDF semantically regardless of its visual layout, laboratory, agency, headings, or table format.

Return only actual sampled outlets, fixtures, taps, faucets, fountains, bottle fillers, or sinks. Ignore cover letters,
definitions, threshold examples, health guidance, recommendations, and narrative numbers. Preserve visible sample IDs,
dates, result strings, inequality signs, units, school, building, floor, room/location, fixture descriptions, and fixture
types. Never invent a value. Use null when information is absent. Include only lead measurements. Always call
record_lead_testing_results exactly once with every lead result row in the document.

Important layout rules:
- Result tables may begin on page 1, continue across pages, or appear only after several pages of explanations and definitions.
  Inspect every page and do not stop after narrative pages.
- A result row is valid only when it belongs to a results table with a Sample ID and Lead Test Result/Result (ppb) column.
- Some tables include an unlabeled sequential row number before the Sample ID. Never use that row number as sample_id;
  use the value under the column labeled Sample ID.
- Table cells may wrap across multiple visual lines. Combine wrapped Building Name, Fixture Housing Type, Fixture Location,
  Location Details, Fixture Type, and Fixture Position text into the same sample row.
- Preserve results such as "<1" exactly. If the table header states "(ppb)", apply "ppb" to every result row even when the
  unit is not repeated in individual cells.
- "Fixture Housing Type" describes the room/structure around the outlet; "Fixture Type" is the sampled outlet type.
- A title immediately below "Lead in School Drinking Water Report" is normally the school/site name, even when it does not
  end with the word "School".
- Exclude RCW citations, threshold values such as 5 ppb mentioned in guidance, dates in narrative text, page numbers, and
  all examples shown on definition pages.`;

const EXTRACTION_TOOL = {
  name: TOOL_NAME,
  description:
    "Record every fixture-level lead testing result found in the supplied school drinking-water PDF.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      school_district: { type: ["string", "null"] },
      school_name: { type: ["string", "null"] },
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            source_page: { type: ["integer", "null"], minimum: 1 },
            school_name: { type: ["string", "null"] },
            building_name: { type: ["string", "null"] },
            floor: { type: ["string", "null"] },
            room: { type: ["string", "null"] },
            fixture_description: { type: ["string", "null"] },
            fixture_type: { type: ["string", "null"] },
            sample_id: { type: ["string", "null"] },
            sample_date: { type: ["string", "null"] },
            lead_result: { type: "string" },
            unit: { type: ["string", "null"] },
          },
          required: [
            "source_page",
            "school_name",
            "building_name",
            "floor",
            "room",
            "fixture_description",
            "fixture_type",
            "sample_id",
            "sample_date",
            "lead_result",
            "unit",
          ],
        },
      },
    },
    required: ["school_district", "school_name", "rows"],
  },
};

interface ClaudeRow {
  source_page: number | null;
  school_name: string | null;
  building_name: string | null;
  floor: string | null;
  room: string | null;
  fixture_description: string | null;
  fixture_type: string | null;
  sample_id: string | null;
  sample_date: string | null;
  lead_result: string;
  unit: string | null;
}

function text(value: unknown, max = 500): string {
  if (value == null) return "";
  if (!["string", "number"].includes(typeof value)) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

function date(value: unknown): string {
  const raw = text(value, 40);
  if (!raw) return "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

export function normalizeClaudeLeadPayload(input: Record<string, unknown>): Record<string, unknown> {
  const documentDistrict = text(input.school_district);
  const documentSchool = text(input.school_name);
  const rawRows = Array.isArray(input.rows) ? input.rows : [];
  const rows = rawRows
    .slice(0, MAX_ROWS)
    .filter((row): row is ClaudeRow => Boolean(row && typeof row === "object"))
    .map((row, index) => {
      const result = text(row.lead_result, 100);
      return {
        rowNumber: index + 1,
        raw: {
          "Source Page": row.source_page ?? "",
          "School District": documentDistrict,
          School: text(row.school_name) || documentSchool,
          Building: text(row.building_name),
          Floor: text(row.floor),
          Room: text(row.room),
          "Fixture Description": text(row.fixture_description),
          "Fixture Type": text(row.fixture_type),
          "Sample ID": text(row.sample_id),
          "Sample Date": date(row.sample_date),
          "Lead Result": result,
          Unit: text(row.unit) || "ppb",
        },
        schoolDistrict: documentDistrict,
        school: text(row.school_name) || documentSchool,
        building: text(row.building_name),
        floor: text(row.floor),
        room: text(row.room),
        fixtureDescription: text(row.fixture_description),
        fixtureType: text(row.fixture_type),
        sampleId: text(row.sample_id),
        sampleDate: date(row.sample_date),
        resultValue: result,
        resultUnit: text(row.unit) || "ppb",
      };
    })
    .filter((row) => row.resultValue);

  if (!rows.length) throw new Error("Claude found no fixture-level lead results in this PDF.");
  return { rows };
}

async function downloadPdf(authHeader: string, storagePath: string): Promise<Uint8Array> {
  const { url, key } = getSupabaseServerEnv();
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || !storagePath.startsWith(`${user.id}/`)) {
    throw new Error("You do not have access to this PDF.");
  }
  const { data, error } = await supabase.storage.from("lead-testing-reports").download(storagePath);
  if (error || !data) throw new Error("The uploaded PDF could not be read.");
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.length > MAX_PDF_BYTES) throw new Error("PDF is too large. Split it into files under 23 MB.");
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new Error("The uploaded file is not a valid PDF.");
  }
  return bytes;
}

export async function handleParseLeadReportRequest(
  authHeader: string | undefined,
  payload: { storagePath?: string; fileName?: string },
): Promise<ScanHandlerResult> {
  const authError = await verifySupabaseUser(authHeader);
  if (authError) return authError;
  if (!authHeader) return { status: 401, body: { error: "Unauthorized" } };

  const storagePath = text(payload.storagePath, 1000);
  if (!storagePath || storagePath.includes("..")) {
    return { status: 400, body: { error: "Provide a valid storagePath." } };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { status: 503, body: { error: "PDF reading is unavailable. ANTHROPIC_API_KEY is not configured." } };
  }

  try {
    const pdf = await downloadPdf(authHeader, storagePath);
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_PDF_MODEL?.trim() || process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 16000,
        temperature: 0,
        system: SYSTEM_PROMPT,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "tool", name: TOOL_NAME, disable_parallel_tool_use: true },
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: Buffer.from(pdf).toString("base64"),
              },
            },
            {
              type: "text",
              text: `Extract all fixture-level lead testing rows from ${text(payload.fileName) || "this PDF"}.`,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Anthropic PDF extraction error", response.status, detail);
      if (response.status === 429) {
        return { status: 429, body: { error: "Too many PDF requests. Wait a moment and try again." } };
      }
      return { status: 502, body: { error: "Claude could not read this PDF. Try again or upload CSV/Excel." } };
    }

    const data = (await response.json()) as {
      content?: Array<{ type?: string; name?: string; input?: Record<string, unknown> }>;
    };
    const tool = data.content?.find((block) => block.type === "tool_use" && block.name === TOOL_NAME);
    if (!tool?.input) return { status: 502, body: { error: "Claude returned no structured result rows." } };
    return { status: 200, body: normalizeClaudeLeadPayload(tool.input) };
  } catch (error) {
    console.error("parse-lead-report error", error);
    return { status: 500, body: { error: error instanceof Error ? error.message : "Could not read PDF." } };
  }
}
