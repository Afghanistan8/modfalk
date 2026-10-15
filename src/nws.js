import { node, edge } from './seed.js';
import { closeDb } from './db.js';

export async function importNws(latitude=29.76,longitude=-95.36) {
  const lat=Number(latitude),lon=Number(longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<20||lat>72||lon< -180||lon> -60)throw new Error('Enter a valid US point as latitude longitude');
  const point=`${lat},${lon}`,url=`https://api.weather.gov/alerts/active?point=${point}`;
  const headers={'User-Agent':'ModFalk/0.1 (contact: project owner via GitHub Afghanistan8/modfalk)','Accept':'application/geo+json'};
  const response=await fetch(url,{headers});
  if(!response.ok)throw new Error(`NWS API ${response.status}`);
  const data=await response.json();
  const feature=data.features?.find(f=>f.properties?.expires&&Date.parse(f.properties.expires)>Date.now());
  if(!feature)return {imported:false,message:`No active NWS alert at ${point}; synthetic scenario remains available.`};
  const p=feature.properties,id=`nws-${String(p.id||feature.id).split('/').pop()}`,zoneId=`zone-${id}`;
  const sourceUrl=p.id||feature.id||url,now=new Date().toISOString();
  const pointResponse=await fetch(`https://api.weather.gov/points/${point}`,{headers});
  if(!pointResponse.ok)throw new Error(`NWS point API ${pointResponse.status}`);
  const pointData=await pointResponse.json(),forecastUrl=pointData.properties?.forecast;
  if(!forecastUrl)throw new Error('NWS did not provide a forecast URL for this point');
  const forecastResponse=await fetch(forecastUrl,{headers});
  if(!forecastResponse.ok)throw new Error(`NWS forecast API ${forecastResponse.status}`);
  const forecast=(await forecastResponse.json()).properties?.periods?.[0];
  if(!forecast)throw new Error('NWS did not provide a current forecast period');
  await node('disaster','Alert',id,{headline:p.headline||p.event,issuedAt:p.sent||p.effective,expiresAt:p.expires,status:p.status||'actual',origin:'official',areaDesc:p.areaDesc});
  await node('disaster','Source',`source-${id}`,{url:sourceUrl,retrievedAt:now,kind:'official-NWS-alert'});
  await node('disaster','Zone',zoneId,{name:`NWS point ${point} in ${p.areaDesc||'alert area'}`,latitude:lat,longitude:lon,sourceAreaDescription:true});
  await node('disaster','Forecast',`forecast-${id}`,{summary:forecast.detailedForecast||forecast.shortForecast,startTime:forecast.startTime,endTime:forecast.endTime,origin:'official'});
  await node('disaster','Source',`forecast-source-${id}`,{url:forecastUrl,retrievedAt:now,kind:'official-NWS-forecast'});
  await node('disaster','Facility',`facility-${id}`,{name:'Synthetic facility at selected point',priority:2,synthetic:true,liveStatusVerified:false});
  await node('disaster','Road',`road-${id}`,{name:'Synthetic access road',status:'unknown',verifiedAt:''});
  await node('disaster','Shelter',`shelter-${id}`,{name:'Synthetic candidate shelter',synthetic:true,liveStatusVerified:false});
  await node('disaster','Capacity',`capacity-${id}`,{available:25,verifiedAt:'',synthetic:true});
  await edge('disaster','Alert',id,'FROM_SOURCE','Source',`source-${id}`);
  await edge('disaster','Alert',id,'AFFECTS','Zone',zoneId);
  await edge('disaster','Zone',zoneId,'HAS_FORECAST','Forecast',`forecast-${id}`);
  await edge('disaster','Forecast',`forecast-${id}`,'FROM_SOURCE','Source',`forecast-source-${id}`);
  await edge('disaster','Facility',`facility-${id}`,'LOCATED_IN','Zone',zoneId);
  await edge('disaster','Facility',`facility-${id}`,'USES_ROAD','Road',`road-${id}`);
  await edge('disaster','Road',`road-${id}`,'LEADS_TO','Shelter',`shelter-${id}`);
  await edge('disaster','Facility',`facility-${id}`,'ROUTE','Road',`road-${id}`,{distanceKm:2});
  await edge('disaster','Road',`road-${id}`,'ROUTE','Shelter',`shelter-${id}`,{distanceKm:3});
  await edge('disaster','Shelter',`shelter-${id}`,'HAS_CAPACITY','Capacity',`capacity-${id}`);
  return {imported:true,alertId:id,headline:p.headline||p.event,sourceUrl,forecastUrl,expiresAt:p.expires,facilityStatus:'synthetic/unverified'};
}

if(process.argv[1]?.endsWith('nws.js'))importNws(process.argv[2]||29.76,process.argv[3]||-95.36).then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e);process.exitCode=1;}).finally(closeDb);
