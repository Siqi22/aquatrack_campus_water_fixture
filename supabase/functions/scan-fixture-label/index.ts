// Legacy copy for Lovable Cloud git sync — production uses Vercel /api/scan-fixture-label instead.
// Provider: Anthropic Claude only (server-side secret ANTHROPIC_API_KEY on Vercel, not Lovable).
//
// Secrets: Supabase Dashboard → Edge Functions → Secrets, or:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref <ref>
//   supabase secrets set ANTHROPIC_MODEL=claude-3-5-haiku-20241022
//
// Request JSON: { imageBase64?: string, imageUrl?: string, imageMimeType?: string }

const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Reject anonymous JWT / missing session — only signed-in users may trigger paid OCR. */
async function requireAuthenticatedUser(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return null;
}

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

function normalizeMediaType(raw: string | undefined): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const t = (raw ?? "image/jpeg").toLowerCase().trim();
  if (ALLOWED_IMAGE_MEDIA.has(t)) return t as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  return "image/jpeg";
}

async function scanWithClaude(args: {
  apiKey: string;
  model: string;
  imageBase64: string;
  imageUrl: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}): Promise<Response> {
  const { apiKey, model, imageBase64, imageUrl, mediaType } = args;

  const userContent: unknown[] = [
    { type: "text", text: "Extract the fixture metadata from this label." },
  ];

  if (imageBase64) {
    userContent.unshift({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: imageBase64 },
    });
  } else if (imageUrl) {
    userContent.unshift({
      type: "image",
      source: { type: "url", url: imageUrl },
    });
  }

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
    return new Response(JSON.stringify({ error: "Anthropic API error", details: t }), {
      status: aiResp.status === 429 ? 429 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = (await aiResp.json()) as {
    content?: Array<{ type?: string; name?: string; input?: Record<string, unknown> }>;
  };
  const toolBlock = data?.content?.find((b) => b.type === "tool_use" && b.name === "extract_fixture");
  const input = toolBlock?.input;
  if (!input || typeof input !== "object") {
    return new Response(JSON.stringify({ error: "No structured output from Claude", raw: data }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(input), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = await requireAuthenticatedUser(req);
  if (authError) return authError;

  try {
    const body = await req.json().catch(() => ({}));
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
    const imageMimeType = normalizeMediaType(typeof body.imageMimeType === "string" ? body.imageMimeType : undefined);

    if (!imageBase64 && !imageUrl) {
      return new Response(JSON.stringify({ error: "Provide imageBase64 or imageUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({
          error: "Label scan is unavailable. Set Edge Function secret ANTHROPIC_API_KEY (Claude Haiku).",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const model = Deno.env.get("ANTHROPIC_MODEL") ?? DEFAULT_ANTHROPIC_MODEL;
    return await scanWithClaude({
      apiKey: anthropicKey,
      model,
      imageBase64,
      imageUrl,
      mediaType: imageMimeType,
    });
  } catch (e) {
    console.error("scan-fixture-label error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
