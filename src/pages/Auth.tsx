import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Droplets } from 'lucide-react';
import { toast } from 'sonner';

type Mode = 'signin' | 'signup';

export default function Auth() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate('/', { replace: true });
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
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: displayName || email },
          },
        });
        if (error) throw error;
        toast.success('Account created. You can now sign in.');
        setMode('signin');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Welcome back!');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Google sign-in failed');
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
          <p className="mt-1 text-sm text-muted-foreground">Campus water fixture inventory</p>
        </div>

        <div className="card-soft p-5">
          <div className="mb-4 inline-flex w-full rounded-xl bg-secondary p-1">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Display name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="search-input mt-1 pl-3"
                  placeholder="Jane Doe"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="search-input mt-1 pl-3"
                placeholder="you@example.edu"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="search-input mt-1 pl-3"
                placeholder="At least 6 characters"
              />
            </div>
            <button type="submit" disabled={busy} className="btn-primary mt-2 w-full">
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="my-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button type="button" onClick={handleGoogle} className="btn-secondary w-full">
            Continue with Google
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your role (Collector, Coordinator, or Facilities) is assigned after sign-in.
        </p>
      </div>
    </div>
  );
}
