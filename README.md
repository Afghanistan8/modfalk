# ModFalk

**Submission track:** Agents That Act on Connected Data (Track 01, WeMakeDevs × FalkorDB Graph Hacks: Context for AI Agents).

ModFalk is a local web app with four graph agents. Each agent selects a named MCP tool, traverses a domain-specific FalkorDB graph, and writes an internal action with the evidence and uncertainty that led to it. A reviewer can mark the action reviewed or dismissed. The exact tab labels are **Case Evidence**, **Medical overlook**, **Disaster response**, and **Sports Forcast**.

The UI is deliberately simple so it can be replaced with the owner's final design. The app fails its decision path when FalkorDB is unavailable. No real case or patient records are used; facility, shelter, road, and capacity records are synthetic.

## Quick start

Requirements: Node.js 22+ and Docker with Compose. Tested locally with Node 24; this workstation did not have Docker, so the included GitHub Actions workflow is configured to check live database integration after a push.

```sh
docker compose up -d --wait
npm ci
npm run prepare:sports
npm run seed
npm start
```

Open **http://127.0.0.1:4173**. FalkorDB Browser is at **http://127.0.0.1:3000**. A named Docker volume and append-only persistence retain the graph. `npm run seed` is idempotent for the source nodes and edges; every agent run intentionally creates a new reviewable action. Do not use `docker compose down -v` unless you intend to delete graph data.

For an official live NWS alert, optionally run `npm run import:nws -- TX` (replace `TX` with a two-letter state code), then use the returned alert ID in the Disaster response tab. If no active alert is returned, the synthetic scenario remains available. The imported alert is official; its associated facility, shelter, road, and capacity are expressly synthetic and unverified. The default demo alert is entirely synthetic.

Verification:

```sh
npm test
npm run test:integration
```

Run integration tests after starting FalkorDB, preparing sports data, and seeding. The integration test calls all four agents through MCP, verifies their persisted actions, and reviews one action. The unit suite tests missing citations, weak identity matches, stale medical data, domain isolation, graph failure, and forecast leakage. The [GitHub Actions workflow](.github/workflows/integration.yml) runs both suites against FalkorDB on push.

## Architecture

```text
Browser → local HTTP server → domain agent → MCP Client
                                   ↓ tools/call
                              MCP Server → FalkorDB client → four isolated graphs
                                   ↓
                           Finding → Action → Review status
```

The Node server and the domain agents are in `src/`. `src/mcp.js` uses the official Model Context Protocol SDK with a linked in-memory transport. This is a real MCP client/server call path, not a direct database call disguised as MCP. Only MCP tool handlers in `src/mcp.js` call `src/db.js` for agent decisions and action writes. The server's health endpoint is a direct connectivity probe, not an agent decision. `src/queries.js` is the reviewed Cypher catalog. The front end uses plain HTML, CSS, and JavaScript in `public/`.

FalkorDB holds four separate graphs: `modfalk_case`, `modfalk_medical`, `modfalk_disaster`, and `modfalk_sports`. Domain tool names select the graph server-side, and the client cannot supply an arbitrary graph name. Removing FalkorDB makes tool calls fail and prevents actions; the UI reports it as offline. The `database failure breaks the decision path` unit test checks this explicitly.

## Graph model and decision paths

All domains use source provenance and internal workflow nodes. `Source` carries a URL, type, and retrieval time. Domain facts carry record IDs and event dates. A `Finding` records a tool name, subject, summary, creation time, and serialized evidence trail; `(:Finding)-[:TRIGGERED]->(:Action)` links it to a proposed, reviewed, or dismissed action. The evidence trail identifies source records, exact displayed passages or record summaries, path, and uncertainty. Public guidance is separate from synthetic case evidence. Missing citations or uncertain identities stop the case agent before it writes an action; missing or stale clinical facts stop the medical agent. A scenario warning or unverified road and capacity remains visibly uncertain in a disaster brief.

| Graph | Representative multi-hop path | Tool and consequence |
| --- | --- | --- |
| Case Evidence | `Case → Event ← Statement ← Witness`, with each statement linked to its `Passage → Source` | `case_conflicts` finds divergent claims and writes a lawyer-review task. |
| Medical overlook | `Patient → Medicine → Ingredient`; `Patient → Allergy ← LabelSection → Source` | `medical_contraindications` finds a documented serious allergy concern and writes a clinician-review alert. |
| Disaster response | `Alert → Zone ← Facility → Road → Shelter → Capacity` | `disaster_candidates` plus `disaster_shortest_path` writes a prioritized incident-team brief. |
| Sports Forcast | `Match → Home/Away Team ← HistoricalMatch → Opponent`; `Match → Lineup → Player`; `Match → GameState` | `sports_context` and `sports_history` write a forecast revision after manual game-state input. |

The disaster route ranking calls FalkorDB's [`algo.SPpaths`](https://docs.falkordb.com/algorithms/sppath) with `weightProp: 'distanceKm'`. The distance is a graph route over *synthetic* road edges, not a verified driving route. The current scenario labels roads and capacity unverified. This algorithm is useful because the agent must compare shelter paths across a road network, rather than treating every candidate as equally close. See the full [Cypher catalog](src/queries.js).

Representative case query (abridged):

```cypher
MATCH (c:Case {id:$id})-[:HAS_EVENT]->(e:Event)<-[:ABOUT]-(a:Statement)<-[:GAVE]-(wa:Witness)
MATCH (e)<-[:ABOUT]-(b:Statement)<-[:GAVE]-(wb:Witness)
MATCH (a)-[:SUPPORTED_BY]->(pa:Passage)-[:FROM_SOURCE]->(sa:Source)
MATCH (b)-[:SUPPORTED_BY]->(pb:Passage)-[:FROM_SOURCE]->(sb:Source)
WHERE a.id < b.id AND a.claimKey = b.claimKey AND a.claimValue <> b.claimValue
RETURN a.id, b.id, pa.id, pb.id, sa.url, sb.url
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
- **Medical overlook:** The synthetic patient has a recorded serious penicillin allergy and current amoxicillin entry. The public [DailyMed amoxicillin label](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4fb7837e-964c-4d38-a3a5-b384b1bd6e08), section 4, documents the concern. NLM notes that DailyMed is not a complete list of all FDA-regulated labeling. The [FDA's January 2026 clinical decision-support guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software) is a review reference. The app never diagnoses, prescribes, changes a dose, or claims safety from an absent warning.
- **Disaster response:** The [NWS API](https://www.weather.gov/documentation/services-web-api) adapter can import an active official alert with issue and expiry times. The replayable default alert and every facility, shelter, road, capacity, and distance are synthetic. No public warning or dispatch is issued.
- **Sports Forcast:** `npm run prepare:sports` downloads [StatsBomb Open Data](https://github.com/hudl/open-data) for FA Women's Super League seasons 2018/19, 2019/20, 2020/21, and 2023/24. StatsBomb is the data source; their repository requests attribution and logo use for published analysis. The local downloaded dataset is ignored by Git and is re-created during setup. The fixed three-way form model uses a 70/30 time split and reports a multiclass Brier score; the downloaded 457-match snapshot yielded **0.1757** on 138 held-out matches. The selected match is a *historical replay*, and manual game-state changes create new revisions. There is no trusted live sports feed. The model is a transparent baseline, not a betting or certainty claim.

The sports model uses only matches with kickoff earlier than the replay match for its displayed prediction. Its holdout score is evaluated without fitting or tuning parameters on holdout outcomes. Prior results may be used for later replay predictions only after those matches occurred. Lineup and player links are displayed as context; this version does not claim a measured lineup effect.

## Demo and submission status

Use [DEMO_CAPTURE.md](DEMO_CAPTURE.md) to record all four tabs and actions. **A working demo video is still required and has not been recorded.** No live deployment or hackathon submission has been made. Local setup is provided in this README. The repository author and owner is **Afghanistan8**. An AI coding assistant (Codex) was used to draft implementation and documentation; it is not a Git coauthor or contributor. The participant must personally run the demo, inspect the graph and source claims, verify the code and model, and be able to explain the architecture and query choices before submission. The final UI design is still pending from the owner.

The rules and schedule were last checked on 2026-10-15: [rules](https://www.wemakedevs.org/hackathons/falkordb/rules), [schedule](https://www.wemakedevs.org/hackathons/falkordb/schedule). Review them again before submission.
