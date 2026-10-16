# ModFalk

**Submission track:** Agents That Act on Connected Data (Track 01, WeMakeDevs × FalkorDB Graph Hacks: Context for AI Agents).

ModFalk is a local web app with four graph agents. Each agent selects a named MCP tool, traverses a domain-specific FalkorDB graph, and writes an internal action with the evidence and uncertainty that led to it. A reviewer can mark the action reviewed or dismissed. The exact tab labels are **Case Evidence**, **Medical overlook**, **Disaster response**, and **Sports Forecast**.

The UI follows the owner's supplied monochrome editorial reference: an oversized Modfalk wordmark, narrow grid-framed introduction, and matching agent, result, and review areas. The app fails its decision path when FalkorDB is unavailable. No real case or patient records are used; facility, shelter, road, and capacity records are synthetic. The four tabs are scenarios within Track 01, not separate hackathon tracks. Graph-native agent context supports continuity across runs while the product remains focused on decisions made from connected data.

## Quick start

Requirements: Node.js 22+ and Docker with Compose. Tested locally with Node 24 and Docker Desktop. The live FalkorDB integration test runs locally; the GitHub Actions workflows are disabled at the owner's request.

```sh
docker compose up -d --wait
npm ci
npm run prepare:sports
npm run seed
npm run import:public
npm run import:nws-active
npm start
```

Open **http://127.0.0.1:4173**. FalkorDB Browser is at **http://127.0.0.1:3000**. A named Docker volume and append-only persistence retain the graph. `npm run seed` is idempotent for the source nodes and edges; every agent run intentionally creates a new reviewable action. Do not use `docker compose down -v` unless you intend to delete graph data.

To use FalkorDB Cloud, copy `.env.example` to `.env` and fill in the host, port, username, password, and TLS flag from the instance's **Connectivity** tab. `.env` is ignored by Git and must never be committed. The app loads these values automatically; no credentials are required in the chat.

For current public data, run `npm run import:public` for DailyMed and FEMA Open Shelters, then `npm run import:nws-active` for official active NWS alerts. The older point importer (`npm run import:nws -- 29.76 -95.36`) also imports an NWS forecast. The graph records source URL, retrieval time, status, and freshness. FEMA capacity is shown only when the public layer supplies it; missing capacity remains unknown. Synthetic replay scenarios remain available for a deterministic demo, and roads/facilities are never presented as verified dispatch instructions.

Verification:

```sh
npm test
npm run test:integration
```

Run integration tests after starting FalkorDB, preparing sports data, and seeding. The integration test calls all four agents through MCP, verifies their persisted actions, and reviews one action. The unit suite tests missing citations, weak identity matches, stale medical data, domain isolation, graph failure, and forecast leakage. The [GitHub Actions workflow](.github/workflows/integration.yml) is retained for reference but disabled in GitHub at the owner's request; use the local commands above for verification.

## Architecture

```text
Browser → local HTTP server → domain agent → MCP Client
                                   ↓ tools/call
                              MCP Server → FalkorDB client → four isolated graphs
                                   ↓
                           Finding → Action → Review status
```

The Node server and the domain agents are in `src/`. `src/mcp.js` uses the official Model Context Protocol SDK with a linked in-memory transport. This is a real MCP client/server call path, not a direct database call disguised as MCP. Only MCP tool handlers in `src/mcp.js` call `src/db.js` for agent decisions and action writes. The server's health endpoint is a direct connectivity probe, not an agent decision. `src/queries.js` is the reviewed Cypher catalog. The front end uses plain HTML, CSS, and JavaScript in `public/`.

### Track 01 requirements audit

| Hackathon requirement | ModFalk implementation | Proof to show in the demo |
| --- | --- | --- |
| FalkorDB is central to the product | Four isolated FalkorDB graphs hold domain records, provenance, findings, actions, reviews, tool invocations, and durable agent context. | Stop FalkorDB and run an agent: the decision fails and no action is written. |
| Connected data drives the decision | Each agent follows a named multi-hop Cypher path; the disaster agent also ranks graph routes with `algo.SPpaths`. | Open the result's path and Cypher, then compare the cited source nodes. |
| Agents use graph tools | The server dispatches domain-specific MCP tools; the client cannot choose an arbitrary graph. | Show the selected tool and the tool invocation nodes in the trace. |
| Memory persists between runs | Prior `Finding`, `Action`, `Review`, `AgentContext`, `ToolInvocation`, and `ContextEvidence` nodes are queried before the next run. | Run the same tab twice and show the **PRIOR GRAPH MEMORY** block. |
| Decisions are traceable | Every proposed action stores the path, source URLs, displayed passages, uncertainty, tool log, and context evidence; context evidence links back to `Source`. | Use the review queue to inspect the finding, evidence, sources, and reviewer status. |
| Sources are honest and inspectable | Public DailyMed, NWS, FEMA, and StatsBomb data carry source URLs and retrieval/freshness metadata. Synthetic case/patient records and unverified operational roads are labeled at the record and UI boundary. | Show the source URL and the uncertainty boundary for each scenario. |

FalkorDB holds four separate graphs: `modfalk_case`, `modfalk_medical`, `modfalk_disaster`, and `modfalk_sports`. Domain tool names select the graph server-side, and the client cannot supply an arbitrary graph name. Removing FalkorDB makes tool calls fail and prevents actions; the UI reports it as offline. The `database failure breaks the decision path` unit test checks this explicitly.

## Graph model and decision paths

All domains use source provenance and internal workflow nodes. `Source` carries a URL, type, and retrieval time. Dated `Assertion` nodes distinguish synthetic and public source facts; key demo facts link to their assertions and sources. A `Finding` records its agent-inference or model-output classification, tool name, subject, summary, creation time, and serialized evidence trail; `(:Finding)-[:TRIGGERED]->(:Action)` links it to a proposed action. A reviewer update creates a `Review` node and changes the action to reviewed or dismissed. The evidence trail identifies source records, exact displayed passages or record summaries, path, and uncertainty. Public guidance is separate from synthetic case evidence. Missing citations or uncertain identities stop the case agent before it writes an action; missing or stale clinical facts stop the medical agent. A scenario warning or unverified road and capacity remains visibly uncertain in a disaster brief.

| Graph | Representative multi-hop path | Tool and consequence |
| --- | --- | --- |
| Case Evidence | `Case → Event ← Statement ← Witness`, with each statement linked to its `Passage → Source` and event-linked exhibits inspected for missing passages | `case_conflicts` and `case_gaps` find divergent claims and missing corroboration, then write a lawyer-review task. |
| Medical overlook | `Patient → Condition → Source`; `Patient → Medicine → Ingredient`; `Patient → Allergy ← LabelSection → Source` | `medical_contraindications` finds a documented serious allergy concern and writes a clinician-review alert. |
| Disaster response | `Alert → Zone ← Facility → Road → Shelter → Capacity`, plus `Zone → Forecast → Source` | `disaster_candidates` plus `disaster_shortest_path` writes a prioritized incident-team brief. |
| Sports Forecast | `Match → Home/Away Team ← HistoricalMatch → Opponent`; `Match → Lineup → Player`; `Match → GameState` | `sports_context` and `sports_history` write a forecast revision after manual game-state input. |

The disaster route ranking calls FalkorDB's [`algo.SPpaths`](https://docs.falkordb.com/algorithms/sppath) with `weightProp: 'distanceKm'`. The distance is a graph route over *synthetic* road edges, not a verified driving route. The current scenario labels roads and capacity unverified. This algorithm is useful because the agent must compare shelter paths across a road network, rather than treating every candidate as equally close. See the full [Cypher catalog](src/queries.js).

Representative case query (abridged):

```cypher
MATCH (c:Case {id:$id})-[:HAS_EVENT]->(e:Event)<-[:ABOUT]-(a:Statement)<-[:GAVE]-(wa:Witness)
MATCH (e)<-[:ABOUT]-(b:Statement)<-[:GAVE]-(wb:Witness)
MATCH (a)-[:SUPPORTED_BY]->(pa:Passage)-[:FROM_SOURCE]->(sa:Source)
MATCH (b)-[:SUPPORTED_BY]->(pb:Passage)-[:FROM_SOURCE]->(sb:Source)
MATCH (a)-[:EXPRESSES]->(aa:Assertion)
MATCH (b)-[:EXPRESSES]->(ba:Assertion)
WHERE a.id < b.id AND aa.claimKey = ba.claimKey AND aa.claimValue <> ba.claimValue
RETURN a.id, b.id, aa.claimValue, ba.claimValue, pa.id, pb.id, sa.url, sb.url
```

For the seeded case, the agent selects `case_conflicts` because the two witnesses discuss the same synthetic arrival event. It receives `statement-a` (`18:40`) and `statement-b` (`19:10`) with distinct synthetic source passages, then calls:

```js
client.callTool({name: 'create_action', arguments: {
  domain: 'case', kind: 'lawyer-review', subjectId: 'case-001',
  summary: 'Lawyer review: conflicting loading bay arrival statements',
  evidenceJson: '...exact path, passage IDs and sources...', tool: 'case_conflicts'
}})
```

The resulting `Finding → Action` is visible in the review queue with a proposed status. The UI also shows the selected tool, why it was chosen, the full Cypher, graph path, source records, timestamps, uncertainty, and reviewer status.

## Domain limits and sources

- **Case Evidence:** Records are synthetic. The jurisdiction selector links to current official [US DOJ Justice Manual](https://www.justice.gov/jm/jm-9-5000-issues-related-trials-and-other-court-proceedings), [England and Wales CPS Disclosure Manual](https://www.cps.gov.uk/prosecution-guidance/disclosure-manual), and [Canadian PPSC Deskbook](https://www.ppsc-sppc.gc.ca/eng/pub/fpsd-sfpg/fps-sfp/tpd/p2/ch05.html). The app never decides guilt, admissibility, or a disclosure duty.
- **Medical overlook:** The patient and clinical record are explicitly synthetic; the medication evidence is public. `npm run import:public` retrieves current amoxicillin label metadata from the [DailyMed API](https://dailymed.nlm.nih.gov/dailymed/webservices-help/v1/drugname_labeltype_spls_api.cfm), and the graph stores its set ID, publication date, retrieval time, and source URL. The [FDA clinical decision-support guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software) is a review reference. The app never diagnoses, prescribes, changes a dose, or claims safety from an absent warning.
- **Disaster response:** The [NWS API](https://www.weather.gov/documentation/services-web-api) adapter imports current official alerts, and `npm run import:public` retrieves the [FEMA Open Shelters](https://gis.fema.gov/arcgis/rest/services/NSS/OpenShelters/MapServer/0) status and evacuation/post-impact capacity fields when published. Alert and shelter sources are real; any unverified road/facility relationship is clearly labeled, and no public warning or dispatch is issued.
- **Sports Forecast:** `npm run prepare:sports` downloads [StatsBomb Open Data](https://github.com/hudl/open-data) for the FA Women's Super League, Premier League, La Liga, 1. Bundesliga, Ligue 1, Serie A, and FIFA World Cup. StatsBomb is the data source; their repository requests attribution and logo use for published analysis. The local downloaded dataset is ignored by Git and is re-created during setup. The fixed three-way form model uses a 70/30 time split and reports a multiclass Brier score. The selected matches are historical replays, and manual game-state changes create new revisions. There is no trusted live sports feed. The model is a transparent baseline, not a betting or certainty claim.
- **Public-data imports:** `npm run import:public` imports current DailyMed label metadata and FEMA Open Shelters records, including published shelter status and evacuation/post-impact capacity when present. `npm run import:nws-active` imports current official NWS alerts. Patient identities, witness statements, and unverified operational routes remain explicitly synthetic or unverified; the public source is never represented as a fabricated fact.

![StatsBomb logo](https://raw.githubusercontent.com/hudl/open-data/master/img/SB%20-%20Icon%20Lockup%20-%20Colour%20positive.png)

The sports model uses only matches with kickoff earlier than the replay match for its displayed prediction. Its holdout score is evaluated without fitting or tuning parameters on holdout outcomes. Prior results may be used for later replay predictions only after those matches occurred. Lineup and player links are displayed as context; this version does not claim a measured lineup effect.

## Demo and submission status

Use [DEMO_CAPTURE.md](DEMO_CAPTURE.md) to record all four tabs and actions. **A working demo video is still required and has not been recorded.** No live deployment or hackathon submission has been made. Local setup is provided in this README. The repository author and owner is **Afghanistan8**. An AI coding assistant (Codex) was used to draft implementation and documentation; it is not a Git coauthor or contributor. The participant must personally run the demo, inspect the graph and source claims, verify the code and model, and be able to explain the architecture and query choices before submission.

The rules and schedule were last checked on 2026-10-15: [rules](https://www.wemakedevs.org/hackathons/falkordb/rules), [schedule](https://www.wemakedevs.org/hackathons/falkordb/schedule). Review them again before submission.
