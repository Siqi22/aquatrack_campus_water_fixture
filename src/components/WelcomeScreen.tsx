import { useNavigate } from 'react-router-dom';
import { Building2, ClipboardList, Droplets, FileSpreadsheet, Wrench, X } from 'lucide-react';
import { getQuickStart } from '@/lib/roles';
import { ActionTile } from '@/components/layout/ActionTile';

const welcomeKey = (userId: string) => `aquaTrack:welcomeDismissed:${userId}`;

export function wasWelcomeDismissed(userId: string | undefined): boolean {
  if (!userId) return true;
  try {
    return localStorage.getItem(welcomeKey(userId)) === '1';
  } catch {
    return false;
  }
}

export function dismissWelcome(userId: string | undefined): void {
  if (!userId) return;
  try {
    localStorage.setItem(welcomeKey(userId), '1');
  } catch {
    /* ignore */
  }
}

interface Props {
  userId: string;
  fixtureCount: number;
  onDismiss: () => void;
  onImport: () => void;
}

export function WelcomeScreen({ userId, fixtureCount, onDismiss, onImport }: Props) {
  const navigate = useNavigate();
  const steps = getQuickStart(fixtureCount > 0);

  return (
    <div className="welcome-overlay">
      <div className="welcome-panel">
        <button type="button" onClick={onDismiss} className="welcome-close" aria-label="Close">
          <X className="h-4 w-4" />
        </button>

        <div className="welcome-badge">
          <Droplets className="h-5 w-5 text-primary" />
          <span>AquaTrack</span>
        </div>

        <h2 className="mt-4 text-lg font-bold text-foreground">Welcome to AquaTrack</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Survey fixtures on site, import spreadsheets, or browse your campus inventory.
        </p>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          What would you like to do?
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
                dismissWelcome(userId);
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
