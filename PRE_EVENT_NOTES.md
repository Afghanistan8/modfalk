# ModFalk — permitted pre-event notes

Checked on 2026-10-04 (Africa/Lagos). This folder had no existing project files or Git repository when inspected. These are research notes and graph sketches only. No application code, interface, database, dataset ingestion, or submission artifact has been created.

## Event boundary

The current [schedule](https://www.wemakedevs.org/hackathons/falkordb/schedule) gives the build window as **2026-10-15 00:01 IST through 2026-10-18 23:59 IST**. In Lagos (WAT, UTC+1), that is **2026-10-14 19:31 through 2026-10-18 19:29**. The [rules](https://www.wemakedevs.org/hackathons/falkordb/rules), item 8, allow discussing ideas, notes, graph sketches, and diagrams before the start, but say the main coding and design work must begin after it. Recheck both pages when the user asks to continue.

The current [track brief](https://www.wemakedevs.org/hackathons/falkordb) names Track 01 **Agents That Act on Connected Data** and lists multi-hop reasoning, graph queries and algorithms, MCP tool selection, actions, and explainable results. An older cached slash-URL result described a different event; use the current track page, rules, and schedule above.

FalkorDB must be the primary graph database and central to the decision path. Event data must be public, synthetic, or owned and permitted. Each submission needs a public repository, README with setup and graph model, essential Cypher/algorithms, working demo video, live deployment or complete local setup, track name, and AI-assistant disclosure. The participant must personally understand and verify the code and design. These requirements are from the [rules](https://www.wemakedevs.org/hackathons/falkordb/rules).

## Source register for later verification

| Area | Official or original source | What was checked now | Recheck during build |
| --- | --- | --- | --- |
| US legal guidance | [DOJ Justice Manual 9-5.000](https://www.justice.gov/jm/jm-9-5000-issues-related-trials-and-other-court-proceedings) | Section 9-5.001 concerns disclosure of exculpatory and impeachment information. The page cautions that its policy does not replace case-specific legal research. No page revision date identified. | Record the exact section and retrieval date; have a lawyer verify any jurisdictional guidance. |
| England and Wales guidance | [CPS Disclosure Manual](https://www.cps.gov.uk/prosecution-guidance/disclosure-manual) | Page says revised 2018-12-14 and refreshed 2022-07-14. | Identify the relevant chapter and exact passage before displaying guidance. |
| Canada guidance | [PPSC Deskbook, 2.5 Principles of Disclosure](https://www.ppsc-sppc.gc.ca/eng/pub/fpsd-sfpg/fps-sfp/tpd/p2/ch05.html) | Guideline dated 2014-03-01; page modified 2015-07-23. It describes a broad but qualified disclosure obligation. | Verify current guidance and exact passage with a Canadian reviewer. |
| Drug labels | [NLM DailyMed](https://dailymed.nlm.nih.gov/dailymed/) | NLM describes it as recent labeling submitted to FDA by companies, while warning that it is not a complete list of FDA-regulated labeling. | Pin each demo passage to a label set ID, section, label version/date, and retrieval time. |
| Clinical decision support | [FDA guidance, January 2026](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software) | Final guidance describes the FDA's treatment of certain CDS software functions. | Review exact criteria before characterizing ModFalk's medical workflow. |
| Weather | [NWS API documentation](https://www.weather.gov/documentation/services-web-api) | API supplies forecasts and alerts as open data and requires an identifying User-Agent; rate limits apply. | Confirm alert schema, issue/expiry fields, and API terms during implementation. |
| Historical soccer | [StatsBomb Open Data](https://github.com/hudl/open-data) | Repository documents matches, events, and lineups; attribution and logo use are requested when publishing analysis. | Inspect the full license and choose a competition with enough dated matches for a time-based holdout before using it. |
| FalkorDB setup | [FalkorDB Docker guide](https://docs.falkordb.com/operations/docker) | Documents Docker Compose, a named volume for persistence, and append-only persistence settings. | Pin image versions and verify persistence in a running local setup. |
| FalkorDB MCP | [FalkorDB MCP Server](https://github.com/FalkorDB/FalkorDB-MCPServer) | Documents Cypher graph tools and read-only query support. | Select and test an actual MCP client/server path; record the invoked tool. |

No agency case material or patient data has been downloaded or imported. Public guidance is separate from synthetic case facts.

## Later build and review notes

- Use the exact requested tab labels: **Case Evidence**, **Medical overlook**, **Disaster response**, **Sports Forcast**.
- Keep four demo domains isolated. Every action is internal and reviewable; none determines guilt, prescribes, issues a public warning, or claims certainty about a sports outcome.
- Make the graph indispensable: each decision should require a multi-hop FalkorDB result, and the visible explanation should include graph path, source identifier, event and ingestion times, uncertainty, tool call, action, and reviewer status.
- At build time, test full paths, missing citations, uncertain identity matches, stale data, graph outage, domain separation, and chronological forecast evaluation.
- Do not push, publish, deploy, submit, or create a timed follow-up until the user gives further instructions. The user plans to provide the final UI design later.

