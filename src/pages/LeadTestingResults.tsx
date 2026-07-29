/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useFixtureStore } from '@/store/fixtureStore';
import { useLeadTesting, type TestingRound } from '@/hooks/useLeadTesting';
import { formatLeadMeasurement, leadResultColor } from '@/lib/leadTesting';
import { PageHeader } from '@/components/layout/PageHeader';
import { LeadTestingModuleNav } from '@/components/LeadTestingModuleNav';
import { QuickStat } from '@/components/layout/QuickStat';
import { leadReportRowBelongsToWorkspace } from '@/lib/leadReportScope';

interface ResultItem { round:TestingRound; school:string; location:string }

export default function LeadTestingResults(){
  const {fixtures,campuses}=useFixtureStore();const lead=useLeadTesting();const[unresolved,setUnresolved]=useState(0);
  const fixtureIds=useMemo(()=>new Set(fixtures.map(fixture=>fixture.id)),[fixtures]);
  const districtName=campuses.find(campus=>campus.schoolDistrict)?.schoolDistrict??'';
  const schoolNames=useMemo(()=>new Set(campuses.map(campus=>(campus.school||campus.name).trim().toLowerCase())),[campuses]);
  const imported=useMemo<ResultItem[]>(()=>lead.rounds.filter(round=>fixtureIds.has(round.fixture_id)&&round.report_upload_id&&round.result_value).flatMap(round=>{const fixture=fixtures.find(item=>item.id===round.fixture_id);if(!fixture)return[];const campus=campuses.find(item=>item.id===fixture.campusId);if(!campus)return[];return[{round,school:campus.school,location:`${fixture.buildingName} · Floor ${fixture.floor} · Room ${fixture.roomNumber}`}]}),[lead.rounds,fixtureIds,fixtures,campuses]);
  const verified=imported.length;
  useEffect(()=>{void(async()=>{const db=supabase as any;const result=await db.from('lead_testing_report_rows').select('id,school_name,proposed_fixture_id,confirmed_fixture_id,imported_testing_round_id,match_status,user_confirmed,lead_testing_report_uploads(district_or_organization)').is('imported_testing_round_id',null).eq('user_confirmed',false).neq('match_status','excluded').is('deleted_at',null);if(result.error)return;setUnresolved((result.data??[]).filter((row:any)=>leadReportRowBelongsToWorkspace(row,fixtureIds,districtName,schoolNames)).length)})()},[fixtureIds,districtName,schoolNames,lead.rounds.length]);
  const above15=imported.filter(item=>(item.round.result_ppb??0)>15).sort((a,b)=>(b.round.result_ppb??0)-(a.round.result_ppb??0));const above5=imported.filter(item=>(item.round.result_ppb??0)>5&&(item.round.result_ppb??0)<=15).sort((a,b)=>(b.round.result_ppb??0)-(a.round.result_ppb??0));const passing=imported.filter(item=>(item.round.result_ppb??0)<=5).sort((a,b)=>(b.round.result_ppb??0)-(a.round.result_ppb??0));
  return <div className="page-shell"><PageHeader title="View Results" subtitle="Imported laboratory results"/><LeadTestingModuleNav/>
    <div className="grid grid-cols-2 gap-2"><QuickStat label="Verified" value={verified}/><QuickStat label="Unresolved Matches" value={unresolved} to="/lead-testing/upload?review=unresolved"/></div>
    <div className="mt-5 space-y-5">{above15.length>0&&<ResultGroup title="Above 15 ppb" items={above15} tone="urgent"/>}{above5.length>0&&<ResultGroup title="Above 5 through 15 ppb" items={above5} tone="warning"/>}{passing.length>0&&<ResultGroup title="5 ppb or less" items={passing}/>} {!imported.length&&<div className="empty-state mt-10"><p className="text-sm font-semibold">No imported laboratory results</p><p className="mt-1 text-xs text-muted-foreground">Upload and confirm a report to see results here.</p></div>}</div>
  </div>;
}
function ResultGroup({title,items,tone='default'}:{title:string;items:ResultItem[];tone?:'default'|'warning'|'urgent'}){return <section><h2 className={`section-label mb-2 ${tone==='urgent'?'text-status-urgent':tone==='warning'?'text-status-warning':''}`}>{title} · {items.length}</h2><div className="overflow-hidden rounded-xl border"><div className="grid grid-cols-[1fr_1.4fr_auto] gap-2 border-b bg-secondary/40 px-3 py-2 text-[10px] font-semibold text-muted-foreground"><span>School</span><span>Fixture / Location</span><span>Lead (ppb)</span></div>{items.map(item=><Link to={`/fixture/${item.round.fixture_id}`} key={item.round.id} className="grid grid-cols-[1fr_1.4fr_auto] gap-2 border-b px-3 py-3 text-xs last:border-b-0 hover:bg-secondary/30"><span>{item.school}</span><span>{item.location}</span><span className={`font-bold tabular-nums ${leadResultColor(item.round.result_ppb)}`}>{formatLeadMeasurement(item.round.result_value,item.round.result_original_unit,item.round.result_ppb).replace(/ ppb$/,'')}</span></Link>)}</div></section>}
