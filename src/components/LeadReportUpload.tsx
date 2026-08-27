/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, FileCheck2, Link2, Plus, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { parseSpreadsheetFile } from '@/lib/spreadsheet';
import { matchLeadReportRow, parseLeadReportCSV, resolveMatchedFixtureType, type LeadFixtureMatch, type LeadReportRowDraft } from '@/lib/leadReportImport';
import { extractLeadReportWithClaude } from '@/lib/claudeLeadReport';
import { formatLeadMeasurement, normalizeLeadResult, label } from '@/lib/leadTesting';
import { getFixtureTypeLabel, normalizeFixtureCategory, useFixtureStore, type Fixture } from '@/store/fixtureStore';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible,CollapsibleContent,CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { leadReportRowBelongsToWorkspace } from '@/lib/leadReportScope';
import { normalizeSchoolDistrict } from '@/lib/schoolDistrict';
import { formatFloorLabel, normalizeFloorKey } from '@/lib/floorUtils';
import { useOrganization } from '@/contexts/OrganizationContext';

interface ReviewRow extends LeadReportRowDraft { id:string; reportUploadId:string; sourceFileName:string; match:LeadFixtureMatch; selectedFixtureId?:string; confirmed:boolean; excluded:boolean; imported:boolean; importedTestingRoundId?:string }
const db=supabase as any;
const ACTIVE_REPORT_STORAGE_KEY='aquatrack.activeLeadReportId';
const REVIEW_SELECTION_INITIALIZED_PREFIX='aquatrack.leadReviewSelectionInitialized.';

export function LeadReportUpload({onImported,reviewUnresolved=false}:{onImported?:()=>void|Promise<void>;reviewUnresolved?:boolean}){
  const {organizationName}=useOrganization();
  const {fixtures,campuses,buildings,addCampus,addBuilding,addFixture,loadAll}=useFixtureStore();const[rows,setRows]=useState<ReviewRow[]>([]);const[fileName,setFileName]=useState('');const[busy,setBusy]=useState(false);const[reviewLoaded,setReviewLoaded]=useState(!reviewUnresolved);const[bulkChoice,setBulkChoice]=useState<'include'|null>(null);const restoreAttempted=useRef(false);
  const fixtureIds=useMemo(()=>new Set(fixtures.map(fixture=>fixture.id)),[fixtures]);const districtName=organizationName;const schoolNames=useMemo(()=>new Set(campuses.map(campus=>(campus.school||campus.name).trim().toLowerCase())),[campuses]);
  const ready=rows.filter(row=>row.confirmed&&!row.excluded&&!row.imported).length;
  const skipped=rows.filter(row=>!row.confirmed&&!row.imported).length;
  const includable=rows.filter(row=>row.selectedFixtureId&&!row.confirmed&&!row.imported);
  const reviewRows=rows.filter(row=>!row.imported);
  const bulkEligible=rows.filter(row=>row.selectedFixtureId&&!row.imported);
  const canSubmit=rows.length>0;
  useEffect(()=>{if(!reviewUnresolved)return;void(async()=>{setBusy(true);try{const result=await db.from('lead_testing_report_rows').select('*,lead_testing_report_uploads(file_name,district_or_organization)').is('imported_testing_round_id',null).eq('user_confirmed',false).neq('match_status','excluded').is('deleted_at',null).order('report_upload_id').order('row_number');if(result.error)throw result.error;setRows((result.data??[]).filter((row:any)=>leadReportRowBelongsToWorkspace(row,fixtureIds,districtName,schoolNames)).map(reviewRowFromDb));setBulkChoice(null);setFileName('Unresolved report matches')}catch(error){toast.error(errorMessage(error),{duration:8000})}finally{setBusy(false);setReviewLoaded(true)}})()},[reviewUnresolved,fixtureIds,districtName,schoolNames]);
  useEffect(()=>{if(reviewUnresolved||restoreAttempted.current)return;restoreAttempted.current=true;const reportId=localStorage.getItem(ACTIVE_REPORT_STORAGE_KEY);if(!reportId)return;void(async()=>{setBusy(true);try{const report=await db.from('lead_testing_report_uploads').select('id,file_name').eq('id',reportId).is('deleted_at',null).maybeSingle();if(report.error)throw report.error;if(!report.data){localStorage.removeItem(ACTIVE_REPORT_STORAGE_KEY);return}await openExistingReport(report.data)}catch(error){localStorage.removeItem(ACTIVE_REPORT_STORAGE_KEY);toast.error(errorMessage(error),{duration:8000})}finally{setBusy(false)}})()},[reviewUnresolved]);
  async function openExistingReport(report:{id:string;file_name:string},resetSelection=false){
    const existing=await db.from('lead_testing_report_rows').select('*,lead_testing_report_uploads(file_name)').eq('report_upload_id',report.id).is('deleted_at',null).order('row_number');
    if(existing.error)throw existing.error;
    if(!existing.data?.length)throw new Error('This report already exists, but its extracted rows are unavailable.');
    let reviewRows=existing.data.map(reviewRowFromDb);
    const initializedKey=`${REVIEW_SELECTION_INITIALIZED_PREFIX}${report.id}`;
    if(resetSelection||localStorage.getItem(initializedKey)!=='1'){
      const pendingRows=reviewRows.filter(row=>!row.imported);
      const resetResults=await Promise.all(pendingRows.map(row=>db.from('lead_testing_report_rows').update({proposed_fixture_id:row.selectedFixtureId||row.match.fixtureId||null,confirmed_fixture_id:null,user_confirmed:false,match_status:row.match.status}).eq('id',row.id)));
      const failed=resetResults.find(result=>result.error);if(failed?.error)throw failed.error;
      reviewRows=reviewRows.map(row=>row.imported?row:{...row,confirmed:false,excluded:false});
      localStorage.setItem(initializedKey,'1');
    }
    setRows(reviewRows);setBulkChoice(null);setFileName(report.file_name);localStorage.setItem(ACTIVE_REPORT_STORAGE_KEY,report.id);
  }
  async function processFile(file:File){let temporaryStoragePath='';setBusy(true);try{
    const extension=file.name.split('.').pop()?.toLowerCase();if(!extension||!['csv','xlsx','pdf'].includes(extension))throw new Error('Choose a CSV, Excel, or PDF report.');
    const hash=await sha256(file);
    const exactDuplicate=await db.from('lead_testing_report_uploads').select('id,file_name').eq('file_sha256',hash).is('deleted_at',null).maybeSingle();if(exactDuplicate.error)throw exactDuplicate.error;if(exactDuplicate.data){await openExistingReport(exactDuplicate.data,true);return}
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
    if(!parsed.length)throw new Error('No lead-result rows were extracted.');parsed.forEach(row=>{row.schoolDistrict=normalizeSchoolDistrict(row.schoolDistrict||districtName);normalizeLeadResult(row.resultValue,row.resultUnit)});
    const contentHash=await sha256Text(canonicalReportContent(parsed));
    const duplicate=await db.from('lead_testing_report_uploads').select('id,file_name').eq('content_sha256',contentHash).is('deleted_at',null).maybeSingle();
    if(duplicate.error)throw duplicate.error;if(duplicate.data){if(storagePath)await supabase.storage.from('lead-testing-reports').remove([storagePath]);temporaryStoragePath='';await openExistingReport(duplicate.data,true);return}
    if(!storagePath){storagePath=`${auth.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const storage=await supabase.storage.from('lead-testing-reports').upload(storagePath,file);if(storage.error)throw storage.error}
    const created=await db.from('lead_testing_report_uploads').insert({file_name:file.name,file_url:storagePath,file_type:extension,file_sha256:hash,content_sha256:contentHash,uploaded_by:auth.user?.id,district_or_organization:parsed.find(row=>row.schoolDistrict)?.schoolDistrict||null,processing_status:'ready_for_review',extracted_row_count:parsed.length,unresolved_row_count:parsed.length}).select('*').single();if(created.error)throw created.error;temporaryStoragePath='';
    const review=parsed.map(row=>{const match=matchLeadReportRow(row,fixtures,campuses);const matchedFixture=fixtures.find(fixture=>fixture.id===match.fixtureId);return{...row,fixtureType:resolveMatchedFixtureType(row.fixtureType,matchedFixture),id:crypto.randomUUID(),reportUploadId:created.data.id,sourceFileName:file.name,match,selectedFixtureId:match.fixtureId,confirmed:false,excluded:false,imported:false}});
    const saved=await db.from('lead_testing_report_rows').insert(review.map(row=>rowToDb(row,created.data.id))).select('id,row_number');if(saved.error)throw saved.error;
    const ids=new Map((saved.data??[]).map((item:any)=>[item.row_number,item.id]));setRows(review.map(row=>({...row,id:ids.get(row.rowNumber)??row.id})));setBulkChoice(null);setFileName(file.name);localStorage.setItem(ACTIVE_REPORT_STORAGE_KEY,created.data.id);localStorage.setItem(`${REVIEW_SELECTION_INITIALIZED_PREFIX}${created.data.id}`,'1');toast.success(`${parsed.length} rows extracted. Review every match before importing.`);
  }catch(error){if(temporaryStoragePath)await supabase.storage.from('lead-testing-reports').remove([temporaryStoragePath]);toast.error(reportProcessingError(error),{duration:10000})}finally{setBusy(false)}}
  async function changeRow(row:ReviewRow,patch:Partial<ReviewRow>,rematch=false){setBulkChoice(null);let next={...row,...patch,excluded:false};if(rematch){const match=matchLeadReportRow(next,fixtures,campuses);next={...next,match,selectedFixtureId:match.fixtureId,confirmed:false}}const matchedFixture=fixtures.find(fixture=>fixture.id===next.selectedFixtureId);next={...next,fixtureType:resolveMatchedFixtureType(next.fixtureType,matchedFixture)};setRows(current=>current.map(item=>item.id===row.id?next:item));const updated=await db.from('lead_testing_report_rows').update({...rowToDb(next,row.reportUploadId),confirmed_fixture_id:next.confirmed?next.selectedFixtureId||null:null,user_confirmed:next.confirmed,match_status:next.confirmed?'manually_matched':next.match.status}).eq('id',row.id);if(updated.error)toast.error(errorMessage(updated.error))}
  async function includeAllRows(){
    if(!includable.length)return;
    setBusy(true);
    try{
      const includedIds=new Set(includable.map(row=>row.id));
      const results=await Promise.all(includable.map(row=>{const matchedFixture=fixtures.find(fixture=>fixture.id===row.selectedFixtureId);return db.from('lead_testing_report_rows').update({fixture_type:resolveMatchedFixtureType(row.fixtureType,matchedFixture),confirmed_fixture_id:row.selectedFixtureId,user_confirmed:true,match_status:'manually_matched'}).eq('id',row.id)}));
      const failed=results.find(result=>result.error);
      if(failed?.error)throw failed.error;
      setRows(current=>current.map(row=>{const matchedFixture=fixtures.find(fixture=>fixture.id===row.selectedFixtureId);return includedIds.has(row.id)?{...row,fixtureType:resolveMatchedFixtureType(row.fixtureType,matchedFixture),confirmed:true,excluded:false}:row}));
      setBulkChoice('include');
      toast.success(`${includable.length} result${includable.length===1?'':'s'} included.`);
    }catch(error){toast.error(errorMessage(error),{duration:8000})}finally{setBusy(false)}
  }
  async function clearAllRows(){
    if(!reviewRows.length)return;
    setBusy(true);
    try{
      const results=await Promise.all(reviewRows.map(row=>db.from('lead_testing_report_rows').update({confirmed_fixture_id:null,user_confirmed:false,match_status:row.match.status}).eq('id',row.id)));
      const failed=results.find(result=>result.error);
      if(failed?.error)throw failed.error;
      setRows(current=>current.map(row=>row.imported?row:{...row,confirmed:false,excluded:false}));
      setBulkChoice(null);
    }catch(error){toast.error(errorMessage(error),{duration:8000})}finally{setBusy(false)}
  }
  async function createFixtureForRow(row:ReviewRow){
    const schoolName=row.school.trim();if(!schoolName)throw new Error('Enter the school name before creating this fixture.');
    const same=(left:string|undefined,right:string)=>normalizeFingerprint(left??'')===normalizeFingerprint(right);
    let campus=campuses.find(item=>same(item.school||item.name,schoolName));
    if(!campus){campus=await addCampus({name:schoolName,school:schoolName,schoolDistrict:districtName,address:''})??undefined}
    if(!campus)throw new Error('The school could not be created.');
    const buildingName=row.building.trim()||'Main Building';
    const floorKey=normalizeFloorKey(row.floor||'1')||'1';
    let building=buildings.find(item=>item.campusId===campus!.id&&same(item.name,buildingName));
    const numericFloor=Number.parseInt(floorKey,10);if(!building){building=await addBuilding({campusId:campus.id,name:buildingName,floors:Number.isFinite(numericFloor)?Math.max(1,numericFloor):1})??undefined}
    if(!building)throw new Error('The building could not be created.');
    const location=(row.room||row.fixtureDescription||'Location pending').trim();
    const existingFixture=fixtures.find(item=>item.buildingId===building!.id&&normalizeFloorKey(item.floor)===floorKey&&same(item.nearestRoom||item.roomNumber,location));
    const fixture=existingFixture??await addFixture({campusId:campus.id,buildingId:building.id,buildingName:building.name,floor:floorKey,roomNumber:location,nearestRoom:location,brand:'',model:'',serialNumber:row.sampleId?`REPORT-${row.sampleId}`:'',photoURL:'',modelPlatePhotoURL:'',lastMaintenanceDate:new Date().toISOString().slice(0,10),filterType:'',category:normalizeFixtureCategory(row.fixtureType||row.fixtureDescription),fixtureTypeLabel:row.fixtureType.trim()||row.fixtureDescription.trim()||'Fixture',qualityRating:{pressure:3,cleanliness:3},observations:`Created from uploaded report ${row.sourceFileName}, row ${row.rowNumber}.`,locationConfirmed:false,savedByName:'Lead Report Import'});
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
      const result=normalizeLeadResult(row.resultValue,row.resultUnit);const matchedFixture=fixtures.find(fixture=>fixture.id===row.selectedFixtureId);const rowUpdate=await db.from('lead_testing_report_rows').update({fixture_type:resolveMatchedFixtureType(row.fixtureType,matchedFixture),normalized_result_ppb:result.ppb,user_confirmed:true,match_status:'imported'}).eq('id',row.id);if(rowUpdate.error)throw new Error(`Row ${row.rowNumber}: ${errorMessage(rowUpdate.error)}`);
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
    const skippedIds=rows.filter(item=>!item.imported&&!item.confirmed).map(item=>item.id);
    if(skippedIds.length){const skippedUpdate=await db.from('lead_testing_report_rows').update({confirmed_fixture_id:null,user_confirmed:false,match_status:'excluded'}).in('id',skippedIds);if(skippedUpdate.error)throw new Error(errorMessage(skippedUpdate.error))}
    for(const reportId of [...new Set(rows.map(row=>row.reportUploadId))]){const[pendingResult,importedResult]=await Promise.all([db.from('lead_testing_report_rows').select('id',{count:'exact',head:true}).eq('report_upload_id',reportId).is('imported_testing_round_id',null).neq('match_status','excluded'),db.from('lead_testing_report_rows').select('id',{count:'exact',head:true}).eq('report_upload_id',reportId).eq('match_status','imported')]);const unresolved=pendingResult.count??0;await db.from('lead_testing_report_uploads').update({matched_row_count:importedResult.count??0,unresolved_row_count:unresolved,processing_status:unresolved===0?'imported':'partially_matched'}).eq('id',reportId)}localStorage.removeItem(ACTIVE_REPORT_STORAGE_KEY);await loadAll();await onImported?.();toast.success(imported||updated?[`${imported} new result${imported===1?'':'s'} imported`,`${updated} existing result${updated===1?'':'s'} updated`,skippedIds.length?`${skippedIds.length} unselected result${skippedIds.length===1?'':'s'} skipped`:'' ].filter(Boolean).join(' · '):skippedIds.length?`Review submitted · ${skippedIds.length} unselected result${skippedIds.length===1?'':'s'} skipped`:'Review submitted. No testing records were changed.');
  }catch(error){toast.error(errorMessage(error),{duration:8000})}finally{setBusy(false)}}
  if(!rows.length){if(reviewUnresolved)return <div className="empty-state mt-10"><p className="text-sm font-semibold">{reviewLoaded?'No unresolved matches':'Loading unresolved matches…'}</p><p className="mt-1 text-xs text-muted-foreground">{reviewLoaded?'Every uploaded report row has been imported or skipped.':'Please wait.'}</p></div>;return <div className="card-section"><div className="panel-header"><div className="flex gap-2"><Upload className="h-4 w-4"/><h2 className="font-semibold">Upload Test Report</h2></div></div><div className="panel-body"><p className="text-sm text-muted-foreground">Upload CSV, Excel, or PDF. Match or add fixtures during review.</p><label htmlFor="lead-report-file" className={`mt-3 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-input bg-background px-4 text-sm font-medium transition-colors ${busy?'cursor-not-allowed opacity-60':'cursor-pointer hover:border-primary hover:bg-secondary/30'}`}><span className="flex items-center gap-2"><Upload className="h-4 w-4 text-primary"/>{busy?'Processing report…':'Choose report file'}</span><span className="text-sm font-normal text-muted-foreground">CSV, Excel, or PDF</span></label><Input id="lead-report-file" className="sr-only" disabled={busy} type="file" accept=".csv,.xlsx,.pdf" onChange={event=>{const file=event.target.files?.[0];if(file)void processFile(file);event.currentTarget.value=''}}/><p className="mt-2 text-xs text-muted-foreground">{busy?'Extracting rows and matching existing fixtures…':'Nothing is created until you review an unmatched row.'}</p></div></div>}
  return <div className="space-y-3"><div className="card-soft flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Review · {fileName}</p><p className="text-xs text-muted-foreground">{ready} selected for import · {skipped} unselected</p></div>{reviewRows.length>0&&<label className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${bulkChoice==='include'?'border-primary/40 bg-primary/5 text-primary':'border-border bg-background'} ${busy||bulkEligible.length===0?'cursor-not-allowed opacity-60':'cursor-pointer'}`}><Checkbox checked={bulkChoice==='include'} disabled={busy||bulkEligible.length===0} onCheckedChange={checked=>void(checked===true?includeAllRows():clearAllRows())}/><span>Include All ({bulkEligible.length})</span></label>}</div>{rows.map(row=><ReviewCard key={row.id} row={row} fixtures={fixtures} onCreate={()=>createFixtureForRow(row)} onChange={(patch,rematch)=>void changeRow(row,patch,rematch)}/>)}
    <div className="sticky bottom-3 rounded-2xl border bg-background/95 p-4 shadow-lg backdrop-blur"><Button className="w-full" size="lg" disabled={busy||!canSubmit} onClick={importConfirmed}><FileCheck2 className="mr-2 h-4 w-4"/>{busy?'Submitting…':'Submit'}</Button><p className="mt-2 text-center text-xs text-muted-foreground">{ready>0?`${ready} selected result${ready===1?'':'s'} will be imported. ${skipped} unselected result${skipped===1?'':'s'} will be skipped.`:'No results are selected. Submit to skip all rows without changing testing records.'}</p></div>
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
  const fixtureType=resolveMatchedFixtureType(row.fixtureType,suggested);
  const result=useMemo(()=>{try{return normalizeLeadResult(row.resultValue,row.resultUnit)}catch{return null}},[row.resultValue,row.resultUnit]);
  const normalizedSearch=search.trim().toLowerCase();
  const choices=normalizedSearch?fixtures.filter(fixture=>[fixture.id,fixture.buildingName,fixture.floor,fixture.roomNumber,fixture.nearestRoom,getFixtureTypeLabel(fixture),fixture.category,fixture.brand,fixture.model].filter(Boolean).join(' ').toLowerCase().includes(normalizedSearch)).slice(0,100):[];
  const unresolved=['multiple_matches','no_match'].includes(row.match.status)&&!row.confirmed;
  const showFixtureFinder=!row.imported&&!row.excluded&&(findingAnother||unresolved);
  const isIncluded=row.confirmed&&!row.excluded;

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
        {!row.imported&&<label className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${isIncluded?'border-primary/40 bg-primary/5 text-primary':'border-border bg-background'}`}><Checkbox checked={isIncluded} onCheckedChange={checked=>{if(checked===true){const canInclude=Boolean(row.selectedFixtureId);onChange({excluded:false,confirmed:canInclude});if(!canInclude)openFixtureFinder()}else onChange({excluded:false,confirmed:false})}}/><span>Include</span></label>}
      </div>
    </div>
    <div className="panel-body space-y-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <Cell label="School" value={row.school}/>
        <Cell label="Building" value={suggested?.buildingName||row.building}/>
        <Cell label="Fixture Description" value={row.fixtureDescription||row.fixtureType}/>
        <Cell label="Fixture Type" value={fixtureType}/>
        <Cell label="Fixture Location" value={suggested?[formatFloorLabel(suggested.floor),suggested.nearestRoom||suggested.roomNumber].filter(Boolean).join(' · '):[row.floor&&formatFloorLabel(row.floor),row.room].filter(Boolean).join(' · ')}/>
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
            <span className="mt-0.5 block text-xs text-muted-foreground">{formatFloorLabel(fixture.floor)} · {getFixtureTypeLabel(fixture)}{fixture.brand?` · ${fixture.brand}`:''}{fixture.model?` ${fixture.model}`:''}</span>
          </button>)}
          {!choices.length&&<p className="px-3 py-4 text-center text-sm text-muted-foreground">No matching fixtures found.</p>}
        </div>}

        {pendingFixture&&<div className="rounded-xl border border-primary/30 bg-background p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Match found</p>
          <p className="mt-1 text-sm font-semibold">{pendingFixture.buildingName} · Room {pendingFixture.roomNumber}</p>
          <p className="text-xs text-muted-foreground">{formatFloorLabel(pendingFixture.floor)} · {getFixtureTypeLabel(pendingFixture)}</p>
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
function reviewRowFromDb(item:any):ReviewRow{const raw=(item.raw_text_or_raw_data??{}) as Record<string,unknown>;const storedStatus=['high_confidence_match','possible_match','multiple_matches','no_match'].includes(item.match_status)?item.match_status:item.proposed_fixture_id||item.confirmed_fixture_id?'high_confidence_match':'no_match';const upload=Array.isArray(item.lead_testing_report_uploads)?item.lead_testing_report_uploads[0]:item.lead_testing_report_uploads;return{id:item.id,reportUploadId:item.report_upload_id,sourceFileName:upload?.file_name??'Uploaded report',rowNumber:item.row_number,raw:Object.fromEntries(Object.entries(raw).map(([key,value])=>[key,value==null?'':String(value)])),schoolDistrict:normalizeSchoolDistrict(item.school_district),school:item.school_name??'',building:item.building_name??'',floor:normalizeFloorKey(rawField(raw,['floor','level'])),room:item.room??'',fixtureDescription:item.fixture_description??'',fixtureType:item.fixture_type??'',sampleId:item.sample_id??'',sampleDate:item.sample_date??'',resultValue:item.result_value??'',resultUnit:item.result_unit??'ppb',match:{fixtureId:item.proposed_fixture_id??item.confirmed_fixture_id??undefined,status:storedStatus,confidence:item.match_confidence??0,reasons:item.match_reasons??[],alternatives:[]},selectedFixtureId:item.confirmed_fixture_id??item.proposed_fixture_id??undefined,confirmed:Boolean(item.user_confirmed),excluded:item.match_status==='excluded',imported:Boolean(item.imported_testing_round_id),importedTestingRoundId:item.imported_testing_round_id??undefined}}
function matchStatusText(row:ReviewRow){if(row.imported)return'Imported';if(row.confirmed)return'Included';if(row.match.status==='high_confidence_match')return'Matched';if(row.match.status==='possible_match')return'Possible Match';if(row.match.status==='multiple_matches')return'Multiple Matches';return'No Match'}
function MatchBadge({row}:{row:ReviewRow}){const text=matchStatusText(row);const color=text==='Included'?'bg-emerald-100 text-emerald-800':text==='Matched'?'bg-cyan-100 text-cyan-800':text==='Imported'?'bg-blue-100 text-blue-800':text==='Possible Match'?'bg-amber-100 text-amber-800':text==='Multiple Matches'?'bg-violet-100 text-violet-800':'bg-red-100 text-red-800';return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{text}</span>}
function Cell({label:caption,value}:{label:string;value?:string}){return <div className="min-w-0 text-left"><p className="text-[10px] text-muted-foreground">{caption}</p><p className="break-words font-medium">{value||'—'}</p></div>}
