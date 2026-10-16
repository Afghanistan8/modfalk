import { node, edge } from './seed.js';
import { closeDb, runQuery } from './db.js';

const FEMA_QUERY='https://gis.fema.gov/arcgis/rest/services/NSS/OpenShelters/MapServer/0/query?where=shelter_status%3D%27OPEN%27&outFields=shelter_id,shelter_name,address,city,state,zip,shelter_status,evacuation_capacity,post_impact_capacity,latitude,longitude&returnGeometry=false&resultRecordCount=100&f=json';
const sourceUrl=FEMA_QUERY;

export async function importFemaShelters(limit=5) {
  const response=await fetch(FEMA_QUERY,{headers:{'User-Agent':'ModFalk/0.1 https://github.com/Afghanistan8/modfalk','Accept':'application/json'}});
  if(!response.ok)throw new Error(`FEMA shelter API ${response.status}`);
  const features=(await response.json()).features||[];
  const shelters=features.map(f=>f.attributes).filter(s=>s?.shelter_id&&(s.latitude!==null||s.evacuation_capacity!==null||s.post_impact_capacity!==null)).slice(0,limit);
  if(!shelters.length)throw new Error('FEMA returned no open shelters');
  const now=new Date().toISOString();
  await node('disaster','Source','fema-open-shelters-source',{url:sourceUrl,retrievedAt:now,kind:'official-FEMA-open-shelter'});
  await runQuery('disaster',`MATCH (r:Road {sourceKind:'official-FEMA-open-shelter'}) DETACH DELETE r`,{},false);
  for(const s of shelters){
    const sid=`fema-shelter-${s.shelter_id}`,cid=`fema-capacity-${s.shelter_id}`;
    const available=Number.isFinite(Number(s.evacuation_capacity))&&Number(s.evacuation_capacity)>0?Number(s.evacuation_capacity):Number.isFinite(Number(s.post_impact_capacity))&&Number(s.post_impact_capacity)>0?Number(s.post_impact_capacity):null;
    const verifiedGeo=Number.isFinite(Number(s.latitude))&&Number.isFinite(Number(s.longitude));
    await node('disaster','Shelter',sid,{name:s.shelter_name||'FEMA open shelter',address:s.address,city:s.city,state:s.state,zip:s.zip,status:s.shelter_status,latitude:s.latitude,longitude:s.longitude,verifiedGeo,sourceKind:'official-FEMA-open-shelter',synthetic:false});
    await node('disaster','Capacity',cid,{available,verifiedAt:available===null?'':now,sourceKind:'official-FEMA-open-shelter',synthetic:false});
    await edge('disaster','Shelter',sid,'HAS_CAPACITY','Capacity',cid);
    await edge('disaster','Shelter',sid,'FROM_SOURCE','Source','fema-open-shelters-source');
  }
  return {source:sourceUrl,imported:shelters.length,shelters:shelters.map(s=>({id:s.shelter_id,name:s.shelter_name,capacity:s.evacuation_capacity??s.post_impact_capacity,status:s.shelter_status}))};
}

export async function importDailyMed(drug='amoxicillin') {
  const url=`https://dailymed.nlm.nih.gov/dailymed/services/v1/drugname/${encodeURIComponent(drug)}/spls.json`;
  const response=await fetch(url);
  if(!response.ok)throw new Error(`DailyMed API ${response.status}`);
  const payload=await response.json(),columns=payload.COLUMNS||[],rows=payload.DATA||[],records=rows.map(row=>Object.fromEntries(columns.map((key,i)=>[key.toLowerCase(),row[i]])));
  const latest=records.sort((a,b)=>Date.parse(b.published_date||'')-Date.parse(a.published_date||''))[0];
  if(!latest?.setid)throw new Error(`DailyMed returned no ${drug} label`);
  const now=new Date().toISOString(),source=`https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${latest.setid}.xml`;
  const xmlResponse=await fetch(source);if(!xmlResponse.ok)throw new Error(`DailyMed label XML ${xmlResponse.status}`);
  const contraindications=extractContraindications(await xmlResponse.text());
  if(!contraindications)throw new Error(`DailyMed label ${latest.setid} has no extractable contraindications section`);
  await node('medical','Source','dailymed-amoxicillin-current',{url:source,retrievedAt:now,kind:'official-DailyMed-label'});
  await node('medical','LabelSection','dailymed-amoxicillin-current',{text:contraindications.slice(0,2000),labelDate:latest.published_date,labelDateIso:new Date(latest.published_date).toISOString().slice(0,10),warningKind:'contraindication',recordId:latest.setid,sourceKind:'official-DailyMed-label',verifiedText:true});
  await edge('medical','Medicine','amoxicillin','HAS_LABEL','LabelSection','dailymed-amoxicillin-current');
  await edge('medical','LabelSection','dailymed-amoxicillin-current','WARNS_ABOUT','Allergy','penicillin');
  await edge('medical','LabelSection','dailymed-amoxicillin-current','FROM_SOURCE','Source','dailymed-amoxicillin-current');
  return {source,drug,title:latest.title,publishedDate:latest.published_date,setId:latest.setid};
}

const decodeXml=text=>text.replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();
export function extractContraindications(xml) {
  const sections=[...String(xml).matchAll(/<section\b[\s\S]*?<\/section>/gi)].map(x=>x[0]);
  const section=sections.find(value=>/<code\b[^>]*\bcode=["']34070-3["']/i.test(value));
  const text=section?.match(/<text\b[^>]*>([\s\S]*?)<\/text>/i)?.[1];
  return text?decodeXml(text):'';
}

if(process.argv[1]?.endsWith('public-data.js'))Promise.all([importFemaShelters(),importDailyMed()]).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e);process.exitCode=1;}).finally(closeDb);
