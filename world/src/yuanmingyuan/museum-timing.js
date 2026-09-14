// Physics consumes ordinary slow frames in small steps. Only a long foreground
// stall is capped; the environment clock can still consume the actual elapsed time.
export function advanceMuseumTime(rawDt,step){
  const activeDt=Number.isFinite(rawDt)?Math.max(0,rawDt):0,simulationDt=Math.min(.5,activeDt);
  const count=Math.max(1,Math.ceil(simulationDt/(1/30)-1e-8)),dt=simulationDt/count;
  for(let i=0;i<count;i++)step(dt);
  return {activeDt,simulationDt};
}
