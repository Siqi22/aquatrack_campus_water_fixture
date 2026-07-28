import { Link } from 'react-router-dom';

interface Props {
  label: string;
  value: number | string;
  tone?: 'default' | 'good' | 'warning' | 'urgent';
  to?: string;
  ariaLabel?: string;
  onClick?: () => void;
}

const toneClass: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-foreground',
  good: 'text-status-good',
  warning: 'text-status-warning',
  urgent: 'text-status-urgent',
};

export function QuickStat({ label, value, tone = 'default', to, ariaLabel, onClick }: Props) {
  const content = (
    <>
      <p className={`text-xl font-bold tabular-nums ${toneClass[tone]}`}>{value}</p>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
    </>
  );

  if (to) {
    return (
      <Link to={to} aria-label={ariaLabel ?? `${label}: ${value}`} className="quick-stat quick-stat-link">
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel ?? `${label}: ${value}`} className="quick-stat quick-stat-link text-left">
        {content}
      </button>
    );
  }

  return <div className="quick-stat">{content}</div>;
}
