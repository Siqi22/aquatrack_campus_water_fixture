import { useNavigate } from 'react-router-dom';
import { Building2, ClipboardList, Droplets, FileSpreadsheet, Shield, Wrench, X } from 'lucide-react';
import { ROLE_META, getRoleQuickStart, type AppRole } from '@/lib/roles';
import { ActionTile } from '@/components/layout/ActionTile';

const WELCOME_KEY = 'aquaTrack:welcomeDismissed';

export function wasWelcomeDismissed(): boolean {
  try {
    return sessionStorage.getItem(WELCOME_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissWelcome(): void {
  try {
    sessionStorage.setItem(WELCOME_KEY, '1');
  } catch {
    /* ignore */
  }
}

const roleIcons: Record<AppRole, typeof Droplets> = {
  Surveyor: ClipboardList,
  Facilities: Building2,
  Admin: Shield,
};

interface Props {
  role: AppRole;
  fixtureCount: number;
  onDismiss: () => void;
  onImport: () => void;
}

export function WelcomeScreen({ role, fixtureCount, onDismiss, onImport }: Props) {
  const navigate = useNavigate();
  const meta = ROLE_META[role];
  const RoleIcon = roleIcons[role];
  const steps = getRoleQuickStart(role, fixtureCount > 0);

  return (
    <div className="welcome-overlay">
      <div className="welcome-panel">
        <button type="button" onClick={onDismiss} className="welcome-close" aria-label="Close">
          <X className="h-4 w-4" />
        </button>

        <div className="welcome-badge">
          <RoleIcon className="h-5 w-5 text-primary" />
          <span>{meta.label}</span>
        </div>

        <h2 className="mt-4 text-lg font-bold text-foreground">Welcome to AquaTrack</h2>
        <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Recommended next steps
        </p>
        <div className="mt-2 space-y-2">
          {steps.map((step, i) => (
            <ActionTile
              key={step.id}
              icon={
                step.id === 'import'
                  ? FileSpreadsheet
                  : step.id === 'maintenance'
                    ? Wrench
                    : step.id === 'campus'
                      ? Building2
                      : ClipboardList
              }
              title={step.label}
              description={step.description}
              primary={i === 0}
              onClick={() => {
                onDismiss();
                if (step.id === 'import') onImport();
                else navigate(step.to);
              }}
            />
          ))}
        </div>

        <button type="button" onClick={onDismiss} className="btn-primary mt-5 w-full">
          Go to home
        </button>
      </div>
    </div>
  );
}
