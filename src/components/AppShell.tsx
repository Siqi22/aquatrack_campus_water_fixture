import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, PlusCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const tabs = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/add', icon: PlusCircle, label: 'Assets' },
  { to: '/campus', icon: Building2, label: 'Campus' },
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
      <div className="flex-1 overflow-y-scroll pb-24 scroll-gutter-stable">{children}</div>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-card via-card/95 to-card/80 shadow-[0_-5px_15px_rgba(147,147,147,0.14)] backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-lg items-center justify-center gap-[50px] px-6">
          {tabs.map(({ to, icon: Icon, label }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                className={`flex h-9 items-center justify-center transition-colors ${
                  active
                    ? 'gap-1 rounded-[20px] bg-[#C8C8F4]/15 px-3 py-1 text-[#4C4DDC]'
                    : 'w-8 text-[#939393] hover:text-foreground'
                }`}
              >
                <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 1.8} />
                {active ? <span className="text-xs font-semibold leading-none">{label}</span> : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
