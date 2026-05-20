interface Props {
  label: string;
  value: number | string;
  tone?: 'default' | 'good' | 'warning' | 'urgent';
}

const toneClass: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-foreground',
  good: 'text-status-good',
  warning: 'text-status-warning',
  urgent: 'text-status-urgent',
};

export function QuickStat({ label, value, tone = 'default' }: Props) {
  return (
    <div className="quick-stat">
      <p className={`text-xl font-bold tabular-nums ${toneClass[tone]}`}>{value}</p>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
