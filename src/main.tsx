import { createRoot } from "react-dom/client";
import "./index.css";
import { hasSupabaseEnv } from "@/lib/supabaseEnv";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

function renderMissingConfig() {
  createRoot(rootEl!).render(
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        background: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Missing Supabase configuration</h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: "#475569" }}>
          Copy <code>.env.example</code> to <code>.env.local</code>, fill in{" "}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, then restart{" "}
          <code>npm run dev</code>. On Lovable, also check Cloud → Secrets or ensure{" "}
          <code>env/supabase.public.env</code> is present after git sync.
        </p>
      </div>
    </div>,
  );
}

if (!hasSupabaseEnv()) {
  renderMissingConfig();
} else {
  import("./App.tsx").then(async ({ default: App }) => {
    const { initNativePlatform } = await import("./lib/nativePlatform");
    await initNativePlatform();
    createRoot(rootEl).render(<App />);
  });
}
