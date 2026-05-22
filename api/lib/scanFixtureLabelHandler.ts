/**
 * Claude Haiku vision OCR for fixture model plates.
 * Used by Vercel serverless API (primary) — not Lovable / Supabase Edge Functions.
 */

import { createClient } from "@supabase/supabase-js";

export const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-haiku-20241022";

const SYSTEM_PROMPT = `You are an OCR + vision assistant for commercial drinking-water fixture model plates and labels.

Read every character visible on the sticker/plate photo: manufacturer name, model name/number, serial number, and filter or cartridge product number.
Transcribe text exactly as printed. If a field is missing or illegible, return an empty string — never guess serial numbers.

Infer fountain type from the unit appearance and any printed text.
Always call extract_fixture with your results.

Category must be exactly one of: PorcelainFountain, MetalFountain, VendingMachine, BottleRefillStation, Other.
Never use WallFountain — that legacy type does not exist.`;

const EXTRACT_TOOL_ANTHROPIC = {
  name: "extract_fixture",
  description: "Return the extracted fixture metadata.",
  input_schema: {
    type: "object",
    properties: {
      brand: { type: "string", description: "Manufacturer brand, e.g. Elkay" },
      model: { type: "string", description: "Model name/number, e.g. EZH2O" },
      serialNumber: { type: "string", description: "Serial number if visible" },
      filterType: { type: "string", description: "Filter type/cartridge name" },
      category: {
        type: "string",
        enum: ["PorcelainFountain", "MetalFountain", "VendingMachine", "BottleRefillStation", "Other"],
      },
      confidence: { type: "number", description: "0..1 confidence" },
    },
    required: ["brand", "model", "serialNumber", "filterType", "category", "confidence"],
  },
};

const ALLOWED_IMAGE_MEDIA = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export type ScanImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export function normalizeMediaType(raw: string | undefined): ScanImageMediaType {
  const t = (raw ?? "image/jpeg").toLowerCase().trim();
  if (ALLOWED_IMAGE_MEDIA.has(t)) return t as ScanImageMediaType;
  return "image/jpeg";
}

export interface ScanFixtureLabelPayload {
  imageBase64?: string;
  imageMimeType?: string;
}

export interface ScanHandlerResult {
  status: number;
  body: Record<string, unknown>;
}

function getEnv(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

export async function verifySupabaseUser(authHeader: string | undefined): Promise<ScanHandlerResult | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const supabaseUrl = getEnv("SUPABASE_URL", getEnv("VITE_SUPABASE_URL"));
  const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY", getEnv("VITE_SUPABASE_PUBLISHABLE_KEY"));
  if (!supabaseUrl || !supabaseAnonKey) {
    return { status: 500, body: { error: "Server misconfigured" } };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  return null;
}

async function scanWithClaude(args: {
  apiKey: string;
  model: string;
  imageBase64: string;
  mediaType: ScanImageMediaType;
}): Promise<ScanHandlerResult> {
  const { apiKey, model, imageBase64, mediaType } = args;

  const userContent: unknown[] = [
    {
      type: "image",
      source: { type: "base64", media_type: mediaType, data: imageBase64 },
    },
    { type: "text", text: "Extract the fixture metadata from this label." },
  ];

  const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [EXTRACT_TOOL_ANTHROPIC],
      tool_choice: { type: "tool", name: "extract_fixture" },
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!aiResp.ok) {
    const t = await aiResp.text();
    console.error("Anthropic error", aiResp.status, t);
    return {
      status: aiResp.status === 429 ? 429 : 500,
      body: { error: "Anthropic API error" },
    };
  }

  const data = (await aiResp.json()) as {
    content?: Array<{ type?: string; name?: string; input?: Record<string, unknown> }>;
  };
  const toolBlock = data?.content?.find((b) => b.type === "tool_use" && b.name === "extract_fixture");
  const input = toolBlock?.input;
  if (!input || typeof input !== "object") {
    return { status: 502, body: { error: "No structured output from Claude" } };
  }

  return { status: 200, body: input as Record<string, unknown> };
}

/** Run label scan — Anthropic only; Lovable gateway is not used. */
export async function handleScanFixtureLabelRequest(
  authHeader: string | undefined,
  payload: ScanFixtureLabelPayload,
): Promise<ScanHandlerResult> {
  const authError = await verifySupabaseUser(authHeader);
  if (authError) return authError;

  const imageBase64 = typeof payload.imageBase64 === "string" ? payload.imageBase64 : "";
  const imageMimeType = normalizeMediaType(
    typeof payload.imageMimeType === "string" ? payload.imageMimeType : undefined,
  );

  if (!imageBase64) {
    return { status: 400, body: { error: "Provide imageBase64" } };
  }

  // Cap payload size (~4 MB base64) to limit abuse / memory use.
  if (imageBase64.length > 5_500_000) {
    return { status: 413, body: { error: "Image too large" } };
  }

  const anthropicKey = getEnv("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return {
      status: 503,
      body: {
        error: "Label scan is unavailable. Set ANTHROPIC_API_KEY in Vercel environment variables.",
      },
    };
  }

  const model = getEnv("ANTHROPIC_MODEL") ?? DEFAULT_ANTHROPIC_MODEL;
  return scanWithClaude({
    apiKey: anthropicKey,
    model,
    imageBase64,
    mediaType: imageMimeType,
  });
}
