import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFixtureStore } from '@/store/fixtureStore';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const { session, loading: authLoading } = useAuth();
  const { loaded, loadError, loadAll } = useFixtureStore();
  const location = useLocation();

  useEffect(() => {
    if (loadError) toast.error(`Could not load the workspace: ${loadError}`);
  }, [loadError]);

  if (authLoading || (session && !loaded)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (loadError) {
    return (
      <div className="app-surface flex min-h-screen items-center justify-center px-5">
        <div className="card-soft w-full max-w-sm p-5 text-center">
          <h1 className="text-base font-semibold text-foreground">Workspace could not load</h1>
          <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
          <button type="button" className="btn-primary mt-4 w-full" onClick={() => void loadAll()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
