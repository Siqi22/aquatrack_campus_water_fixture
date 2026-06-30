const STORAGE_KEY = 'aquatrack.campus-nav';

export interface CampusNavState {
  selectedCampus: string;
  expandedBuilding: string | null;
  selectedFloor: { buildingId: string; floor: string } | null;
  listScrollTop: number;
}

export function loadCampusNavState(fallbackCampusId: string): CampusNavState {
  const fallback: CampusNavState = {
    selectedCampus: fallbackCampusId,
    expandedBuilding: null,
    selectedFloor: null,
    listScrollTop: 0,
  };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<CampusNavState>;
    return {
      selectedCampus: parsed.selectedCampus || fallbackCampusId,
      expandedBuilding: parsed.expandedBuilding ?? null,
      selectedFloor: parsed.selectedFloor ?? null,
      listScrollTop: typeof parsed.listScrollTop === 'number' ? parsed.listScrollTop : 0,
    };
  } catch {
    return fallback;
  }
}

export function saveCampusNavState(state: CampusNavState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}
