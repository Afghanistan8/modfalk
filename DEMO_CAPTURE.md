# Demo capture script — video still required

Record a screen video only after the local integration test passes against FalkorDB. Keep the browser and FalkorDB Browser visible enough to show that the graph is real.

1. Show `docker compose ps`, `npm run prepare:sports`, `npm run seed`, `npm run import:public`, `npm run import:nws-active`, and `npm run test:integration`; open `http://127.0.0.1:4173` and show the green FalkorDB status.
2. **Case Evidence:** select `case-001`, run each jurisdiction in turn, then focus on the US run. Show `case → event ← statements ← witnesses`, linked assertions and passage IDs, the two timestamps, selected `case_conflicts` MCP tool and Cypher, and its lawyer-review task. Mark it reviewed.
3. **Medical overlook:** select `patient-001`; show the synthetic patient boundary, current DailyMed label metadata, label date, uncertainty section, selected `medical_contraindications` tool, prior graph memory, and clinician-review alert. Do not suggest a dose or treatment.
4. **Disaster response:** first choose a current official NWS alert and show that its source URL and expiry are real while the missing verified facility/route connection returns **needs evidence** and creates no incident brief. Then choose the synthetic flood scenario to demonstrate `disaster_candidates`, `disaster_shortest_path`, its `algo.SPpaths` query, uncertainty, prior graph memory, and the review-only incident brief. FEMA open shelters are source-linked records; ModFalk does not fabricate a route from them to the scenario facility.
5. **Sports Forecast:** choose a named match from the Premier League, La Liga, Bundesliga, Ligue 1, Serie A, or FIFA World Cup; run it at 0–0, then change manual minute to 30 and home goals to 1, and run again. Show revised probabilities, forecast timestamp, competition/source, 1,727-match coverage, model version, chronological holdout Brier score, lineup path when available, and two forecast revisions.
6. In FalkorDB Browser, list the four graphs and inspect a `Finding → Action` path. Stop FalkorDB briefly and show an agent call fail rather than produce an action; restart the container afterward.
7. End with the README's source links, architecture, graph model, AI-assistant disclosure, and the human review responsibilities. Upload the video only when the owner approves publication and submission.

Suggested recording length: 4–6 minutes. Do not call the hackathon submission complete without the actual video.
