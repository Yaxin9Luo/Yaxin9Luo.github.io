// Shared with the static portfolio shell: this module must not import the engine.
export const TIME_PERIODS = Object.freeze(['dawn', 'day', 'noon', 'dusk', 'night', 'midnight']);
export const TIME_MODES = Object.freeze(['auto', ...TIME_PERIODS]);
export const TIME_PHASES = Object.freeze({ dawn: .265, day: .46, noon: .5, dusk: .735, night: .86, midnight: 0 });
export const DAY_DURATION_SECONDS = 240;
export const wrapPhase = value => ((value % 1) + 1) % 1;
export const normalizeTimeMode = value => TIME_MODES.includes(value) ? value : 'auto';

export function formatClockTime(phase) {
  const minutes = Math.floor(wrapPhase(Number.isFinite(phase) ? phase : TIME_PHASES.night) * 1440 + 1e-8) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function periodForPhase(phase) {
  const hour = wrapPhase(Number.isFinite(phase) ? phase : TIME_PHASES.night) * 24;
  if (hour < 5 || hour >= 22) return 'midnight';
  if (hour < 8) return 'dawn';
  if (hour < 11.5) return 'day';
  if (hour < 13) return 'noon';
  if (hour < 17) return 'day';
  if (hour < 19) return 'dusk';
  return 'night';
}
