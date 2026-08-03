import { useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/contexts/AuthContext';

const DEFAULT_REPORTER_URL = 'https://aquatrack-water-quality-reporter.vercel.app';

export default function Communication() {
  const { session } = useAuth();
  const [error, setError] = useState('');

  function openReporter() {
    const accessToken = session?.access_token;
    if (!accessToken) {
      setError('Your AquaTrack session is unavailable. Sign in again and retry.');
      return;
    }
    setError('');
    const configured = (import.meta.env.VITE_COMMUNICATION_TOOL_URL || DEFAULT_REPORTER_URL).replace(/\/$/, '');
    window.location.replace(`${configured}/auth/launch#access_token=${encodeURIComponent(accessToken)}`);
  }

  useEffect(() => {
    openReporter();
    // The session access token is the only value needed for this one-time handoff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  return <div className="page-shell max-w-xl">
    <PageHeader title="Communication" subtitle="Opening AquaTrack Communication" />
    <div className="card-section">
      <div className="panel-body py-10 text-center">
        {error ? <p className="text-sm text-destructive">{error}</p> : <>
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-sm font-semibold">Connecting securely…</p>
          <p className="mt-1 text-xs text-muted-foreground">Your school and fixture access will carry over from AquaTrack.</p>
        </>}
        <Button className="mt-5" variant="outline" onClick={openReporter}>
          <ArrowUpRight className="mr-2 h-4 w-4" />Open AquaTrack Communication
        </Button>
      </div>
    </div>
  </div>;
}
