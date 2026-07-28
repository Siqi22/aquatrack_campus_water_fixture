import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Droplets } from "lucide-react";
import { toast } from "sonner";

type Mode = "signin" | "signup";

export default function Auth() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { organizationMode, setOrganizationMode, organizationName } = useOrganization();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  if (authLoading) {
    return (
      <div className="app-surface flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (session) return <Navigate to="/" replace />;

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: displayName || email },
          },
        });
        if (error) throw error;
        toast.success("Account created. You can now sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-surface flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Droplets className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">AquaTrack</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {organizationName} water fixture inventory
          </p>
        </div>

        <div className="card-soft p-5">
          <div className="segmented-control mb-4">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={
                  mode === m
                    ? "segmented-option-active"
                    : "segmented-option-inactive"
                }
              >
                {m === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            <fieldset>
              <legend className="field-label">Workspace type</legend>
              <div className="mt-2 grid gap-2">
                {([
                  ['uw', 'University of Washington'],
                  ['school_district', 'School District'],
                ] as const).map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                      organizationMode === value ? 'border-primary bg-primary/5' : 'bg-card'
                    }`}
                  >
                    <input
                      type="radio"
                      name="organization-mode"
                      value={value}
                      checked={organizationMode === value}
                      onChange={() => setOrganizationMode(value)}
                    />
                    <span className="font-medium text-foreground">{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {mode === "signup" && (
              <div>
                <label className="field-label">Display name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="field-input mt-1"
                  placeholder="Jane Doe"
                />
              </div>
            )}
            <div>
              <label className="field-label">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input mt-1"
                placeholder="you@example.edu"
              />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input mt-1"
                placeholder="At least 6 characters"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="btn-primary mt-2 w-full"
            >
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Signed-in teammates share one fixture inventory workspace.
        </p>
      </div>
    </div>
  );
}
