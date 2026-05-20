import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  to?: string;
  onClick?: () => void;
  primary?: boolean;
}

export function ActionTile({ icon: Icon, title, description, to, onClick, primary }: Props) {
  const className = primary ? 'action-tile action-tile-primary' : 'action-tile';

  const inner = (
    <>
      <div className={`action-tile-icon ${primary ? 'action-tile-icon-primary' : ''}`}>
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}
