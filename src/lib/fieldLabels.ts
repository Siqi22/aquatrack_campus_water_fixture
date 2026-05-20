/** Slide-aligned field labels used across forms, detail views, and export. */
export const FIELD_LABELS = {
  companyName: 'Company name',
  model: 'Model',
  serialNumber: 'Serial number',
  productNumber: 'Product number (filter type)',
  modelLabel: 'Model label',
  generalPhoto: 'General photo',
  floor: 'Floor',
  room: 'Room / landmark',
} as const;

export const NO_LABEL_REASONS = [
  'Sticker worn off / illegible',
  'Label partially worn or damaged',
  'Plate hidden behind wall or fixture body',
  'Older fixture — no plate present',
  'Plate damaged / painted over',
  'Other',
] as const;

export const ISSUE_OPTIONS: { id: string; label: string }[] = [
  { id: 'rust', label: 'Rust / corrosion' },
  { id: 'low_flow', label: 'Low flow / pressure' },
  { id: 'noisy', label: 'Noisy' },
  { id: 'dirty', label: 'Dirty / needs cleaning' },
  { id: 'clogged_filter', label: 'Clogged filter' },
];

export function issueLabel(id: string): string {
  return ISSUE_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export const FLOOR_STATUS_LABELS: Record<string, string> = {
  NotStarted: 'Not started',
  InProgress: 'In progress',
  Done: 'Complete',
  Restricted: 'Locked',
};
