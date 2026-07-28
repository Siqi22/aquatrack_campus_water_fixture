/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeLeadResult } from '@/lib/leadTesting';

export interface TestingRound { id:string; fixture_id:string; round_type:string; round_number:number; status:string; sample_id:string|null; laboratory_sample_id:string|null; sample_draw_at?:string|null; sample_drawn_at:string|null; sample_collector_name:string|null; sampling_method:string|null; sampling_method_description?:string|null; result_value:string|null; result_original_unit:string|null; result_ppb:number|null; result_category:string|null; result_received_at:string|null; required_action:string; report_upload_id:string|null; notes:string|null; created_at:string; }
export interface Remediation { id:string; fixture_id:string; triggering_testing_round_id:string; remediation_type:string; status:string; description:string|null; responsible_person:string|null; contractor_or_company:string|null; started_at:string|null; completed_at:string|null; manufacturer:string|null; product_name:string|null; model:string|null; serial_number:string|null; installation_date:string|null; photo_url:string|null; notes:string|null; follow_up_testing_round_id:string|null; created_at:string; }
export interface LeadEvent { id:string; fixture_id:string; event_type:string; event_timestamp:string; description:string; testing_round_id:string|null; remediation_record_id:string|null; }

const db = supabase as any;
export function useLeadTesting(fixtureId?: string) {
  const [rounds,setRounds]=useState<TestingRound[]>([]); const [remediations,setRemediations]=useState<Remediation[]>([]); const [events,setEvents]=useState<LeadEvent[]>([]); const [loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{ setLoading(true); try {
    let rq=db.from('lead_testing_rounds').select('*').is('deleted_at',null).order('round_number');
    let mq=db.from('remediation_records').select('*').is('deleted_at',null).order('created_at');
    let eq=db.from('lead_testing_events').select('*').order('event_timestamp',{ascending:false});
    if(fixtureId){rq=rq.eq('fixture_id',fixtureId);mq=mq.eq('fixture_id',fixtureId);eq=eq.eq('fixture_id',fixtureId);}
    const [r,m,e]=await Promise.all([rq,mq,eq]); if(r.error) throw r.error; if(m.error) throw m.error; if(e.error) throw e.error;
    setRounds(r.data??[]);setRemediations(m.data??[]);setEvents(e.data??[]);
  } finally {setLoading(false);} },[fixtureId]);
  useEffect(()=>{void refresh();},[refresh]);
  async function actor(){const {data}=await supabase.auth.getUser();return data.user?.id??null;}
  async function event(fixture_id:string,event_type:string,description:string,extra:Record<string,unknown>={}){await db.from('lead_testing_events').insert({fixture_id,event_type,description,performed_by:await actor(),...extra});}
  async function createRound(input:{fixtureId:string;roundType:string;sampleId?:string;sampleDrawDate:string;collector:string;method:string;methodDescription?:string;notes?:string;remediationId?:string}){
    if(!input.sampleDrawDate) throw new Error('Sample draw date is required.');
    if(!input.collector.trim()) throw new Error('Collector is required.');
    if(!input.method) throw new Error('Sampling method is required.');
    const existing=rounds.filter(r=>r.fixture_id===input.fixtureId); if(input.sampleId&&existing.some(r=>r.sample_id?.toLowerCase()===input.sampleId!.toLowerCase())) throw new Error('This sample ID is already in use.');
    const active=existing.find(r=>!['complete','invalid_or_inconclusive'].includes(r.status));
    const status=input.roundType==='post_remediation_retest'?'awaiting_retest_results':'awaiting_results';
    const {data,error}=await db.from('lead_testing_rounds').insert({fixture_id:input.fixtureId,round_type:input.roundType,round_number:Math.max(0,...existing.map(r=>r.round_number))+1,status,sample_id:input.sampleId||null,sample_draw_date:input.sampleDrawDate,sample_drawn_at:`${input.sampleDrawDate}T12:00:00`,sample_collector_name:input.collector.trim(),sampling_method:input.method,sampling_method_description:input.method==='other'?input.methodDescription||null:null,notes:input.notes||null,created_by:await actor()}).select('*').single();
    if(error) throw error; await db.from('fixtures').update({current_lead_testing_status:status,current_required_action:'Awaiting Results',current_testing_round_id:data.id,lead_testing_last_updated_at:new Date().toISOString()}).eq('id',input.fixtureId);
    if(input.remediationId)await db.from('remediation_records').update({follow_up_testing_round_id:data.id,status:'awaiting_retest'}).eq('id',input.remediationId);
    await event(input.fixtureId,input.roundType==='post_remediation_retest'?'retest_sample_drawn':'sample_drawn',input.roundType==='post_remediation_retest'?'Post-remediation retest sample drawn':'Sample drawn and awaiting results',{testing_round_id:data.id,remediation_record_id:input.remediationId}); await refresh(); return {round:data,hadActiveRound:Boolean(active)};
  }
  async function enterResult(round:TestingRound,value:string,unit:string,receivedAt:string,labSampleId?:string,notes?:string){
    if(new Date(receivedAt)<new Date(round.sample_drawn_at??0)) throw new Error('Result date cannot be before the sample date.');
    const {error}=await db.from('lead_testing_rounds').update({result_value:value,result_original_unit:unit,result_received_at:receivedAt,laboratory_sample_id:labSampleId||null,notes:notes||round.notes}).eq('id',round.id); if(error) throw error;
    const normalized=normalizeLeadResult(value,unit,round.round_type==='post_remediation_retest');
    await event(round.fixture_id,round.round_type==='post_remediation_retest'?'retest_result_received':'result_manually_entered',`Lead result recorded: ${value} ${unit}`,{testing_round_id:round.id,metadata:{normalized_ppb:normalized.ppb}});
    if(round.round_type==='post_remediation_retest')await event(round.fixture_id,normalized.category==='5 ppb or less'?'remediation_verified':'additional_remediation_required',normalized.category==='5 ppb or less'?'Post-remediation retest passed; remediation verified':'Post-remediation retest remained above 5 ppb; additional remediation required',{testing_round_id:round.id});
    await refresh();
  }
  async function setAvailability(fixture:string,status:string){await db.from('fixtures').update({fixture_availability_status:status,lead_testing_last_updated_at:new Date().toISOString()}).eq('id',fixture);await event(fixture,status==='shut_off'?'outlet_shut_off':'access_restricted',`Fixture availability changed to ${status.replaceAll('_',' ')}`);await refresh();}
  async function createRemediation(input:{fixtureId:string;roundId:string;type:string;description:string;responsible:string;contractor?:string;product?:string;manufacturer?:string;model?:string;serialNumber?:string;installationDate?:string;photoUrl?:string;startedAt?:string;notes?:string}){const {data,error}=await db.from('remediation_records').insert({fixture_id:input.fixtureId,triggering_testing_round_id:input.roundId,remediation_type:input.type,status:'in_progress',description:input.description,responsible_person:input.responsible,contractor_or_company:input.contractor||null,product_name:input.product||null,manufacturer:input.manufacturer||null,model:input.model||null,serial_number:input.serialNumber||null,installation_date:input.installationDate||null,photo_url:input.photoUrl||null,started_at:input.startedAt||new Date().toISOString(),notes:input.notes||null,created_by:await actor()}).select('*').single();if(error)throw error;await db.from('fixtures').update({current_lead_testing_status:'remediation_in_progress',current_required_action:'Remediation required',lead_testing_last_updated_at:new Date().toISOString()}).eq('id',input.fixtureId);await event(input.fixtureId,'remediation_started',input.description,{testing_round_id:input.roundId,remediation_record_id:data.id});await refresh();}
  async function completeRemediation(item:Remediation){const now=new Date().toISOString();const {error}=await db.from('remediation_records').update({status:'completed',completed_at:now,started_at:item.started_at||now}).eq('id',item.id);if(error)throw error;await event(item.fixture_id,'remediation_completed','Remediation completed; post-remediation retest required',{testing_round_id:item.triggering_testing_round_id,remediation_record_id:item.id});await refresh();}
  return {rounds,remediations,events,loading,refresh,createRound,enterResult,setAvailability,createRemediation,completeRemediation};
}
