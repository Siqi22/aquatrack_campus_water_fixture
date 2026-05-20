import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  analyzeCSV,
  enrichAnalysisWithDuplicates,
  buildExistingFixtureIndex,
  mappingLabel,
  type ImportAnalysis,
  type ImportMode,
} from '@/lib/importCSV';
import { isSpreadsheetFile, spreadsheetFormatLabel, spreadsheetToCSVText } from '@/lib/spreadsheet';
import { useFixtureStore } from '@/store/fixtureStore';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const IMPORT_MODES: { id: ImportMode; label: string; description: string }[] = [
  {
    id: 'skip_duplicates',
    label: 'Skip duplicates',
    description: 'Keep existing records; only add fixtures that are not already in the database.',
  },
  {
    id: 'update_existing',
    label: 'Update existing',
    description: 'Refresh matching fixtures (same campus, building, floor, and room) with spreadsheet values.',
  },
  {
    id: 'insert_only',
    label: 'Insert all rows',
    description: 'Always create new records — useful for one-time seed imports.',
  },
];

export function ImportDialog({ open, onOpenChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { importFromAnalysis, loading, fixtures, campuses } = useFixtureStore();
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('skip_duplicates');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAnalysis(null);
      setError(null);
      setImporting(false);
      setImportMode('skip_duplicates');
    }
  }, [open]);

  const previewFixtures = useMemo(() => analysis?.fixtures.slice(0, 5) ?? [], [analysis]);

  const effectiveNewCount = useMemo(() => {
    if (!analysis) return 0;
    if (importMode === 'insert_only') return analysis.fixtures.length;
    if (importMode === 'update_existing') return analysis.newFixtureCount;
    return analysis.newFixtureCount;
  }, [analysis, importMode]);

  async function handleFile(file: File) {
    setError(null);
    try {
      if (!isSpreadsheetFile(file)) {
        setError('Unsupported file type. Upload .csv, .xlsx, or .xls');
        return;
      }
      const text = await spreadsheetToCSVText(file);
      let result = analyzeCSV(text, file.name);
      if (result.headers.length === 0) {
        setError('Could not read column headers from this file.');
        setAnalysis(null);
        return;
      }
      if (result.mappings.length < 3) {
        setError('Not enough recognizable columns. Expected campus, building, floor, and room at minimum.');
        setAnalysis(null);
        return;
      }
      const index = buildExistingFixtureIndex(fixtures, campuses);
      result = enrichAnalysisWithDuplicates(result, index);
      setAnalysis(result);
      setImportMode(result.duplicateCount > 0 ? 'skip_duplicates' : 'insert_only');
    } catch (e) {
      console.error(e);
      setError('Failed to parse file. Export as UTF-8 CSV or Excel (.xlsx) and try again.');
      setAnalysis(null);
    }
  }

  async function handleImport() {
    if (!analysis) return;
    setImporting(true);
    try {
      const result = await importFromAnalysis(analysis, { mode: importMode });
      const parts = [
        result.fixturesImported ? `${result.fixturesImported} added` : null,
        result.fixturesUpdated ? `${result.fixturesUpdated} updated` : null,
        result.fixturesSkippedDuplicates ? `${result.fixturesSkippedDuplicates} skipped` : null,
        result.floorsLocked ? `${result.floorsLocked} floors locked` : null,
      ].filter(Boolean);
      toast.success(parts.length ? `Import complete: ${parts.join(', ')}` : 'Import complete');
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Import failed — check your connection and try again.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-accent" />
            Import spreadsheet
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Upload CSV or Excel (.xlsx). Columns are detected automatically — campus, building, floor, room, category,
          company name, model, serial number, and filter product number.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.currentTarget.value = '';
          }}
        />

        {!analysis ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-2 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 py-10 text-center transition-colors hover:border-accent hover:bg-accent/10"
          >
            <Upload className="h-8 w-8 text-accent" />
            <span className="text-sm font-semibold text-foreground">Choose spreadsheet file</span>
            <span className="text-[11px] text-muted-foreground">CSV, Excel (.xlsx), or legacy .xls</span>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border bg-secondary/30 p-3">
              <p className="text-sm font-semibold text-foreground">
                {analysis.fileName}{' '}
                <span className="text-[10px] font-normal text-muted-foreground">
                  ({spreadsheetFormatLabel(analysis.fileName)})
                </span>
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-card px-2 py-1.5">
                  <span className="text-muted-foreground">Fixture rows</span>
                  <p className="font-bold text-foreground">{analysis.fixtures.length}</p>
                </div>
                <div className="rounded-lg bg-card px-2 py-1.5">
                  <span className="text-muted-foreground">Already in database</span>
                  <p className="font-bold text-foreground">{analysis.duplicateCount}</p>
                </div>
                <div className="rounded-lg bg-card px-2 py-1.5">
                  <span className="text-muted-foreground">Locked floors</span>
                  <p className="font-bold text-foreground">{analysis.floorLocks.length}</p>
                </div>
                <div className="rounded-lg bg-card px-2 py-1.5">
                  <span className="text-muted-foreground">Buildings</span>
                  <p className="font-bold text-foreground">{analysis.buildingCount}</p>
                </div>
              </div>
              {analysis.skipped.length > 0 && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-status-warning">
                  <AlertTriangle className="h-3 w-3" />
                  {analysis.skipped.length} rows skipped (placeholders or incomplete)
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-foreground">Import mode</p>
              <div className="mt-1 space-y-1.5">
                {IMPORT_MODES.map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${
                      importMode === opt.id ? 'border-accent bg-accent/5' : 'bg-card'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === opt.id}
                      onChange={() => setImportMode(opt.id)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                      <span className="block text-[10px] text-muted-foreground">{opt.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-foreground">Detected columns</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {analysis.mappings.map((m) => (
                  <span
                    key={`${m.key}-${m.index}`}
                    className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
                  >
                    {mappingLabel(m.key)}
                  </span>
                ))}
              </div>
            </div>

            {previewFixtures.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground">Preview (first rows)</p>
                <div className="mt-1 space-y-1">
                  {previewFixtures.map((f) => (
                    <div key={f.sourceRow} className="rounded-lg border bg-card px-2 py-1.5 text-[11px]">
                      <span className="font-semibold text-foreground">{f.buildingName}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        · Fl {f.floor} · {f.nearestRoom}
                      </span>
                      <span className="text-muted-foreground"> · {f.categoryLabel}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-status-urgent/40 bg-status-urgent/10 px-3 py-2 text-xs text-status-urgent">
            {error}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {analysis && (
            <Button
              variant="outline"
              onClick={() => {
                setAnalysis(null);
                setError(null);
              }}
            >
              Choose different file
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!analysis || importing || loading || analysis.fixtures.length === 0}
            onClick={() => void handleImport()}
          >
            {importing ? (
              'Importing…'
            ) : (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                {importMode === 'update_existing'
                  ? `Apply ${analysis?.fixtures.length ?? 0} rows`
                  : `Import ${effectiveNewCount} fixtures`}
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
