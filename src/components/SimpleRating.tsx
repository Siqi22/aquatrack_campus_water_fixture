/** Three-level rating (Low / OK / Good) — easier to interpret than 1–5 stars. */
const OPTIONS = [
  { value: 1, label: 'Low' },
  { value: 2, label: 'OK' },
  { value: 3, label: 'Good' },
] as const;

interface SimpleRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
}

export function SimpleRating({ value, onChange, readonly }: SimpleRatingProps) {
  const normalized = value <= 1 ? 1 : value >= 3 ? 3 : 2;

  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {OPTIONS.map((opt) => {
        const active = normalized === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(opt.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? 'bg-accent text-accent-foreground'
                : readonly
                  ? 'bg-secondary/50 text-muted-foreground cursor-default'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
