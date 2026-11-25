// Pose tables of the campaign's mass that are not in base-poses.js (shared by the code-drawn campaign.js and the
// generated mass loader, so that neither needs the other): the dagger-axe and the great axe carried upright, blade
// forward; the Zhou spear carried upright.
import { KIND } from './base-poses.js';
KIND['shang:cge'] = { ...KIND.axe, base: { ...KIND.axe.base, w: -86 } };
KIND['zhou:cspear'] = { ...KIND['zhou:spear'], base: { ...KIND['zhou:spear'].base, w: -84 } };
// either table serves either side (a Shang shield-man carries his spear upright, a Zhou strongman his club like the axe):
// the plain names are what the loaders find when a side has no table of its own
KIND.cge = KIND['zhou:cge'] = KIND['shang:cge'];
KIND.cspear = KIND['shang:cspear'] = KIND['zhou:cspear'];
