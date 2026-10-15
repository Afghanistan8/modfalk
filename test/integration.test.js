import test from 'node:test';
import assert from 'node:assert/strict';
import { seedAll } from '../src/seed.js';
import { createGraphMcpClient, callGraphTool } from '../src/mcp.js';
import { runCase, runMedical, runDisaster, runSports } from '../src/agents.js';
import { closeDb } from '../src/db.js';

test('FalkorDB-backed paths produce all four actions through MCP and support review',async()=>{
  const ids=await seedAll();const m=await createGraphMcpClient();
  try {
    const results=[await runCase(m.client,ids.case,'US'),await runMedical(m.client,ids.medical),await runDisaster(m.client,ids.disaster),await runSports(m.client,ids.sports.matchId,{minute:30,homeGoals:1,awayGoals:0})];
    assert.deepEqual(results.map(r=>r.status),['action-proposed','action-proposed','action-proposed','action-proposed']);
    assert.ok(results.every(r=>r.action?.id));
    for(const [i,domain] of ['case','medical','disaster','sports'].entries()){
      const listed=await callGraphTool(m.client,'list_actions',{domain});assert.ok(listed.rows.some(a=>a.id===results[i].action.id));
    }
    const review=await callGraphTool(m.client,'review_action',{domain:'case',actionId:results[0].action.id,status:'reviewed'});
    assert.equal(review.rows[0].status,'reviewed');
  }finally {await m.close();await closeDb();}
});
