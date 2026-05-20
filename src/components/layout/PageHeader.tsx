import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  backTo?: string;
  onBack?: () => void;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, backTo, onBack, action }: Props) {
  const backControl =
    backTo != null ? (
      <Link to={backTo} className="btn-icon" aria-label="Go back">
        <ChevronLeft className="h-5 w-5" />
      </Link>
    ) : onBack != null ? (
      <button type="button" onClick={onBack} className="btn-icon" aria-label="Go back">
        <ChevronLeft className="h-5 w-5" />
      </button>
    ) : null;

  return (
    <header className="page-header">
      <div className="flex items-center gap-2">
        {backControl}
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
        {action}
      </div>
    </header>
  );
}
