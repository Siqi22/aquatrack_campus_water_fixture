/** Shared status pill backgrounds — pair with `.status-pill` base class. */
export const floorStatusPillClass: Record<string, string> = {
  NotStarted: 'bg-secondary text-secondary-foreground',
  InProgress: 'bg-status-warning/15 text-status-warning',
  Done: 'bg-status-good/15 text-status-good',
  Restricted: 'bg-status-urgent/15 text-status-urgent',
};

export const fixtureStatusDotClass: Record<string, string> = {
  Good: 'bg-status-good',
  Warning: 'bg-status-warning',
  Urgent: 'bg-status-urgent',
};
