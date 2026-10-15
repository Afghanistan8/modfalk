import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { evaluateChronologicalHoldout } from './model.js';

const ROOT='https://raw.githubusercontent.com/hudl/open-data/master/data';
const SEASONS=[4,42,90,281]; // FA Women's Super League, chronological coverage 2018/19–2023/24.
export const SPORTS_FILE=new URL('../data/sports.json',import.meta.url);

async function fetchJson(url) {
  const response=await fetch(url,{headers:{'User-Agent':'ModFalk/0.1 (hackathon demo)'}});
  if(!response.ok)throw new Error(`${response.status} from ${url}`);
  return response.json();
}

export async function prepareSports() {
  const raw=(await Promise.all(SEASONS.map(id=>fetchJson(`${ROOT}/matches/37/${id}.json`)))).flat();
  const matches=raw.filter(m=>m.match_date&&Number.isFinite(m.home_score)&&Number.isFinite(m.away_score))
    .map(m=>({id:String(m.match_id),kickoff:`${m.match_date}T${(m.kick_off||'12:00:00').slice(0,8)}Z`,homeId:String(m.home_team.home_team_id),home:m.home_team.home_team_name,awayId:String(m.away_team.away_team_id),away:m.away_team.away_team_name,homeGoals:m.home_score,awayGoals:m.away_score,sourceUrl:`${ROOT}/matches/37/${m.season.season_id}.json`,season:m.season.season_name}))
    .sort((a,b)=>a.kickoff.localeCompare(b.kickoff)||a.id.localeCompare(b.id));
  const seen=new Set(),unique=matches.filter(m=>!seen.has(m.id)&&seen.add(m.id));
  if(unique.length<20)throw new Error('The selected public dataset is too small for evaluation');
  const target=unique[Math.floor(unique.length*0.82)];
  let lineup=[];
  try {lineup=await fetchJson(`${ROOT}/lineups/${target.id}.json`);} catch(error){console.error(`Lineup unavailable for ${target.id}: ${error.message}`);}
  const dataset={source:'StatsBomb Open Data',sourceUrl:'https://github.com/hudl/open-data',retrievedAt:new Date().toISOString(),competition:"FA Women's Super League",matches:unique,targetId:target.id,lineup};
  await mkdir(new URL('../data/',import.meta.url),{recursive:true});
  await writeFile(SPORTS_FILE,JSON.stringify(dataset,null,2));
  return {file:fileURLToPath(SPORTS_FILE),matches:unique.length,target:`${target.home} vs ${target.away} (${target.kickoff})`,metric:evaluateChronologicalHoldout(unique)};
}

export async function loadSports() {
  try{return JSON.parse(await readFile(SPORTS_FILE,'utf8'));}
  catch(e){if(e.code==='ENOENT')throw new Error('Sports dataset missing. Run npm run prepare:sports first.');throw e;}
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]) {
  prepareSports().then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e);process.exitCode=1;});
}
