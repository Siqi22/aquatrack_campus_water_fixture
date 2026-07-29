import { useMemo, useState } from 'react';
import { Download, FileCheck2, FileText, RefreshCw, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { extractLeadReportWithClaude } from '@/lib/claudeLeadReport';
import { parseSpreadsheetFile } from '@/lib/spreadsheet';
import {
  downloadEditableWaterReport,
  leadRowsToWaterSamples,
  parseWaterQualityCSV,
  reportSummary,
  WATER_ANALYTES,
  type WaterQualitySample,
} from '@/lib/waterQualityReport';
import { useFixtureStore } from '@/store/fixtureStore';

type FileKey = 'results' | 'style' | 'reference' | 'coc';
type Contact = { name: string; title: string; phone: string; email: string };
const emptyContact = (): Contact => ({ name: '', title: '', phone: '', email: '' });

export default function Communication() {
  const { campuses } = useFixtureStore();
  const [schoolId, setSchoolId] = useState('');
  const [files, setFiles] = useState<Partial<Record<FileKey, File>>>({});
  const [samples, setSamples] = useState<WaterQualitySample[]>([]);
  const [busy, setBusy] = useState(false);
  const [samplingDates, setSamplingDates] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [actions, setActions] = useState('');
  const [notes, setNotes] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([emptyContact(), emptyContact()]);
  const school = campuses.find(item => item.id === schoolId);
  const summary = useMemo(() => reportSummary(samples), [samples]);

  async function preview() {
    const file = files.results;
    if (!schoolId || !file) return;
    setBusy(true);
    let storagePath = '';
    try {
      let parsed: WaterQualitySample[] = [];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw new Error('Sign in again before reading a PDF.');
        storagePath = `${auth.user.id}/communication-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const upload = await supabase.storage.from('lead-testing-reports').upload(storagePath, file);
        if (upload.error) throw upload.error;
        parsed = leadRowsToWaterSamples(await extractLeadReportWithClaude(storagePath, file.name));
      } else {
        const workbook = await parseSpreadsheetFile(file);
        parsed = workbook.sheets.flatMap(sheet => parseWaterQualityCSV(sheet.csv));
      }
      if (!parsed.length) throw new Error('No water-quality result rows were found.');
      const selectedSchool = school?.school || school?.name || '';
      parsed = parsed.map(sample => ({ ...sample, school: sample.school || selectedSchool }));
      setSamples(parsed);
      const dates = [...new Set(parsed.map(sample => sample.sampleDate).filter(Boolean))].sort();
      setSamplingDates(dates.length > 1 ? `${dates[0]} through ${dates.at(-1)}` : dates[0] || '');
      const resultSummary = reportSummary(parsed);
      setIntroduction(`Water samples were collected from ${parsed.length} fixture${parsed.length === 1 ? '' : 's'} at ${selectedSchool}. The samples were analyzed for ${resultSummary.analytes.join(', ')}.`);
      setActions(resultSummary.warnings + resultSummary.urgent > 0
        ? 'Fixtures with results above the applicable action or aesthetic level will be reviewed, restricted when required, remediated, and retested.'
        : 'No immediate corrective action is required based on the reported results. Routine monitoring and record retention will continue.');
      toast.success(`${parsed.length} samples are ready to review.`);
    } catch (error) {
      toast.error(message(error), { duration: 9000 });
    } finally {
      if (storagePath) await supabase.storage.from('lead-testing-reports').remove([storagePath]);
      setBusy(false);
    }
  }

  function updateContact(index: number, patch: Partial<Contact>) {
    setContacts(current => current.map((contact, itemIndex) => itemIndex === index ? { ...contact, ...patch } : contact));
  }

  function download() {
    if (!school || !samples.length) return;
    downloadEditableWaterReport({
      district: school.schoolDistrict || '',
      school: school.school || school.name,
      samplingDates,
      introduction,
      actions,
      notes,
      contacts,
      samples,
      sourceFiles: Object.values(files).filter(Boolean).map(file => file!.name),
    });
    toast.success('Editable Word report downloaded.');
  }

  if (samples.length) {
    return <div className="page-shell max-w-6xl">
      <PageHeader title="Water Quality Report" subtitle="Review results and prepare an editable school report" />
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Samples" value={samples.length} />
        <SummaryCard label="Above standard" value={summary.warnings} tone="warning" />
        <SummaryCard label="Urgent results" value={summary.urgent} tone="urgent" />
      </div>

      <section className="card-section mt-4">
        <div className="panel-header"><div><h2 className="font-semibold">Results Preview</h2><p className="text-xs text-muted-foreground">{school?.school || school?.name} · {summary.analytes.join(', ')}</p></div></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead><tr className="border-b bg-secondary/40 text-left text-[10px] text-muted-foreground"><th className="p-3">Sample ID</th><th className="p-3">Fixture / Location</th>{summary.analytes.map(analyte => <th className="p-3" key={analyte}>{analyte}</th>)}</tr></thead>
            <tbody>{samples.map((sample, index) => <tr className="border-b last:border-0" key={`${sample.sampleId}-${index}`}><td className="p-3 font-medium">{sample.sampleId}</td><td className="p-3">{sample.location || sample.building || '—'}</td>{summary.analytes.map(analyte => { const result = sample.measurements[analyte]; return <td className={`p-3 font-semibold ${result?.severity === 'urgent' ? 'text-status-urgent' : result?.severity === 'warning' ? 'text-status-warning' : ''}`} key={analyte}>{result ? `${result.display} ${result.unit}` : '—'}</td>; })}</tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="card-section mt-4">
        <div className="panel-header"><div><h2 className="font-semibold">Report Content</h2><p className="text-xs text-muted-foreground">Edit the language before downloading</p></div></div>
        <div className="panel-body grid gap-4">
          <Field label="Sampling Dates"><Input value={samplingDates} onChange={event => setSamplingDates(event.target.value)} /></Field>
          <Field label="Introduction"><Textarea className="min-h-28" value={introduction} onChange={event => setIntroduction(event.target.value)} /></Field>
          <Field label="Actions Taken"><Textarea className="min-h-28" value={actions} onChange={event => setActions(event.target.value)} /></Field>
          <Field label="Notes (optional)"><Textarea value={notes} onChange={event => setNotes(event.target.value)} /></Field>
          <div>
            <p className="field-label mb-2">Contacts (optional)</p>
            <div className="grid gap-3 md:grid-cols-2">{contacts.map((contact, index) => <div className="rounded-xl border p-3" key={index}><p className="mb-2 text-xs font-semibold">Contact {index + 1}</p><div className="grid grid-cols-2 gap-2"><Input className="col-span-2" placeholder="Name" value={contact.name} onChange={event => updateContact(index, { name: event.target.value })} /><Input className="col-span-2" placeholder="Title" value={contact.title} onChange={event => updateContact(index, { title: event.target.value })} /><Input placeholder="Phone" value={contact.phone} onChange={event => updateContact(index, { phone: event.target.value })} /><Input placeholder="Email" value={contact.email} onChange={event => updateContact(index, { email: event.target.value })} /></div></div>)}</div>
          </div>
        </div>
      </section>

      <div className="sticky bottom-20 mt-4 grid grid-cols-[auto_1fr] gap-2 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur">
        <Button variant="outline" onClick={() => setSamples([])}><RefreshCw className="mr-2 h-4 w-4" />Change files</Button>
        <Button onClick={download}><Download className="mr-2 h-4 w-4" />Download Editable Word Report</Button>
      </div>
    </div>;
  }

  return <div className="page-shell max-w-4xl">
    <PageHeader title="Communication" subtitle="Create an editable water-quality report" />
    <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-secondary/50 p-1 text-center text-[11px] font-semibold">
      <div className="rounded-lg bg-background px-2 py-2 text-primary shadow-sm">1 · Setup</div>
      <div className="px-2 py-2 text-muted-foreground">2 · Review</div>
      <div className="px-2 py-2 text-muted-foreground">3 · Download</div>
    </div>

    <section className="card-section">
      <div className="panel-header"><div><h2 className="font-semibold">Report Setup</h2><p className="text-xs text-muted-foreground">School district report</p></div></div>
      <div className="panel-body">
        <Field label="School">
          <Select value={schoolId} onValueChange={setSchoolId}><SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger><SelectContent>{campuses.map(campus => <SelectItem value={campus.id} key={campus.id}>{campus.school || campus.name}</SelectItem>)}</SelectContent></Select>
        </Field>
      </div>
    </section>

    <section className="card-section mt-4">
      <div className="panel-header"><div><h2 className="font-semibold">Source Files</h2><p className="text-xs text-muted-foreground">CSV, Excel, or PDF laboratory results</p></div></div>
      <div className="panel-body grid gap-3 md:grid-cols-2">
        <FilePicker id="current-results" title="Current lab/results file" required file={files.results} accept=".pdf,.csv,.xlsx" onFile={file => setFiles(current => ({ ...current, results: file }))} />
        <FilePicker id="coc-file" title="COC / sampling form" file={files.coc} accept=".pdf,.csv,.xlsx,.doc,.docx" onFile={file => setFiles(current => ({ ...current, coc: file }))} />
        <FilePicker id="style-file" title="Sample report style" file={files.style} accept=".pdf,.doc,.docx" onFile={file => setFiles(current => ({ ...current, style: file }))} />
        <FilePicker id="reference-file" title="Lab reference format" file={files.reference} accept=".pdf,.csv,.xlsx" onFile={file => setFiles(current => ({ ...current, reference: file }))} />
      </div>
    </section>

    <Button className="mt-4 w-full" size="lg" disabled={busy || !schoolId || !files.results} onClick={preview}>
      {busy ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Reading results…</> : <><FileCheck2 className="mr-2 h-4 w-4" />Upload &amp; Preview</>}
    </Button>
  </div>;
}

function FilePicker({ id, title, file, accept, required, onFile }: { id: string; title: string; file?: File; accept: string; required?: boolean; onFile: (file?: File) => void }) {
  return <label htmlFor={id} className="flex min-h-28 cursor-pointer flex-col justify-between rounded-xl border border-dashed p-4 transition-colors hover:border-primary hover:bg-secondary/30">
    <div className="flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2">{file ? <FileText className="h-4 w-4 text-primary" /> : <UploadCloud className="h-4 w-4 text-primary" />}</div><div><p className="text-sm font-semibold">{title}{required ? ' *' : ''}</p><p className="mt-1 break-all text-xs text-muted-foreground">{file?.name || (required ? 'Choose a file' : 'Optional')}</p></div></div>
    <input id={id} className="sr-only" type="file" accept={accept} onChange={event => onFile(event.target.files?.[0])} />
  </label>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5"><span className="field-label">{label}</span>{children}</label>;
}

function SummaryCard({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warning' | 'urgent' }) {
  return <div className="card-soft p-4"><p className={`text-2xl font-bold tabular-nums ${tone === 'urgent' ? 'text-status-urgent' : tone === 'warning' ? 'text-status-warning' : ''}`}>{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}

function message(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Could not prepare this report.';
}
