import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Sparkles } from 'lucide-react';
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

export function ExportDialog({ open, onOpenChange, fixtures, campuses }: Props) {
  const [templateId, setTemplateId] = useState<string>('default');
  const [selected, setSelected] = useState<ExportColumnKey[]>(DEFAULT_EXPORT_KEYS);

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

  const download = (keys: ExportColumnKey[]) => {
    if (keys.length === 0) {
      toast.error('Pick at least one column');
      return;
    }
    exportToCSV(fixtures, keys, campusMap);
    toast.success(`Exported ${fixtures.length} fixtures`);
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
                      onClick={() => download(t.keys)}
                      className="gap-1 h-8 px-2.5 text-[11px]"
                    >
                      <Download className="h-3 w-3" /> CSV
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom column picker */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>{fixtures.length} fixtures · {selected.length} columns</span>
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
            <Download className="h-3.5 w-3.5" /> Download custom
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
