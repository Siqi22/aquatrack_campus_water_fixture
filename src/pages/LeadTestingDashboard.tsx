/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Search } from 'lucide-react';
import { useFixtureStore } from '@/store/fixtureStore';
import { useLeadTesting } from '@/hooks/useLeadTesting';
import { overallWorkflowLabel, requiredActionLabel } from '@/lib/leadTesting';
import { PageHeader } from '@/components/layout/PageHeader';
import { LeadTestingModuleNav } from '@/components/LeadTestingModuleNav';
import { Input } from '@/components/ui/input';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import { useOrganization } from '@/contexts/OrganizationContext';

const statusOptions=[
  ['not_started','Sampling Required'],
  ['awaiting_results','Awaiting Results'],
  ['action_required','Remediation Required'],
  ['remediation_in_progress','Remediation In Progress'],
  ['awaiting_retest','Retesting Required'],
  ['complete','Complete'],
] as const;

export default function LeadTestingDashboard(){
  const {organizationName,isSchoolDistrict}=useOrganization();
  const {fixtures,campuses}=useFixtureStore();const lead=useLeadTesting();const[view,setView]=useState('overview');const[query,setQuery]=useState('');const[statusFilter,setStatusFilter]=useState('all');
  const latest=(fixtureId:string)=>lead.rounds.filter(round=>round.fixture_id===fixtureId).at(-1);
  const rows=useMemo(()=>fixtures.filter(fixture=>{const round=lead.rounds.filter(item=>item.fixture_id===fixture.id).at(-1);const status=fixture.currentLeadTestingStatus??round?.status??'not_started';const searchable=[fixture.id,fixture.buildingName,fixture.floor,fixture.roomNumber,round?.sample_id,campuses.find(campus=>campus.id===fixture.campusId)?.school].join(' ').toLowerCase();if(query&&!searchable.includes(query.toLowerCase()))return false;if(statusFilter!=='all'&&status!==statusFilter)return false;if(view==='sample'&&!['not_started','scheduled'].includes(status))return false;if(view==='awaiting'&&!['awaiting_results','awaiting_retest_results'].includes(status))return false;if(view==='received'&&!round?.result_value)return false;if(view==='above5'&&!((round?.result_ppb??0)>5&&(round?.result_ppb??0)<=15))return false;if(view==='immediate'&&!((round?.result_ppb??0)>15))return false;if(view==='remediation'&&!['action_required','remediation_in_progress'].includes(status))return false;if(view==='retest'&&status!=='awaiting_retest')return false;return true}),[fixtures,lead.rounds,campuses,query,statusFilter,view]);
  const stat=(predicate:(status:string,round:any)=>boolean)=>fixtures.filter(fixture=>{const round=latest(fixture.id);return predicate(fixture.currentLeadTestingStatus??round?.status??'not_started',round)}).length;
  return <div className="page-shell"><PageHeader title="Lead Testing" subtitle={`${organizationName} sampling, results, remediation, and retesting`}/><LeadTestingModuleNav/>
    <section><div className="grid grid-cols-3 gap-y-3">
      <WorkflowStat label="Require sampling" value={stat(value=>['not_started','scheduled'].includes(value))} onClick={()=>setView('sample')} className="border-r"/>
      <WorkflowStat label="Awaiting results" value={stat(value=>['awaiting_results','awaiting_retest_results'].includes(value))} onClick={()=>setView('awaiting')} className="border-r"/>
      <WorkflowStat label="Above 5 ppb" value={stat((_value,round)=>(round?.result_ppb??0)>5&&(round?.result_ppb??0)<=15)} tone="warning" onClick={()=>setView('above5')}/>
      <WorkflowStat label="Above 15 ppb" value={stat((_value,round)=>(round?.result_ppb??0)>15)} tone="urgent" onClick={()=>setView('immediate')} className="border-r"/>
      <WorkflowStat label="Remediation active" value={stat(value=>['action_required','remediation_in_progress'].includes(value))} onClick={()=>setView('remediation')} className="border-r"/>
      <WorkflowStat label="Awaiting retest" value={stat(value=>value==='awaiting_retest')} onClick={()=>setView('retest')}/>
    </div></section>
    <section className="mt-4"><div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Fixture, room, sample ID…"/></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-44"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{statusOptions.map(([value,name])=><SelectItem value={value} key={value}>{name}</SelectItem>)}</SelectContent></Select></div><div className="mt-3 space-y-2">{rows.map(fixture=>{const round=latest(fixture.id);const campus=campuses.find(item=>item.id===fixture.campusId);return <Link className="list-row items-start" to={`/fixture/${fixture.id}`} key={fixture.id}><div><b className="text-sm">{fixture.buildingName} · Room {fixture.roomNumber}</b><p className="text-xs text-muted-foreground">{isSchoolDistrict?campus?.school:campus?.name} · Floor {fixture.floor}</p><p className="mt-1 text-xs">{overallWorkflowLabel(round?.status??fixture.currentLeadTestingStatus)} · {requiredActionLabel(round?.status??fixture.currentLeadTestingStatus,round?.required_action??fixture.currentRequiredAction)}</p></div>{(round?.result_ppb??0)>15&&<AlertTriangle className="h-5 w-5 text-destructive" aria-label="Above 15 ppb"/>}</Link>})}{!rows.length&&<p className="empty-state mt-8 text-sm">No fixtures in this view.</p>}</div></section>
  </div>;
}
function WorkflowStat({label,value,tone='default',onClick,className=''}:{label:string;value:number;tone?:'default'|'warning'|'urgent';onClick:()=>void;className?:string}){return <button type="button" onClick={onClick} aria-label={`${label}: ${value}`} className={`min-w-0 px-3 py-3 text-left transition-colors hover:bg-secondary/30 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}><p className={`text-2xl font-bold tabular-nums ${tone==='warning'?'text-status-warning':tone==='urgent'?'text-status-urgent':'text-foreground'}`}>{value}</p><p className="mt-1 text-xs font-medium leading-tight text-muted-foreground">{label}</p></button>}
