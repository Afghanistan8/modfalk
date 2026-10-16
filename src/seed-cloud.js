import { runQuery, closeDb } from './db.js';
import { loadSports } from './sports-data.js';
import { fileURLToPath } from 'node:url';

const chunk = (rows, size = 500) => {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
};

async function writeBatches(cypher, rows, size = 500) {
  for (const batch of chunk(rows, size)) await runQuery('sports', cypher, {rows: batch}, false);
}

export async function seedSportsCloud() {
  const dataset = await loadSports();

  const sources = [...new Set(dataset.matches.map(m => m.sourceUrl))].map((url, i) => ({
    id: `statsbomb-season-${i}`, url, retrievedAt: dataset.retrievedAt, kind: 'public-historical-data'
  }));
  const sourceIds = new Map(sources.map(s => [s.url, s.id]));
  const teams = [...new Map(dataset.matches.flatMap(m => [[m.homeId, m.home], [m.awayId, m.away]])).entries()]
    .map(([id, name]) => ({id, name}));
  const matches = dataset.matches.map(m => ({
    id: m.id, kickoff: m.kickoff, homeGoals: m.homeGoals, awayGoals: m.awayGoals,
    season: m.season, competition: m.competition, country: m.country, kind: 'source-fact',
    homeId: m.homeId, awayId: m.awayId, sourceId: sourceIds.get(m.sourceUrl)
  }));

  await writeBatches('UNWIND $rows AS row MERGE (s:Source {id:row.id}) SET s.url=row.url, s.retrievedAt=row.retrievedAt, s.kind=row.kind', sources);
  await writeBatches('UNWIND $rows AS row MERGE (t:Team {id:row.id}) SET t.name=row.name', teams);
  await writeBatches('UNWIND $rows AS row MERGE (m:HistoricalMatch {id:row.id}) SET m.kickoff=row.kickoff, m.homeGoals=row.homeGoals, m.awayGoals=row.awayGoals, m.season=row.season, m.competition=row.competition, m.country=row.country, m.kind=row.kind', matches);
  await writeBatches('UNWIND $rows AS row MATCH (m:HistoricalMatch {id:row.id}), (t:Team {id:row.homeId}) MERGE (m)-[:HOME_TEAM]->(t)', matches);
  await writeBatches('UNWIND $rows AS row MATCH (m:HistoricalMatch {id:row.id}), (t:Team {id:row.awayId}) MERGE (m)-[:AWAY_TEAM]->(t)', matches);
  await writeBatches('UNWIND $rows AS row MATCH (m:HistoricalMatch {id:row.id}), (s:Source {id:row.sourceId}) MERGE (m)-[:FROM_SOURCE]->(s)', matches);

  const target = dataset.matches.find(m => m.id === dataset.targetId);
  const targetSource = sourceIds.get(target.sourceUrl);
  await writeBatches('UNWIND $rows AS row MERGE (a:Assertion {id:row.id}) SET a.claimKey=row.claimKey, a.claimValue=row.claimValue, a.eventAt=row.eventAt, a.ingestedAt=row.ingestedAt, a.classification=row.classification', [{id:`result-${target.id}`, claimKey:'match-result', claimValue:`${target.homeGoals}-${target.awayGoals}`, eventAt:target.kickoff, ingestedAt:dataset.retrievedAt, classification:'source-fact'}], 1);
  await writeBatches('UNWIND $rows AS row MATCH (m:HistoricalMatch {id:row.matchId}), (a:Assertion {id:row.assertionId}), (s:Source {id:row.sourceId}) MERGE (m)-[:ASSERTED_BY]->(a) MERGE (a)-[:FROM_SOURCE]->(s)', [{matchId:target.id, assertionId:`result-${target.id}`, sourceId:targetSource}], 1);

  const order=['FIFA World Cup','Premier League','La Liga','Serie A','1. Bundesliga','Ligue 1',"FA Women's Super League"];
  const replayMatches = [target, ...order.map(name=>dataset.matches.filter(m=>m.competition===name).at(-1))]
    .filter((m, i, a) => a.findIndex(x => x.id === m.id) === i)
    .map(m => ({id:`replay-${m.id}`, sourceMatchId:m.id, kickoff:m.kickoff, competition:m.competition, country:m.country, homeId:m.homeId, awayId:m.awayId}));
  await writeBatches('UNWIND $rows AS row MERGE (m:Match {id:row.id}) SET m.kickoff=row.kickoff, m.replay=true, m.sourceMatchId=row.sourceMatchId, m.competition=row.competition, m.country=row.country', replayMatches, 50);
  await writeBatches('UNWIND $rows AS row MERGE (s:GameState {id:"state-" + row.id}) SET s.minute=0, s.homeGoals=0, s.awayGoals=0, s.inputKind="manual-replay"', replayMatches, 50);
  await writeBatches('UNWIND $rows AS row MATCH (m:Match {id:row.id}), (h:Team {id:row.homeId}), (a:Team {id:row.awayId}), (s:GameState {id:"state-" + row.id}) MERGE (m)-[:HOME_TEAM]->(h) MERGE (m)-[:AWAY_TEAM]->(a) MERGE (m)-[:HAS_STATE]->(s)', replayMatches, 50);
  const homeLineup=dataset.lineup.find(l=>String(l.team_id)===target.homeId);
  if(homeLineup){
    const lineupId=`lineup-replay-${target.id}`,players=homeLineup.lineup.filter(p=>p.positions?.some(x=>x.start_reason==='Starting XI')).map(p=>({id:String(p.player_id),name:p.player_name}));
    await runQuery('sports',`MERGE (l:Lineup {id:$lineupId}) SET l.sourceMatchId=$sourceMatchId,l.kind='historical-replay' WITH l MATCH (m:Match {id:$matchId}),(t:Team {id:$teamId}) MERGE (m)-[:HAS_LINEUP]->(l) MERGE (l)-[:FOR_TEAM]->(t)`,{lineupId,sourceMatchId:target.id,matchId:`replay-${target.id}`,teamId:target.homeId},false);
    await writeBatches('UNWIND $rows AS row MERGE (p:Player {id:row.id}) SET p.name=row.name',players,50);
    await writeBatches('UNWIND $rows AS row MATCH (l:Lineup {id:row.lineupId}),(p:Player {id:row.id}) MERGE (l)-[:INCLUDES]->(p)',players.map(p=>({...p,lineupId})),50);
  }
  return {historyMatches: dataset.matches.length, replayMatches: replayMatches.length};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])seedSportsCloud().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; }).finally(closeDb);
