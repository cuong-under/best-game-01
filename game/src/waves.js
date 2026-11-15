// Wave composition and the spawn queue: what marches, in what order, and when the
// road is clear again. The wave list itself lives in config.js.

import { TOTAL_WAVES, WAVES } from './config.js';

export function waveCount() {
  return TOTAL_WAVES;
}

export function waveDef(wave) {
  return WAVES[wave - 1] || null;
}

/** Expand a wave's groups into a timed queue of spawns, earliest first. */
export function buildSpawnQueue(wave) {
  const def = waveDef(wave);
  const queue = [];
  if (!def) return queue;
  for (const group of def.groups) {
    for (let i = 0; i < group.count; i += 1) {
      queue.push({ type: group.type, at: group.delay + i * group.gap, wave });
    }
  }
  queue.sort((a, b) => a.at - b.at);
  return queue;
}

/** How many enemies a wave holds in total (before splitters split). */
export function waveSize(wave) {
  const def = waveDef(wave);
  if (!def) return 0;
  return def.groups.reduce((total, group) => total + group.count, 0);
}

export function createWaveState() {
  return {
    wave: 0,
    phase: 'idle',
    queue: [],
    elapsed: 0,
    spawned: 0,
    total: 0,
  };
}

export function startWaveState(state, wave) {
  state.wave = wave;
  state.phase = 'spawning';
  state.queue = buildSpawnQueue(wave);
  state.elapsed = 0;
  state.spawned = 0;
  state.total = state.queue.length;
}

/**
 * Advance the spawn clock one step. Returns the spawn entries due now (each with its
 * type and wave); the queue keeps its place, so calling this every step releases
 * enemies on schedule.
 */
export function waveSpawnsDue(state, dt) {
  const due = [];
  if (state.phase !== 'spawning') return due;
  state.elapsed += dt;
  while (state.queue.length > 0 && state.queue[0].at <= state.elapsed) {
    due.push(state.queue.shift());
    state.spawned += 1;
  }
  if (state.queue.length === 0) state.phase = 'marching';
  return due;
}

export function waveRemaining(state, enemiesAlive) {
  return state.queue.length + enemiesAlive;
}
