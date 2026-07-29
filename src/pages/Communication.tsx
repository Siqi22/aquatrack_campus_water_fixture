import { useMemo, useState } from 'react';
import { Download, FileCheck2, FileText, RefreshCw, Search, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  downloadEditableWaterReport,
  parseWaterMeasurement,
  reportSummary,
  type WaterQualitySample,
} from '@/lib/waterQualityReport';
import { useFixtureStore } from '@/store/fixtureStore';
import { useLeadTesting } from '@/hooks/useLeadTesting';

type FileKey = 'style' | 'reference' | 'coc';
type Contact = { name: string; title: string; phone: string; email: string };
const emptyContact = (): Contact => ({ name: '', title: '', phone: '', email: '' });

export default function Communication() {
  const { campuses, fixtures } = useFixtureStore();
  const lead = useLeadTesting();
  const [schoolId, setSchoolId] = useState('');
  const [files, setFiles] = useState<Partial<Record<FileKey, File>>>({});
  const [samples, setSamples] = useState<WaterQualitySample[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [fixtureQuery, setFixtureQuery] = useState('');
  const [samplingDates, setSamplingDates] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [actions, setActions] = useState('');
  const [notes, setNotes] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([emptyContact(), emptyContact()]);
  const school = campuses.find(item => item.id === schoolId);
  const schoolFixtures = useMemo(() => fixtures.filter(fixture => fixture.campusId === schoolId), [fixtures, schoolId]);
  const normalizedQuery = fixtureQuery.trim().toLowerCase();
  const visibleFixtures = schoolFixtures.filter(fixture => !normalizedQuery || [fixture.id, fixture.buildingName, fixture.floor, fixture.roomNumber, fixture.nearestRoom, fixture.category, fixture.brand, fixture.model].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery));
  const summary = useMemo(() => reportSummary(samples), [samples]);

  function preview() {
    if (!school || !selected.length) return;
    const selectedSchool = school.school || school.name;
    const latestRound = new Map<string, typeof lead.rounds[number]>();
    lead.rounds.forEach(round => {
      const current = latestRound.get(round.fixture_id);
      if (!current || round.round_number > current.round_number) latestRound.set(round.fixture_id, round);
    });
    const parsed = schoolFixtures.filter(fixture => selected.includes(fixture.id)).map(fixture => {
      const round = latestRound.get(fixture.id);
      const result = round?.result_value ? parseWaterMeasurement('Lead', round.result_value, round.result_original_unit || 'ppb') : undefined;
      return {
        sampleId: round?.sample_id || fixture.serialNumber || fixture.id,
        school: selectedSchool,
        building: fixture.buildingName,
        location: `${fixture.buildingName} · Floor ${fixture.floor} · Room ${fixture.roomNumber || fixture.nearestRoom}`,
        sampleDate: (round?.sample_drawn_at || '').slice(0, 10),
        measurements: result ? { Lead: result } : {},
      } satisfies WaterQualitySample;
    });
    setSamples(parsed);
    const dates = [...new Set(parsed.map(sample => sample.sampleDate).filter(Boolean))].sort();
    setSamplingDates(dates.length > 1 ? `${dates[0]} through ${dates.at(-1)}` : dates[0] || '');
    const resultSummary = reportSummary(parsed);
    setIntroduction(`This report summarizes available lead-testing information for ${parsed.length} selected fixture${parsed.length === 1 ? '' : 's'} at ${selectedSchool}.`);
    setActions(resultSummary.warnings + resultSummary.urgent > 0
      ? 'Fixtures with results above 5 ppb will be reviewed, restricted when required, remediated, and retested.'
      : 'No immediate corrective action is required for fixtures with completed results at or below 5 ppb. Fixtures without results remain in the testing workflow.');
    toast.success(`${parsed.length} fixtures are ready to review.`);
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

      <div className="sticky bottom-20 mt-4 grid grid-cols-1 gap-2 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:grid-cols-[auto_1fr]">
        <Button className="w-full" variant="outline" onClick={() => setSamples([])}><RefreshCw className="mr-2 h-4 w-4 shrink-0" />Change selection</Button>
        <Button className="w-full min-w-0" onClick={download}><Download className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">Download Word Report</span></Button>
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
          <Select value={schoolId} onValueChange={value => { setSchoolId(value); setFixtureQuery(''); setSelected(fixtures.filter(fixture => fixture.campusId === value).map(fixture => fixture.id)); }}><SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger><SelectContent>{campuses.map(campus => <SelectItem value={campus.id} key={campus.id}>{campus.school || campus.name}</SelectItem>)}</SelectContent></Select>
        </Field>
      </div>
    </section>

    {schoolId && <section className="card-section mt-4">
      <div className="panel-header"><div><h2 className="font-semibold">Select Fixtures</h2><p className="text-xs text-muted-foreground">{selected.length} of {schoolFixtures.length} selected</p></div><label className="flex items-center gap-2 text-xs"><Checkbox checked={schoolFixtures.length > 0 && selected.length === schoolFixtures.length} onCheckedChange={checked => setSelected(checked === true ? schoolFixtures.map(fixture => fixture.id) : [])} />Select All</label></div>
      <div className="panel-body">
        <div className="relative mb-3"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={fixtureQuery} onChange={event => setFixtureQuery(event.target.value)} placeholder="Search building, floor, room, type, or fixture ID…" /></div>
        <div className="max-h-80 space-y-2 overflow-y-auto">{visibleFixtures.map(fixture => <label className="list-row cursor-pointer" key={fixture.id}><Checkbox checked={selected.includes(fixture.id)} onCheckedChange={checked => setSelected(current => checked ? [...new Set([...current, fixture.id])] : current.filter(id => id !== fixture.id))} /><span className="min-w-0 text-xs"><b>{fixture.buildingName} · Floor {fixture.floor} · Room {fixture.roomNumber || fixture.nearestRoom}</b><br /><span className="text-muted-foreground">{fixture.category} · {fixture.currentResultPpb == null ? 'No result' : `${fixture.currentResultPpb.toFixed(3)} ppb`}</span></span></label>)}{!visibleFixtures.length && <p className="py-5 text-center text-sm text-muted-foreground">No fixtures match this search.</p>}</div>
      </div>
    </section>}

    <section className="card-section mt-4">
      <div className="panel-header"><div><h2 className="font-semibold">Supporting Files</h2><p className="text-xs text-muted-foreground">Optional report references</p></div></div>
      <div className="panel-body grid gap-3 md:grid-cols-3">
        <FilePicker id="coc-file" title="COC / sampling form" file={files.coc} accept=".pdf,.csv,.xlsx,.doc,.docx" onFile={file => setFiles(current => ({ ...current, coc: file }))} />
        <FilePicker id="style-file" title="Sample report style" file={files.style} accept=".pdf,.doc,.docx" onFile={file => setFiles(current => ({ ...current, style: file }))} />
        <FilePicker id="reference-file" title="Lab reference format" file={files.reference} accept=".pdf,.csv,.xlsx" onFile={file => setFiles(current => ({ ...current, reference: file }))} />
      </div>
    </section>

    <Button className="mt-4 w-full" size="lg" disabled={!schoolId || !selected.length || lead.loading} onClick={preview}>
      <FileCheck2 className="mr-2 h-4 w-4" />Review {selected.length || ''} Selected Fixtures
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
