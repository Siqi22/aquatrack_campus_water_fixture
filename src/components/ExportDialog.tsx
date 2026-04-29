import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Sparkles, FileText } from 'lucide-react';
import {
  EXPORT_COLUMNS,
  EXPORT_TEMPLATES,
  DEFAULT_EXPORT_KEYS,
  exportToCSV,
  type ExportColumnKey,
} from '@/lib/exportCSV';
import type { Fixture, Campus } from '@/store/fixtureStore';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fixtures: Fixture[];
  campuses: Campus[];
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'all-campuses';
}

export function ExportDialog({ open, onOpenChange, fixtures, campuses }: Props) {
  const [templateId, setTemplateId] = useState<string>('default');
  const [selected, setSelected] = useState<ExportColumnKey[]>(DEFAULT_EXPORT_KEYS);

  // Filename composition
  const today = new Date().toISOString().split('T')[0];
  const campusOptions = useMemo(() => {
    const ids = Array.from(new Set(fixtures.map((f) => f.campusId)));
    return ids.map((id) => ({ id, name: campuses.find((c) => c.id === id)?.name ?? 'Unknown' }));
  }, [fixtures, campuses]);

  const [campusToken, setCampusToken] = useState<string>('all');
  const [dateToken, setDateToken] = useState<string>(today);
  const [includeTemplate, setIncludeTemplate] = useState(true);
  const [customSuffix, setCustomSuffix] = useState('');

  useEffect(() => {
    if (open) {
      setCampusToken('all');
      setDateToken(today);
      setIncludeTemplate(true);
      setCustomSuffix('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const campusMap = useMemo(() => {
    const m: Record<string, string> = {};
    campuses.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [campuses]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = EXPORT_TEMPLATES.find((t) => t.id === id);
    if (tpl) setSelected(tpl.keys);
  };

  const toggle = (k: ExportColumnKey) => {
    setTemplateId('custom');
    setSelected((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  const previewCols = useMemo(
    () => EXPORT_COLUMNS.filter((c) => selected.includes(c.key)),
    [selected],
  );

  const sampleRow = fixtures[0];
  const sampleValues = useMemo(() => {
    if (!sampleRow) return null;
    return previewCols.map((c) => String(c.get(sampleRow, { campusName: campusMap[sampleRow.campusId] }) ?? ''));
  }, [previewCols, sampleRow, campusMap]);

  const filename = useMemo(() => {
    const parts: string[] = ['fixtures'];
    if (campusToken === 'all') parts.push('all');
    else parts.push(slug(campusOptions.find((c) => c.id === campusToken)?.name ?? 'campus'));
    if (includeTemplate) parts.push(slug(templateId));
    if (customSuffix.trim()) parts.push(slug(customSuffix));
    if (dateToken) parts.push(dateToken);
    return parts.join('_') + '.csv';
  }, [campusToken, campusOptions, includeTemplate, templateId, customSuffix, dateToken]);

  const filteredFixtures = useMemo(
    () => (campusToken === 'all' ? fixtures : fixtures.filter((f) => f.campusId === campusToken)),
    [fixtures, campusToken],
  );

  const download = (keys: ExportColumnKey[]) => {
    if (keys.length === 0) {
      toast.error('Pick at least one column');
      return;
    }
    if (filteredFixtures.length === 0) {
      toast.error('No fixtures match the selected campus');
      return;
    }
    exportToCSV(filteredFixtures, keys, campusMap, filename);
    toast.success(`Exported ${filteredFixtures.length} fixtures`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export to CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Templates — one-click download */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Quick templates
            </p>
            <div className="space-y-2">
              {EXPORT_TEMPLATES.map((t) => {
                const active = templateId === t.id;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 ${
                      active ? 'border-accent bg-accent/5' : 'bg-card'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => applyTemplate(t.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-sm font-semibold text-foreground">{t.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{t.description}</p>
                    </button>
                    <Button
                      size="sm"
                      onClick={() => { applyTemplate(t.id); download(t.keys); }}
                      className="gap-1 h-8 px-2.5 text-[11px]"
                    >
                      <Download className="h-3 w-3" /> CSV
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live column preview */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <FileText className="h-3 w-3" /> Preview ({previewCols.length} cols)
            </p>
            <div className="rounded-lg border bg-muted/30 overflow-x-auto">
              <table className="text-[10px] w-full">
                <thead>
                  <tr className="bg-muted/50">
                    {previewCols.map((c) => (
                      <th key={c.key} className="px-2 py-1.5 text-left font-semibold text-foreground whitespace-nowrap border-b">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {sampleValues
                      ? sampleValues.map((v, i) => (
                          <td key={i} className="px-2 py-1.5 text-muted-foreground whitespace-nowrap max-w-[120px] truncate">
                            {v || '—'}
                          </td>
                        ))
                      : previewCols.map((c) => (
                          <td key={c.key} className="px-2 py-1.5 text-muted-foreground italic">sample</td>
                        ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {sampleRow && (
              <p className="mt-1 text-[10px] text-muted-foreground">First row shown as sample.</p>
            )}
          </div>

          {/* Filename builder */}
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Filename</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-muted-foreground">
                Campus
                <select
                  value={campusToken}
                  onChange={(e) => setCampusToken(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-card px-2 py-1.5 text-xs text-foreground"
                >
                  <option value="all">All campuses</option>
                  {campusOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-muted-foreground">
                Date
                <input
                  type="date"
                  value={dateToken}
                  onChange={(e) => setDateToken(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-card px-2 py-1.5 text-xs text-foreground"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-foreground">
              <Checkbox checked={includeTemplate} onCheckedChange={(v) => setIncludeTemplate(!!v)} />
              Include template name ({templateId})
            </label>
            <input
              value={customSuffix}
              onChange={(e) => setCustomSuffix(e.target.value)}
              placeholder="Custom suffix (optional)"
              className="w-full rounded-md border bg-card px-2 py-1.5 text-xs text-foreground"
            />
            <div className="rounded-md bg-muted/40 px-2 py-1.5 text-[11px] font-mono text-foreground break-all">
              {filename}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {filteredFixtures.length} of {fixtures.length} fixtures will be exported.
            </p>
          </div>

          {/* Custom column picker */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>{selected.length} columns selected</span>
              <div className="flex gap-2">
                <button type="button" className="text-accent font-medium" onClick={() => { setTemplateId('custom'); setSelected(EXPORT_COLUMNS.map((c) => c.key)); }}>All</button>
                <button type="button" className="text-muted-foreground font-medium" onClick={() => { setTemplateId('custom'); setSelected([]); }}>None</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[35vh] overflow-y-auto">
              {EXPORT_COLUMNS.map((c) => {
                const checked = selected.includes(c.key);
                return (
                  <label
                    key={c.key}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-sm cursor-pointer ${
                      checked ? 'bg-accent/10 border-accent' : 'bg-card'
                    }`}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(c.key)} />
                    <span className="text-foreground">{c.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => download(selected)} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
