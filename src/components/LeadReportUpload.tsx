/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, FileCheck2, Link2, Plus, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { parseSpreadsheetFile } from '@/lib/spreadsheet';
import { matchLeadReportRow, parseLeadReportCSV, type LeadFixtureMatch, type LeadReportRowDraft } from '@/lib/leadReportImport';
import { extractLeadReportWithClaude } from '@/lib/claudeLeadReport';
import { formatLeadMeasurement, normalizeLeadResult, label } from '@/lib/leadTesting';
import { normalizeFixtureCategory, useFixtureStore, type Fixture } from '@/store/fixtureStore';
import { Button } from '@/components/ui/button';
import { Collapsible,CollapsibleContent,CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { leadReportRowBelongsToWorkspace } from '@/lib/leadReportScope';
import { normalizeSchoolDistrict } from '@/lib/schoolDistrict';

interface ReviewRow extends LeadReportRowDraft { id:string; reportUploadId:string; sourceFileName:string; match:LeadFixtureMatch; selectedFixtureId?:string; confirmed:boolean; excluded:boolean; imported:boolean; importedTestingRoundId?:string }
const db=supabase as any;
const ACTIVE_REPORT_STORAGE_KEY='aquatrack.activeLeadReportId';

export function LeadReportUpload({onImported,reviewUnresolved=false}:{onImported?:()=>void|Promise<void>;reviewUnresolved?:boolean}){
  const {fixtures,campuses,buildings,addCampus,addBuilding,addFixture,loadAll}=useFixtureStore();const[rows,setRows]=useState<ReviewRow[]>([]);const[fileName,setFileName]=useState('');const[busy,setBusy]=useState(false);const[reviewLoaded,setReviewLoaded]=useState(!reviewUnresolved);const restoreAttempted=useRef(false);
  const fixtureIds=useMemo(()=>new Set(fixtures.map(fixture=>fixture.id)),[fixtures]);const districtName=campuses.find(campus=>campus.schoolDistrict)?.schoolDistrict??'';const schoolNames=useMemo(()=>new Set(campuses.map(campus=>(campus.school||campus.name).trim().toLowerCase())),[campuses]);
  const ready=rows.filter(row=>row.confirmed&&!row.excluded&&!row.imported).length;
  const needsReview=rows.filter(row=>!row.confirmed&&!row.excluded&&!row.imported).length;
  const canSubmit=rows.length>0&&needsReview===0;
  useEffect(()=>{if(!reviewUnresolved)return;void(async()=>{setBusy(true);try{const result=await db.from('lead_testing_report_rows').select('*,lead_testing_report_uploads(file_name,district_or_organization)').is('imported_testing_round_id',null).eq('user_confirmed',false).neq('match_status','excluded').is('deleted_at',null).order('report_upload_id').order('row_number');if(result.error)throw result.error;setRows((result.data??[]).filter((row:any)=>leadReportRowBelongsToWorkspace(row,fixtureIds,districtName,schoolNames)).map(reviewRowFromDb));setFileName('Unresolved report matches')}catch(error){toast.error(errorMessage(error),{duration:8000})}finally{setBusy(false);setReviewLoaded(true)}})()},[reviewUnresolved,fixtureIds,districtName,schoolNames]);
  useEffect(()=>{if(reviewUnresolved||restoreAttempted.current)return;restoreAttempted.current=true;const reportId=localStorage.getItem(ACTIVE_REPORT_STORAGE_KEY);if(!reportId)return;void(async()=>{setBusy(true);try{const report=await db.from('lead_testing_report_uploads').select('id,file_name').eq('id',reportId).is('deleted_at',null).maybeSingle();if(report.error)throw report.error;if(!report.data){localStorage.removeItem(ACTIVE_REPORT_STORAGE_KEY);return}await openExistingReport(report.data)}catch(error){localStorage.removeItem(ACTIVE_REPORT_STORAGE_KEY);toast.error(errorMessage(error),{duration:8000})}finally{setBusy(false)}})()},[reviewUnresolved]);
  async function openExistingReport(report:{id:string;file_name:string}){
    const existing=await db.from('lead_testing_report_rows').select('*,lead_testing_report_uploads(file_name)').eq('report_upload_id',report.id).is('deleted_at',null).order('row_number');
    if(existing.error)throw existing.error;
    if(!existing.data?.length)throw new Error('This report already exists, but its extracted rows are unavailable.');
    setRows(existing.data.map(reviewRowFromDb));setFileName(report.file_name);localStorage.setItem(ACTIVE_REPORT_STORAGE_KEY,report.id);
  }
  async function processFile(file:File){let temporaryStoragePath='';setBusy(true);try{
    const extension=file.name.split('.').pop()?.toLowerCase();if(!extension||!['csv','xlsx','pdf'].includes(extension))throw new Error('Choose a CSV, Excel, or PDF report.');
    const hash=await sha256(file);
    const exactDuplicate=await db.from('lead_testing_report_uploads').select('id,file_name').eq('file_sha256',hash).is('deleted_at',null).maybeSingle();if(exactDuplicate.error)throw exactDuplicate.error;if(exactDuplicate.data){await openExistingReport(exactDuplicate.data);return}
    const {data:auth}=await supabase.auth.getUser();if(!auth.user)throw new Error('Sign in to upload a report.');
    let storagePath='';
    let parsed:LeadReportRowDraft[];
    if(extension==='pdf'){
      storagePath=`${auth.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const storage=await supabase.storage.from('lead-testing-reports').upload(storagePath,file);if(storage.error)throw storage.error;
      temporaryStoragePath=storagePath;
      parsed=await extractLeadReportWithClaude(storagePath,file.name);
    }else{
      parsed=(await parseSpreadsheetFile(file)).sheets.flatMap(sheet=>parseLeadReportCSV(sheet.csv));
    }
    if(!parsed.length)throw new Error('No lead-result rows were extracted.');parsed.forEach(row=>{row.schoolDistrict=normalizeSchoolDistrict(row.schoolDistrict);normalizeLeadResult(row.resultValue,row.resultUnit)});
    const contentHash=await sha256Text(canonicalReportContent(parsed));
    const duplicate=await db.from('lead_testing_report_uploads').select('id,file_name').eq('content_sha256',contentHash).is('deleted_at',null).maybeSingle();
    if(duplicate.error)throw duplicate.error;if(duplicate.data){if(storagePath)await supabase.storage.from('lead-testing-reports').remove([storagePath]);temporaryStoragePath='';await openExistingReport(duplicate.data);return}
    if(!storagePath){storagePath=`${auth.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const storage=await supabase.storage.from('lead-testing-reports').upload(storagePath,file);if(storage.error)throw storage.error}
    const created=await db.from('lead_testing_report_uploads').insert({file_name:file.name,file_url:storagePath,file_type:extension,file_sha256:hash,content_sha256:contentHash,uploaded_by:auth.user?.id,district_or_organization:parsed.find(row=>row.schoolDistrict)?.schoolDistrict||null,processing_status:'ready_for_review',extracted_row_count:parsed.length,unresolved_row_count:parsed.length}).select('*').single();if(created.error)throw created.error;temporaryStoragePath='';
    const review=parsed.map(row=>{const match=matchLeadReportRow(row,fixtures,campuses);return{...row,id:crypto.randomUUID(),reportUploadId:created.data.id,sourceFileName:file.name,match,selectedFixtureId:match.fixtureId,confirmed:false,excluded:false,imported:false}});
    const saved=await db.from('lead_testing_report_rows').insert(review.map(row=>rowToDb(row,created.data.id))).select('id,row_number');if(saved.error)throw saved.error;
    const ids=new Map((saved.data??[]).map((item:any)=>[item.row_number,item.id]));setRows(review.map(row=>({...row,id:ids.get(row.rowNumber)??row.id})));setFileName(file.name);localStorage.setItem(ACTIVE_REPORT_STORAGE_KEY,created.data.id);toast.success(`${parsed.length} rows extracted. Review every match before importing.`);
  }catch(error){if(temporaryStoragePath)await supabase.storage.from('lead-testing-reports').remove([temporaryStoragePath]);toast.error(reportProcessingError(error),{duration:10000})}finally{setBusy(false)}}
  async function changeRow(row:ReviewRow,patch:Partial<ReviewRow>,rematch=false){let next={...row,...patch};if(rematch){const match=matchLeadReportRow(next,fixtures,campuses);next={...next,match,selectedFixtureId:match.fixtureId,confirmed:false}}setRows(current=>current.map(item=>item.id===row.id?next:item));const updated=await db.from('lead_testing_report_rows').update({...rowToDb(next,row.reportUploadId),confirmed_fixture_id:next.selectedFixtureId||null,user_confirmed:next.confirmed,match_status:next.excluded?'excluded':next.confirmed?'manually_matched':next.match.status}).eq('id',row.id);if(updated.error)toast.error(errorMessage(updated.error))}
  async function createFixtureForRow(row:ReviewRow){
    const schoolName=row.school.trim();if(!schoolName)throw new Error('Enter the school name before creating this fixture.');
    const same=(left:string|undefined,right:string)=>normalizeFingerprint(left??'')===normalizeFingerprint(right);
    let campus=campuses.find(item=>same(item.school||item.name,schoolName));
    if(!campus){campus=await addCampus({name:schoolName,school:schoolName,schoolDistrict:normalizeSchoolDistrict(row.schoolDistrict||campuses.find(item=>item.schoolDistrict)?.schoolDistrict),address:''})??undefined}
    if(!campus)throw new Error('The school could not be created.');
    const buildingName=row.building.trim()||'Main Building';
    let building=buildings.find(item=>item.campusId===campus!.id&&same(item.name,buildingName));
    const numericFloor=Number.parseInt(row.floor,10);if(!building){building=await addBuilding({campusId:campus.id,name:buildingName,floors:Number.isFinite(numericFloor)?Math.max(1,numericFloor):1})??undefined}
    if(!building)throw new Error('The building could not be created.');
    const location=(row.room||row.fixtureDescription||'Location pending').trim();
    const existingFixture=fixtures.find(item=>item.buildingId===building!.id&&same(item.floor,row.floor||'1')&&same(item.nearestRoom||item.roomNumber,location));
    const fixture=existingFixture??await addFixture({campusId:campus.id,buildingId:building.id,buildingName:building.name,floor:row.floor.trim()||'1',roomNumber:location,nearestRoom:location,brand:'',model:'',serialNumber:row.sampleId?`REPORT-${row.sampleId}`:'',photoURL:'',modelPlatePhotoURL:'',lastMaintenanceDate:new Date().toISOString().slice(0,10),filterType:'',category:normalizeFixtureCategory(row.fixtureType||row.fixtureDescription),qualityRating:{pressure:3,cleanliness:3},observations:`Created from uploaded report ${row.sourceFileName}, row ${row.rowNumber}.`,locationConfirmed:false,savedByName:'Lead Report Import'});
    if(!fixture)throw new Error('The fixture could not be created.');
    await changeRow(row,{selectedFixtureId:fixture.id,match:{fixtureId:fixture.id,status:'high_confidence_match',confidence:1,reasons:['Created from this report row'],alternatives:[]},confirmed:true,excluded:false});
    toast.success(existingFixture?'Existing fixture selected.':'School, building, and fixture data saved.');
  }
  async function importConfirmed(){if(!canSubmit)return;setBusy(true);let imported=0;let updated=0;try{const {data:auth}=await supabase.auth.getUser();if(!auth.user)throw new Error('Your session has expired. Sign in again, then retry the import.');
    for(const row of rows.filter(item=>item.imported&&!item.excluded&&item.importedTestingRoundId)){
      const existingRound=await db.from('lead_testing_rounds').select('fixture_id,sample_id,sample_draw_date,result_value,result_original_unit').eq('id',row.importedTestingRoundId).single();if(existingRound.error)throw new Error(`Row ${row.rowNumber}: ${errorMessage(existingRound.error)}`);
      const desired={sample_id:row.sampleId||null,sample_draw_date:row.sampleDate||null,result_value:row.resultValue,result_original_unit:row.resultUnit};
      const changed=existingRound.data.fixture_id!==row.selectedFixtureId||existingRound.data.sample_id!==desired.sample_id||existingRound.data.sample_draw_date!==desired.sample_draw_date||existingRound.data.result_value!==desired.result_value||existingRound.data.result_original_unit!==desired.result_original_unit;
      if(changed){if(existingRound.data.fixture_id!==row.selectedFixtureId)throw new Error(`Row ${row.rowNumber}: An imported result cannot be moved to a different fixture.`);const roundUpdate=await db.from('lead_testing_rounds').update({...desired,sample_drawn_at:row.sampleDate?`${row.sampleDate}T12:00:00`:null}).eq('id',row.importedTestingRoundId);if(roundUpdate.error)throw new Error(`Row ${row.rowNumber}: ${errorMessage(roundUpdate.error)}`);updated++}
      const result=normalizeLeadResult(row.resultValue,row.resultUnit);const rowUpdate=await db.from('lead_testing_report_rows').update({normalized_result_ppb:result.ppb,user_confirmed:true,match_status:'imported'}).eq('id',row.id);if(rowUpdate.error)throw new Error(`Row ${row.rowNumber}: ${errorMessage(rowUpdate.error)}`);
    }
    for(const row of rows.filter(item=>item.confirmed&&item.selectedFixtureId&&!item.excluded&&!item.imported)){
      const rowCheck=await db.from('lead_testing_report_rows').select('imported_testing_round_id').eq('id',row.id).single();if(rowCheck.error)throw new Error(`Row ${row.rowNumber}: ${errorMessage(rowCheck.error)}`);if(rowCheck.data?.imported_testing_round_id)throw new Error(`Row ${row.rowNumber} has already been imported.`);
      const existing=await db.from('lead_testing_rounds').select('round_number,sample_id').eq('fixture_id',row.selectedFixtureId).is('deleted_at',null);if(existing.error)throw new Error(`Row ${row.rowNumber}: ${errorMessage(existing.error)}`);
      if(row.sampleId){const duplicate=await db.from('lead_testing_rounds').select('id,fixture_id,sample_draw_date,result_value,result_original_unit').ilike('sample_id',row.sampleId).is('deleted_at',null).maybeSingle();if(duplicate.error)throw new Error(`Row ${row.rowNumber}: ${errorMessage(duplicate.error)}`);if(duplicate.data){if(duplicate.data.fixture_id!==row.selectedFixtureId)throw new Error(`Row ${row.rowNumber}: Sample ID ${row.sampleId} belongs to a different fixture.`);const result=normalizeLeadResult(row.resultValue,row.resultUnit);const roundUpdate=await db.from('lead_testing_rounds').update({sample_draw_date:row.sampleDate||duplicate.data.sample_draw_date,sample_drawn_at:row.sampleDate?`${row.sampleDate}T12:00:00`:undefined,result_value:row.resultValue,result_original_unit:row.resultUnit,result_received_at:new Date().toISOString(),report_upload_id:row.reportUploadId,report_row_reference:String(row.rowNumber),matching_method:'existing_fixture_review',matching_confidence:row.match.confidence}).eq('id',duplicate.data.id);if(roundUpdate.error)throw new Error(`Row ${row.rowNumber}: ${errorMessage(roundUpdate.error)}`);const recovered=await db.from('lead_testing_report_rows').update({imported_testing_round_id:duplicate.data.id,normalized_result_ppb:result.ppb,confirmed_fixture_id:row.selectedFixtureId,user_confirmed:true,match_status:'imported'}).eq('id',row.id).is('imported_testing_round_id',null);if(recovered.error)throw new Error(`Row ${row.rowNumber}: ${errorMessage(recovered.error)}`);setRows(current=>current.map(item=>item.id===row.id?{...item,imported:true}:item));imported++;continue}}
      const pendingRemediation=await db.from('remediation_records').select('id').eq('fixture_id',row.selectedFixtureId).eq('status','awaiting_retest').is('deleted_at',null).order('created_at',{ascending:false}).limit(1).maybeSingle();
      const result=normalizeLeadResult(row.resultValue,row.resultUnit,Boolean(pendingRemediation.data));const roundNumber=Math.max(0,...(existing.data??[]).map((round:any)=>round.round_number))+1;const roundType=pendingRemediation.data?'post_remediation_retest':roundNumber===1?'initial_test':'retest';
      const inserted=await db.from('lead_testing_rounds').insert({fixture_id:row.selectedFixtureId,round_type:roundType,round_number:roundNumber,status:'results_received',sample_id:row.sampleId||null,sample_draw_date:row.sampleDate||null,sample_drawn_at:row.sampleDate?`${row.sampleDate}T12:00:00`:null,result_value:row.resultValue,result_original_unit:row.resultUnit,result_received_at:new Date().toISOString(),report_upload_id:row.reportUploadId,report_row_reference:String(row.rowNumber),matching_method:'existing_fixture_review',matching_confidence:row.match.confidence,created_by:auth.user.id}).select('*').single();if(inserted.error)throw new Error(`Row ${row.rowNumber}: ${errorMessage(inserted.error)}`);
      if(pendingRemediation.data)await db.from('remediation_records').update({follow_up_testing_round_id:inserted.data.id}).eq('id',pendingRemediation.data.id);
      const updated=await db.from('lead_testing_report_rows').update({imported_testing_round_id:inserted.data.id,normalized_result_ppb:result.ppb,confirmed_fixture_id:row.selectedFixtureId,user_confirmed:true,match_status:'imported'}).eq('id',row.id).is('imported_testing_round_id',null);if(updated.error)throw new Error(`Row ${row.rowNumber}: ${errorMessage(updated.error)}`);
      await db.from('lead_testing_events').insert({fixture_id:row.selectedFixtureId,testing_round_id:inserted.data.id,event_type:'result_imported',description:`Result imported from ${row.sourceFileName}, row ${row.rowNumber}`,performed_by:auth.user?.id,metadata:{report_upload_id:row.reportUploadId,report_row_id:row.id,match_confidence:row.match.confidence}});
      if(pendingRemediation.data)await db.from('lead_testing_events').insert({fixture_id:row.selectedFixtureId,testing_round_id:inserted.data.id,remediation_record_id:pendingRemediation.data.id,event_type:result.category==='5 ppb or less'?'remediation_verified':'additional_remediation_required',description:result.category==='5 ppb or less'?'Post-remediation retest passed; remediation verified':'Post-remediation retest remained above 5 ppb; additional remediation required',performed_by:auth.user?.id,metadata:{normalized_ppb:result.ppb}});
      setRows(current=>current.map(item=>item.id===row.id?{...item,imported:true}:item));imported++;
    }
    for(const reportId of [...new Set(rows.map(row=>row.reportUploadId))]){const[pendingResult,importedResult]=await Promise.all([db.from('lead_testing_report_rows').select('id',{count:'exact',head:true}).eq('report_upload_id',reportId).is('imported_testing_round_id',null).neq('match_status','excluded'),db.from('lead_testing_report_rows').select('id',{count:'exact',head:true}).eq('report_upload_id',reportId).eq('match_status','imported')]);const unresolved=pendingResult.count??0;await db.from('lead_testing_report_uploads').update({matched_row_count:importedResult.count??0,unresolved_row_count:unresolved,processing_status:unresolved===0?'imported':'partially_matched'}).eq('id',reportId)}localStorage.removeItem(ACTIVE_REPORT_STORAGE_KEY);await loadAll();await onImported?.();toast.success(imported||updated?[`${imported} new result${imported===1?'':'s'} imported`,`${updated} existing result${updated===1?'':'s'} updated`].filter(message=>!message.startsWith('0 ')).join(' · '):'Review submitted. No testing records were changed.');
  }catch(error){toast.error(errorMessage(error),{duration:8000})}finally{setBusy(false)}}
  if(!rows.length){if(reviewUnresolved)return <div className="empty-state mt-10"><p className="text-sm font-semibold">{reviewLoaded?'No unresolved matches':'Loading unresolved matches…'}</p><p className="mt-1 text-xs text-muted-foreground">{reviewLoaded?'Every uploaded report row has been matched, imported, or excluded.':'Please wait.'}</p></div>;return <div className="card-section"><div className="panel-header"><div className="flex gap-2"><Upload className="h-4 w-4"/><h2 className="font-semibold">Upload Test Report</h2></div></div><div className="panel-body"><p className="text-sm text-muted-foreground">Upload CSV, Excel, or PDF. Match or add fixtures during review.</p><label htmlFor="lead-report-file" className={`mt-3 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-input bg-background px-4 text-sm font-medium transition-colors ${busy?'cursor-not-allowed opacity-60':'cursor-pointer hover:border-primary hover:bg-secondary/30'}`}><span className="flex items-center gap-2"><Upload className="h-4 w-4 text-primary"/>{busy?'Processing report…':'Choose report file'}</span><span className="text-sm font-normal text-muted-foreground">CSV, Excel, or PDF</span></label><Input id="lead-report-file" className="sr-only" disabled={busy} type="file" accept=".csv,.xlsx,.pdf" onChange={event=>{const file=event.target.files?.[0];if(file)void processFile(file);event.currentTarget.value=''}}/><p className="mt-2 text-xs text-muted-foreground">{busy?'Extracting rows and matching existing fixtures…':'Nothing is created until you review an unmatched row.'}</p></div></div>}
  return <div className="space-y-3"><div className="card-soft p-4"><p className="font-semibold">Review · {fileName}</p><p className="text-xs text-muted-foreground">{ready} matched and ready · {needsReview} need review</p></div>{rows.map(row=><ReviewCard key={row.id} row={row} fixtures={fixtures} onCreate={()=>createFixtureForRow(row)} onChange={(patch,rematch)=>void changeRow(row,patch,rematch)}/>)}
    <div className="sticky bottom-3 rounded-2xl border bg-background/95 p-4 shadow-lg backdrop-blur"><Button className="w-full" size="lg" disabled={busy||!canSubmit} onClick={importConfirmed}><FileCheck2 className="mr-2 h-4 w-4"/>{busy?'Submitting…':'Submit'}</Button><p className="mt-2 text-center text-xs text-muted-foreground">{needsReview>0?`${needsReview} result${needsReview===1?'':'s'} still need to be matched or excluded.`:ready>0?'Included results will be imported. Excluded rows will not change the system.':'Excluded rows will not change the system. Existing results are updated only when details changed.'}</p></div>
  </div>;
}

function ReviewCard({row,fixtures,onChange,onCreate}:{row:ReviewRow;fixtures:Fixture[];onChange:(patch:Partial<ReviewRow>,rematch?:boolean)=>void;onCreate:()=>Promise<void>}){
  const [search,setSearch]=useState('');
  const [editing,setEditing]=useState(false);
  const [findingAnother,setFindingAnother]=useState(false);
  const [creating,setCreating]=useState(false);
  const [searchAttempted,setSearchAttempted]=useState(false);
  const [pendingFixtureId,setPendingFixtureId]=useState<string>();
  const suggested=fixtures.find(fixture=>fixture.id===row.selectedFixtureId);
  const pendingFixture=fixtures.find(fixture=>fixture.id===pendingFixtureId);
  const result=useMemo(()=>{try{return normalizeLeadResult(row.resultValue,row.resultUnit)}catch{return null}},[row.resultValue,row.resultUnit]);
  const normalizedSearch=search.trim().toLowerCase();
  const choices=normalizedSearch?fixtures.filter(fixture=>[fixture.id,fixture.buildingName,fixture.floor,fixture.roomNumber,fixture.nearestRoom,fixture.category,fixture.brand,fixture.model].filter(Boolean).join(' ').toLowerCase().includes(normalizedSearch)).slice(0,100):[];
  const unresolved=['multiple_matches','no_match'].includes(row.match.status)&&!row.confirmed;
  const showFixtureFinder=!row.imported&&!row.excluded&&(findingAnother||unresolved);

  function openFixtureFinder(){
    setFindingAnother(true);
    setPendingFixtureId(undefined);
    setSearch('');
    setSearchAttempted(false);
  }

  function linkEntry(){
    if(!pendingFixtureId)return;
    onChange({selectedFixtureId:pendingFixtureId,confirmed:true,excluded:false});
    setFindingAnother(false);
    setPendingFixtureId(undefined);
    setSearch('');
    setSearchAttempted(false);
  }

  function createEntry(){
    setCreating(true);
    void onCreate()
      .then(()=>{
        setEditing(false);
        setFindingAnother(false);
        setSearch('');
        setSearchAttempted(false);
      })
      .catch(error=>toast.error(errorMessage(error),{duration:8000}))
      .finally(()=>setCreating(false));
  }

  return <div className={`card-section ${row.imported?'opacity-70':''}`}>
    <div className="panel-header">
      <div>
        <p className="text-sm font-semibold">{row.school||'—'} · Row {row.rowNumber}</p>
        <p className="text-xs text-muted-foreground">{row.fixtureDescription||row.fixtureType||'—'} · {result?formatLeadMeasurement(row.resultValue,row.resultUnit,result.ppb):'Invalid result'}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <MatchBadge row={row}/>
        {!row.imported&&(row.excluded||unresolved)&&<Button type="button" size="sm" variant="outline" className={row.excluded?'border-muted-foreground bg-secondary':'border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive'} onClick={()=>{onChange({excluded:!row.excluded,confirmed:false});if(row.excluded)openFixtureFinder()}}>{row.excluded?'Include instead':'Exclude'}</Button>}
      </div>
    </div>
    <div className="panel-body space-y-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <Cell label="School" value={row.school}/>
        <Cell label="Fixture Location" value={suggested?`${suggested.buildingName} · Room ${suggested.roomNumber}`:[row.building,row.room&&`Room ${row.room}`].filter(Boolean).join(' · ')}/>
        <Cell label="Fixture Description" value={row.fixtureDescription||row.fixtureType}/>
        <Cell label="Lead Result" value={result?formatLeadMeasurement(row.resultValue,row.resultUnit,result.ppb):'Invalid result'}/>
      </div>

      {!showFixtureFinder&&!row.imported&&!row.excluded&&<Button type="button" variant="outline" size="sm" onClick={openFixtureFinder}><Search className="mr-1 h-4 w-4"/>Find another fixture</Button>}

      {showFixtureFinder&&<section className="space-y-3 rounded-xl border border-border bg-secondary/20 p-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor={`fixture-search-${row.id}`}>Search existing fixtures</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/>
            <Input id={`fixture-search-${row.id}`} className="pl-9" value={search} onChange={event=>{setSearch(event.target.value);if(event.target.value.trim())setSearchAttempted(true);setPendingFixtureId(undefined)}} placeholder="Building, floor, room, or fixture type"/>
          </div>
        </div>

        {normalizedSearch&&<div className="max-h-52 overflow-y-auto rounded-xl border bg-background p-1">
          {choices.slice(0,10).map(fixture=><button type="button" key={fixture.id} onClick={()=>{setPendingFixtureId(fixture.id);setSearch('')}} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary">
            <span className="font-medium">{fixture.buildingName} · Room {fixture.roomNumber}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Floor {fixture.floor} · {label(fixture.category)}{fixture.brand?` · ${fixture.brand}`:''}{fixture.model?` ${fixture.model}`:''}</span>
          </button>)}
          {!choices.length&&<p className="px-3 py-4 text-center text-sm text-muted-foreground">No matching fixtures found.</p>}
        </div>}

        {pendingFixture&&<div className="rounded-xl border border-primary/30 bg-background p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Match found</p>
          <p className="mt-1 text-sm font-semibold">{pendingFixture.buildingName} · Room {pendingFixture.roomNumber}</p>
          <p className="text-xs text-muted-foreground">Floor {pendingFixture.floor} · {label(pendingFixture.category)}</p>
          <Button type="button" className="mt-3 w-full" size="sm" onClick={linkEntry}><Link2 className="mr-1.5 h-4 w-4"/>Link entry</Button>
        </div>}

        {searchAttempted&&!pendingFixture&&<div className="rounded-xl border border-dashed bg-background p-3">
          <p className="text-sm font-semibold">Create new fixture</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Create a new fixture entry from the school, building, and location in this report.</p>
          <Button type="button" className="mt-2" variant="ghost" size="sm" disabled={creating} onClick={createEntry}><Plus className="mr-1.5 h-4 w-4"/>{creating?'Creating…':'Create new'}</Button>
        </div>}
      </section>}

      <Collapsible open={editing} onOpenChange={setEditing}>
        <CollapsibleTrigger asChild><Button variant="ghost" size="sm"><ChevronDown className="mr-1 h-4 w-4"/>Create new</Button></CollapsibleTrigger>
        <CollapsibleContent className="grid grid-cols-2 gap-2 pt-2">
          {(['school','building','floor','room','fixtureDescription','fixtureType','sampleId','sampleDate','resultValue','resultUnit'] as const).map(field=><div key={field}><label className="text-[10px] text-muted-foreground">{label(field)}</label><Input type={field==='sampleDate'?'date':'text'} value={row[field]} onChange={event=>onChange({[field]:event.target.value,confirmed:false} as Partial<ReviewRow>)}/></div>)}
          <Button className="col-span-2" variant="outline" disabled={creating} onClick={createEntry}>{creating?'Creating…':'Confirm creation'}</Button>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-wrap items-center gap-2">
        {!showFixtureFinder&&row.selectedFixtureId&&!row.confirmed&&!row.excluded&&!row.imported&&<Button type="button" size="sm" variant="outline" onClick={()=>onChange({confirmed:true})}>Confirm match</Button>}
        {row.confirmed&&!row.excluded&&!row.imported&&<Button type="button" size="sm" disabled>Included</Button>}
      </div>
    </div>
  </div>;
}
function rowToDb(row:ReviewRow,reportId:string){let ppb:null|number=null;try{ppb=normalizeLeadResult(row.resultValue,row.resultUnit).ppb}catch{return{}}return{report_upload_id:reportId,row_number:row.rowNumber,raw_text_or_raw_data:row.raw,sample_id:row.sampleId||null,school_district:normalizeSchoolDistrict(row.schoolDistrict),school_name:row.school||null,building_name:row.building||null,room:row.room||null,fixture_description:row.fixtureDescription||null,fixture_type:row.fixtureType||null,sample_date:row.sampleDate||null,result_value:row.resultValue,result_unit:row.resultUnit,normalized_result_ppb:ppb,proposed_fixture_id:row.match.fixtureId||null,match_status:row.match.status,match_confidence:row.match.confidence,match_reasons:row.match.reasons}}
async function sha256(file:File){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(value=>value.toString(16).padStart(2,'0')).join('')}
async function sha256Text(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
function canonicalReportContent(rows:LeadReportRowDraft[]){return JSON.stringify(rows.map(row=>({schoolDistrict:normalizeFingerprint(row.schoolDistrict),school:normalizeFingerprint(row.school),building:normalizeFingerprint(row.building),floor:normalizeFingerprint(row.floor),room:normalizeFingerprint(row.room),fixtureDescription:normalizeFingerprint(row.fixtureDescription),fixtureType:normalizeFingerprint(row.fixtureType),sampleId:normalizeFingerprint(row.sampleId),sampleDate:row.sampleDate.trim(),resultValue:normalizeFingerprint(row.resultValue),resultUnit:normalizeFingerprint(row.resultUnit)})))}
function normalizeFingerprint(value:string){return value.trim().toLowerCase().replace(/\s+/g,' ')}
function errorMessage(error:unknown){if(error instanceof Error)return error.message;if(error&&typeof error==='object'&&'message'in error&&typeof error.message==='string')return error.message;return'Import failed. Please try again.'}
function reportProcessingError(error:unknown){const message=errorMessage(error);if(/content_sha256|schema cache/i.test(message))return'The report deduplication database update has not been applied yet. Run migration 20260728030000_lead_report_content_deduplication.sql in Supabase, then try again.';if(message==='Import failed. Please try again.')return'Could not process report. Check that the report storage and database migrations are available, then try again.';return message}
function rawField(raw:Record<string,unknown>,names:string[]){const entry=Object.entries(raw).find(([key])=>names.includes(key.toLowerCase().trim().replace(/[_-]+/g,' ')));return entry?.[1]==null?'':String(entry[1])}
function reviewRowFromDb(item:any):ReviewRow{const raw=(item.raw_text_or_raw_data??{}) as Record<string,unknown>;const storedStatus=['high_confidence_match','possible_match','multiple_matches','no_match'].includes(item.match_status)?item.match_status:item.proposed_fixture_id||item.confirmed_fixture_id?'high_confidence_match':'no_match';const upload=Array.isArray(item.lead_testing_report_uploads)?item.lead_testing_report_uploads[0]:item.lead_testing_report_uploads;return{id:item.id,reportUploadId:item.report_upload_id,sourceFileName:upload?.file_name??'Uploaded report',rowNumber:item.row_number,raw:Object.fromEntries(Object.entries(raw).map(([key,value])=>[key,value==null?'':String(value)])),schoolDistrict:normalizeSchoolDistrict(item.school_district),school:item.school_name??'',building:item.building_name??'',floor:rawField(raw,['floor','level']),room:item.room??'',fixtureDescription:item.fixture_description??'',fixtureType:item.fixture_type??'',sampleId:item.sample_id??'',sampleDate:item.sample_date??'',resultValue:item.result_value??'',resultUnit:item.result_unit??'ppb',match:{fixtureId:item.proposed_fixture_id??item.confirmed_fixture_id??undefined,status:storedStatus,confidence:item.match_confidence??0,reasons:item.match_reasons??[],alternatives:[]},selectedFixtureId:item.confirmed_fixture_id??item.proposed_fixture_id??undefined,confirmed:Boolean(item.user_confirmed),excluded:item.match_status==='excluded',imported:Boolean(item.imported_testing_round_id),importedTestingRoundId:item.imported_testing_round_id??undefined}}
function matchStatusText(row:ReviewRow){if(row.imported)return'Imported';if(row.excluded)return'Excluded';if(row.confirmed)return'Matched';if(row.match.status==='high_confidence_match')return'Matched';if(row.match.status==='possible_match')return'Possible Match';if(row.match.status==='multiple_matches')return'Multiple Matches';return'No Match'}
function MatchBadge({row}:{row:ReviewRow}){const text=matchStatusText(row);const color=text==='Matched'?'bg-emerald-100 text-emerald-800':text==='Imported'?'bg-blue-100 text-blue-800':text==='Possible Match'?'bg-amber-100 text-amber-800':text==='Multiple Matches'?'bg-violet-100 text-violet-800':text==='Excluded'?'bg-slate-100 text-slate-700':'bg-red-100 text-red-800';return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{text}</span>}
function Cell({label:caption,value}:{label:string;value?:string}){return <div><p className="text-[10px] text-muted-foreground">{caption}</p><p className="font-medium">{value||'—'}</p></div>}
