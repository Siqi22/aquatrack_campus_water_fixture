import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFixtureStore } from '@/store/fixtureStore';

interface Props {
  children: ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const { session, loading: authLoading } = useAuth();
  const { loaded } = useFixtureStore();
  const location = useLocation();

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

  return <>{children}</>;
}
