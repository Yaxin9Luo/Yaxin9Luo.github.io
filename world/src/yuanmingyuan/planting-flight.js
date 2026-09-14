import {stepMuseumFlight,museumVisitorCollider} from './visitor-motion.js';

// Keep the existing flight/ground/water rules. A wood/stone slide can finish
// at a different XZ from the proposed flight, so its final ground clearance
// must be checked again before the rendered visitor adopts the position.
export function stepMuseumFlightAroundPlants(position,input,dt,{surfaceAt,waterY=2,planting}={}){
  const options={surfaceAt,waterY},proposed=stepMuseumFlight(position,input,dt,options);
  if(!planting)return proposed;
  const actor=museumVisitorCollider({mode:'flying',position});
  const body={radius:actor.radius,height:actor.height,centerOffsetY:(actor.bottom+actor.top)*.5-position.y};
  const swept=planting.constrainFlight(position,proposed,body);
  if(swept.initialOverlap)return {...position};
  const corrected=stepMuseumFlight(swept.position,{},0,options);
  if(corrected.y<=swept.position.y)return swept.position;
  const lifted=planting.constrainFlight(swept.position,corrected,body);
  // If a solid overhead blocks the clearance correction, retain the previous
  // safe frame; never finish a slide embedded in a new rise of the terrain.
  return lifted.initialOverlap||lifted.position.y<corrected.y-1e-7?{...position}:lifted.position;
}
