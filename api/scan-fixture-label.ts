import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleScanFixtureLabelRequest } from "./lib/scanFixtureLabelHandler";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization;
    const result = await handleScanFixtureLabelRequest(authHeader, req.body ?? {});
    return res.status(result.status).json(result.body);
  } catch (e) {
    console.error("scan-fixture-label API error", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
