import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download } from 'lucide-react';
import {
  EXPORT_COLUMNS,
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
  const [selected, setSelected] = useState<ExportColumnKey[]>(DEFAULT_EXPORT_KEYS);

  const toggle = (k: ExportColumnKey) =>
    setSelected((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const handleExport = () => {
    if (selected.length === 0) {
      toast.error('Pick at least one column');
      return;
    }
    const map: Record<string, string> = {};
    campuses.forEach((c) => (map[c.id] = c.name));
    exportToCSV(fixtures, selected, map);
    toast.success(`Exported ${fixtures.length} fixtures`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export to CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{fixtures.length} fixtures · {selected.length} columns</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-accent font-medium"
                onClick={() => setSelected(EXPORT_COLUMNS.map((c) => c.key))}
              >
                All
              </button>
              <button
                type="button"
                className="text-muted-foreground font-medium"
                onClick={() => setSelected([])}
              >
                None
              </button>
              <button
                type="button"
                className="text-muted-foreground font-medium"
                onClick={() => setSelected(DEFAULT_EXPORT_KEYS)}
              >
                Default
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Download CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
