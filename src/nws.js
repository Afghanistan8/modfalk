import { node, edge } from './seed.js';
import { closeDb } from './db.js';

export async function importNws(area='TX') {
  if(!/^[A-Z]{2}$/.test(area))throw new Error('Use a two-letter US state code');
  const url=`https://api.weather.gov/alerts/active?area=${area}`;
  const response=await fetch(url,{headers:{'User-Agent':'ModFalk/0.1 (contact: project owner via GitHub Afghanistan8/modfalk)','Accept':'application/geo+json'}});
  if(!response.ok)throw new Error(`NWS API ${response.status}`);
  const data=await response.json();
  const feature=data.features?.find(f=>f.properties?.expires&&Date.parse(f.properties.expires)>Date.now());
  if(!feature)return {imported:false,message:`No active NWS alert in ${area}; synthetic scenario remains available.`};
  const p=feature.properties,id=`nws-${String(p.id||feature.id).split('/').pop()}`,zoneId=`zone-${id}`;
  const sourceUrl=p.id||feature.id||url,now=new Date().toISOString();
  await node('disaster','Alert',id,{headline:p.headline||p.event,issuedAt:p.sent||p.effective,expiresAt:p.expires,status:p.status||'actual',origin:'official',areaDesc:p.areaDesc});
  await node('disaster','Source',`source-${id}`,{url:sourceUrl,retrievedAt:now,kind:'official-NWS-alert'});
  await node('disaster','Zone',zoneId,{name:p.areaDesc||area,sourceAreaDescription:true});
  await node('disaster','Facility',`facility-${id}`,{name:'Synthetic facility in alert area',priority:2,synthetic:true,liveStatusVerified:false});
  await node('disaster','Road',`road-${id}`,{name:'Synthetic access road',status:'unknown',verifiedAt:''});
  await node('disaster','Shelter',`shelter-${id}`,{name:'Synthetic candidate shelter',synthetic:true,liveStatusVerified:false});
  await node('disaster','Capacity',`capacity-${id}`,{available:25,verifiedAt:'',synthetic:true});
  await edge('disaster','Alert',id,'FROM_SOURCE','Source',`source-${id}`);
  await edge('disaster','Alert',id,'AFFECTS','Zone',zoneId);
  await edge('disaster','Facility',`facility-${id}`,'LOCATED_IN','Zone',zoneId);
  await edge('disaster','Facility',`facility-${id}`,'USES_ROAD','Road',`road-${id}`);
  await edge('disaster','Road',`road-${id}`,'LEADS_TO','Shelter',`shelter-${id}`);
  await edge('disaster','Facility',`facility-${id}`,'ROUTE','Road',`road-${id}`,{distanceKm:2});
  await edge('disaster','Road',`road-${id}`,'ROUTE','Shelter',`shelter-${id}`,{distanceKm:3});
  await edge('disaster','Shelter',`shelter-${id}`,'HAS_CAPACITY','Capacity',`capacity-${id}`);
  return {imported:true,alertId:id,headline:p.headline||p.event,sourceUrl,expiresAt:p.expires,facilityStatus:'synthetic/unverified'};
}

if(process.argv[1]?.endsWith('nws.js'))importNws((process.argv[2]||'TX').toUpperCase()).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e);process.exitCode=1;}).finally(closeDb);
