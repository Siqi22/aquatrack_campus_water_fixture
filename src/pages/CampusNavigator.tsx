import { useEffect, useRef, useState } from 'react';
import { useFixtureStore } from '@/store/fixtureStore';
import { FloorPlanView } from '@/components/FloorPlanView';
import { PageHeader } from '@/components/layout/PageHeader';
import { loadCampusNavState, saveCampusNavState } from '@/lib/campusNavState';
import { Building2, ChevronRight, ChevronDown, Download, Layers } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSearchParams } from 'react-router-dom';
import {
  isLeadFixtureFilter,
  LEAD_FIXTURE_FILTER_OPTIONS,
  matchesLeadFixtureFilter,
  type LeadFixtureFilter,
} from '@/lib/leadTestingFilters';
import { Button } from '@/components/ui/button';
import { LeadResultsExportDialog } from '@/components/LeadResultsExportDialog';

const ALL_SCHOOLS_VALUE = 'all-schools';

function getPageScrollContainer(): HTMLElement | null {
  return document.querySelector('main.scroll-gutter-stable');
}

function restorePageScroll(top: number) {
  const scrollToTop = () => {
    const el = getPageScrollContainer();
    if (el) el.scrollTop = top;
  };

  requestAnimationFrame(scrollToTop);
  requestAnimationFrame(() => requestAnimationFrame(scrollToTop));
  window.setTimeout(scrollToTop, 80);
}

export default function CampusNavigator() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { campuses, getBuildingsByCampus, getFixturesByBuilding, getFixturesByCampus, getFloorsByBuilding } =
    useFixtureStore();
  const { isSchoolDistrict, locationLabel } = useOrganization();
  const visibleCampuses = campuses;
  const requestedFilter = searchParams.get('leadFilter');
  const leadFilter: LeadFixtureFilter = isLeadFixtureFilter(requestedFilter) ? requestedFilter : 'all';

  const defaultCampusId = isSchoolDistrict ? ALL_SCHOOLS_VALUE : visibleCampuses[0]?.id || '';
  const [selectedCampus, setSelectedCampus] = useState(defaultCampusId);
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<{ buildingId: string; floor: string } | null>(null);
  const [listScrollTop, setListScrollTop] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const restoreScrollTopRef = useRef<number | null>(null);

  const showingAllSchools = isSchoolDistrict && selectedCampus === ALL_SCHOOLS_VALUE;
  const scopedCampuses = showingAllSchools
    ? visibleCampuses
    : visibleCampuses.filter((campus) => campus.id === selectedCampus);
  const campusBuildings = scopedCampuses.flatMap((campus) => getBuildingsByCampus(campus.id));
  const campusFixtures = scopedCampuses.flatMap((campus) => getFixturesByCampus(campus.id));
  const campusFixtureCount = campusFixtures.length;
  const displayedBuildings = campusBuildings.filter(
    (building) =>
      leadFilter === 'all' ||
      getFixturesByBuilding(building.id).some((fixture) => matchesLeadFixtureFilter(fixture, leadFilter)),
  );
  const currentCampus = campuses.find((c) => c.id === selectedCampus);
  const totalSchools = visibleCampuses.length;

  useEffect(() => {
    if (!defaultCampusId || hydrated) return;
    const saved = loadCampusNavState(defaultCampusId);
    const campusValid =
      (isSchoolDistrict && saved.selectedCampus === ALL_SCHOOLS_VALUE) ||
      visibleCampuses.some((c) => c.id === saved.selectedCampus);
    setSelectedCampus(campusValid ? saved.selectedCampus : defaultCampusId);
    setExpandedBuilding(saved.expandedBuilding);
    setSelectedFloor(saved.selectedFloor);
    setListScrollTop(saved.listScrollTop);
    if (!saved.selectedFloor) restoreScrollTopRef.current = saved.listScrollTop;
    setHydrated(true);
  }, [defaultCampusId, visibleCampuses, hydrated, isSchoolDistrict]);

  useEffect(() => {
    if (
      (isSchoolDistrict && selectedCampus === ALL_SCHOOLS_VALUE) ||
      visibleCampuses.some((campus) => campus.id === selectedCampus)
    ) return;
    setSelectedCampus(defaultCampusId);
    setExpandedBuilding(null);
    setSelectedFloor(null);
  }, [defaultCampusId, isSchoolDistrict, selectedCampus, visibleCampuses]);

  useEffect(() => {
    if (!hydrated || !selectedCampus) return;
    saveCampusNavState({ selectedCampus, expandedBuilding, selectedFloor, listScrollTop });
  }, [hydrated, selectedCampus, expandedBuilding, selectedFloor, listScrollTop]);

  useEffect(() => {
    if (!hydrated || selectedFloor || restoreScrollTopRef.current == null) return;
    const top = restoreScrollTopRef.current;
    restoreScrollTopRef.current = null;
    restorePageScroll(top);
  }, [hydrated, selectedFloor, campusBuildings.length, expandedBuilding]);

  function backFromFloor() {
    const saved = loadCampusNavState(selectedCampus || defaultCampusId);
    const nextScrollTop = saved.listScrollTop || listScrollTop;
    if (selectedFloor) {
      setExpandedBuilding(selectedFloor.buildingId);
    }
    restoreScrollTopRef.current = nextScrollTop;
    setSelectedFloor(null);
  }

  function openFloor(buildingId: string, floor: string) {
    const nextScrollTop = getPageScrollContainer()?.scrollTop ?? 0;
    const nextSelectedFloor = { buildingId, floor };
    setListScrollTop(nextScrollTop);
    setExpandedBuilding(buildingId);
    setSelectedFloor(nextSelectedFloor);
    saveCampusNavState({
      selectedCampus,
      expandedBuilding: buildingId,
      selectedFloor: nextSelectedFloor,
      listScrollTop: nextScrollTop,
    });
  }

  if (selectedFloor) {
    return (
      <div className="page-shell">
        <PageHeader
          title={`Floor ${selectedFloor.floor}`}
          subtitle={campusBuildings.find((b) => b.id === selectedFloor.buildingId)?.name ?? 'Building'}
          onBack={backFromFloor}
        />
        <FloorPlanView
          buildingId={selectedFloor.buildingId}
          floor={selectedFloor.floor}
          buildingName={campusBuildings.find((b) => b.id === selectedFloor.buildingId)?.name || ''}
          campusId={campusBuildings.find((b) => b.id === selectedFloor.buildingId)?.campusId || selectedCampus}
          leadFilter={leadFilter}
        />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        title={
          showingAllSchools
            ? `${totalSchools} ${totalSchools === 1 ? 'school' : 'schools'}`
            : isSchoolDistrict
              ? currentCampus?.school || 'School'
              : locationLabel
        }
        subtitle={
          scopedCampuses.length > 0
            ? `${campusBuildings.length} buildings · ${campusFixtureCount} fixtures`
            : `Select a ${locationLabel.toLowerCase()} to browse`
        }
        action={
          <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
            <Download className="mr-1 h-4 w-4" />
            Download
          </Button>
        }
      />
      <LeadResultsExportDialog open={exportOpen} onOpenChange={setExportOpen} campuses={visibleCampuses} />

      <div className="mb-4 grid max-w-3xl gap-3 sm:grid-cols-2">
        {visibleCampuses.length > 1 && (
        <div>
          <p className="field-label mb-2">School</p>
          <Select
            value={selectedCampus}
            onValueChange={(value) => {
              setSelectedCampus(value);
              setExpandedBuilding(null);
              setSelectedFloor(null);
              setListScrollTop(0);
              restoreScrollTopRef.current = 0;
            }}
          >
            <SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SCHOOLS_VALUE}>All schools</SelectItem>
              {visibleCampuses.map((campus) => (
                <SelectItem key={campus.id} value={campus.id}>
                  {isSchoolDistrict ? campus.school : campus.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        )}
        <div>
          <p className="field-label mb-2">Lead Testing Filter</p>
          <Select
            value={leadFilter}
            onValueChange={(value: LeadFixtureFilter) => {
              const next = new URLSearchParams(searchParams);
              if (value === 'all') next.delete('leadFilter');
              else next.set('leadFilter', value);
              setSearchParams(next);
              setExpandedBuilding(null);
              setSelectedFloor(null);
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEAD_FIXTURE_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {currentCampus && visibleCampuses.length === 1 && (
        <p className="mb-4 text-sm text-muted-foreground">{isSchoolDistrict ? currentCampus.school : currentCampus.name}</p>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {displayedBuildings.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-12 text-center">
            <Building2 className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium text-foreground">{leadFilter === 'all' ? 'No buildings yet' : 'No fixtures match this filter'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{leadFilter === 'all' ? 'No buildings are available for this school.' : 'Choose another lead testing status or school.'}</p>
          </div>
        ) : (
          displayedBuildings.map((b) => {
            const isOpen = expandedBuilding === b.id;
            const buildingFixtures = getFixturesByBuilding(b.id).filter((fixture) => matchesLeadFixtureFilter(fixture, leadFilter));
            const fixtureCount = buildingFixtures.length;
            const floors = getFloorsByBuilding(b.id).filter(
              (floor) => leadFilter === 'all' || buildingFixtures.some((fixture) => fixture.floor === floor.floor),
            );

            return (
              <div key={b.id} className="card-soft overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedBuilding(isOpen ? null : b.id)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <div className="action-tile-icon">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{b.name}</p>
                    {showingAllSchools && (
                      <p className="text-xs text-muted-foreground">
                        {visibleCampuses.find((campus) => campus.id === b.campusId)?.school}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {floors.length} floors · {fixtureCount} fixtures
                    </p>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {isOpen && (
                  <div className="border-t px-2 pb-2">
                    {floors.map((fp) => (
                      <button
                        key={fp.floor}
                        type="button"
                        onClick={() => openFloor(b.id, fp.floor)}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary/50"
                      >
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-sm text-foreground">Floor {fp.floor}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
