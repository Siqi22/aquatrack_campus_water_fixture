import { ClipboardCheck, FileUp, FlaskConical } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const sections = [
  { to: '/lead-testing/sampling', label: 'Sampling', icon: ClipboardCheck },
  { to: '/lead-testing/upload', label: 'Record Results', icon: FileUp },
  { to: '/lead-testing/results', label: 'View Results', icon: FlaskConical },
];

export function LeadTestingModuleNav() {
  return (
    <nav className="mb-5 grid grid-cols-3 gap-2 rounded-2xl bg-secondary/60 p-1.5" aria-label="Lead Testing navigation">
      {sections.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-sm font-semibold transition-colors ${
              isActive
                ? 'border-primary/30 bg-card text-primary shadow-sm'
                : 'border-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground'
            }`
          }
        >
          <Icon className="h-5 w-5" strokeWidth={2.25} />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
