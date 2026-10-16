export const GRAPHS = Object.freeze({
  case: 'modfalk_case', medical: 'modfalk_medical',
  disaster: 'modfalk_disaster', sports: 'modfalk_sports'
});

export const CASE_QUERY = `
MATCH (c:Case {id:$id})-[:HAS_EVENT]->(e:Event)<-[:ABOUT]-(a:Statement)<-[:GAVE]-(wa:Witness)
MATCH (e)<-[:ABOUT]-(b:Statement)<-[:GAVE]-(wb:Witness)
MATCH (a)-[:SUPPORTED_BY]->(pa:Passage)-[:FROM_SOURCE]->(sa:Source)
MATCH (b)-[:SUPPORTED_BY]->(pb:Passage)-[:FROM_SOURCE]->(sb:Source)
MATCH (a)-[:EXPRESSES]->(aa:Assertion)
MATCH (b)-[:EXPRESSES]->(ba:Assertion)
WHERE a.id < b.id AND aa.claimKey = ba.claimKey AND aa.claimValue <> ba.claimValue
RETURN c.id AS caseId,e.id AS eventId,e.title AS eventTitle,
 a.id AS aId,aa.claimValue AS aValue,aa.eventAt AS aDate,wa.id AS aWitness,
 pa.id AS aPassage,pa.text AS aText,sa.url AS aUrl,sa.retrievedAt AS aIngestedAt,sa.kind AS aSourceKind,
 b.id AS bId,ba.claimValue AS bValue,ba.eventAt AS bDate,wb.id AS bWitness,
 pb.id AS bPassage,pb.text AS bText,sb.url AS bUrl,sb.retrievedAt AS bIngestedAt,sb.kind AS bSourceKind,
 a.identityConfidence AS aIdentity,b.identityConfidence AS bIdentity`;

export const CASE_GAPS_QUERY = `
MATCH (c:Case {id:$id})-[:HAS_EVENT]->(e:Event)<-[:ABOUT]-(ex:Exhibit)
OPTIONAL MATCH (ex)-[:SUPPORTED_BY]->(p:Passage)
WITH e,ex,p WHERE p IS NULL
RETURN e.id AS eventId,ex.id AS exhibitId,ex.description AS description`;

export const MEDICAL_QUERY = `
MATCH (p:Patient {id:$id})-[:TAKES]->(m:Medicine)-[:HAS_INGREDIENT]->(i:Ingredient)
MATCH (p)-[:HAS_CONDITION]->(co:Condition)-[:FROM_SOURCE]->(ps:Source)
MATCH (p)-[:HAS_ALLERGY]->(a:Allergy)
MATCH (m)-[:HAS_LABEL]->(l:LabelSection)-[:WARNS_ABOUT]->(a)
MATCH (l)-[:FROM_SOURCE]->(s:Source)
WHERE a.severity = 'serious' AND l.warningKind = 'contraindication' AND l.verifiedText = true
RETURN p.id AS patientId,co.id AS conditionId,co.name AS condition,
 co.recordedAt AS conditionDate,ps.url AS patientSourceUrl,ps.retrievedAt AS patientRetrievedAt,
 m.id AS medicineId,m.name AS medicine,
 m.recordedAt AS medicineDate,i.name AS ingredient,a.name AS allergy,
 a.recordedAt AS allergyDate,a.ingestedAt AS allergyIngestedAt,a.recordId AS allergyRecord,
 l.id AS labelId,l.text AS labelText,l.labelDate AS labelDate,
 s.url AS labelUrl,s.retrievedAt AS retrievedAt,s.kind AS sourceKind ORDER BY l.labelDateIso DESC`;

export const DISASTER_QUERY = `
MATCH (a:Alert {id:$id})-[:FROM_SOURCE]->(src:Source)
OPTIONAL MATCH (a)-[:AFFECTS]->(z:Zone)<-[:LOCATED_IN]-(f:Facility)
OPTIONAL MATCH (f)-[:USES_ROAD]->(r:Road)-[:LEADS_TO]->(s:Shelter)
OPTIONAL MATCH (s)-[:HAS_CAPACITY]->(c:Capacity)
OPTIONAL MATCH (z)-[:HAS_FORECAST]->(fc:Forecast)-[:FROM_SOURCE]->(fs:Source)
RETURN a.id AS alertId,a.headline AS headline,a.issuedAt AS issuedAt,
 a.expiresAt AS expiresAt,a.status AS alertStatus,a.origin AS origin,
 src.url AS sourceUrl,src.retrievedAt AS retrievedAt,src.kind AS sourceKind,
 z.id AS zoneId,z.verifiedGeo AS zoneVerifiedGeo,
 f.id AS facilityId,f.name AS facility,f.verifiedGeo AS facilityVerifiedGeo,
 f.priority AS priority,r.id AS roadId,r.status AS roadStatus,
 r.verifiedAt AS roadVerifiedAt,s.id AS shelterId,s.name AS shelter,
 s.verifiedGeo AS shelterVerifiedGeo,
 c.available AS available,c.verifiedAt AS capacityVerifiedAt,
 fc.id AS forecastId,fc.summary AS forecastSummary,fc.startTime AS forecastStart,
 fc.endTime AS forecastEnd,fs.url AS forecastUrl,fs.retrievedAt AS forecastRetrievedAt,
 fs.kind AS forecastSourceKind`;

export const DISASTER_SHORTEST_PATH = `
MATCH (f:Facility {id:$facilityId}), (s:Shelter {id:$shelterId})
CALL algo.SPpaths({sourceNode:f,targetNode:s,relTypes:['ROUTE'],weightProp:'distanceKm'})
YIELD path,pathWeight
RETURN pathWeight AS distanceKm,[n IN nodes(path) | n.id] AS route`;

export const SPORTS_QUERY = `
MATCH (m:Match {id:$id})-[:HOME_TEAM]->(h:Team)
MATCH (m)-[:AWAY_TEAM]->(a:Team)
MATCH (m)-[:HAS_STATE]->(st:GameState)
OPTIONAL MATCH (m)-[:HAS_LINEUP]->(l:Lineup)-[:FOR_TEAM]->(h)
OPTIONAL MATCH (l)-[:INCLUDES]->(p:Player)
RETURN m.id AS matchId,m.kickoff AS kickoff,h.id AS homeId,h.name AS home,
 a.id AS awayId,a.name AS away,st.minute AS minute,st.homeGoals AS homeGoals,
 st.awayGoals AS awayGoals,collect(DISTINCT p.name) AS lineup`;

export const SPORTS_HISTORY_QUERY = `
MATCH (m:HistoricalMatch)-[:HOME_TEAM]->(h:Team)
MATCH (m)-[:AWAY_TEAM]->(a:Team)
MATCH (m)-[:FROM_SOURCE]->(s:Source)
RETURN m.id AS id,m.kickoff AS kickoff,m.homeGoals AS homeGoals,
 m.awayGoals AS awayGoals,h.id AS homeId,a.id AS awayId,
 s.url AS sourceUrl,s.retrievedAt AS retrievedAt,s.kind AS sourceKind ORDER BY kickoff,id`;

export const AGENT_MEMORY_QUERY = `
MATCH (f:Finding {subjectId:$id})-[:TRIGGERED]->(a:Action)
OPTIONAL MATCH (f)-[:USED_CONTEXT]->(c:AgentContext)
OPTIONAL MATCH (c)-[:USED_TOOL]->(t:ToolInvocation)
OPTIONAL MATCH (c)-[:CITED]->(ce:ContextEvidence)
RETURN f.id AS findingId,a.id AS actionId,a.kind AS kind,a.status AS status,
 f.summary AS summary,f.createdAt AS createdAt,c.path AS path,
 c.uncertaintyJson AS uncertaintyJson,count(DISTINCT t) AS toolCount,
 count(DISTINCT ce) AS citationCount ORDER BY f.createdAt DESC LIMIT 5`;

export const QUERY_CATALOG = {
  case_conflicts: CASE_QUERY,
  case_gaps: CASE_GAPS_QUERY,
  medical_contraindications: MEDICAL_QUERY,
  disaster_candidates: DISASTER_QUERY,
  disaster_shortest_path: DISASTER_SHORTEST_PATH,
  sports_context: SPORTS_QUERY,
  sports_history: SPORTS_HISTORY_QUERY,
  agent_memory: AGENT_MEMORY_QUERY
};
