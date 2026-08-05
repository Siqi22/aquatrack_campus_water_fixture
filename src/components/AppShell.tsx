import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Beaker, Calculator, Droplets, LogOut, PenLine } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ImportDialog } from '@/components/ImportDialog';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { DrinkingFountainIcon } from '@/components/icons/DrinkingFountainIcon';
import { HomeIcon } from '@/components/icons/HomeIcon';

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const { organizationName } = useOrganization();
  const tabs = [
    { to: '/', icon: HomeIcon, label: 'Home' },
    { to: '/campus', icon: DrinkingFountainIcon, label: 'Fixture Inventory' },
    { to: '/lead-testing/results', icon: Beaker, label: 'Lead Testing' },
    { to: '/communication', icon: PenLine, label: 'Communication' },
    { to: '/replacement-budget', icon: Calculator, label: 'Budget' },
  ];
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('import') === '1') {
      setImportOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('import');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="flex min-h-screen flex-col bg-background app-surface">
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Droplets className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">AquaTrack</p>
              <p className="truncate text-[10px] text-muted-foreground">{organizationName} · {user?.email}</p>
            </div>
          </div>
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
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 overflow-y-auto pb-24 scroll-gutter-stable">
        {children}
      </main>

      <nav className="nav-bar">
        <div className="mx-auto grid w-full max-w-3xl grid-cols-5 items-stretch px-1 md:px-4">
          {tabs.map(({ to, icon: Icon, label }) => {
            const active = pathname === to || (to === '/lead-testing/results' && pathname.startsWith('/lead-testing/'));
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

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
