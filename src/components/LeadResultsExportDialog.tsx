/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatPpb } from '@/lib/leadTesting';
import type { Campus } from '@/store/fixtureStore';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function LeadResultsExportDialog({
  open,
  onOpenChange,
  campuses,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campuses: Campus[];
}) {
  const [selected, setSelected] = useState<string[]>(campuses.map((campus) => campus.id));
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (open) setSelected(campuses.map((campus) => campus.id));
  }, [open, campuses]);

  const allSelected = campuses.length > 0 && selected.length === campuses.length;

  async function download() {
    if (!selected.length) return;
    setDownloading(true);
    try {
      const selectedSchools = new Set(
        campuses
          .filter((campus) => selected.includes(campus.id))
          .map((campus) => campus.school || campus.name),
      );
      const db = supabase as any;
      const { data, error } = await db
        .from('lead_testing_report_rows')
        .select('row_number,school_name,building_name,room,fixture_description,result_value,result_unit,normalized_result_ppb,match_status,confirmed_fixture_id,proposed_fixture_id,lead_testing_report_uploads(file_name)')
        .is('deleted_at', null)
        .order('report_upload_id')
        .order('row_number');
      if (error) throw error;

      const rows = (data ?? []).filter((row: any) => selectedSchools.has(row.school_name));
      const header = [
        'Source Report',
        'Row',
        'School',
        'Building',
        'Room',
        'Fixture Description',
        'Original Result',
        'Lead Result (ppb)',
        'Match Status',
        'Matched Fixture ID',
      ];
      const lines = rows.map((row: any) => {
        const upload = Array.isArray(row.lead_testing_report_uploads)
          ? row.lead_testing_report_uploads[0]
          : row.lead_testing_report_uploads;
        return [
          upload?.file_name ?? '',
          row.row_number,
          row.school_name ?? '',
          row.building_name ?? '',
          row.room ?? '',
          row.fixture_description ?? '',
          [row.result_value, row.result_unit].filter(Boolean).join(' '),
          formatPpb(row.normalized_result_ppb),
          row.match_status,
          row.confirmed_fixture_id ?? row.proposed_fixture_id ?? '',
        ];
      });
      const csv = [header, ...lines]
        .map((line) => line.map(csvCell).join(','))
        .join('\n');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      link.download = `lead-testing-results-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      onOpenChange(false);
      toast.success(`${rows.length} results downloaded.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not download results.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download Lead Testing Results</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-3">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) =>
                setSelected(checked ? campuses.map((campus) => campus.id) : [])
              }
            />
            <span className="text-sm font-semibold">Select all schools</span>
          </label>

          {campuses.map((campus) => {
            const checked = selected.includes(campus.id);
            return (
              <label key={campus.id} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(next) =>
                    setSelected((current) =>
                      next
                        ? [...current, campus.id]
                        : current.filter((id) => id !== campus.id),
                    )
                  }
                />
                <span className="text-sm">{campus.school || campus.name}</span>
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!selected.length || downloading} onClick={() => void download()}>
            <Download className="mr-2 h-4 w-4" />
            {downloading ? 'Downloading…' : `Download ${selected.length} Schools`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}
