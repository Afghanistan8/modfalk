# Demo capture script — video still required

Record a screen video only after the local integration test passes against FalkorDB. Keep the browser and FalkorDB Browser visible enough to show that the graph is real.

1. Show `docker compose ps`, `npm run prepare:sports`, `npm run seed`, and `npm run test:integration`; open `http://127.0.0.1:4173` and show the green FalkorDB status.
2. **Case Evidence:** select `case-001`, run each jurisdiction in turn, then focus on the US run. Show `case → event ← statements ← witnesses`, linked assertions and passage IDs, the two timestamps, selected `case_conflicts` MCP tool and Cypher, and its lawyer-review task. Mark it reviewed.
3. **Medical overlook:** select `patient-001`; show the synthetic condition, allergy and medicine, DailyMed section 4 link and label date, uncertainty section, selected `medical_contraindications` tool, and clinician-review alert. Do not suggest a dose or treatment.
4. **Disaster response:** run `scenario-flood-001`. State aloud that the alert and forecast are synthetic. Show issue/expiry times, facilities, candidate shelter, unverified road/capacity labels, `disaster_candidates`, `disaster_shortest_path` and its `algo.SPpaths` query, and the internal incident-team brief. If a current official NWS alert is available at a chosen point, optionally import it with its forecast and clearly distinguish both from synthetic facilities.
5. **Sports Forcast:** run the preselected historical replay at 0–0, then change manual minute to 30 and home goals to 1, and run again. Show revised probabilities, forecast timestamp, 457-match source coverage, model version, 138-match chronological holdout Brier score, lineup path, and two forecast revisions.
6. In FalkorDB Browser, list the four graphs and inspect a `Finding → Action` path. Stop FalkorDB briefly and show an agent call fail rather than produce an action; restart the container afterward.
7. End with the README's source links, architecture, graph model, AI-assistant disclosure, and the human review responsibilities. Upload the video only when the owner approves publication and submission.

Suggested recording length: 4–6 minutes. Do not call the hackathon submission complete without the actual video.
