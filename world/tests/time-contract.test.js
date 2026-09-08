import test from 'node:test';
import assert from 'node:assert/strict';
import {TIME_MODES,TIME_PERIODS,TIME_PHASES,normalizeTimeMode,formatClockTime,periodForPhase} from '../src/time-contract.js';

test('saved legacy modes retain their fixed versus auto meaning and six presets are available',()=>{
  for(const value of ['auto','dawn','day','dusk','night'])assert.equal(normalizeTimeMode(value),value);
  for(const value of [undefined,null,'noonish',{},false])assert.equal(normalizeTimeMode(value),'auto');
  assert.deepEqual(TIME_PERIODS,['dawn','day','noon','dusk','night','midnight']);
  for(const period of TIME_PERIODS){assert.ok(TIME_MODES.includes(period));assert.equal(normalizeTimeMode(period),period);assert.equal(periodForPhase(TIME_PHASES[period]),period);}
});

test('HH:mm wraps exactly at midnight and labels follow hours rather than palette interpolation',()=>{
  assert.equal(formatClockTime(0),'00:00');assert.equal(formatClockTime(1),'00:00');assert.equal(formatClockTime(.5),'12:00');
  assert.equal(formatClockTime(-1/1440),'23:59');assert.equal(formatClockTime(1439/1440),'23:59');
  assert.equal(periodForPhase(7/24),'dawn');assert.equal(periodForPhase(10/24),'day');assert.equal(periodForPhase(12/24),'noon');
  assert.equal(periodForPhase(18/24),'dusk');assert.equal(periodForPhase(21/24),'night');assert.equal(periodForPhase(23/24),'midnight');
  assert.equal(periodForPhase(1-1e-8),periodForPhase(1e-8));
});
