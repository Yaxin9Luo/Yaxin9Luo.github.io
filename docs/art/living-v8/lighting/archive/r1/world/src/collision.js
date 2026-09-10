import { locations as defaultLocations, bridges as defaultBridges } from './locations.js';

// These are structural proxies for the unrotated, metre-scale factories in models.js.
// Windows and closed doors are solid; the ruins' archways remain open. Decorative
// foliage, thin rails, furniture, terrain and other world objects are not covered.
// Each convex solid stores outward unit planes: nx*x + ny*y + nz*z <= distance.
const EPSILON = 1e-8;
const SKIN = 0.002;

function plane(x, y, z, distance) {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length, distance / length];
}

function localArchitecture(id) {
  const solids = [];
  const add = (name, planes, bottom, top) => solids.push({ id: `${id}/${name}`, buildingId: id, planes, bottom, top });
  const caps = (bottom, top) => [plane(0, -1, 0, -bottom), plane(0, 1, 0, top)];
  const box = (name, x, z, width, depth, bottom, top) => add(name, [
    plane(1, 0, 0, x + width / 2), plane(-1, 0, 0, -x + width / 2),
    plane(0, 0, 1, z + depth / 2), plane(0, 0, -1, -z + depth / 2), ...caps(bottom, top),
  ], bottom, top);
  // Twelve tangent planes conservatively enclose round/octagonal masonry and trim.
  const round = (name, x, z, radius, bottom, top, topRadius = radius) => {
    const planes = caps(bottom, top), slope = (radius - topRadius) / (top - bottom);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6, nx = Math.sin(angle), nz = Math.cos(angle);
      planes.push(plane(nx, slope, nz, radius + nx * x + nz * z + slope * bottom));
    }
    add(name, planes, bottom, top);
  };
  const roof = (name, x, z, width, depth, bottom, rise) => {
    const top = bottom + rise, slope = rise / (depth / 2);
    add(name, [plane(1, 0, 0, x + width / 2), plane(-1, 0, 0, -x + width / 2),
      plane(0, 1, slope, top + slope * z), plane(0, 1, -slope, top - slope * z), ...caps(bottom, top)], bottom, top);
  };
  // Convex XY profile extruded along Z; used for the surviving open ruin arches.
  const profile = (name, points, z, depth) => {
    const area = points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0);
    if (area < 0) points = [...points].reverse();
    const planes = [plane(0, 0, 1, z + depth / 2), plane(0, 0, -1, -z + depth / 2)];
    points.forEach((p, i) => {
      const q = points[(i + 1) % points.length], nx = q[1] - p[1], ny = p[0] - q[0];
      planes.push(plane(nx, ny, 0, nx * p[0] + ny * p[1]));
    });
    const bottom = Math.min(...points.map(p => p[1])), top = Math.max(...points.map(p => p[1]));
    planes.push(...caps(bottom, top));
    add(name, planes, bottom, top);
  };
  const tower = (name, x, z, radius, height, roofHeight) => {
    round(`${name}-body`, x, z, radius + 0.24, 0, height + 0.25);
    round(`${name}-spire`, x, z, radius * 1.28 + 0.1, height + 0.12, height + roofHeight + 1.04, 0.18);
  };

  if (id === 'about') {
    // Open foreground court, rear terrace, perpendicular wings and a tall square keep.
    box('foundation',0,0,58,46,0,.85);
    box('upper-terrace',0,-8,53.4,28.4,.55,2.02);
    box('great-hall',0,-9.4,27.5,14.8,2,22.05);
    roof('great-hall-roof',0,-9.5,28.4,15.3,21.94,10.03);
    for(const x of [-13.2,-7.55,0,7.55,13.2]) {
      box(`hall-buttress-${x}`,x,-1.98,1.1,1.8,2,22.15);
      round(`hall-pinnacle-${x}`,x,-2.18,.55,21.8,25.5,.08);
    }
    box('frontispiece',0,.25,9,6.5,1.7,20.83);
    roof('frontispiece-roof',0,.1,9.4,6.8,20.64,5.68);
    for(const side of [-1,1])round(`frontispiece-pinnacle-${side}`,side*4.35,2.95,.84,20.6,27,.12);
    // Empty arcade bays are represented by piers and arch shoulders, never one box.
    const arcade=(name,x,z,width,base,height,count,depth,alongZ=false)=>{
      const pitch=width/count,opening=pitch-.72;
      const orient=solid=>{ if(alongZ)solid.planes=solid.planes.map(([nx,ny,nz,d])=>[nz,ny,nx,d]); };
      for(let i=0;i<=count;i++) {
        const u=-width/2+i*pitch;
        box(`${name}-pier-${i}`,alongZ?z+u:x+u,alongZ?x:z,.85,depth,base,base+height);
        orient(solids.at(-1));
      }
      for(let i=0;i<count;i++)for(const side of [-1,1]) {
        const u=-width/2+(i+.5)*pitch,center=(alongZ?z:x)+u;
        profile(`${name}-arch-${i}-${side}`,[[center+side*opening/2,base+.12+(height-.5)*.6],
          [center,base+height-.45],[center,base+height+.1],[center+side*opening/2,base+height+.1]],alongZ?x:z,depth);
        orient(solids.at(-1));
      }
    };
    const longRoof=(name,x,z,width,depth,bottom,rise)=>{
      roof(name,z,x,depth,width,bottom,rise);
      solids.at(-1).planes=solids.at(-1).planes.map(([nx,ny,nz,d])=>[nz,ny,nx,d]);
    };
    for(const side of [-1,1]) {
      box(`wing-${side}`,side*20,.1,11.6,31.7,1.3,13.85);
      longRoof(`wing-roof-${side}`,side*20,0,12.3,32.3,13.69,7.73);
      for(const z of [-11,-4,3,10]) {
        box(`outer-pier-${side}-${z}`,side*27.9,z,1.5,1.85,.8,9.45);
        const x0=side*27.9,x1=side*25.15;
        profile(`flying-brace-${side}-${z}`,[[x0+side*.3,6.1],[x1-side*.3,10.25],
          [x1-side*.3,13.1],[x0+(x1-x0)*.4,12.1],[x0+side*.3,9.85]],z,.72);
        round(`buttress-pinnacle-${side}-${z}`,side*27.9,z,.69,9.4,13.55,.13);
      }
      arcade(`cloister-${side}`,side*12.2,8.1,16.8,1.15,6.5,4,.85,true);
      box(`cloister-deck-${side}`,side*13.3,8.1,3.2,17.6,7.64,8.04);
      box(`cloister-parapet-${side}`,side*12.15,8.1,.62,17.4,7.94,8.72);
      for(const z of [-7,4]) {
        box(`wing-dormer-${side}-${z}`,side*20,z,2.9,2.65,15.65,20.55);
        roof(`wing-dormer-roof-${side}-${z}`,side*20,z,3.5,3.1,20.34,2.93);
      }
    }
    box('astronomical-keep',-4,-13,10.55,10.55,2,45.15);
    box('keep-belfry',-4,-13,12.45,12.45,43.8,56.62);
    // Four sloping planes enclose the square pyramidal roof, preserving its taper.
    const roofBase=56.5,roofTop=73.85,half=6.95,k=half/(roofTop-roofBase);
    add('keep-pyramid',[...caps(roofBase,roofTop),
      plane(1,k,0,-4+half+k*roofBase),plane(-1,k,0,4+half+k*roofBase),
      plane(0,k,1,-13+half+k*roofBase),plane(0,k,-1,13+half+k*roofBase)],roofBase,roofTop);
    for(const sx of [-1,1])for(const sz of [-1,1])round(`keep-pinnacle-${sx}-${sz}`,-4+sx*5.7,-13+sz*5.7,.93,54.8,62.3,.12);
    for(const u of [-2.65,2.65]) {
      box(`keep-lucarne-front-${u}`,-4+u,-8.5,2.5,1.9,58.6,63.04);
      longRoof(`keep-lucarne-front-roof-${u}`,-4+u,-8.5,3,2.4,62.79,3.83);
      box(`keep-lucarne-side-${u}`,.5,-13+u,1.9,2.5,58.6,63.04);
      roof(`keep-lucarne-side-roof-${u}`,.5,-13+u,2.4,3,62.79,3.83);
    }
    for(const side of [-1,1]) {
      round(`keep-oriel-${side}`,-4+side*5.25,-8,1.16,33.1,39.15);
      round(`keep-oriel-roof-${side}`,-4+side*5.25,-8,1.44,38.95,44.25,.12);
    }
    const towers=[[-21,-14,3.1,35.5,14],[21,-14,3.2,40,15.2],[9.5,-16,2,46.3,14.2],
      [-12,-16,1.7,41,12.3],[-21,13,2.8,20.5,9.7],[21,13,2.8,25.5,10.5],
      [-8.5,19,2.1,17.5,8],[8.5,19,2.1,19.7,8.8]];
    towers.forEach((p,i)=>tower(`tower-${i}`,...p));
    round('east-rear-balcony',21,-14,3.95,38.7,40.2);
    for(const [i,v]of [[-12.5,28.3,-13.3,15,3.9,4],[15.3,31.1,-14,11.7,3.6,3]].entries()) {
      const [x,y,z,width,depth,count]=v;
      box(`bridge-deck-${i}`,x,z,width+.2,depth+.2,y-.27,y+.28);
      for(const side of [-1,1])arcade(`bridge-${i}-${side}`,x,z+side*depth/2,width,y+.22,4.8,count,.65);
      roof(`bridge-roof-${i}`,x,z,width+1,depth+.9,y+5.19,2.93);
    }
    for(const x of [-8,2,8]) {
      box(`hall-dormer-${x}`,x,-5.5,2.5,2.7,25.4,30.14);
      roof(`hall-dormer-roof-${x}`,x,-5.5,3.15,3.25,29.99,2.73);
    }
    for(const x of [-10,5.4])box(`chimney-${x}`,x,-11.5,1.7,1.7,25.6,33.44);
    // Gate is a real 7.6m-wide passage. The court between it and the hall is empty.
    for(const side of [-1,1]) {
      box(`gate-pier-${side}`,side*5.35,20,3.65,3.7,1.05,11.7);
      profile(`gate-arch-${side}`,[[side*3.8,6.45],[0,9.9],[0,12.2],[side*3.8,12.2]],20,3.7);
      box(`forecourt-wall-${side}`,side*16.5,20.4,11.3,1.65,.8,4.3);
    }
    box('gate-crown',0,20.2,14.7,3.85,11.5,13.05);
  } else if (id === 'publications') {
    box('foundation', 0, 0, 17, 13.5, 0, 0.9);
    box('archive-hall', 0, -0.55, 14.9, 11.8, 0.75, 9.65);
    roof('archive-roof', 0, -0.7, 15.55, 11.9, 9.49, 5.48);
    box('frontispiece', 0, 5.2, 5.1, 2.5, 0.65, 10.16);
    roof('frontispiece-roof', 0, 5.2, 5.65, 3, 9.97, 3.2);
    tower('archive-tower', -5.1, -3.9, 1.65, 13.2, 5.7);
    box('chimney', 5.2, -2.6, 1.1, 1.1, 12.3, 16.56);
  } else if (id === 'projects') {
    box('foundation', 0, 0, 17, 13.4, 0, 0.8);
    box('atelier', -1, 0.1, 12.45, 10.1, 0.4, 7.92);
    roof('atelier-roof', -1, 0, 13.35, 10.9, 7.79, 4.48);
    box('forge-stack', -5.2, -1.8, 2.68, 2.68, 0.3, 17.33);
    round('copper-vessel', 6.05, 0.1, 1.9, 0.4, 8.5);
    box('copper-pipe', 4.8, 0.1, 2.9, .48, 8.5, 9.65);
  } else if (id === 'research') {
    round('foundation', 0, 0, 8.2, 0, 1.25);
    round('observatory-body', 0, 0, 5.55, 1.05, 9.53);
    round('observatory-balcony', 0, 0, 6.55, 9, 9.8);
    round('dome-drum', 0, 0, 5.2, 9.5, 11.95);
    // Tangent planes approximate a hemisphere without turning it into a cylinder.
    const radius = 5.2, centerY = 11.78, domePlanes = caps(11.72, centerY + radius);
    for (const latitude of [0, Math.PI / 6, Math.PI / 3]) for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, ny = Math.sin(latitude);
      domePlanes.push(plane(Math.sin(a) * Math.cos(latitude), ny, Math.cos(a) * Math.cos(latitude), radius + ny * centerY));
    }
    add('observatory-dome', domePlanes, 11.72, centerY + radius);
    profile('telescope', [[2.3,11.6],[3.7,11.6],[8.05,16.4],[6.55,17.1]], 0, 1.95);
    // The telescope profile above was drawn along Z/Y; exchange its X/Z axes.
    const telescope = solids.at(-1);
    telescope.planes = telescope.planes.map(([x,y,z,d]) => [z,y,x,d]);
    round('armillary', 0, 0, 1.92, 16.5, 21.35);
  } else if (id === 'contact') {
    round('foundation', 0, 0, 6.4, 0, 0.8);
    tower('owlery', 0, 0, 3.35, 14.1, 5.8);
    round('balcony', 0, 0, 4.75, 12.15, 13.05);
    // Coarse 3-step groups follow the actual spiral; the rest of the annulus is open.
    for (let i = 0; i < 37; i += 3) {
      const a = (Math.min(i + 1,36) / 36) * Math.PI * 1.84 + .5;
      round(`stair-${i}`, Math.sin(a) * 4.05, Math.cos(a) * 4.05, 1, .7 + i * .32, 1.03 + Math.min(i + 2,36) * .32);
    }
  } else if (id === 'journey') {
    round('foundation', 0, 0, 8.9, 0, .73);
    for (const [i, pair] of [[-6.3,-5.45],[-2.75,-1.35],[1.35,2.75],[5.45,6.3]].entries()) {
      box(`cloister-pier-${i}`, (pair[0] + pair[1]) / 2, -4.65, pair[1] - pair[0] + .2, 1.15, .65, 6.48);
    }
    for (const x of [-4.1, 0, 4.1]) for (const side of [-1, 1]) {
      profile(`cloister-arch-${x}-${side}`, [[x + side * 1.4,3.45],[x,5.25],[x,6.5],[x + side * 1.4,6.5]], -4.65, 1.15);
    }
    for (const side of [-1, 1]) {
      box(`portal-pier-${side}`, side * 3.3, -1.2, 1.9, 2.15, .6, 5.38);
      const edgePoint = (t, offset) => {
        const length = Math.hypot(4.9, 6.6 * t);
        return [side * 3.3 * (1 - t * t) + side * 4.9 / length * offset, 5.4 + 4.9 * t + 6.6 * t / length * offset];
      };
      for (let i = 0; i < 3; i++) {
        const t0 = i * .94 / 3, t1 = (i + 1) * .94 / 3;
        profile(`portal-arch-${side}-${i}`, [edgePoint(t0,.68),edgePoint(t1,.68),edgePoint(t1,-.68),edgePoint(t0,-.68)], -1.2, 1.4);
      }
    }
    box('portal-keystone', 0, -1.18, 1, 1.5, 9.4, 10.64);
    for (const [i, p] of [[-6,-3.6,6.3],[6,-3.8,4.1],[-6.1,3.5,2.7],[6.5,3.4,1.8]].entries()) {
      round(`broken-column-${i}`, p[0], p[1], 1.05, .55, p[2] + 1.1);
    }
    round('suspended-crystal', 0, -1, .78, 3.05, 6.12, .35);
  }
  return solids;
}

/** Build once. Location IDs determine the asset; radius is not a building shape. */
export function createBuildingColliders(locations = defaultLocations) {
  return locations.flatMap(location => localArchitecture(location.id).map(solid => ({
    ...solid,
    bottom: solid.bottom + location.y,
    top: solid.top + location.y,
    planes: solid.planes.map(([x,y,z,d]) => [x,y,z,d + x * location.x + y * location.y + z * location.z]),
  })));
}

/**
 * Build once alongside building proxies. Matches createViaduct in site-details.js;
 * endpoint order rotates the local +Z axis, and elevation is the deck centre.
 * Separate piers and convex arch shoulders preserve every real arch opening.
 */
export function createBridgeColliders(bridges = defaultBridges, { elevation = 6.82 } = {}) {
  return Object.entries(bridges).flatMap(([id, [a, b]]) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < EPSILON) return [];
    const sin = (b[0] - a[0]) / length, cos = (b[1] - a[1]) / length;
    const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2, solids = [];
    const add = (name, planes, bottom, top) => solids.push({
      id: `bridge/${id}/${name}`, buildingId: `bridge/${id}`,
      bottom: bottom + elevation, top: top + elevation,
      planes: planes.map(([nx, ny, nz, d]) => {
        const wx = cos * nx + sin * nz, wz = -sin * nx + cos * nz;
        return [wx, ny, wz, d + wx * x + ny * elevation + wz * z];
      }),
    });
    const box = (name, cx, cz, width, depth, bottom, top) => add(name, [
      plane(1, 0, 0, cx + width / 2), plane(-1, 0, 0, -cx + width / 2),
      plane(0, 0, 1, cz + depth / 2), plane(0, 0, -1, -cz + depth / 2),
      plane(0, -1, 0, -bottom), plane(0, 1, 0, top),
    ], bottom, top);
    // A convex Z/Y profile extruded across the thickness of a side wall.
    const profile = (name, cx, points) => {
      const planes = [plane(1, 0, 0, cx + .385), plane(-1, 0, 0, -cx + .385)];
      points.forEach((p, i) => {
        const q = points[(i + 1) % points.length], ny = p[0] - q[0], nz = q[1] - p[1];
        planes.push(plane(0, ny, nz, ny * p[1] + nz * p[0]));
      });
      add(name, planes, Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[1])));
    };
    const count = Math.max(2, Math.round(length / 8)), span = length / count, radius = span * .36;
    box('deck', 0, 0, 6, length, -.35, .35);
    for (const side of [-1, 1]) {
      box(`rail-top-${side}`, side * 2.86, 0, .48, length, 1.24, 1.66);
      box(`rail-base-${side}`, side * 2.86, 0, .55, length, .255, .605);
      for (let i = 0; i <= count; i++) box(`rail-post-${side}-${i}`, side * 2.86,
        -length / 2 + i * span, .85, .85, .1, 1.9);
      // Sloped tangent planes enclose the small tapered balusters without
      // replacing the whole balustrade with an opaque collision wall.
      for (let cz = -length / 2 + .5, i = 0; cz < length / 2; cz += 1.3, i++) {
        const slope = .1, planes = [plane(0, -1, 0, -.5), plane(0, 1, 0, 1.4)];
        for (let j = 0; j < 8; j++) {
          const angle = j * Math.PI / 4, nx = Math.cos(angle), nz = Math.sin(angle);
          planes.push(plane(nx, slope, nz, .2 + nx * side * 2.86 + nz * cz + slope * .5));
        }
        add(`baluster-${side}-${i}`, planes, .5, 1.4);
      }
      for (let i = 0; i < count; i++) {
        const center = -length / 2 + (i + .5) * span;
        for (const end of [-1, 1]) {
          const inner = radius - .06, outer = span / 2 + .06;
          box(`pier-${side}-${i}-${end}`, side * 2.45, center + end * (inner + outer) / 2,
            .77, outer - inner, -24.06, -.19);
        }
        // Chords conservatively follow the semicircle. Eight segments add at
        // most 6cm of arc approximation at these spans, plus the real 6cm bevel.
        for (let segment = 0; segment < 8; segment++) {
          const p = (8 - segment) * Math.PI / 8, q = (7 - segment) * Math.PI / 8;
          const lo = center + Math.cos(p) * radius, hi = center + Math.cos(q) * radius;
          profile(`arch-${side}-${i}-${segment}`, side * 2.45, [
            [lo, -6 + Math.sin(p) * radius - .06], [hi, -6 + Math.sin(q) * radius - .06],
            [hi, -.19], [lo, -.19],
          ]);
        }
      }
    }
    return solids;
  });
}

const defaultColliders = createBuildingColliders();
const copy = p => ({ x:p.x, y:p.y, z:p.z });
const margin = (p, radius, halfHeight) => radius * Math.hypot(p[0],p[2]) + halfHeight * Math.abs(p[1]);
const signedDistance = (p, point) => p[3] - p[0] * point.x - p[1] * point.y - p[2] * point.z;

function contains(solid, point, radius, halfHeight) {
  if (point.y < solid.bottom - halfHeight || point.y > solid.top + halfHeight) return false;
  return solid.planes.every(p => signedDistance(p,point) + margin(p,radius,halfHeight) > -EPSILON);
}

function interval(solid, origin, direction, padding) {
  let enter = -Infinity, leave = Infinity, enterPlane = null, leavePlane = null;
  for (const p of solid.planes) {
    const distance = signedDistance(p,origin) + padding(p);
    const rate = p[0] * direction.x + p[1] * direction.y + p[2] * direction.z;
    if (Math.abs(rate) < EPSILON) { if (distance < -EPSILON) return null; continue; }
    const t = distance / rate;
    if (rate < 0 && t > enter) { enter = t; enterPlane = p; }
    if (rate > 0 && t < leave) { leave = t; leavePlane = p; }
    if (enter > leave + EPSILON) return null;
  }
  return { enter, leave, enterPlane, leavePlane, solid };
}

/**
 * Recover an overlapping rider in X/Z and remove only inward normal velocity.
 * Pure: accepts plain vectors or THREE.Vector3, never mutates its inputs.
 * This is penetration recovery, not swept movement; call after each movement step.
 * A radius=.8 / halfHeight=1 cylinder is enclosed conservatively by offset planes.
 */
export function resolveRiderCollision(position, velocity, colliders = defaultColliders, { radius = .8, halfHeight = 1 } = {}) {
  const result = { position:copy(position), velocity:copy(velocity), collided:false, normal:null, colliderId:null };
  const touching = colliders.filter(s => contains(s,position,radius,halfHeight));
  if (!touching.length) return result;
  const directions = new Map();
  for (const solid of touching) for (const p of solid.planes) {
    const length = Math.hypot(p[0],p[2]);
    if (length < EPSILON) continue;
    const direction = { x:p[0] / length, y:0, z:p[2] / length };
    directions.set(`${direction.x.toFixed(5)}/${direction.z.toFixed(5)}`, direction);
  }
  let best = null;
  const active = colliders.filter(s => position.y >= s.bottom - halfHeight && position.y <= s.top + halfHeight);
  const padding = p => margin(p,radius,halfHeight);
  for (const direction of directions.values()) {
    const spans = active.map(s => interval(s,position,direction,padding)).filter(s => s && s.leave >= 0).sort((a,b) => a.enter - b.enter);
    let end = 0, boundary = null;
    // Exit the UNION of overlapping bodies. Per-box pushes oscillate at wing/hall joins.
    for (const span of spans) {
      if (span.enter > end + SKIN) break;
      if (span.leave >= end) { end = span.leave; boundary = span; }
    }
    if (boundary && (!best || end < best.distance)) best = { distance:end, direction, boundary };
  }
  if (!best) return result;
  const distance = best.distance + SKIN;
  result.position.x += best.direction.x * distance;
  result.position.z += best.direction.z * distance;
  const p = best.boundary.leavePlane, length = Math.hypot(p[0],p[2]);
  result.normal = { x:p[0] / length, y:0, z:p[2] / length };
  const inward = result.velocity.x * result.normal.x + result.velocity.z * result.normal.z;
  if (inward < 0) { result.velocity.x -= inward * result.normal.x; result.velocity.z -= inward * result.normal.z; }
  result.collided = true;
  result.colliderId = best.boundary.solid.id;
  return result;
}

/**
 * Clip a camera boom against convex proxy planes expanded by a .3m camera sphere.
 * Returns the safe endpoint, metric distance, blocked flag and collider ID.
 * If origin is inside a solid there is no unobstructed boom: return origin/zero.
 * Clamp the ACTUAL camera again after interpolation; a safe goal alone cannot stop
 * its interpolated path from crossing a wall. No enforced minimum boom can override a hit.
 */
export function shortenCameraBoom(origin, desired, colliders = defaultColliders, { radius = .3, clearance = .08 } = {}) {
  const dx = desired.x - origin.x, dy = desired.y - origin.y, dz = desired.z - origin.z;
  const distance = Math.hypot(dx,dy,dz);
  if (distance < EPSILON) return { position:copy(origin), distance:0, blocked:false, colliderId:null };
  const direction = { x:dx / distance, y:dy / distance, z:dz / distance };
  let nearest = distance, colliderId = null;
  for (const solid of colliders) {
    const hit = interval(solid,origin,direction,() => radius);
    if (!hit || hit.leave < 0 || hit.enter > distance) continue;
    const contact = Math.max(0,hit.enter);
    if (contact <= nearest) { nearest = contact; colliderId = solid.id; }
  }
  const safeDistance = colliderId ? Math.max(0,nearest - clearance) : distance;
  return { position:{ x:origin.x + direction.x * safeDistance, y:origin.y + direction.y * safeDistance, z:origin.z + direction.z * safeDistance },
    distance:safeDistance, blocked:colliderId !== null, colliderId };
}
