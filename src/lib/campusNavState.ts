const STORAGE_KEY = 'aquatrack.campus-nav';

export interface CampusNavState {
  selectedCampus: string;
  expandedBuilding: string | null;
  selectedFloor: { buildingId: string; floor: string } | null;
}

export function loadCampusNavState(fallbackCampusId: string): CampusNavState {
  const fallback: CampusNavState = {
    selectedCampus: fallbackCampusId,
    expandedBuilding: null,
    selectedFloor: null,
  };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<CampusNavState>;
    return {
      selectedCampus: parsed.selectedCampus || fallbackCampusId,
      expandedBuilding: parsed.expandedBuilding ?? null,
      selectedFloor: parsed.selectedFloor ?? null,
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
