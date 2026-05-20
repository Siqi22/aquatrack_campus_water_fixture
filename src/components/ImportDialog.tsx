import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  analyzeCSV,
  mappingLabel,
  type ImportAnalysis,
} from '@/lib/importCSV';
import { useFixtureStore } from '@/store/fixtureStore';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { importFromAnalysis, loading } = useFixtureStore();
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAnalysis(null);
      setError(null);
      setImporting(false);
    }
  }, [open]);

  const previewFixtures = useMemo(() => analysis?.fixtures.slice(0, 5) ?? [], [analysis]);

  async function handleFile(file: File) {
    setError(null);
    try {
      const text = await file.text();
      const result = analyzeCSV(text, file.name);
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
      setAnalysis(result);
    } catch {
      setError('Failed to parse file. Use a UTF-8 CSV export.');
      setAnalysis(null);
    }
  }

  async function handleImport() {
    if (!analysis) return;
    setImporting(true);
    try {
      const result = await importFromAnalysis(analysis);
      toast.success(
        `Imported ${result.fixturesImported} fixtures, ${result.floorsLocked} locked floors` +
          (result.skipped ? ` (${result.skipped} rows skipped)` : ''),
      );
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
            Import from CSV
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Upload a spreadsheet export. Columns are detected automatically — campus, building, floor, room, category, company name, model, serial number, and filter type.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
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
            <span className="text-sm font-semibold text-foreground">Choose CSV file</span>
            <span className="text-[11px] text-muted-foreground">.csv from Excel, Google Sheets, or AquaTrack export</span>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border bg-secondary/30 p-3">
              <p className="text-sm font-semibold text-foreground">{analysis.fileName}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-card px-2 py-1.5">
                  <span className="text-muted-foreground">Fixtures</span>
                  <p className="font-bold text-foreground">{analysis.fixtures.length}</p>
                </div>
                <div className="rounded-lg bg-card px-2 py-1.5">
                  <span className="text-muted-foreground">Locked floors</span>
                  <p className="font-bold text-foreground">{analysis.floorLocks.length}</p>
                </div>
                <div className="rounded-lg bg-card px-2 py-1.5">
                  <span className="text-muted-foreground">Campuses</span>
                  <p className="font-bold text-foreground">{analysis.campusLabels.length}</p>
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
              <p className="text-xs font-semibold text-foreground">Detected columns</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {analysis.mappings.map((m) => (
                  <span key={`${m.key}-${m.index}`} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
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
                      <span className="text-muted-foreground"> · Fl {f.floor} · {f.nearestRoom}</span>
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
            <Button variant="outline" onClick={() => { setAnalysis(null); setError(null); }}>
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
            {importing ? 'Importing…' : (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Import {analysis?.fixtures.length ?? 0} fixtures
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
