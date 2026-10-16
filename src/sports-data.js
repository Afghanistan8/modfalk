import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { evaluateChronologicalHoldout } from './model.js';

const ROOT='https://raw.githubusercontent.com/hudl/open-data/master/data';
const COMPETITIONS=[
  [37,4,"FA Women's Super League",'England'],[37,42,"FA Women's Super League",'England'],[37,90,"FA Women's Super League",'England'],[37,281,"FA Women's Super League",'England'],
  [2,27,'Premier League','England'],[11,27,'La Liga','Spain'],[9,281,'1. Bundesliga','Germany'],[7,235,'Ligue 1','France'],[12,27,'Serie A','Italy'],[43,106,'FIFA World Cup','International']
];
export const SPORTS_FILE=new URL('../data/sports.json',import.meta.url);
const DEPLOYED_SPORTS_FILE=new URL('./sports-snapshot.json',import.meta.url);

async function fetchJson(url) {
  const response=await fetch(url,{headers:{'User-Agent':'ModFalk/0.1 (hackathon demo)'}});
  if(!response.ok)throw new Error(`${response.status} from ${url}`);
  return response.json();
}

export async function prepareSports() {
  const raw=(await Promise.all(COMPETITIONS.map(([competitionId,seasonId])=>fetchJson(`${ROOT}/matches/${competitionId}/${seasonId}.json`)))).flat();
  const competitionByKey=new Map(COMPETITIONS.map(([competitionId,seasonId,name,country])=>[`${competitionId}/${seasonId}`,{name,country,competitionId,seasonId}]));
  const matches=raw.filter(m=>m.match_date&&Number.isFinite(m.home_score)&&Number.isFinite(m.away_score))
    .map(m=>{const c=competitionByKey.get(`${m.competition.competition_id}/${m.season.season_id}`)||{};return {id:String(m.match_id),kickoff:`${m.match_date}T${(m.kick_off||'12:00:00').slice(0,8)}Z`,homeId:String(m.home_team.home_team_id),home:m.home_team.home_team_name,awayId:String(m.away_team.away_team_id),away:m.away_team.away_team_name,homeGoals:m.home_score,awayGoals:m.away_score,sourceUrl:`${ROOT}/matches/${m.competition.competition_id}/${m.season.season_id}.json`,season:m.season.season_name,competition:c.name||m.competition.competition_name,country:c.country||m.competition.country_name,competitionId:m.competition.competition_id}})
    .sort((a,b)=>a.kickoff.localeCompare(b.kickoff)||a.id.localeCompare(b.id));
  const seen=new Set(),unique=matches.filter(m=>!seen.has(m.id)&&seen.add(m.id));
  if(unique.length<20)throw new Error('The selected public dataset is too small for evaluation');
  const target=unique.find(m=>m.competition==='FIFA World Cup'&&m.home==='Argentina'&&m.away==='France')||unique[Math.floor(unique.length*0.82)];
  let lineup=[];
  try {lineup=await fetchJson(`${ROOT}/lineups/${target.id}.json`);} catch(error){console.error(`Lineup unavailable for ${target.id}: ${error.message}`);}
  const dataset={source:'StatsBomb Open Data',sourceUrl:'https://github.com/hudl/open-data',retrievedAt:new Date().toISOString(),competitions:[...new Set(unique.map(m=>`${m.competition} (${m.country})`))],matches:unique,targetId:target.id,lineup};
  await mkdir(new URL('../data/',import.meta.url),{recursive:true});
  await writeFile(SPORTS_FILE,JSON.stringify(dataset,null,2));
  return {file:fileURLToPath(SPORTS_FILE),matches:unique.length,target:`${target.home} vs ${target.away} (${target.kickoff})`,metric:evaluateChronologicalHoldout(unique)};
}

export async function loadSports() {
  try{return JSON.parse(await readFile(SPORTS_FILE,'utf8'));}
  catch(e){
    if(e.code!=='ENOENT')throw e;
    try{return JSON.parse(await readFile(DEPLOYED_SPORTS_FILE,'utf8'));}
    catch(fallbackError){if(fallbackError.code==='ENOENT')throw new Error('Sports dataset missing. Run npm run prepare:sports first.');throw fallbackError;}
  }
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]) {
  prepareSports().then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e);process.exitCode=1;});
}
