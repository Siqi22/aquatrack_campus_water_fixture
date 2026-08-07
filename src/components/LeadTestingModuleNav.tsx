import { ClipboardCheck, FileUp, FlaskConical } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const sections = [
  { to: '/lead-testing/sampling', label: 'Sampling', icon: ClipboardCheck },
  { to: '/lead-testing/upload', label: 'Record Results', icon: FileUp },
  { to: '/lead-testing/results', label: 'View Results', icon: FlaskConical },
];

export function LeadTestingModuleNav() {
  return (
    <nav className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-secondary/50 p-1" aria-label="Lead Testing navigation">
      {sections.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-semibold ${
              isActive ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
            }`
          }
        >
          <Icon className="h-4 w-4" />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
