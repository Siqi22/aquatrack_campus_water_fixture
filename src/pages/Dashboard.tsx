import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  FlaskConical,
  RotateCcw,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useFixtureStore } from '@/store/fixtureStore';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useLeadTesting } from '@/hooks/useLeadTesting';

export default function Dashboard() {
  const { organizationName } = useOrganization();
  const { fixtures, campuses, buildings, loading, loaded } = useFixtureStore();
  const lead = useLeadTesting();

  const districtName = (
    campuses.find((campus) => campus.schoolDistrict?.trim())?.schoolDistrict || organizationName
  ).replace(/\s+School District$/i, '');

  const latestRoundByFixture = useMemo(() => {
    const latest = new Map<string, (typeof lead.rounds)[number]>();
    lead.rounds.forEach((round) => {
      const current = latest.get(round.fixture_id);
      if (!current || round.round_number > current.round_number) latest.set(round.fixture_id, round);
    });
    return latest;
  }, [lead.rounds]);

  const fixtureState = (fixtureId: string) => {
    const fixture = fixtures.find((item) => item.id === fixtureId);
    const round = latestRoundByFixture.get(fixtureId);
    return {
      status: fixture?.currentLeadTestingStatus ?? round?.status ?? 'not_started',
      ppb: round?.result_ppb ?? fixture?.currentResultPpb ?? null,
    };
  };

  const schoolCount = (matches: (status: string, ppb: number | null) => boolean) =>
    new Set(
      fixtures
        .filter((fixture) => {
          const state = fixtureState(fixture.id);
          return matches(state.status, state.ppb);
        })
        .map((fixture) => fixture.campusId),
    ).size;

  const leadStatus = {
    sampling: schoolCount((status) => ['not_started', 'scheduled'].includes(status)),
    results: schoolCount((status) => ['awaiting_results', 'awaiting_retest_results'].includes(status)),
    above5: schoolCount((_status, ppb) => ppb !== null && ppb > 5 && ppb <= 15),
    above15: schoolCount((_status, ppb) => ppb !== null && ppb > 15),
    retesting: schoolCount((status) => ['awaiting_retest', 'retest_sample_drawn', 'awaiting_retest_results'].includes(status)),
    remediation: schoolCount((status) => ['action_required', 'remediation_in_progress'].includes(status)),
  };

  const schoolsWithFixtureData = new Set(fixtures.map((fixture) => fixture.campusId)).size;
  const fixtureDataCoverage = campuses.length > 0
    ? Math.round((schoolsWithFixtureData / campuses.length) * 100)
    : 0;

  const lastUpdated = fixtures
    .map((fixture) => fixture.leadTestingLastUpdatedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return (
    <div className="page-shell">
      <header className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">{districtName}</p>
          <h1 className="page-title mt-1">Lead Testing Overview</h1>
          <p className="page-subtitle">Track lead testing progress across all schools.</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleDateString() : 'No testing activity yet'}
        </p>
      </header>

      {!loaded && loading ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">Loading workspace…</p>
      ) : (
        <div className="space-y-4">
          <section className="card-soft p-4 sm:p-5" aria-label="Fixture inventory status">
            <SectionHeading
              icon={Building2}
              title="Fixture Inventory Status"
              subtitle="Schools with recorded fixture locations"
            />
            <Link
              to="/campus"
              className="mt-4 block rounded-xl border bg-card p-4 transition-colors hover:bg-secondary/30"
            >
              <p className="text-2xl font-bold tabular-nums text-foreground">{fixtureDataCoverage}%</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">Schools with fixture data</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {schoolsWithFixtureData} of {campuses.length} schools
              </p>
            </Link>
          </section>

          <section className="card-soft p-4 sm:p-5">
            <SectionHeading icon={Wrench} title="Action Status" subtitle="Schools that require action" />
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <ActionCard icon={FlaskConical} value={leadStatus.sampling} label="Awaiting initial sampling" to="/campus?leadFilter=sample" active={leadStatus.sampling > 0} />
              <ActionCard icon={ClipboardCheck} value={leadStatus.results} label="Awaiting laboratory results" to="/campus?leadFilter=awaiting" />
              <ActionCard icon={RotateCcw} value={leadStatus.retesting} label="Awaiting retesting" to="/campus?leadFilter=retest" />
              <ActionCard icon={ShieldCheck} value={leadStatus.remediation} label="In active remediation" to="/campus?leadFilter=remediation" />
            </div>
          </section>

          <section className="card-soft p-4 sm:p-5">
            <SectionHeading icon={BarChart3} title="Completed Test Results" subtitle="Schools with completed laboratory results" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ResultCard value={leadStatus.above5} label="Schools with results 5–15 ppb" tone="warning" to="/campus?leadFilter=above5" />
              <ResultCard value={leadStatus.above15} label="Schools with results above 15 ppb" tone="urgent" to="/campus?leadFilter=immediate" />
            </div>
          </section>

          <p className="text-xs text-muted-foreground">
            {campuses.length} schools · {buildings.length} buildings · {fixtures.length} fixtures
          </p>
        </div>
      )}
    </div>
  );
}

function SectionHeading({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  value,
  label,
  to,
  active = false,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  to: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-secondary/30 ${
        active ? 'border-orange-400 bg-orange-50/50' : 'bg-card'
      }`}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${active ? 'bg-orange-100 text-orange-600' : 'bg-secondary text-muted-foreground'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className={`text-xl font-bold tabular-nums ${active ? 'text-orange-600' : 'text-foreground'}`}>{value}</p>
        <p className="text-[11px] font-medium leading-tight text-muted-foreground">{label}</p>
      </div>
    </Link>
  );
}

function ResultCard({ value, label, tone, to }: { value: number; label: string; tone: 'warning' | 'urgent'; to: string }) {
  return (
    <Link to={to} className={`rounded-xl border p-4 transition-colors hover:bg-secondary/30 ${tone === 'warning' ? 'border-amber-200' : 'border-red-200'}`}>
      <p className={`text-2xl font-bold tabular-nums ${tone === 'warning' ? 'text-amber-500' : 'text-red-600'}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </Link>
  );
}
