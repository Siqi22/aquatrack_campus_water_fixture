import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleParseLeadReportRequest } from "./lib/parseLeadReportHandler";

function resolveCorsOrigin(req: VercelRequest): string {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const allowed = (process.env.SCAN_API_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (origin && allowed.includes(origin)) return origin;
  const vercelHost = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  if (origin && vercelHost === origin) return origin;
  if (origin && /^https:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return vercelHost || allowed[0] || "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const corsOrigin = resolveCorsOrigin(req);
  if (corsOrigin) {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const result = await handleParseLeadReportRequest(req.headers.authorization, req.body ?? {});
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("parse-lead-report API error", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}
