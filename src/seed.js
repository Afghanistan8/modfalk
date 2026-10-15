import { runQuery, closeDb } from './db.js';
import { loadSports } from './sports-data.js';

const stamp=new Date().toISOString();
const clean=object=>Object.fromEntries(Object.entries(object).filter(([,v])=>v!==undefined&&v!==null));
const identifier=x=>{if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(x))throw new Error('Invalid graph identifier');return x;};
export async function node(domain,label,id,props={}) {
  const values=clean(props),set=Object.keys(values).map(key=>`n.${identifier(key)}=$${identifier(key)}`).join(',');
  await runQuery(domain,`MERGE (n:${identifier(label)} {id:$id})${set?` SET ${set}`:''}`,{id:String(id),...values},false);
}
export async function edge(domain,fromLabel,fromId,type,toLabel,toId,props={}) {
  const values=clean(props),set=Object.keys(values).map(key=>`r.${identifier(key)}=$${identifier(key)}`).join(',');
  await runQuery(domain,`MATCH (a:${identifier(fromLabel)} {id:$fromId}),(b:${identifier(toLabel)} {id:$toId}) MERGE (a)-[r:${identifier(type)}]->(b)${set?` SET ${set}`:''}`,{fromId:String(fromId),toId:String(toId),...values},false);
}

async function seedCase() {
  const d='case';
  await node(d,'Case','case-001',{name:'Warehouse camera timeline',synthetic:true});
  await node(d,'Event','event-001',{title:'Loading bay arrival',eventAt:'2026-09-21T18:40:00Z',synthetic:true});
  await edge(d,'Case','case-001','HAS_EVENT','Event','event-001');
  for(const [id,name] of [['witness-a','Morgan Vale'],['witness-b','Samir Bell']])await node(d,'Witness',id,{name,synthetic:true});
  const records=[
    ['statement-a','witness-a','18:40','passage-a','Synthetic interview record A says the van arrived at 18:40.'],
    ['statement-b','witness-b','19:10','passage-b','Synthetic interview record B says the van arrived at 19:10.']
  ];
  for(const [id,witness,value,passage,text] of records){
    await node(d,'Statement',id,{claimKey:'arrival-time',claimValue:value,recordedAt:'2026-09-22T10:00:00Z',identityConfidence:0.98,synthetic:true});
    await node(d,'Assertion',`assertion-${id}`,{claimKey:'arrival-time',claimValue:value,eventAt:`2026-09-21T${value}:00Z`,recordedAt:'2026-09-22T10:00:00Z',ingestedAt:stamp,classification:'synthetic-fact'});
    await node(d,'Passage',passage,{text,recordId:passage,ingestedAt:stamp,kind:'synthetic-fact'});
    await node(d,'Source',`source-${passage}`,{url:`synthetic://case-001/${passage}`,retrievedAt:stamp,kind:'synthetic-case-evidence'});
    await edge(d,'Witness',witness,'GAVE','Statement',id);
    await edge(d,'Statement',id,'ABOUT','Event','event-001');
    await edge(d,'Statement',id,'EXPRESSES','Assertion',`assertion-${id}`);
    await edge(d,'Assertion',`assertion-${id}`,'FROM_SOURCE','Source',`source-${passage}`);
    await edge(d,'Statement',id,'SUPPORTED_BY','Passage',passage);
    await edge(d,'Passage',passage,'FROM_SOURCE','Source',`source-${passage}`);
  }
  await node(d,'Exhibit','camera-log',{description:'Synthetic camera clock log; time sync unverified',synthetic:true});
  await edge(d,'Exhibit','camera-log','ABOUT','Event','event-001');
  for(const [code,title,url,date] of [
    ['US','Justice Manual 9-5.001','https://www.justice.gov/jm/jm-9-5000-issues-related-trials-and-other-court-proceedings','retrieved 2026-10-15'],
    ['EW','CPS Disclosure Manual','https://www.cps.gov.uk/prosecution-guidance/disclosure-manual','2022-07-14'],
    ['CA','PPSC Deskbook 2.5','https://www.ppsc-sppc.gc.ca/eng/pub/fpsd-sfpg/fps-sfp/tpd/p2/ch05.html','2015-07-23']]){
    await node(d,'Guidance',`guidance-${code}`,{jurisdiction:code,title,date,kind:'guidance'});
    await node(d,'Source',`guidance-source-${code}`,{url,retrievedAt:stamp,kind:'official-guidance'});
    await edge(d,'Guidance',`guidance-${code}`,'FROM_SOURCE','Source',`guidance-source-${code}`);
  }
}

async function seedMedical() {
  const d='medical',date=new Date().toISOString();
  await node(d,'Patient','patient-001',{name:'Synthetic Patient A',synthetic:true});
  await node(d,'Condition','condition-001',{name:'Synthetic infection, type unspecified',recordedAt:date,recordId:'synthetic-condition-001',synthetic:true});
  await node(d,'Medicine','amoxicillin',{name:'Amoxicillin',recordedAt:date,synthetic:true});
  await node(d,'Ingredient','amoxicillin-ingredient',{name:'amoxicillin'});
  await node(d,'Allergy','penicillin',{name:'penicillin',severity:'serious',recordedAt:date,ingestedAt:stamp,recordId:'synthetic-allergy-001',synthetic:true});
  await node(d,'LabelSection','amoxicillin-4',{text:'to amoxicillin or to other beta-lactams (e.g., penicillins or cephalosporins).',labelDate:'2026-03-01',warningKind:'contraindication',recordId:'section-4'});
  await node(d,'Assertion','allergy-assertion-001',{claimKey:'serious-allergy',claimValue:'penicillin',eventAt:date,ingestedAt:stamp,classification:'synthetic-fact'});
  await node(d,'Assertion','condition-assertion-001',{claimKey:'recorded-condition',claimValue:'infection, type unspecified',eventAt:date,ingestedAt:stamp,classification:'synthetic-fact'});
  await node(d,'Assertion','label-assertion-001',{claimKey:'contraindication',claimValue:'serious beta-lactam hypersensitivity',eventAt:'2026-03-01',ingestedAt:stamp,classification:'source-fact'});
  await node(d,'Source','patient-record-source',{url:'synthetic://patient-record',retrievedAt:stamp,kind:'synthetic-patient-record'});
  await node(d,'Source','dailymed-amoxicillin',{url:'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4fb7837e-964c-4d38-a3a5-b384b1bd6e08',retrievedAt:stamp,kind:'official-drug-label'});
  for(const args of [
    ['Patient','patient-001','TAKES','Medicine','amoxicillin'],['Patient','patient-001','HAS_ALLERGY','Allergy','penicillin'],
    ['Patient','patient-001','HAS_CONDITION','Condition','condition-001'],
    ['Medicine','amoxicillin','HAS_INGREDIENT','Ingredient','amoxicillin-ingredient'],['Medicine','amoxicillin','HAS_LABEL','LabelSection','amoxicillin-4'],
    ['LabelSection','amoxicillin-4','WARNS_ABOUT','Allergy','penicillin'],['LabelSection','amoxicillin-4','FROM_SOURCE','Source','dailymed-amoxicillin']
  ])await edge(d,...args);
  for(const labelAndId of [['Condition','condition-001'],['Allergy','penicillin'],['Medicine','amoxicillin']])await edge(d,...labelAndId,'FROM_SOURCE','Source','patient-record-source');
  await edge(d,'Condition','condition-001','ASSERTED_BY','Assertion','condition-assertion-001');
  await edge(d,'Assertion','condition-assertion-001','FROM_SOURCE','Source','patient-record-source');
  await edge(d,'Allergy','penicillin','ASSERTED_BY','Assertion','allergy-assertion-001');
  await edge(d,'Assertion','allergy-assertion-001','FROM_SOURCE','Source','patient-record-source');
  await edge(d,'LabelSection','amoxicillin-4','ASSERTED_BY','Assertion','label-assertion-001');
  await edge(d,'Assertion','label-assertion-001','FROM_SOURCE','Source','dailymed-amoxicillin');
}

async function seedDisaster() {
  const d='disaster',issuedAt=new Date().toISOString(),expiresAt=new Date(Date.now()+86400000).toISOString();
  await node(d,'Alert','scenario-flood-001',{headline:'Synthetic flash-flood scenario for graph demonstration',issuedAt,expiresAt,status:'scenario',origin:'synthetic'});
  await node(d,'Assertion','alert-assertion-001',{claimKey:'hazard',claimValue:'synthetic flash-flood scenario',eventAt:issuedAt,ingestedAt:stamp,classification:'synthetic-fact'});
  await node(d,'Source','scenario-source',{url:'synthetic://disaster/flood-scenario-001',retrievedAt:stamp,kind:'synthetic-scenario'});
  await node(d,'Zone','zone-001',{name:'Synthetic Creek Zone'});
  await node(d,'Facility','clinic-001',{name:'Creekside Clinic',priority:3,synthetic:true});
  await node(d,'Facility','school-001',{name:'North School',priority:2,synthetic:true});
  await node(d,'Road','road-a',{name:'Bridge Road',status:'unknown',verifiedAt:''});
  await node(d,'Road','road-b',{name:'Hill Road',status:'unknown',verifiedAt:''});
  await node(d,'Shelter','shelter-001',{name:'Hill Centre',synthetic:true});
  await node(d,'Capacity','capacity-001',{available:40,verifiedAt:'',synthetic:true});
  await node(d,'Forecast','forecast-scenario-001',{summary:'Synthetic heavy-rain forecast for scenario replay',startTime:issuedAt,endTime:expiresAt,origin:'synthetic'});
  await node(d,'Source','forecast-scenario-source',{url:'synthetic://disaster/rain-forecast-001',retrievedAt:stamp,kind:'synthetic-forecast'});
  await edge(d,'Alert','scenario-flood-001','AFFECTS','Zone','zone-001');
  await edge(d,'Alert','scenario-flood-001','FROM_SOURCE','Source','scenario-source');
  await edge(d,'Alert','scenario-flood-001','ASSERTED_BY','Assertion','alert-assertion-001');
  await edge(d,'Assertion','alert-assertion-001','FROM_SOURCE','Source','scenario-source');
  await edge(d,'Zone','zone-001','HAS_FORECAST','Forecast','forecast-scenario-001');
  await edge(d,'Forecast','forecast-scenario-001','FROM_SOURCE','Source','forecast-scenario-source');
  for(const facility of ['clinic-001','school-001']){
    await edge(d,'Facility',facility,'LOCATED_IN','Zone','zone-001');
    await edge(d,'Facility',facility,'USES_ROAD','Road',facility==='clinic-001'?'road-a':'road-b');
    await edge(d,'Facility',facility,'ROUTE','Road',facility==='clinic-001'?'road-a':'road-b',{distanceKm:facility==='clinic-001'?2:3});
  }
  for(const road of ['road-a','road-b']){
    await edge(d,'Road',road,'LEADS_TO','Shelter','shelter-001');
    await edge(d,'Road',road,'ROUTE','Shelter','shelter-001',{distanceKm:road==='road-a'?4:2});
  }
  await edge(d,'Shelter','shelter-001','HAS_CAPACITY','Capacity','capacity-001');
}

async function seedSports() {
  const d='sports',dataset=await loadSports();
  for(const [url,index] of [...new Set(dataset.matches.map(m=>m.sourceUrl))].map((url,i)=>[url,i]))await node(d,'Source',`statsbomb-season-${index}`,{url,retrievedAt:dataset.retrievedAt,kind:'public-historical-data'});
  const sourceIds=new Map([...new Set(dataset.matches.map(m=>m.sourceUrl))].map((url,i)=>[url,`statsbomb-season-${i}`]));
  const teams=new Map();for(const m of dataset.matches){teams.set(m.homeId,m.home);teams.set(m.awayId,m.away);}
  for(const [id,name] of teams)await node(d,'Team',id,{name});
  for(const m of dataset.matches){
    await node(d,'HistoricalMatch',m.id,{kickoff:m.kickoff,homeGoals:m.homeGoals,awayGoals:m.awayGoals,season:m.season,kind:'source-fact'});
    await edge(d,'HistoricalMatch',m.id,'HOME_TEAM','Team',m.homeId);
    await edge(d,'HistoricalMatch',m.id,'AWAY_TEAM','Team',m.awayId);
    await edge(d,'HistoricalMatch',m.id,'FROM_SOURCE','Source',sourceIds.get(m.sourceUrl));
  }
  const target=dataset.matches.find(m=>m.id===dataset.targetId),id=`replay-${target.id}`;
  await node(d,'Assertion',`result-${target.id}`,{claimKey:'match-result',claimValue:`${target.homeGoals}-${target.awayGoals}`,eventAt:target.kickoff,ingestedAt:dataset.retrievedAt,classification:'source-fact'});
  await edge(d,'HistoricalMatch',target.id,'ASSERTED_BY','Assertion',`result-${target.id}`);
  await edge(d,'Assertion',`result-${target.id}`,'FROM_SOURCE','Source',sourceIds.get(target.sourceUrl));
  await node(d,'Match',id,{kickoff:target.kickoff,replay:true,sourceMatchId:target.id});
  await node(d,'GameState',`state-${id}`,{minute:0,homeGoals:0,awayGoals:0,inputKind:'manual-replay'});
  await edge(d,'Match',id,'HOME_TEAM','Team',target.homeId);
  await edge(d,'Match',id,'AWAY_TEAM','Team',target.awayId);
  await edge(d,'Match',id,'HAS_STATE','GameState',`state-${id}`);
  const homeLineup=dataset.lineup.find(l=>String(l.team_id)===target.homeId);
  if(homeLineup){
    await node(d,'Lineup',`lineup-${id}`,{sourceMatchId:target.id,kind:'historical-replay'});
    await edge(d,'Match',id,'HAS_LINEUP','Lineup',`lineup-${id}`);
    await edge(d,'Lineup',`lineup-${id}`,'FOR_TEAM','Team',target.homeId);
    for(const p of homeLineup.lineup.filter(p=>p.positions?.some(x=>x.start_reason==='Starting XI'))){
      await node(d,'Player',String(p.player_id),{name:p.player_name});
      await edge(d,'Lineup',`lineup-${id}`,'INCLUDES','Player',String(p.player_id));
    }
  }
  return {matchId:id,historyMatches:dataset.matches.length};
}

export async function seedAll() {
  await seedCase();await seedMedical();await seedDisaster();const sports=await seedSports();
  return {case:'case-001',medical:'patient-001',disaster:'scenario-flood-001',sports};
}

if(process.argv[1]?.endsWith('seed.js'))seedAll().then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e);process.exitCode=1;}).finally(closeDb);
