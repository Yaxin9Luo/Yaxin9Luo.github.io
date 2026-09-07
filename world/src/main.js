import './style.css';
import './journal.css';
import {Interface} from './ui.js';

const ui=new Interface(document.querySelector('#app'));
// Portfolio content becomes interactive before the optional 3D engine loads.
Promise.all([import('./game.js'),import('./landscape.js').then(m=>m.loadLandscapeAssets()),import('./models.js').then(m=>m.loadArchitectureAssets?.()),import('./characters.js').then(m=>m.loadCharacterAssets())]).then(([{Game}])=>{
  const game=new Game(ui.canvas,{onFrame:s=>ui.update(s),onMessage:m=>ui.toast(m),onInteract:id=>ui.open(id),onExhibit:id=>ui.openPaper(id),onProgress:p=>ui.snapshot.progress=p,onTravel:()=>{}},ui.options);
  ui.setGame(game);
  if(ui.view)game.setPaused(true);
}).catch(error=>ui.fail(error));
