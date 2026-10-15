import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraphMcpClient } from '../src/mcp.js';
import { runCase, runMedical, runDisaster, runSports } from '../src/agents.js';
import { assertChronology, evaluateChronologicalHoldout } from '../src/model.js';
import { loadSports } from '../src/sports-data.js';

const caseRow={caseId:'case-001',eventId:'event-001',eventTitle:'arrival',aId:'s1',aValue:'18:40',aDate:'2026-09-22',aWitness:'w1',aPassage:'p1',aText:'18:40',aUrl:'synthetic://a',bId:'s2',bValue:'19:10',bDate:'2026-09-22',bWitness:'w2',bPassage:'p2',bText:'19:10',bUrl:'synthetic://b',aIdentity:0.98,bIdentity:0.99};
const medicalRow={patientId:'patient-001',medicineId:'amoxicillin',medicine:'Amoxicillin',medicineDate:new Date().toISOString(),ingredient:'amoxicillin',allergy:'penicillin',allergyDate:new Date().toISOString(),allergyRecord:'ar1',labelId:'l1',labelText:'Serious hypersensitivity is a contraindication.',labelDate:'2026-03-01',labelUrl:'https://dailymed.nlm.nih.gov/example'};
const disasterRow={alertId:'a1',headline:'Scenario',issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),alertStatus:'scenario',origin:'synthetic',sourceUrl:'synthetic://alert',retrievedAt:new Date().toISOString(),zoneId:'z1',facilityId:'f1',facility:'Clinic',priority:3,roadId:'r1',roadStatus:'unknown',roadVerifiedAt:'',shelterId:'s1',shelter:'Shelter',available:30,capacityVerifiedAt:''};

function fake(overrides={}) {
  const writes=[];
  const query=async(domain,cypher,params,readOnly)=>{
    if(!readOnly){writes.push({domain,cypher,params});return [{id:params.id}];}
    if(cypher.includes('MATCH (c:Case'))return overrides.caseRows??[caseRow];
    if(cypher.includes('MATCH (p:Patient'))return overrides.medicalRows??[medicalRow];
    if(cypher.includes('MATCH (a:Alert'))return overrides.disasterRows??[disasterRow];
    if(cypher.includes('CALL algo.SPpaths'))return [{distanceKm:5,route:['f1','r1','s1']}];
    if(cypher.includes('MATCH (m:Match'))return overrides.sportsRows??[];
    if(cypher.includes('MATCH (m:HistoricalMatch'))return overrides.history??[];
    return [];
  };
  return {query,writes};
}

test('case path uses an MCP tool and creates a review action with both citations',async()=>{
  const f=fake(),m=await createGraphMcpClient(f.query);try{const result=await runCase(m.client,'case-001','EW');assert.equal(result.status,'action-proposed');assert.equal(result.toolLog.tool,'case_conflicts');assert.equal(result.evidence.sources.length,2);assert.equal(result.guidance.agency,'Crown Prosecution Service');assert.equal(f.writes.length,1);assert.equal(f.writes[0].domain,'case');}finally{await m.close();}
});
test('missing citation and weak identity stop a case action',async()=>{
  for(const change of [{aUrl:''},{aIdentity:0.4}]){const f=fake({caseRows:[{...caseRow,...change}]}),m=await createGraphMcpClient(f.query);try{assert.equal((await runCase(m.client,'case-001')).status,'needs-evidence');assert.equal(f.writes.length,0);}finally{await m.close();}}
});
test('fresh synthetic allergy and label create clinician alert; stale record blocks it',async()=>{
  const good=fake(),m=await createGraphMcpClient(good.query);try{assert.equal((await runMedical(m.client,'patient-001')).status,'action-proposed');assert.equal(good.writes[0].domain,'medical');}finally{await m.close();}
  const stale=fake({medicalRows:[{...medicalRow,allergyDate:'2020-01-01'}]}),n=await createGraphMcpClient(stale.query);try{assert.equal((await runMedical(n.client,'patient-001')).status,'needs-evidence');assert.equal(stale.writes.length,0);}finally{await n.close();}
});
test('disaster path invokes FalkorDB shortest-path algorithm and labels uncertainty',async()=>{
  const f=fake(),m=await createGraphMcpClient(f.query);try{const result=await runDisaster(m.client,'a1');assert.equal(result.status,'action-proposed');assert.equal(result.toolLog[1].tool,'disaster_shortest_path');assert.equal(result.routes[0].distanceKm,5);assert.ok(result.evidence.uncertainty.some(x=>x.includes('unverified')));}finally{await m.close();}
});
test('database failure breaks the decision path and creates no action',async()=>{
  const m=await createGraphMcpClient(async()=>{throw new Error('database offline');});try{await assert.rejects(()=>runCase(m.client,'case-001'),/database offline/);}finally{await m.close();}
});
test('domain tool dispatch is isolated',async()=>{
  const f=fake(),m=await createGraphMcpClient(f.query);try{await runMedical(m.client,'patient-001');assert.ok(f.writes.every(x=>x.domain==='medical'));}finally{await m.close();}
});
test('forecast rejects future match data and evaluates a chronological holdout',async()=>{
  assert.throws(()=>assertChronology([{kickoff:'2025-01-02',homeGoals:1,awayGoals:0}],'2025-01-01'),/at or after/);
  const dataset=await loadSports();const metric=evaluateChronologicalHoldout(dataset.matches);assert.ok(metric.holdoutMatches>20);assert.ok(metric.value>=0&&metric.value<=1);
  const target=dataset.matches.find(x=>x.id===dataset.targetId);
  const f=fake({sportsRows:[{matchId:`replay-${target.id}`,kickoff:target.kickoff,homeId:target.homeId,home:target.home,awayId:target.awayId,away:target.away,minute:0,homeGoals:0,awayGoals:0,lineup:['Player A']}],history:dataset.matches}),m=await createGraphMcpClient(f.query);
  try{const result=await runSports(m.client,`replay-${target.id}`,{minute:30,homeGoals:1,awayGoals:0});assert.equal(result.status,'action-proposed');assert.equal(result.forecast.modelVersion,'transparent-form-v1');assert.ok(Math.abs(result.forecast.home+result.forecast.draw+result.forecast.away-1)<1e-9);assert.equal(f.writes[0].domain,'sports');}finally{await m.close();}
});
