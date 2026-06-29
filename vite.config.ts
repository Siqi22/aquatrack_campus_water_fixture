import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { loadPublicSupabaseEnv } from "./src/lib/loadPublicEnv";
import { handleScanFixtureLabelRequest } from "./api/lib/scanFixtureLabelHandler";

function readJsonBody(req: { on: (event: string, cb: (chunk?: Buffer) => void) => void }): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("error", () => reject(new Error("Failed to read request body")));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
  });
}

function localScanApiPlugin() {
  return {
    name: "local-scan-fixture-label-api",
    apply: "serve" as const,
    configureServer(server) {
      server.middlewares.use("/api/scan-fixture-label", async (req, res) => {
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
        res.setHeader("Content-Type", "application/json");

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const body = await readJsonBody(req);
          const result = await handleScanFixtureLabelRequest(req.headers.authorization, body);
          res.statusCode = result.status;
          res.end(JSON.stringify(result.body));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  loadPublicSupabaseEnv();

  // Vercel needs absolute asset paths (`/`); Capacitor local bundle uses relative (`./`).
  const base = process.env.VERCEL ? "/" : "./";

  return {
    base,
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      ...(process.env.VITE_VERCEL_APP_URL
        ? {
            proxy: {
              "/api": {
                target: process.env.VITE_VERCEL_APP_URL.replace(/\/$/, ""),
                changeOrigin: true,
                secure: true,
              },
            },
          }
        : {}),
    },
    plugins: [react(), mode === "development" && localScanApiPlugin(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
