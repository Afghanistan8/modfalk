import { FalkorDB } from 'falkordb';
import { GRAPHS } from './queries.js';

try { process.loadEnvFile(); } catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

let connection;
export async function getDb() {
  if (!connection) {
    connection = FalkorDB.connect({
      socket: {host: process.env.FALKORDB_HOST || '127.0.0.1',
        port: Number(process.env.FALKORDB_PORT || 6379),
        connectTimeout: 2500,
        tls: process.env.FALKORDB_TLS === 'true'},
      username: process.env.FALKORDB_USERNAME || undefined,
      password: process.env.FALKORDB_PASSWORD || undefined
    }).catch(error => { connection = undefined; throw error; });
  }
  return connection;
}

export async function runQuery(domain, cypher, params = {}, readOnly = true) {
  if (!(domain in GRAPHS)) throw new Error(`Unknown domain: ${domain}`);
  const db = await getDb();
  const graph = db.selectGraph(GRAPHS[domain]);
  const result = await (readOnly ? graph.roQuery(cypher, {params}) : graph.query(cypher, {params}));
  return result.data || [];
}

export async function closeDb() {
  if (connection) { const db = await connection; await db.close(); connection = undefined; }
}
