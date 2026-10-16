import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createGraphMcpClient, callGraphTool } from './mcp.js';
import { runCase, runMedical, runDisaster, runSports, GUIDANCE } from './agents.js';
import { runQuery, closeDb } from './db.js';
import { loadSports } from './sports-data.js';

const PUBLIC=new URL('../public/',import.meta.url);
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
const body=async req=>{let text='';for await(const chunk of req){text+=chunk;if(text.length>65536)throw new Error('Request body too large');}return JSON.parse(text||'{}');};

export async function createAppServer(options={}) {
  const mcp=await createGraphMcpClient(options.query);
  const handler=async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET'&&url.pathname==='/api/health'){
        try {await (options.query||runQuery)('case','RETURN 1 AS ok',{},true);return json(res,200,{app:'ok',falkordb:'ok',mcp:'connected'});}
        catch(e){return json(res,503,{app:'ok',falkordb:'unavailable',mcp:'connected',error:e.message});}
      }
      if(req.method==='GET'&&url.pathname==='/api/demo'){
        let sports=[];try{const data=await loadSports();const byId=new Map(data.matches.map(m=>[m.id,m]));const selected=[byId.get(data.targetId),...[...new Map(data.matches.map(m=>[m.competition,m])).values()].slice(0,10)].filter(Boolean).filter((m,i,a)=>a.findIndex(x=>x.id===m.id)===i);sports=selected.map(m=>{const date=new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(m.kickoff));return {id:`replay-${m.id}`,label:`${m.home} vs ${m.away} · ${date} · ${m.competition} (${m.country})`,meta:{home:m.home,away:m.away,kickoff:m.kickoff,competition:m.competition,country:m.country,source:'StatsBomb Open Data'}};});}catch{}
        let officialDisaster=[];try{officialDisaster=await runQuery('disaster',`MATCH (a:Alert {origin:'official'})-[:FROM_SOURCE]->(s:Source) RETURN a.id AS id,a.headline AS headline,a.areaDesc AS areaDesc,a.expiresAt AS expiresAt,s.url AS sourceUrl ORDER BY a.issuedAt DESC LIMIT 8`,{},true);}catch{}
        const records={
          case:[{id:'case-001',label:'Case evidence · warehouse arrival · synthetic records'},{id:'case-002',label:'Case evidence · port arrival · synthetic records'},{id:'case-003',label:'Case evidence · transit handoff · synthetic records'}],
          medical:[{id:'patient-001',label:'DailyMed amoxicillin label · synthetic patient A'},{id:'patient-002',label:'DailyMed amoxicillin label · synthetic patient B'},{id:'patient-003',label:'DailyMed amoxicillin label · synthetic patient C'}],
          disaster:[...officialDisaster.map(a=>({id:a.id,label:`${a.headline} · ${a.areaDesc||'official NWS alert'}`})),{id:'scenario-flood-001',label:'Alert-to-shelter response graph · flood scenario'},{id:'scenario-wildfire-002',label:'Alert-to-shelter response graph · wildfire scenario'},{id:'scenario-storm-003',label:'Alert-to-shelter response graph · coastal storm scenario'}],
          sports
        };
        return json(res,200,{ids:{case:records.case[0].id,medical:records.medical[0].id,disaster:records.disaster[0].id,sports:sports[0]?.id||null},records,guidance:GUIDANCE});
      }
      if(req.method==='GET'&&url.pathname==='/api/actions'){
        const domain=url.searchParams.get('domain');if(!['case','medical','disaster','sports'].includes(domain))return json(res,400,{error:'Invalid domain'});
        const result=await callGraphTool(mcp.client,'list_actions',{domain});return json(res,200,result);
      }
      if(req.method==='POST'&&url.pathname==='/api/run'){
        const input=await body(req),id=String(input.id||'').trim();if(!id)return json(res,400,{error:'Select a record first'});
        const handlers={case:()=>runCase(mcp.client,id,input.jurisdiction),medical:()=>runMedical(mcp.client,id),disaster:()=>runDisaster(mcp.client,id),sports:()=>runSports(mcp.client,id,input.state)};
        if(!handlers[input.domain])return json(res,400,{error:'Invalid domain'});
        return json(res,200,await handlers[input.domain]());
      }
      if(req.method==='POST'&&url.pathname==='/api/review'){
        const input=await body(req);const result=await callGraphTool(mcp.client,'review_action',{domain:input.domain,actionId:input.actionId,status:input.status});
        return json(res,result.rows?.length?200:404,result.rows?.length?result:{error:'Proposed action not found'});
      }
      if(req.method==='GET'){
        const paths={'/':'index.html','/styles.css':'styles.css','/app.js':'app.js'};
        const file=paths[url.pathname];if(file){const content=await readFile(new URL(file,PUBLIC));res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html','X-Content-Type-Options':'nosniff'});return res.end(content);}
      }
      return json(res,404,{error:'Not found'});
    }catch(e){json(res,/Invalid|Unknown|large|JSON/.test(e.message)?400:503,{error:e.message});}
  };
  const server=http.createServer(handler);
  return {server,handler,close:async()=>{await new Promise(resolve=>server.close(resolve));await mcp.close();if(!options.query)await closeDb();}};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  createAppServer().then(({server})=>server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log(`ModFalk: http://127.0.0.1:${server.address().port}`))).catch(e=>{console.error(e);process.exitCode=1;});
}
