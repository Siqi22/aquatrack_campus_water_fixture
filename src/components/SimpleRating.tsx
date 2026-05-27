/** Three-level rating (Low / OK / Good) — easier to interpret than 1–5 stars. */
const OPTIONS = [
  { value: 1, label: 'Low' },
  { value: 2, label: 'OK' },
  { value: 3, label: 'Good' },
] as const;

function normalizeRating(value: number) {
  return value <= 1 ? 1 : value >= 3 ? 3 : 2;
}

export function ratingLabel(value: number) {
  return OPTIONS.find((opt) => opt.value === normalizeRating(value))?.label ?? 'OK';
}

interface SimpleRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  compact?: boolean;
}

export function SimpleRating({ value, onChange, readonly, compact }: SimpleRatingProps) {
  const normalized = normalizeRating(value);

  return (
    <div className={`mt-1 flex flex-wrap ${compact ? 'gap-1' : 'gap-2'}`}>
      {OPTIONS.map((opt) => {
        const active = normalized === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(opt.value)}
            className={`rounded-full font-semibold transition-colors ${
              compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1.5 text-xs'
            } ${
              active
                ? 'bg-primary text-primary-foreground'
                : readonly
                  ? 'cursor-default bg-secondary/50 text-muted-foreground'
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
