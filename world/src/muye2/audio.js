// Sound for Muye: a Zhou court orchestra going to war, all synthesized, no audio files (see audio/engine.js).
// This is the module the page imports; its calls are the ones the page has always made, plus:
//   audio.event(e, hero)  every sim event, first thing in the page's handle(): voices what the page does not
//                         (the music's cues, the spoils' workings, the afflictions, the finale) and places sounds in stereo
//   audio.crowd(n)        the living foe count, each frame: how full the music is
//   audio.pause(on)       the pause sheet: the music steps back
//   audio.leave()         the run is left for the camp: the music stops
// The music starts only after a gesture (ensure() makes the context), and follows the sound control and the volume.
// The instruments render in a worker from page load, so no frame waits on them.
import {createSound} from './audio/engine.js';

export function createAudio() { return createSound(); }
