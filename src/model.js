// Transparent, fixed-parameter three-way baseline. Holdout never tunes these weights.
const softmax = values => { const exp=values.map(v=>Math.exp(v-Math.max(...values)));const sum=exp.reduce((a,b)=>a+b,0);return exp.map(v=>v/sum); };
const outcome = m => m.homeGoals>m.awayGoals ? 0 : m.homeGoals===m.awayGoals ? 1 : 2;

export function assertChronology(history, cutoff) {
  if (history.some(m=>!m.kickoff || !Number.isFinite(Number(m.homeGoals)) || !Number.isFinite(Number(m.awayGoals)))) throw new Error('Historical match has incomplete date or score');
  if (history.some(m=>m.kickoff>=cutoff)) throw new Error('Forecast history contains a match at or after the forecast time');
}

export function predictMatch(history, homeId, awayId, state={minute:0,homeGoals:0,awayGoals:0}) {
  const stats=id=>{let games=0,points=0,goals=0,against=0;for(const m of history){if(m.homeId!==id&&m.awayId!==id)continue;const home=m.homeId===id,own=Number(home?m.homeGoals:m.awayGoals),opp=Number(home?m.awayGoals:m.homeGoals);games++;points+=own>opp?3:own===opp?1:0;goals+=own;against+=opp;}return {games,points,goals,against};};
  const h=stats(homeId),a=stats(awayId);
  const strength=s=>((s.points+3)/(s.games+3)-1.5)*0.42 + ((s.goals-s.against)/(s.games+4))*0.18;
  const delta=strength(h)-strength(a)+0.28;
  const minute=Math.max(0,Math.min(90,Number(state.minute)||0));
  const scoreDelta=(Number(state.homeGoals)||0)-(Number(state.awayGoals)||0);
  const progress=minute/90;
  const logits=[delta+scoreDelta*(0.85+2.4*progress),-0.25+0.25*progress,-delta-scoreDelta*(0.85+2.4*progress)];
  const [home,draw,away]=softmax(logits);
  return {home,draw,away,coverage:{homePriorMatches:h.games,awayPriorMatches:a.games,historyMatches:history.length},modelVersion:'transparent-form-v1'};
}

export function evaluateChronologicalHoldout(matches) {
  const ordered=[...matches].sort((a,b)=>a.kickoff.localeCompare(b.kickoff)||String(a.id).localeCompare(String(b.id)));
  if(ordered.length<20) throw new Error('At least 20 historical matches are needed to evaluate the model');
  const cut=Math.floor(ordered.length*0.7), train=ordered.slice(0,cut), test=ordered.slice(cut);
  let sum=0;
  for(const m of test){const earlier=train.filter(x=>x.kickoff<m.kickoff);assertChronology(earlier,m.kickoff);const p=predictMatch(earlier,m.homeId,m.awayId);const probabilities=[p.home,p.draw,p.away],actual=outcome(m);sum+=probabilities.reduce((s,v,i)=>s+(v-(i===actual?1:0))**2,0)/3;}
  return {metric:'multiclass Brier score (lower is better)',value:Number((sum/test.length).toFixed(4)),trainMatches:train.length,holdoutMatches:test.length,splitAt:test[0].kickoff,method:'fixed parameters; 70/30 chronological split; no holdout outcomes used as features'};
}
