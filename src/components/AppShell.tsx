import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Beaker, Calculator, ChevronDown, Droplets, LogOut, PenLine } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ImportDialog } from '@/components/ImportDialog';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { DrinkingFountainIcon } from '@/components/icons/DrinkingFountainIcon';
import { HomeIcon } from '@/components/icons/HomeIcon';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const { organizationName } = useOrganization();
  const districtName = organizationName;
  const tabs = [
    { to: '/', icon: HomeIcon, label: 'Home' },
    { to: '/campus', icon: DrinkingFountainIcon, label: 'Fixture Inventory' },
    { to: '/lead-testing/results', icon: Beaker, label: 'Lead Testing' },
    { to: '/communication', icon: PenLine, label: 'Communication' },
    { to: '/replacement-budget', icon: Calculator, label: 'Budget' },
  ];
  const [importOpen, setImportOpen] = useState(false);
  const userEmail = user?.email || 'Signed-in user';
  const initials = userEmail
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AT';

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out');
    navigate('/auth', { replace: true });
  };

  const navigation = (desktop = false) => tabs.map(({ to, icon: Icon, label }) => {
    const active = pathname === to || (to === '/lead-testing/results' && pathname.startsWith('/lead-testing/'));
    return (
      <Link
        key={to}
        to={to}
        aria-label={label}
        className={desktop
          ? (active ? 'sidebar-tab sidebar-tab-active' : 'sidebar-tab')
          : (active ? 'nav-tab-active' : 'nav-tab')}
      >
        <Icon className={desktop ? 'h-5 w-5' : 'h-5 w-5'} strokeWidth={active ? 2.4 : 2} />
        <span>{label}</span>
      </Link>
    );
  });

  useEffect(() => {
    if (searchParams.get('import') === '1') {
      setImportOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('import');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="app-layout app-surface">
      <aside className="desktop-sidebar" aria-label="AquaTrack navigation">
        <Link to="/" className="app-brand">
          <span className="app-brand-mark"><Droplets className="h-5 w-5" /></span>
          <span className="min-w-0">
            <span className="block truncate text-base font-bold text-foreground">AquaTrack</span>
            <span className="block truncate text-[11px] text-muted-foreground">School Water Management</span>
          </span>
        </Link>
        <nav className="sidebar-nav">{navigation(true)}</nav>
      </aside>

      <div className="app-content-column">
        <header className="app-topbar">
          <div className="app-topbar-inner">
            <p className="topbar-organization" title={districtName}>{districtName}</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="user-menu-trigger" aria-label="Open user menu">
                  <Avatar className="h-9 w-9 border border-primary/15">
                    <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-56 truncate text-sm font-medium text-foreground sm:block">{userEmail}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-xl p-2">
                <DropdownMenuLabel className="font-normal">
                  <span className="block text-xs text-muted-foreground">Signed in as</span>
                  <span className="mt-0.5 block truncate text-sm font-semibold">{userEmail}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer rounded-lg text-destructive focus:text-destructive" onSelect={() => void handleSignOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="app-main-content scroll-gutter-stable">{children}</main>
      </div>

      <nav className="nav-bar" aria-label="AquaTrack navigation">
        <div className="mx-auto grid w-full max-w-3xl grid-cols-5 items-stretch px-1 md:px-4">
          {navigation()}
        </div>
      </nav>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
