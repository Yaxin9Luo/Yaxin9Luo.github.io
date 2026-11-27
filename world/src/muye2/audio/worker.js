// Renders the instrument bank off the page's thread. Asked for a list of [key, name, arg], it renders each and posts
// it back as it is done (the array's memory is transferred, not copied), so the first sounds are ready in milliseconds
// and the frame never waits on a render.
import {render, hall, hallBig, RATE} from './instruments.js';

self.onmessage = ({data}) => {
  if (data.hall) { const [L, R] = hall(RATE), [L2, R2] = hallBig(RATE); self.postMessage({hall: [L, R, L2, R2]}, [L.buffer, R.buffer, L2.buffer, R2.buffer]); }
  for (const [key, name, arg] of data.list || []) {
    let x = null;
    try { x = render(name, arg); } catch (err) { self.postMessage({key, error: String(err && err.message || err)}); continue; }
    self.postMessage({key, x}, [x.buffer]);
  }
  self.postMessage({done: data.batch});
};
