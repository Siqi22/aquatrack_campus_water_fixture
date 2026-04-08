import { FixtureStatus } from '@/store/fixtureStore';
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

const config: Record<FixtureStatus, { icon: typeof CheckCircle2; className: string }> = {
  Good: { icon: CheckCircle2, className: 'bg-status-good/10 text-status-good' },
  Warning: { icon: AlertTriangle, className: 'bg-status-warning/10 text-status-warning' },
  Urgent: { icon: AlertCircle, className: 'bg-status-urgent/10 text-status-urgent' },
};

export function StatusBadge({ status }: { status: FixtureStatus }) {
  const { icon: Icon, className } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}
