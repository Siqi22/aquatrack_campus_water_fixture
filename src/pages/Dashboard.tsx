import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFixtureStore } from '@/store/fixtureStore';
import type { Fixture } from '@/store/fixtureStore';
import { ActionTile } from '@/components/layout/ActionTile';
import { QuickStat } from '@/components/layout/QuickStat';
import { ExportDialog } from '@/components/ExportDialog';
import {
  Search,
  Download,
  Upload,
  Wrench,
  ArrowRight,
  Building2,
  FileSpreadsheet,
  ClipboardList,
} from 'lucide-react';
import { getQuickStart } from '@/lib/roles';
import { issueLabel } from '@/lib/fieldLabels';
import type { LucideIcon } from 'lucide-react';

const stepIcons: Record<string, LucideIcon> = {
  survey: ClipboardList,
  campus: Building2,
  import: FileSpreadsheet,
  maintenance: Wrench,
};

function getReviewReasons(fixture: Fixture): string[] {
  const reasons: string[] = [];
  if (fixture.qualityRating.pressure <= 1) reasons.push('Low pressure');
  if (fixture.qualityRating.cleanliness <= 1) reasons.push('Low cleanliness');
  if (fixture.issues?.length) reasons.push(...fixture.issues.map(issueLabel));
  if (fixture.observations?.trim()) reasons.push('Has notes');
  return reasons;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    fixtures,
    campuses,
    buildings,
    loading,
    loaded,
    searchFixtures,
  } = useFixtureStore();
  const [query, setQuery] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  const hasFixtures = fixtures.length > 0;
  const quickStart = getQuickStart(hasFixtures);
  const urgentFixtures = fixtures
    .map((fixture) => ({ fixture, reasons: getReviewReasons(fixture) }))
    .filter(({ reasons }) => reasons.length > 0);
  const urgentCount = urgentFixtures.length;

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchFixtures(query).slice(0, 8);
  }, [query, searchFixtures]);

  function openImport() {
    navigate('/?import=1');
  }

  return (
    <div className="page-shell">
      <header className="page-header">
        <p className="section-label">Home</p>
        <h1 className="page-title mt-1">{hasFixtures ? 'Inventory overview' : 'Get started'}</h1>
        <p className="page-subtitle">
          {hasFixtures
            ? `${fixtures.length} fixtures across ${buildings.length} buildings`
            : 'Import a spreadsheet or survey on site — nothing is pre-loaded.'}
        </p>
      </header>

      <section className="space-y-2">
        {quickStart.slice(0, 2).map((step, i) => (
          <ActionTile
            key={step.id}
            icon={stepIcons[step.id] ?? ClipboardList}
            title={step.label}
            description={step.description}
            primary={i === 0}
            to={step.id === 'import' ? undefined : step.to}
            onClick={step.id === 'import' ? openImport : undefined}
          />
        ))}
      </section>

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={openImport} className="btn-secondary flex-1 text-xs">
          <Upload className="h-3.5 w-3.5" />
          Import
        </button>
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          disabled={!loaded || !hasFixtures}
          className="btn-secondary flex-1 text-xs"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} fixtures={fixtures} campuses={campuses} />

      {!loaded && loading && (
        <p className="mt-8 text-center text-sm text-muted-foreground">Loading workspace…</p>
      )}

      {loaded && hasFixtures && (
        <>
          <div className="mt-5 flex gap-2">
            <QuickStat
              label="Fixtures"
              value={fixtures.length}
              to="/add?mode=manage"
              ariaLabel={`View ${fixtures.length} fixtures`}
            />
            <QuickStat label="Urgent" value={urgentCount} tone={urgentCount > 0 ? 'urgent' : 'default'} />
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fixtures…"
              className="search-input"
            />
          </div>

          {query.trim() && (
            <div className="mt-2 space-y-1">
              {results.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No matches</p>
              ) : (
                results.map((f) => (
                  <Link key={f.id} to={`/fixture/${f.id}`} className="list-row">
                    <div className="min-w-0">
                      <p className="list-row-title">
                        {f.buildingName} · Fl {f.floor} · {f.roomNumber}
                      </p>
                      <p className="list-row-subtitle">
                        {[f.brand, f.model].filter(Boolean).join(' ') || 'Details pending'}
                      </p>
                    </div>
                    {getReviewReasons(f).length > 0 ? (
                      <span className="rounded-full bg-status-urgent/10 px-2 py-1 text-[10px] font-semibold text-status-urgent">
                        Review
                      </span>
                    ) : null}
                  </Link>
                ))
              )}
            </div>
          )}

          {urgentFixtures.length > 0 && (
            <section className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="section-label">Needs attention</h2>
                <Link to="/add?mode=manage" className="link-action">
                  All <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {urgentFixtures.slice(0, 3).map(({ fixture: f, reasons }) => (
                  <Link key={f.id} to={`/fixture/${f.id}`} className="list-row">
                    <div className="min-w-0">
                      <p className="list-row-title">
                        {f.buildingName} · {f.roomNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reasons.slice(0, 2).join(' · ')}
                        {reasons.length > 2 ? ` +${reasons.length - 2} more` : ''}
                      </p>
                    </div>
                    <span className="rounded-full bg-status-urgent/10 px-2 py-1 text-[10px] font-semibold text-status-urgent">
                      Review
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <Link to="/campus" className="action-tile mt-6">
            <div className="action-tile-icon">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Campus & floor progress</p>
              <p className="text-xs text-muted-foreground">Browse buildings and continue surveys</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </>
      )}
    </div>
  );
}
