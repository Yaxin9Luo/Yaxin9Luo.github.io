import './style.css';
import './journal.css';
import {Interface} from './ui.js';
import {createLoadingCoordinator} from './loading-coordinator.js';
import {resourceLoader,redactResourceURL} from './resource-loader.js';
import {cvForLanguage} from './content.js';

const ui=new Interface(document.querySelector('#app'));
let attachedGame=null;
const lifecycle=[],stages=[];
const callbacks={
  onFrame:s=>{if(attachedGame){ui.update(s);ui.applyExhibitState(s.exhibition);}},
  onMessage:m=>ui.toast(m),onInteract:id=>ui.open(id),onExhibit:id=>ui.openPaper(id),
  onExhibition:(id,options)=>ui.openExhibition(id,options),onExhibitionDetail:(id,options)=>ui.openProject(id,options),onExhibitionMedia:()=>ui.enlargeMedia(),
  onArtifact:action=>{if(action.kind==='cv')window.open(cvForLanguage(ui.options.lang),'_blank','noopener,noreferrer');else ui.open(action.id);},
  onTimeChange:mode=>ui.applyTimeMode?.(mode),onProgress:p=>ui.snapshot.progress=p,onTravel:()=>{},
};
const coordinator=createLoadingCoordinator({
  onChange:state=>{lifecycle.push({...state});if(lifecycle.length>150)lifecycle.shift();ui.applyLoadingState(state);},
  createCore:async context=>{
    // This is the only game import: no renderer, model or landscape traffic before intent.
    const {Game}=await import('./game.js');
    context.signal.throwIfAborted();
    return Game.createAsync(ui.canvas,callbacks,ui.options,{...context,onProgress:event=>{
      if(['assembly','assembling','first-frame','enhancements'].includes(event.phase)){stages.push({...event,attemptId:context.attemptId,elapsedMs:performance.now()-(context.deadline-20000)});if(stages.length>100)stages.shift();}
      context.onProgress(event);
    }});
  },
});
const unsubscribe=resourceLoader.subscribe(event=>{
  if(coordinator.snapshot.availability==='interactive')coordinator.enhancement(event);
});
function diagnostics(){
  return {version:1,lifecycle:lifecycle.map(state=>({
    attemptId:state.attemptId,availability:state.availability,enhancements:state.enhancements,phase:state.phase,
    activeResource:state.activeResource?redactResourceURL(typeof state.activeResource==='string'?state.activeResource:state.activeResource.url||state.activeResource.id):null,
    receivedBytes:state.receivedBytes,totalBytes:state.totalBytes,slow:state.slow,
    error:state.error?{type:state.error.type,status:state.error.status,elapsedMs:state.error.elapsedMs}:undefined,
  })),stages:stages.map(event=>({...event})),resources:resourceLoader.diagnostics()};
}
function downloadDiagnostics(){
  const url=URL.createObjectURL(new Blob([JSON.stringify(diagnostics(),null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='portfolio-loading-diagnostics.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
ui.setLoadingController({
  start:()=>coordinator.start().then(game=>{if(game&&attachedGame!==game){attachedGame=game;ui.setGame(game);}}),
  cancel:()=>coordinator.cancel(),downloadDiagnostics,
});
window.portfolioLoading={snapshot:()=>coordinator.snapshot,diagnostics,downloadDiagnostics};
window.addEventListener('pagehide',event=>{if(!event.persisted){unsubscribe();coordinator.dispose();}});
