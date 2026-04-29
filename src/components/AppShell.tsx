import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, PlusCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const tabs = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/campus', icon: Building2, label: 'Campus' },
  { to: '/add', icon: PlusCircle, label: 'Assets' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background app-surface">
      <header className="flex items-center justify-between px-4 py-2 border-b bg-card/60 backdrop-blur-sm">
        <span className="text-[11px] text-muted-foreground truncate">{user?.email}</span>
        <button
          onClick={async () => {
            await signOut();
            toast.success('Signed out');
            navigate('/auth', { replace: true });
          }}
          className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </header>
      <div className="flex-1 overflow-y-scroll pb-28 scroll-gutter-stable">{children}</div>
      <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4">
        <div className="mx-auto flex max-w-lg rounded-[1.75rem] border bg-card/90 p-2 shadow-[0_16px_45px_rgba(0,0,0,0.12)] backdrop-blur-xl">
          {tabs.map(({ to, icon: Icon, label }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-1 flex-col items-center gap-1 rounded-[1.25rem] py-2.5 text-[10px] font-semibold transition-all ${
                  active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.7} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
