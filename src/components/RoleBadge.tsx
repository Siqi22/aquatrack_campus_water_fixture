import { ROLE_META, type AppRole } from '@/lib/roles';

interface Props {
  role: AppRole;
  compact?: boolean;
}

export function RoleBadge({ role, compact }: Props) {
  const meta = ROLE_META[role];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
      title={meta.description}
    >
      {!compact && <span className="text-muted-foreground">Role:</span>}
      {meta.label}
    </span>
  );
}
