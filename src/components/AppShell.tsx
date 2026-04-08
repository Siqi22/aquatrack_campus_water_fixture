import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Building2, PlusCircle, Wrench, ListChecks } from 'lucide-react';

const tabs = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/campus', icon: Building2, label: 'Campus' },
  { to: '/add', icon: PlusCircle, label: 'Onboard' },
  { to: '/manage', icon: ListChecks, label: 'Assets' },
  { to: '/maintenance', icon: Wrench, label: 'Service' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex-1 overflow-y-auto pb-20">{children}</div>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/80 backdrop-blur-xl shadow-lg">
        <div className="mx-auto flex max-w-lg">
          {tabs.map(({ to, icon: Icon, label }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-accent' : 'text-muted-foreground'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-accent' : ''}`} strokeWidth={active ? 2.2 : 1.6} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
