import { McpServer } from '@modelcontextprotocol/server';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import * as z from 'zod/v4';
import { randomUUID } from 'node:crypto';
import { runQuery } from './db.js';
import { QUERY_CATALOG } from './queries.js';

export function createGraphMcpServer(query = runQuery) {
  // The injected query function is used only by tests. Production always calls FalkorDB.
  const server = new McpServer({name:'modfalk-graph-tools', version:'0.1.0'});
  const addRead = (name, domain, cypher, arg) => server.registerTool(name, {
    description:`Read connected ${domain} evidence from FalkorDB`,
    inputSchema:z.object({[arg]:z.string().min(1)}), annotations:{readOnlyHint:true}
  }, async input => {
    try {
      const rows = await query(domain,cypher,{id:input[arg]},true);
      return {content:[{type:'text',text:JSON.stringify(rows)}],structuredContent:{rows}};
    } catch(e) {return {content:[{type:'text',text:e.message}],isError:true};}
  });
  addRead('case_conflicts','case',QUERY_CATALOG.case_conflicts,'caseId');
  addRead('case_gaps','case',QUERY_CATALOG.case_gaps,'caseId');
  addRead('medical_contraindications','medical',QUERY_CATALOG.medical_contraindications,'patientId');
  addRead('disaster_candidates','disaster',QUERY_CATALOG.disaster_candidates,'alertId');
  server.registerTool('disaster_shortest_path', {
    description:'Compute weighted shortest path from exposed facility to candidate shelter in FalkorDB',
    inputSchema:z.object({facilityId:z.string(),shelterId:z.string()}),annotations:{readOnlyHint:true}
  },async input=>{
    try {const rows=await query('disaster',QUERY_CATALOG.disaster_shortest_path,input,true);return {content:[{type:'text',text:JSON.stringify(rows)}],structuredContent:{rows}};}
    catch(e){return {content:[{type:'text',text:e.message}],isError:true};}
  });
  addRead('sports_context','sports',QUERY_CATALOG.sports_context,'matchId');
  server.registerTool('sports_history', {description:'Read dated match results from FalkorDB',inputSchema:z.object({}),annotations:{readOnlyHint:true}}, async () => {
    try {const rows=await query('sports',QUERY_CATALOG.sports_history,{},true);return {content:[{type:'text',text:JSON.stringify(rows)}],structuredContent:{rows}};}
    catch(e){return {content:[{type:'text',text:e.message}],isError:true};}
  });
  server.registerTool('agent_memory', {
    description:'Read prior findings and graph-native agent context for a subject',
    inputSchema:z.object({domain:z.enum(['case','medical','disaster','sports']),subjectId:z.string().min(1)}),
    annotations:{readOnlyHint:true}
  }, async input => {
    try {const rows=await query(input.domain,QUERY_CATALOG.agent_memory,{id:input.subjectId},true);return {content:[{type:'text',text:JSON.stringify(rows)}],structuredContent:{rows}};}
    catch(e){return {content:[{type:'text',text:e.message}],isError:true};}
  });
  server.registerTool('create_action',{
    description:'Persist a reviewable finding and internal action in the domain graph',
    inputSchema:z.object({domain:z.enum(['case','medical','disaster','sports']),kind:z.string(),subjectId:z.string(),summary:z.string(),evidenceJson:z.string(),tool:z.string(),contextJson:z.string().optional()})
  },async input=>{
    const id=randomUUID(), createdAt=new Date().toISOString();
    const classification=input.domain==='sports'?'model-output':'agent-inference';
    let context={};try{context=input.contextJson?JSON.parse(input.contextJson):{};}catch{context={};}
    const tools=Array.isArray(context.toolLog)?context.toolLog:[];
    const citations=Array.isArray(context.sources)?context.sources:[];
    const cypher=`CREATE (f:Finding {id:$id,kind:$kind,classification:$classification,subjectId:$subjectId,summary:$summary,evidenceJson:$evidenceJson,tool:$tool,createdAt:$createdAt})-[:TRIGGERED]->(a:Action {id:$id,kind:$kind,status:'proposed',createdAt:$createdAt})
CREATE (f)-[:USED_CONTEXT]->(c:AgentContext {id:$contextId,domain:$domain,subjectId:$subjectId,tool:$tool,path:$path,uncertaintyJson:$uncertaintyJson,createdAt:$createdAt})
FOREACH (t IN $tools | CREATE (ti:ToolInvocation {id:t.id,tool:t.tool,reason:t.reason,query:t.query}) CREATE (c)-[:USED_TOOL]->(ti))
WITH f,a,c
UNWIND $citations AS s
OPTIONAL MATCH (src:Source {url:s.url})
CREATE (ce:ContextEvidence {id:s.recordId,url:s.url,recordId:s.recordId,text:s.text,date:s.date,retrievedAt:s.retrievedAt,kind:s.kind})
CREATE (c)-[:CITED]->(ce)
FOREACH (_ IN CASE WHEN src IS NULL THEN [] ELSE [1] END | CREATE (ce)-[:DERIVED_FROM]->(src))
RETURN a.id AS id`;
    try {await query(input.domain,cypher,{...input,id,createdAt,classification,domain:input.domain,contextId:`context-${id}`,path:context.path||'',uncertaintyJson:JSON.stringify(context.uncertainty||[]),tools:tools.map((t,i)=>({...t,id:`tool-${id}-${i}`})),citations},false);return {content:[{type:'text',text:id}],structuredContent:{id,createdAt,status:'proposed',contextId:`context-${id}`}};}
    catch(e){return {content:[{type:'text',text:e.message}],isError:true};}
  });
  server.registerTool('review_action',{
    description:'Mark a proposed internal action reviewed or dismissed',
    inputSchema:z.object({domain:z.enum(['case','medical','disaster','sports']),actionId:z.string(),status:z.enum(['reviewed','dismissed'])})
  },async input=>{
    const reviewedAt=new Date().toISOString(),reviewId=randomUUID();
    try {const rows=await query(input.domain,`MATCH (a:Action {id:$id,status:'proposed'}) SET a.status=$status,a.reviewedAt=$reviewedAt CREATE (a)-[:HAS_REVIEW]->(:Review {id:$reviewId,status:$status,reviewedAt:$reviewedAt,reviewer:'local reviewer'}) RETURN a.id AS id,a.status AS status`,{id:input.actionId,status:input.status,reviewedAt,reviewId},false);return {content:[{type:'text',text:JSON.stringify(rows)}],structuredContent:{rows}};}
    catch(e){return {content:[{type:'text',text:e.message}],isError:true};}
  });
  server.registerTool('list_actions',{
    description:'List recent internal actions and reviewer status from one domain graph',
    inputSchema:z.object({domain:z.enum(['case','medical','disaster','sports'])}),annotations:{readOnlyHint:true}
  },async input=>{
    try {const rows=await query(input.domain,`MATCH (f:Finding)-[:TRIGGERED]->(a:Action) RETURN a.id AS id,a.kind AS kind,a.status AS status,a.createdAt AS createdAt,a.reviewedAt AS reviewedAt,f.subjectId AS subjectId,f.summary AS summary,f.evidenceJson AS evidenceJson,f.tool AS tool,f.classification AS classification ORDER BY createdAt DESC LIMIT 30`,{},true);return {content:[{type:'text',text:JSON.stringify(rows)}],structuredContent:{rows}};}
    catch(e){return {content:[{type:'text',text:e.message}],isError:true};}
  });
  return server;
}

export async function createGraphMcpClient(query) {
  const server=createGraphMcpServer(query),client=new Client({name:'modfalk-agent',version:'0.1.0'});
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport),client.connect(clientTransport)]);
  return {client,server,close:async()=>{await client.close();await server.close();}};
}

export async function callGraphTool(client,name,args) {
  const result=await client.callTool({name,arguments:args});
  if(result.isError) throw new Error(result.content?.[0]?.text || `${name} failed`);
  return result.structuredContent || JSON.parse(result.content?.[0]?.text || '{}');
}
