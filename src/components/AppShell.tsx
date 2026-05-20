import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ClipboardList, Droplets, Home, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFixtureStore } from '@/store/fixtureStore';
import { RoleBadge } from '@/components/RoleBadge';
import { WelcomeScreen, dismissWelcome, wasWelcomeDismissed } from '@/components/WelcomeScreen';
import { ImportDialog } from '@/components/ImportDialog';
import { toast } from 'sonner';

const tabs = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/add', icon: ClipboardList, label: 'Survey' },
  { to: '/campus', icon: Building2, label: 'Campus' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const { primaryRole, loaded, fixtures } = useFixtureStore();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('import') === '1') {
      setImportOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('import');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (loaded && pathname === '/' && !wasWelcomeDismissed()) {
      setWelcomeOpen(true);
    }
  }, [loaded, pathname]);

  function closeWelcome() {
    dismissWelcome();
    setWelcomeOpen(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background app-surface">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Droplets className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">AquaTrack</p>
              <p className="truncate text-[10px] text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RoleBadge role={primaryRole} compact />
            <button
              type="button"
              onClick={async () => {
                await signOut();
                toast.success('Signed out');
                navigate('/auth', { replace: true });
              }}
              className="btn-icon"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 overflow-y-auto pb-24 scroll-gutter-stable">
        {children}
      </main>

      <nav className="nav-bar">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
          {tabs.map(({ to, icon: Icon, label }) => {
            const active = pathname === to || (to === '/add' && pathname.startsWith('/add'));
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                className={active ? 'nav-tab-active' : 'nav-tab'}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {welcomeOpen && (
        <WelcomeScreen
          role={primaryRole}
          fixtureCount={fixtures.length}
          onDismiss={closeWelcome}
          onImport={() => {
            closeWelcome();
            setImportOpen(true);
          }}
        />
      )}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
