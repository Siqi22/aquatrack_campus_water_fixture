// Scan a fixture model-plate photo and extract brand/model/serial/filter/category
// using the Lovable AI Gateway (Gemini vision). The function expects a base64
// image (without the data: prefix) or a publicly fetchable URL.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `You are a domain expert in commercial drinking-water fixtures.
Look at the model-plate photo provided and extract metadata.
Always call the extract_fixture function with your best guesses.
If a field is not visible, return an empty string. Never invent serial numbers.`;

const TOOL = {
  type: "function" as const,
  function: {
    name: "extract_fixture",
    description: "Return the extracted fixture metadata.",
    parameters: {
      type: "object",
      properties: {
        brand: { type: "string", description: "Manufacturer brand, e.g. Elkay" },
        model: { type: "string", description: "Model name/number, e.g. EZH2O" },
        serialNumber: { type: "string", description: "Serial number if visible" },
        filterType: { type: "string", description: "Filter type/cartridge name" },
        category: {
          type: "string",
          enum: ["BottleFiller", "WallFountain", "CombinationUnit", "FilteredTap", "Other"],
        },
        confidence: { type: "number", description: "0..1 confidence" },
      },
      required: ["brand", "model", "serialNumber", "filterType", "category", "confidence"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
    if (!imageBase64 && !imageUrl) {
      return new Response(JSON.stringify({ error: "Provide imageBase64 or imageUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imagePart = imageBase64
      ? { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      : { type: "image_url", image_url: { url: imageUrl } };

    const aiResp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the fixture metadata from this label." },
              imagePart,
            ],
          },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "extract_fixture" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "AI gateway error", details: t }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      return new Response(JSON.stringify({ error: "No structured output", raw: data }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(argsStr);
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-fixture-label error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
