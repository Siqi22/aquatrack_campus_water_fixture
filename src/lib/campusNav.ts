/** Deep-linkable campus browser state (survives remount / fixture detail back). */
export function campusBrowseUrl(opts: {
  campusId: string;
  buildingId?: string | null;
  floor?: string | null;
  focusFloor?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set('campus', opts.campusId);
  if (opts.buildingId) params.set('building', opts.buildingId);
  if (opts.floor) params.set('floor', opts.floor);
  if (opts.focusFloor) params.set('focus', opts.focusFloor);
  return `/campus?${params.toString()}`;
}

export function campusFloorUrl(campusId: string, buildingId: string, floor: string): string {
  return campusBrowseUrl({ campusId, buildingId, floor });
}
