import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Home, MapPinOff } from 'lucide-react';

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="app-surface flex min-h-[60vh] items-center justify-center">
      <div className="page-shell py-12 text-center">
        <MapPinOff className="empty-state-icon mx-auto" />
        <p className="section-label">404</p>
        <h1 className="page-title mt-1">Page not found</h1>
        <p className="page-subtitle mt-2">
          <span className="font-mono text-caption">{location.pathname}</span> is not a valid route in AquaTrack.
        </p>
        <Link to="/" className="btn-primary mt-6 inline-flex">
          <Home className="h-4 w-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
