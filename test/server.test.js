import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from '../src/server.js';

test('local app serves tabs and reports graph failure honestly',async()=>{
  const app=await createAppServer({query:async()=>{throw new Error('FalkorDB is offline');}});
  app.server.listen(0,'127.0.0.1');await new Promise(resolve=>app.server.once('listening',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  try{
    const page=await (await fetch(base)).text();for(const label of ['Case Evidence','Medical overlook','Disaster response','Sports Forcast'])assert.ok(page.includes(label));
    assert.ok(page.includes('MODFALK'));
    assert.ok(!page.includes('TRACK 01 · AGENTS THAT ACT ON CONNECTED DATA'));
    const health=await fetch(`${base}/api/health`);assert.equal(health.status,503);
    const run=await fetch(`${base}/api/run`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain:'case',id:'case-001'})});assert.equal(run.status,503);
  }finally{await app.close();}
});
