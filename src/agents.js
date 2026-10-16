import { callGraphTool } from './mcp.js';
import { QUERY_CATALOG } from './queries.js';
import { assertChronology, predictMatch, evaluateChronologicalHoldout } from './model.js';

const toolLog=(tool,reason,query)=>({tool,reason,query});
const evidence=(path,sources,uncertainty=[])=>({path,sources,uncertainty});
const citation=(url,recordId,text,date,retrievedAt,kind)=>({url,recordId,text,date,retrievedAt,kind});
const memory=async(client,domain,subjectId)=>((await callGraphTool(client,'agent_memory',{domain,subjectId})).rows||[]);
const continuity=prior=>prior.length?` Prior graph memory loaded: ${prior.length} earlier finding(s); this run is a new review revision.`:'';
const makeAction=async(client,domain,kind,subjectId,summary,ev,tool,toolLogEntries,priorMemory=[])=>callGraphTool(client,'create_action',{domain,kind,subjectId,summary,evidenceJson:JSON.stringify(ev),tool,contextJson:JSON.stringify({path:ev.path,sources:ev.sources,uncertainty:ev.uncertainty,toolLog:toolLogEntries,memory:priorMemory})});

export async function runCase(client,caseId,jurisdiction='US') {
  const priorMemory=await memory(client,'case',caseId);
  const log=toolLog('case_conflicts','Two witness statements must connect through the same event and separate passages.',QUERY_CATALOG.case_conflicts);
  const {rows}=await callGraphTool(client,log.tool,{caseId});
  const gapLog=toolLog('case_gaps','Find event-linked exhibits that have no source passage for corroboration.',QUERY_CATALOG.case_gaps);
  const gaps=(await callGraphTool(client,gapLog.tool,{caseId})).rows||[];
  const r=rows?.[0];
  if(!r) return {status:'no-finding',message:gaps.length?'An exhibit lacks a source passage; inspect the graph before concluding.':'No connected contradiction found.',toolLog:[log,gapLog]};
  const ev=evidence(`Case ${r.caseId} → Event ${r.eventId} ← Statements ${r.aId} / ${r.bId} ← Witnesses ${r.aWitness} / ${r.bWitness}`,[citation(r.aUrl,r.aPassage,r.aText,r.aDate,r.aIngestedAt,r.aSourceKind||'synthetic-fact'),citation(r.bUrl,r.bPassage,r.bText,r.bDate,r.bIngestedAt,r.bSourceKind||'synthetic-fact')],[]);
  ev.memory=priorMemory;
  if(!r.aUrl||!r.bUrl||!r.aText||!r.bText) ev.uncertainty.push('A required source passage or URL is missing.');
  if(Number(r.aIdentity)<0.8||Number(r.bIdentity)<0.8) ev.uncertainty.push('Witness identity match is uncertain.');
  if(ev.uncertainty.length) return {status:'needs-evidence',message:'The finding needs source or identity verification before an action is created.',evidence:ev,toolLog:[log,gapLog]};
  for(const gap of gaps)ev.uncertainty.push(`Potentially overlooked ${gap.exhibitId}: ${gap.description}; no source passage attached.`);
  const summary=`Lawyer review: conflicting ${r.eventTitle} statements (${r.aId}: ${r.aValue}; ${r.bId}: ${r.bValue}). ${gaps.length} exhibit(s) need corroboration review. No legal conclusion made.${continuity(priorMemory)}`;
  const action=await makeAction(client,'case','lawyer-review',caseId,summary,ev,log.tool,[log,gapLog],priorMemory);
  return {status:'action-proposed',summary,evidence:ev,action,toolLog:[log,gapLog],jurisdiction,guidance:GUIDANCE[jurisdiction]||GUIDANCE.US};
}

export const GUIDANCE={
  US:{agency:'US Department of Justice',title:'Justice Manual 9-5.001',url:'https://www.justice.gov/jm/jm-9-5000-issues-related-trials-and-other-court-proceedings',date:'retrieved 2026-10-15',note:'Federal prosecutor guidance; lawyer review required for any case-specific duty.'},
  EW:{agency:'Crown Prosecution Service',title:'Disclosure Manual',url:'https://www.cps.gov.uk/prosecution-guidance/disclosure-manual',date:'refreshed 2022-07-14',note:'England and Wales guidance; lawyer review required.'},
  CA:{agency:'Public Prosecution Service of Canada',title:'Deskbook 2.5 Principles of Disclosure',url:'https://www.ppsc-sppc.gc.ca/eng/pub/fpsd-sfpg/fps-sfp/tpd/p2/ch05.html',date:'modified 2015-07-23',note:'Canadian federal prosecution guidance; lawyer review required.'}
};

export async function runMedical(client,patientId) {
  const priorMemory=await memory(client,'medical',patientId);
  const log=toolLog('medical_contraindications','A current medicine, ingredient, recorded allergy, and label warning must connect.',QUERY_CATALOG.medical_contraindications);
  const {rows}=await callGraphTool(client,log.tool,{patientId});const r=rows?.[0];
  if(!r) return {status:'no-finding',message:'No documented contraindication path found; this is not a safety clearance.',toolLog:log};
  const ev=evidence(`Patient ${r.patientId} → Condition ${r.conditionId}; Patient → Medicine ${r.medicineId} → Ingredient ${r.ingredient}; Patient → Allergy ${r.allergy} ← Label ${r.labelId}`,[citation(r.labelUrl,r.labelId,r.labelText,r.labelDate,r.retrievedAt,r.sourceKind||'official-drug-label'),citation(r.patientSourceUrl,r.allergyRecord,`Recorded serious ${r.allergy} allergy`,r.allergyDate,r.patientRetrievedAt,'synthetic-fact'),citation(r.patientSourceUrl,r.conditionId,r.condition,r.conditionDate,r.patientRetrievedAt,'synthetic-fact')],[]);
  ev.memory=priorMemory;
  const stale=date=>!date||Date.now()-Date.parse(date)>365*86400000;
  if(stale(r.medicineDate))ev.uncertainty.push('Medicine record is missing or over one year old.');
  if(stale(r.allergyDate))ev.uncertainty.push('Allergy record is missing or over one year old.');
  if(!r.labelUrl||!r.labelText)ev.uncertainty.push('Drug-label citation is missing.');
  if(!r.patientSourceUrl||!r.condition)ev.uncertainty.push('Synthetic patient source or condition record is missing.');
  if(ev.uncertainty.length)return {status:'needs-evidence',message:'Clinical facts or label need verification before an alert is created.',evidence:ev,toolLog:log};
  const summary=`Clinician review: ${r.medicine} and recorded serious ${r.allergy} allergy match label contraindication ${r.labelId}. No treatment advice is provided.${continuity(priorMemory)}`;
  const action=await makeAction(client,'medical','clinician-alert',patientId,summary,ev,log.tool,[log],priorMemory);
  return {status:'action-proposed',summary,evidence:ev,action,toolLog:log};
}

export async function runDisaster(client,alertId) {
  const priorMemory=await memory(client,'disaster',alertId);
  const log=toolLog('disaster_candidates','Trace alert → affected zone → facility → road → shelter → capacity.',QUERY_CATALOG.disaster_candidates);
  const {rows}=await callGraphTool(client,log.tool,{alertId});
  if(!rows?.length)return {status:'no-finding',message:'No exposed facility and shelter path found.',toolLog:log};
  const active=Date.parse(rows[0].expiresAt)>Date.now();
  if(!active)return {status:'needs-evidence',message:'Alert has expired. Refresh official alert data before drafting a current brief.',toolLog:log};
  if(rows[0].origin==='official'&&rows.some(r=>r.zoneVerifiedGeo!==true||r.facilityVerifiedGeo!==true||r.shelterVerifiedGeo!==true||r.roadStatus!=='open'||!r.roadVerifiedAt||!r.capacityVerifiedAt)){
    const ev=evidence(rows.map(r=>`Alert ${r.alertId} → Zone ${r.zoneId} → Facility ${r.facilityId} → Road ${r.roadId} → Shelter ${r.shelterId}`).join('\n'),[citation(rows[0].sourceUrl,rows[0].alertId,rows[0].headline,rows[0].issuedAt,rows[0].retrievedAt,rows[0].sourceKind||'official-NWS-alert')],['The alert is official, but the facility, shelter, route or capacity connection lacks independent geographic and operational verification.']);
    ev.memory=priorMemory;
    return {status:'needs-evidence',message:'Official alert found, but its response path is unverified. No incident brief was created.',evidence:ev,toolLog:log,issuedAt:rows[0].issuedAt,expiresAt:rows[0].expiresAt,origin:rows[0].origin};
  }
  const ranked=[...rows].sort((a,b)=>Number(b.priority)-Number(a.priority));
  const routeLog=toolLog('disaster_shortest_path','Weighted shortest path ranks candidate shelter routes by graph distance.',QUERY_CATALOG.disaster_shortest_path);
  for(const r of ranked){const result=await callGraphTool(client,routeLog.tool,{facilityId:r.facilityId,shelterId:r.shelterId});r.route=result.rows?.[0]||null;}
  const ev=evidence(ranked.map(r=>`Alert ${r.alertId} → Zone ${r.zoneId} → Facility ${r.facilityId} → Road ${r.roadId} → Shelter ${r.shelterId} → Capacity`).join('\n'),[citation(rows[0].sourceUrl,rows[0].alertId,rows[0].headline,rows[0].issuedAt,rows[0].retrievedAt,rows[0].sourceKind||'synthetic-scenario')],[]);
  ev.memory=priorMemory;
  if(rows[0].forecastId)ev.sources.push(citation(rows[0].forecastUrl,rows[0].forecastId,rows[0].forecastSummary,rows[0].forecastStart,rows[0].forecastRetrievedAt,rows[0].forecastSourceKind));
  else ev.uncertainty.push('No linked forecast was available.');
  if(rows[0].origin!=='official')ev.uncertainty.push('Scenario alert is synthetic, not an official live warning.');
  for(const r of ranked){if(r.roadStatus!=='open'||!r.roadVerifiedAt)ev.uncertainty.push(`${r.roadId} is not verified open.`);if(!r.capacityVerifiedAt)ev.uncertainty.push(`${r.shelterId} capacity is unverified.`);}
  if(ranked.some(r=>!r.route))ev.uncertainty.push('A candidate shelter has no computed route.');
  if(!rows[0].sourceUrl)ev.uncertainty.push('Alert source URL is missing.');
  const summary=`Incident-team brief: ${ranked.map(r=>`${r.facility} (priority ${r.priority}) → candidate ${r.shelter}, ${r.available} nominal spaces, ${r.route?.distanceKm??'unverified'} km graph route`).join('; ')}. Confirm roads and capacity before any operational decision.${continuity(priorMemory)}`;
  const action=await makeAction(client,'disaster','incident-brief',alertId,summary,ev,log.tool,[log,routeLog],priorMemory);
  return {status:'action-proposed',summary,evidence:ev,action,toolLog:[log,routeLog],routes:ranked.map(r=>r.route),issuedAt:rows[0].issuedAt,expiresAt:rows[0].expiresAt,origin:rows[0].origin};
}

export async function runSports(client,matchId,state) {
  const priorMemory=await memory(client,'sports',matchId);
  const contextLog=toolLog('sports_context','Match, teams, game state, lineup and players must connect.',QUERY_CATALOG.sports_context);
  const {rows}=await callGraphTool(client,contextLog.tool,{matchId});const context=rows?.[0];
  if(!context)return {status:'no-finding',message:'Match graph path missing.',toolLog:contextLog};
  const historyLog=toolLog('sports_history','Retrieve dated, sourced historical matches for a leakage-safe forecast.',QUERY_CATALOG.sports_history);
  const historyResult=await callGraphTool(client,historyLog.tool,{});const history=historyResult.rows||[];
  if(history.length<20)return {status:'needs-evidence',message:'At least 20 real historical matches are required.',toolLog:[contextLog,historyLog]};
  const cutoff=context.kickoff,prior=history.filter(m=>m.kickoff<cutoff);assertChronology(prior,cutoff);
  const useState=state||{minute:context.minute,homeGoals:context.homeGoals,awayGoals:context.awayGoals};
  const forecast=predictMatch(prior,context.homeId,context.awayId,useState);
  const metric=evaluateChronologicalHoldout(history);
  const previous=(await callGraphTool(client,'list_actions',{domain:'sports'})).rows?.find(a=>a.subjectId===matchId);
  let priorState={minute:context.minute,homeGoals:context.homeGoals,awayGoals:context.awayGoals};
  if(previous){try{priorState=JSON.parse(previous.evidenceJson).state||priorState;}catch{}}
  const ev=evidence(`Match ${matchId} → ${context.homeId} / ${context.awayId} → ${prior.length} prior matches → opponents; Match → Lineup → ${context.lineup?.length||0} players`,prior.slice(-3).map(m=>citation(m.sourceUrl,m.id,`${m.homeId} ${m.homeGoals}–${m.awayGoals} ${m.awayId}`,m.kickoff,m.retrievedAt,m.sourceKind||'public-historical-data')),[]);
  ev.memory=priorMemory;
  if(!context.lineup?.length)ev.uncertainty.push('Lineup coverage is missing.');
  ev.uncertainty.push('Historical replay; game state is manual input. Probabilities are model estimates, not certainties.');
  const explanation=`Manual game state changed from ${priorState.minute}' ${priorState.homeGoals}-${priorState.awayGoals} to ${useState.minute}' ${useState.homeGoals}-${useState.awayGoals}; prior match form and current score affect the three-way baseline. Lineup is context only.`;
  const summary=`Forecast revision for ${context.home} vs ${context.away}: home ${(forecast.home*100).toFixed(1)}%, draw ${(forecast.draw*100).toFixed(1)}%, away ${(forecast.away*100).toFixed(1)}%. ${explanation}`;
  const action=await makeAction(client,'sports','forecast-revision',matchId,summary,{...ev,forecast,metric,state:useState,forecastTime:new Date().toISOString()},contextLog.tool,[contextLog,historyLog],priorMemory);
  return {status:'action-proposed',summary,evidence:ev,action,toolLog:[contextLog,historyLog],forecast,metric,forecastTime:action.createdAt,manualState:useState,home:context.home,away:context.away};
}
