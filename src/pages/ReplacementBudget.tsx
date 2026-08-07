import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_BUDGET_URL = 'https://aquatrack-replacement-budget.vercel.app';

export default function ReplacementBudget() {
  const { session } = useAuth();
  const [error, setError] = useState('');
  const autoLaunchStarted = useRef(false);

  async function openBudgetTool() {
    let accessToken = session?.access_token;
    let refreshError: { message?: string } | null = null;
    const expiresSoon = !session?.expires_at || session.expires_at <= Math.floor(Date.now() / 1000) + 60;
    if (accessToken && expiresSoon) {
      const refreshed = await supabase.auth.refreshSession();
      accessToken = refreshed.data.session?.access_token;
      refreshError = refreshed.error;
    }
    if (!accessToken) {
      setError(refreshError?.message || 'Your AquaTrack session has expired. Sign in again and retry.');
      autoLaunchStarted.current = false;
      return;
    }
    setError('');
    const configured = (import.meta.env.VITE_REPLACEMENT_BUDGET_URL || DEFAULT_BUDGET_URL).replace(/\/$/, '');
    window.location.replace(`${configured}/auth/launch#access_token=${encodeURIComponent(accessToken)}`);
  }

  useEffect(() => {
    if (!session?.access_token || autoLaunchStarted.current) return;
    autoLaunchStarted.current = true;
    void openBudgetTool();
    // The session access token is used only for this one-time secure handoff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  return <div className="page-shell max-w-xl">
    <PageHeader title="Replacement Budget" subtitle="Opening AquaTrack Replacement Budget" />
    <div className="card-section">
      <div className="panel-body py-10 text-center">
        {error ? <p className="text-sm text-destructive">{error}</p> : <>
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-sm font-semibold">Connecting securely…</p>
          <p className="mt-1 text-xs text-muted-foreground">Your schools, fixtures, and lead results will carry over from AquaTrack.</p>
        </>}
        <Button className="mt-5" variant="outline" onClick={()=>void openBudgetTool()}>
          <ArrowUpRight className="mr-2 h-4 w-4" />Open Replacement Budget
        </Button>
      </div>
    </div>
  </div>;
}
