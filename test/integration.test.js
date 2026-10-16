import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCore } from '../src/seed.js';
import { seedSportsCloud } from '../src/seed-cloud.js';
import { loadSports } from '../src/sports-data.js';
import { createGraphMcpClient, callGraphTool } from '../src/mcp.js';
import { runCase, runMedical, runDisaster, runSports } from '../src/agents.js';
import { closeDb } from '../src/db.js';

test('FalkorDB-backed paths produce all four actions through MCP and support review',async()=>{
  const core=await seedCore(),sportsData=await loadSports();await seedSportsCloud();const ids={...core,sports:{matchId:`replay-${sportsData.targetId}`}},m=await createGraphMcpClient();
  try {
    const results=[await runCase(m.client,ids.case,'US'),await runMedical(m.client,ids.medical),await runDisaster(m.client,ids.disaster),await runSports(m.client,ids.sports.matchId,{minute:30,homeGoals:1,awayGoals:0})];
    assert.deepEqual(results.map(r=>r.status),['action-proposed','action-proposed','action-proposed','action-proposed']);
    assert.ok(results.every(r=>r.action?.id));
    const subjects=[ids.case,ids.medical,ids.disaster,ids.sports.matchId];
    for(const [i,domain] of ['case','medical','disaster','sports'].entries()){
      const listed=await callGraphTool(m.client,'list_actions',{domain});assert.ok(listed.rows.some(a=>a.id===results[i].action.id));
      const remembered=await callGraphTool(m.client,'agent_memory',{domain,subjectId:subjects[i]});
      assert.ok(remembered.rows.some(a=>a.actionId===results[i].action.id&&Number(a.toolCount)>0&&Number(a.citationCount)>0));
    }
    const review=await callGraphTool(m.client,'review_action',{domain:'case',actionId:results[0].action.id,status:'reviewed'});
    assert.equal(review.rows[0].status,'reviewed');
  }finally {await m.close();await closeDb();}
});
