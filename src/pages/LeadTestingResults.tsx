/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { ArrowDownWideNarrow, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useFixtureStore } from '@/store/fixtureStore';
import { useLeadTesting, type TestingRound } from '@/hooks/useLeadTesting';
import { formatLeadMeasurement, leadResultColor } from '@/lib/leadTesting';
import { PageHeader } from '@/components/layout/PageHeader';
import { LeadTestingModuleNav } from '@/components/LeadTestingModuleNav';
import { QuickStat } from '@/components/layout/QuickStat';
import { Button } from '@/components/ui/button';
import { leadReportRowBelongsToWorkspace } from '@/lib/leadReportScope';
import { compareFloorKeys, formatFloorLabel } from '@/lib/floorUtils';
import { useOrganization } from '@/contexts/OrganizationContext';
import { resolveWorkspaceSchoolDistrict } from '@/lib/schoolDistrict';

interface ResultItem {
  round: TestingRound;
  school: string;
  building: string;
  floor: string;
  location: string;
}

type ResultSort = 'location' | 'lead';

function compareText(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

function compareLocation(left: ResultItem, right: ResultItem) {
  return compareText(left.school, right.school)
    || compareText(left.building, right.building)
    || compareFloorKeys(left.floor, right.floor)
    || compareText(left.location, right.location)
    || compareText(left.round.fixture_id, right.round.fixture_id);
}

export default function LeadTestingResults() {
  const { fixtures, campuses } = useFixtureStore();
  const { organizationName } = useOrganization();
  const lead = useLeadTesting();
  const [unresolved, setUnresolved] = useState(0);
  const [sortBy, setSortBy] = useState<ResultSort>('location');
  const fixtureIds = useMemo(() => new Set(fixtures.map((fixture) => fixture.id)), [fixtures]);
  const districtName = resolveWorkspaceSchoolDistrict(campuses, organizationName);
  const schoolNames = useMemo(
    () => new Set(campuses.map((campus) => (campus.school || campus.name).trim().toLowerCase())),
    [campuses],
  );
  const imported = useMemo<ResultItem[]>(
    () => lead.rounds
      .filter((round) => fixtureIds.has(round.fixture_id) && round.report_upload_id && round.result_value)
      .flatMap((round) => {
        const fixture = fixtures.find((item) => item.id === round.fixture_id);
        if (!fixture) return [];
        const campus = campuses.find((item) => item.id === fixture.campusId);
        if (!campus) return [];
        return [{
          round,
          school: campus.school || campus.name,
          building: fixture.buildingName,
          floor: fixture.floor,
          location: fixture.nearestRoom || fixture.roomNumber || '',
        }];
      }),
    [lead.rounds, fixtureIds, fixtures, campuses],
  );
  const sortedImported = useMemo(() => [...imported].sort((left, right) => {
    if (sortBy === 'lead') {
      const leadDifference = (right.round.result_ppb ?? -1) - (left.round.result_ppb ?? -1);
      if (leadDifference) return leadDifference;
    }
    return compareLocation(left, right);
  }), [imported, sortBy]);

  useEffect(() => {
    void (async () => {
      const db = supabase as any;
      const result = await db.from('lead_testing_report_rows')
        .select('id,school_name,proposed_fixture_id,confirmed_fixture_id,imported_testing_round_id,match_status,user_confirmed,lead_testing_report_uploads(district_or_organization)')
        .is('imported_testing_round_id', null)
        .eq('user_confirmed', false)
        .neq('match_status', 'excluded')
        .is('deleted_at', null);
      if (result.error) return;
      setUnresolved((result.data ?? []).filter((row: any) => (
        leadReportRowBelongsToWorkspace(row, fixtureIds, districtName, schoolNames)
      )).length);
    })();
  }, [fixtureIds, districtName, schoolNames, lead.rounds.length]);

  return (
    <div className="page-shell">
      <PageHeader title="Lead Testing Results" subtitle="Imported laboratory results" />
      <LeadTestingModuleNav />
      <div className="grid grid-cols-2 gap-2">
        <QuickStat label="Verified" value={imported.length} />
        <QuickStat label="Unresolved Matches" value={unresolved} to="/lead-testing/upload?review=unresolved" />
      </div>

      <section className="mt-5 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="section-label">Testing Results · {imported.length}</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Sort testing results">
            <Button type="button" size="sm" variant={sortBy === 'location' ? 'default' : 'outline'} onClick={() => setSortBy('location')}>
              <Building2 />
              School / Building / Floor
            </Button>
            <Button type="button" size="sm" variant={sortBy === 'lead' ? 'default' : 'outline'} onClick={() => setSortBy('lead')}>
              <ArrowDownWideNarrow />
              Lead Level (ppb)
            </Button>
          </div>
        </div>

        {sortedImported.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border">
            <div className="min-w-[56rem]">
              <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_6rem_minmax(0,1.15fr)_6rem] gap-3 border-b bg-secondary/40 px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground">
                <span>School</span><span>Building</span><span>Floor</span><span>Fixture Location</span><span>Lead (ppb)</span>
              </div>
              {sortedImported.map((item) => (
                <Link to={`/fixture/${item.round.fixture_id}`} key={item.round.id} className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_6rem_minmax(0,1.15fr)_6rem] gap-3 border-b px-3 py-3 text-left text-xs last:border-b-0 hover:bg-secondary/30">
                  <span className="min-w-0">{item.school}</span>
                  <span className="min-w-0">{item.building}</span>
                  <span className="min-w-0">{formatFloorLabel(item.floor)}</span>
                  <span className="min-w-0">{item.location || '—'}</span>
                  <span className={`whitespace-nowrap font-bold tabular-nums ${leadResultColor(item.round.result_ppb)}`}>
                    {formatLeadMeasurement(item.round.result_value, item.round.result_original_unit, item.round.result_ppb).replace(/ ppb$/, '')}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state mt-10">
            <p className="text-sm font-semibold">No imported laboratory results</p>
            <p className="mt-1 text-xs text-muted-foreground">Upload and confirm a report to see results here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
