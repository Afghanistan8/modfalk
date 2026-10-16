# ModFalk original graph sketches — historical planning reference

These are allowable graph-model sketches, not a built application or final schema. Revisit after the event opens and the user asks to continue.

## Shared provenance layer

`Source` identifies an official URL or permitted synthetic file and its owner, publication/revision date if known, retrieval time, and jurisdiction where applicable. `Assertion` records a dated claim, exact passage or record ID, whether it is a source fact, synthetic fact, agent inference, or model output, and its confidence or unresolved state. A domain entity is connected to an assertion and its source. `Finding` connects the assertions and traversed path supporting it. `Action` connects to the finding and has proposed, reviewed, or dismissed status plus reviewer/time. Conflicting assertions coexist rather than overwrite each other. Missing sources or uncertain identity links stop a definitive finding and become visible review gaps.

Separate graph names or strict domain partitions should keep legal, medical, disaster, and sports demo records apart. Official guidance and synthetic facts have distinct types and source flags.

## Case Evidence

Conceptual path: `SyntheticCase → Event ← Statement ← Witness`, then `Statement → SourcePassage` and `Event ← Exhibit → SourcePassage`. A second statement about the same event can disagree on a specific claim. Identity links between names must show confidence and provenance. The agent can flag contradiction or missing corroboration for lawyer review, with the exact records and path. The jurisdiction selector changes guidance shown, not the synthetic facts or legal outcome.

## Medical overlook

Conceptual path: `SyntheticPatient → CurrentMedicine → Ingredient → LabelSection`, with additional paths from `SyntheticPatient → Condition` and `SyntheticPatient → Allergy`. A documented label warning that matches a current fact can create a clinician-review alert. Medicine, condition, and allergy recency must be explicit; absence of a warning is not a safety finding. No real patient records.

## Disaster response

Conceptual path: `OfficialAlert → AffectedArea → SyntheticFacility → AccessRoad → CandidateShelter → Capacity/Resource`. The graph should distinguish official alert facts from synthetic facility and shelter status. A route or shelter with unverified live status remains a candidate and produces a gap in the incident-team brief, not a dispatch recommendation.

## Sports Forecast

Conceptual path: `Match → Home/AwayTeam → PriorMatch → Opponent`, plus `Match → Lineup → Player` and `Match → GameState`. Historical matches and lineups may come from a permitted public dataset. A manual lineup or game-state change creates a forecast revision that records the input delta, model version, timestamp, coverage, probability quality, and a three-way win/draw/loss distribution. Training and calibration must use only information known before each forecast time.

## Open questions for the build window

- Which exact legal passages are safe and useful to display in each jurisdiction?
- Which DailyMed label set IDs provide a clear synthetic contraindication or interaction example?
- Which NWS alert geography and synthetic facilities make a stable replayable demo without implying live shelter verification?
- Which StatsBomb competition has enough chronologically ordered matches and lineups for a meaningful holdout, and what does its full license permit?
- Which MCP server and graph algorithm offer a working, logged end-to-end path for the chosen stack?

