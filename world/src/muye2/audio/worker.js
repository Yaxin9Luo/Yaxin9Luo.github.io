// Renders the instrument bank off the page's thread. Asked for a list of [key, name, arg], it renders each and posts
// it back as it is done (the array's memory is transferred, not copied), so the first sounds are ready in milliseconds
// and the frame never waits on a render.
import {render, hall, RATE} from './instruments.js';

self.onmessage = ({data}) => {
  if (data.hall) { const [L, R] = hall(RATE); self.postMessage({hall: [L, R]}, [L.buffer, R.buffer]); }
  for (const [key, name, arg] of data.list || []) {
    let x = null;
    try { x = render(name, arg, RATE); } catch (err) { self.postMessage({key, error: String(err && err.message || err)}); continue; }
    self.postMessage({key, x}, [x.buffer]);
  }
  self.postMessage({done: data.batch});
};
