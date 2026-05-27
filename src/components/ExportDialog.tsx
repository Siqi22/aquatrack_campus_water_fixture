import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
import { useIsMobile } from '@/hooks/use-mobile';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fixtures: Fixture[];
  campuses: Campus[];
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'all-campuses';
}

function ExportDialogBody({
  templateId,
  setTemplateId,
  selected,
  setSelected,
  campusOptions,
  campusToken,
  setCampusToken,
  dateToken,
  setDateToken,
  includeTemplate,
  setIncludeTemplate,
  customSuffix,
  setCustomSuffix,
  filename,
  filteredFixtures,
  fixtures,
  applyTemplate,
  toggle,
  previewCols,
  sampleValues,
  sampleRow,
  download,
  isMobile,
}: {
  templateId: string;
  setTemplateId: (v: string) => void;
  selected: ExportColumnKey[];
  setSelected: (v: ExportColumnKey[] | ((p: ExportColumnKey[]) => ExportColumnKey[])) => void;
  campusOptions: { id: string; name: string }[];
  campusToken: string;
  setCampusToken: (v: string) => void;
  dateToken: string;
  setDateToken: (v: string) => void;
  includeTemplate: boolean;
  setIncludeTemplate: (v: boolean) => void;
  customSuffix: string;
  setCustomSuffix: (v: string) => void;
  filename: string;
  filteredFixtures: Fixture[];
  fixtures: Fixture[];
  applyTemplate: (id: string) => void;
  toggle: (k: ExportColumnKey) => void;
  previewCols: typeof EXPORT_COLUMNS;
  sampleValues: string[] | null;
  sampleRow: Fixture | undefined;
  download: (keys: ExportColumnKey[]) => void;
  isMobile: boolean;
}) {
  return (
    <div className="space-y-4 pb-1">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
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
                <button type="button" onClick={() => applyTemplate(t.id)} className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-semibold text-foreground">{t.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{t.description}</p>
                </button>
                <Button
                  size="sm"
                  onClick={() => {
                    applyTemplate(t.id);
                    download(t.keys);
                  }}
                  className="h-8 shrink-0 gap-1 px-2.5 text-[11px]"
                >
                  <Download className="h-3 w-3" /> CSV
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t pt-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <FileText className="h-3 w-3" /> Preview ({previewCols.length} cols)
        </p>
        <div className="-mx-1 overflow-x-auto rounded-lg border bg-muted/30 px-1">
          <table className="w-full min-w-max text-[10px]">
            <thead>
              <tr className="bg-muted/50">
                {previewCols.map((c) => (
                  <th
                    key={c.key}
                    className="whitespace-nowrap border-b px-2 py-1.5 text-left font-semibold text-foreground"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {sampleValues
                  ? sampleValues.map((v, i) => (
                      <td key={i} className="max-w-[120px] truncate whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                        {v || '—'}
                      </td>
                    ))
                  : previewCols.map((c) => (
                      <td key={c.key} className="px-2 py-1.5 italic text-muted-foreground">
                        sample
                      </td>
                    ))}
              </tr>
            </tbody>
          </table>
        </div>
        {sampleRow && <p className="mt-1 text-[10px] text-muted-foreground">First row shown as sample.</p>}
      </div>

      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground">Filename</p>
        <div className={`grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <label className="text-[11px] text-muted-foreground">
            Campus
            <select
              value={campusToken}
              onChange={(e) => setCampusToken(e.target.value)}
              className="mt-1 w-full rounded-md border bg-card px-2 py-2 text-base text-foreground md:text-xs"
            >
              <option value="all">All campuses</option>
              {campusOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-muted-foreground">
            Date
            <input
              type="date"
              value={dateToken}
              onChange={(e) => setDateToken(e.target.value)}
              className="mt-1 w-full rounded-md border bg-card px-2 py-2 text-base text-foreground md:text-xs"
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
          className="w-full rounded-md border bg-card px-2 py-2 text-base text-foreground md:text-xs"
        />
        <div className="break-all rounded-md bg-muted/40 px-2 py-1.5 font-mono text-[11px] text-foreground">
          {filename}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {filteredFixtures.length} of {fixtures.length} fixtures will be exported.
        </p>
      </div>

      <div className="border-t pt-3">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{selected.length} columns selected</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="font-medium text-accent"
              onClick={() => {
                setTemplateId('custom');
                setSelected(EXPORT_COLUMNS.map((c) => c.key));
              }}
            >
              All
            </button>
            <button
              type="button"
              className="font-medium text-muted-foreground"
              onClick={() => {
                setTemplateId('custom');
                setSelected([]);
              }}
            >
              None
            </button>
          </div>
        </div>
        <div className={`grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} max-h-[28vh] overflow-y-auto overscroll-contain`}>
          {EXPORT_COLUMNS.map((c) => {
            const checked = selected.includes(c.key);
            return (
              <label
                key={c.key}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm ${
                  checked ? 'border-accent bg-accent/10' : 'bg-card'
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
  );
}

export function ExportDialog({ open, onOpenChange, fixtures, campuses }: Props) {
  const isMobile = useIsMobile();
  const [templateId, setTemplateId] = useState<string>('default');
  const [selected, setSelected] = useState<ExportColumnKey[]>(DEFAULT_EXPORT_KEYS);

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
    campuses.forEach((c) => {
      m[c.id] = c.name;
    });
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

  const previewCols = useMemo(() => EXPORT_COLUMNS.filter((c) => selected.includes(c.key)), [selected]);

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
    return `${parts.join('_')}.csv`;
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

  const bodyProps = {
    templateId,
    setTemplateId,
    selected,
    setSelected,
    campusOptions,
    campusToken,
    setCampusToken,
    dateToken,
    setDateToken,
    includeTemplate,
    setIncludeTemplate,
    customSuffix,
    setCustomSuffix,
    filename,
    filteredFixtures,
    fixtures,
    applyTemplate,
    toggle,
    previewCols,
    sampleValues,
    sampleRow,
    download,
    isMobile,
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} className={isMobile ? 'w-full' : undefined}>
        Cancel
      </Button>
      <Button onClick={() => download(selected)} className={`gap-1.5 ${isMobile ? 'w-full' : ''}`}>
        <Download className="h-3.5 w-3.5" /> Download
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="flex h-[min(92dvh,720px)] max-h-[92dvh] flex-col gap-0 rounded-t-2xl p-0">
          <SheetHeader className="shrink-0 border-b px-4 pb-3 pt-4 text-left">
            <SheetTitle>Export to CSV</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4">
            <ExportDialogBody {...bodyProps} />
          </div>
          <SheetFooter className="shrink-0 gap-2 border-t bg-card px-4 py-3 sm:flex-col">{footer}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:rounded-lg">
        <DialogHeader className="shrink-0 border-b px-6 pb-3 pt-6">
          <DialogTitle>Export to CSV</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <ExportDialogBody {...bodyProps} />
        </div>
        <DialogFooter className="shrink-0 border-t px-6 py-4">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
