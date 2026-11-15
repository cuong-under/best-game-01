// The game's rules and state, with no drawing and no browser in it: towers, enemies,
// projectiles, waves, embers, the lantern's health and the win/lose verdict. step()
// advances one fixed step and reports what happened as bit flags, so the caller can
// play sounds and announcements without the world knowing about screens or audio.

import {
  CORE_HP,
  GRID,
  MAX_TOWERS,
  SCORE,
  START_EMBERS,
  TOWERS,
  TOTAL_WAVES,
  earlyCallBonus,
  isLanternTile,
  isRoadTile,
  waveClearBonus,
} from './config.js';
import { createEnemy, damageEnemy, moveEnemy, resetEnemyIds, slowEnemy, splitEnemy } from './enemies.js';
import {
  canUpgrade,
  createTower,
  projectileStep,
  resetTowerIds,
  towerSellValue,
  towerStep,
  upgradeCost,
  upgradeTower,
} from './towers.js';
import { buildSpawnQueue, createWaveState, startWaveState, waveRemaining, waveSpawnsDue } from './waves.js';
import {
  createFloaterPool,
  createParticlePool,
  spawnBurst,
  spawnFloater,
  spawnMuzzle,
  spawnPuff,
  spawnRing,
  updateFloaters,
  updateParticles,
} from './particles.js';
import { randomInt, randomRange } from './random.js';

export const EVENT_SHOT = 1;
export const EVENT_KILL = 2;
export const EVENT_CORE_HIT = 4;
export const EVENT_WAVE_START = 8;
export const EVENT_WAVE_CLEAR = 16;
export const EVENT_WIN = 32;
export const EVENT_LOSE = 64;
export const EVENT_SPLIT = 128;
export const EVENT_DENIED = 256;
export const EVENT_PLACED = 512;
export const EVENT_UPGRADED = 1024;
export const EVENT_SOLD = 2048;

const DECOR_KINDS = ['tuft', 'tuft', 'flower', 'rock', 'pebble', 'tuft', 'glowshroom'];

export function createWorld(random) {
  const state = {
    time: 0,
    embers: START_EMBERS,
    coreHp: CORE_HP,
    maxCoreHp: CORE_HP,
    score: 0,
    kills: 0,
    leaks: 0,
    towers: [],
    enemies: [],
    projectiles: [],
    particles: createParticlePool(),
    floaters: createFloaterPool(),
    wave: createWaveState(),
    outcome: null,
    shake: 0,
    selectedId: null,
    placing: null,
    decor: [],
    wavesCleared: 0,
    towersBuilt: 0,
    embersEarned: 0,
  };

  function buildDecor() {
    const decor = [];
    for (let row = 0; row < GRID.rows; row += 1) {
      for (let col = 0; col < GRID.cols; col += 1) {
        if (isRoadTile(col, row) || isLanternTile(col, row)) continue;
        if (random() > 0.42) continue;
        decor.push({
          x: (col + 0.5) * GRID.tile + randomRange(random, -13, 13),
          y: (row + 0.5) * GRID.tile + randomRange(random, -13, 13),
          kind: DECOR_KINDS[randomInt(random, 0, DECOR_KINDS.length - 1)],
          variant: random(),
          scale: randomRange(random, 0.7, 1.25),
        });
      }
    }
    return decor;
  }

  function reset() {
    state.time = 0;
    state.embers = START_EMBERS;
    state.coreHp = CORE_HP;
    state.maxCoreHp = CORE_HP;
    state.score = 0;
    state.kills = 0;
    state.leaks = 0;
    state.towers.length = 0;
    state.enemies.length = 0;
    state.projectiles.length = 0;
    state.particles.length = 0;
    state.floaters.length = 0;
    state.wave = createWaveState();
    state.outcome = null;
    state.shake = 0;
    state.selectedId = null;
    state.placing = null;
    state.wavesCleared = 0;
    state.towersBuilt = 0;
    state.embersEarned = 0;
    state.decor = buildDecor();
    resetEnemyIds();
    resetTowerIds();
  }

  function towerAtTile(col, row) {
    for (const tower of state.towers) {
      if (tower.col === col && tower.row === row) return tower;
    }
    return null;
  }

  function towerAtPoint(x, y) {
    let best = null;
    let bestDist = 30;
    for (const tower of state.towers) {
      const dist = Math.hypot(tower.x - x, tower.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = tower;
      }
    }
    return best;
  }

  function placementProblem(type, col, row) {
    if (col < 0 || col >= GRID.cols || row < 0 || row >= GRID.rows) return 'outside';
    if (isRoadTile(col, row)) return 'road';
    if (isLanternTile(col, row)) return 'lantern';
    if (towerAtTile(col, row)) return 'occupied';
    if (state.towers.length >= MAX_TOWERS) return 'limit';
    if (state.embers < TOWERS[type].cost) return 'poor';
    return null;
  }

  function placeTower(type, col, row) {
    if (placementProblem(type, col, row)) return EVENT_DENIED;
    state.embers -= TOWERS[type].cost;
    const tower = createTower(type, col, row);
    state.towers.push(tower);
    state.towersBuilt += 1;
    state.selectedId = tower.id;
    spawnRing(state.particles, tower.x, tower.y, TOWERS[type].color, 34);
    spawnPuff(state.particles, tower.x, tower.y, '#8a7aa8', 6, 10);
    return EVENT_PLACED;
  }

  function upgradeTowerById(id) {
    const tower = state.towers.find((t) => t.id === id);
    if (!tower || !canUpgrade(tower)) return EVENT_DENIED;
    const cost = upgradeCost(tower);
    if (state.embers < cost) return EVENT_DENIED;
    state.embers -= cost;
    upgradeTower(tower);
    spawnRing(state.particles, tower.x, tower.y, '#ffd76a', 40);
    spawnBurst(state.particles, tower.x, tower.y - 10, '#ffd76a', 10, 60, 0.5, 3);
    return EVENT_UPGRADED;
  }

  function sellTowerById(id) {
    const index = state.towers.findIndex((t) => t.id === id);
    if (index === -1) return EVENT_DENIED;
    const tower = state.towers[index];
    state.embers += towerSellValue(tower);
    spawnFloater(state.floaters, tower.x, tower.y - 24, `+${towerSellValue(tower)}`, '#f2c94c', 16);
    spawnPuff(state.particles, tower.x, tower.y, '#8a7aa8', 8, 12);
    state.towers.splice(index, 1);
    if (state.selectedId === id) state.selectedId = null;
    return EVENT_SOLD;
  }

  function selectedTower() {
    return state.towers.find((t) => t.id === state.selectedId) || null;
  }

  function startWave() {
    if (state.outcome) return 0;
    if (state.wave.phase === 'idle') {
      const next = state.wave.wave + 1;
      if (next > TOTAL_WAVES) return 0;
      startWaveState(state.wave, next);
      return EVENT_WAVE_START;
    }
    // Calling early: the next wave's march joins the road at once, for a bonus.
    if (state.wave.wave < TOTAL_WAVES) {
      const next = state.wave.wave + 1;
      const bonus = earlyCallBonus(next);
      state.embers += bonus;
      state.embersEarned += bonus;
      spawnFloater(state.floaters, 440, 70, `Early call +${bonus}`, '#f2c94c', 17);
      mergeEarlyWave(state.wave, next);
      return EVENT_WAVE_START;
    }
    return 0;
  }

  function mergeEarlyWave(waveState, wave) {
    // Merge the next wave's spawns into the running queue, keeping the clock.
    const extra = buildSpawnQueue(wave);
    for (const spawn of extra) {
      spawn.at += waveState.elapsed;
      spawn.wave = wave;
    }
    waveState.queue.push(...extra);
    waveState.queue.sort((a, b) => a.at - b.at);
    waveState.wave = wave;
    waveState.total += extra.length;
    if (waveState.phase === 'marching') waveState.phase = 'spawning';
  }

  function spawnEnemy(type, wave) {
    const enemy = createEnemy(type, wave, random);
    state.enemies.push(enemy);
    return enemy;
  }

  function killEnemy(enemy, harmless, tower) {
    enemy.dead = true;
    state.kills += 1;
    if (tower) tower.kills += 1;
    if (!harmless) {
      state.embers += enemy.def.bounty;
      state.embersEarned += enemy.def.bounty;
      state.score += enemy.def.bounty * SCORE.killMultiplier;
      spawnFloater(state.floaters, enemy.x, enemy.y - 18, `+${enemy.def.bounty}`, '#f2c94c', 14);
    }
    spawnBurst(state.particles, enemy.x, enemy.y, enemy.def.rim, 10, 90, 0.5, 3);
    spawnPuff(state.particles, enemy.x, enemy.y, '#2a2440', 5, 12);
    if (enemy.def.splitsInto) {
      const children = splitEnemy(enemy, state.wave.wave || 1, random);
      for (const child of children) state.enemies.push(child);
      return EVENT_SPLIT;
    }
    return 0;
  }

  function hitEnemy(enemy, damage, slow, slowTime, harmless, tower) {
    const died = damageEnemy(enemy, damage);
    if (slow > 0) slowEnemy(enemy, slow, slowTime);
    if (damage >= 8) spawnFloater(state.floaters, enemy.x + randomRange(random, -8, 8), enemy.y - 16, String(Math.round(damage)), '#f2ead8', 12);
    if (died) return killEnemy(enemy, harmless, tower);
    return 0;
  }

  function step(dt, harmless) {
    let events = 0;
    let shots = 0;
    if (state.outcome) {
      updateParticles(state.particles, dt);
      updateFloaters(state.floaters, dt);
      return { events, shots };
    }
    state.time += dt;
    state.shake = Math.max(0, state.shake - dt * 14);

    for (const spawn of waveSpawnsDue(state.wave, dt)) {
      spawnEnemy(spawn.type, spawn.wave || state.wave.wave);
    }

    for (const enemy of state.enemies) {
      if (enemy.dead || enemy.reachedLantern) continue;
      if (moveEnemy(enemy, dt)) {
        enemy.reachedLantern = true;
        if (!harmless) {
          state.coreHp -= enemy.def.core;
          state.leaks += 1;
          state.shake = 8;
          spawnRing(state.particles, enemy.x, enemy.y, '#ff6b4a', 46);
          spawnBurst(state.particles, enemy.x, enemy.y, '#ff6b4a', 12, 110, 0.5, 3);
          spawnFloater(state.floaters, enemy.x, enemy.y - 26, `-${enemy.def.core}`, '#ff6b6b', 18);
          events |= EVENT_CORE_HIT;
        }
      }
    }

    for (const tower of state.towers) {
      const projectile = towerStep(tower, state.enemies, dt);
      if (projectile) {
        state.projectiles.push(projectile);
        spawnMuzzle(state.particles, projectile.x, projectile.y, tower.def.color);
        shots += 1;
        events |= EVENT_SHOT;
      }
    }

    for (const projectile of state.projectiles) {
      if (projectile.dead) continue;
      const result = projectileStep(projectile, dt);
      if (result === 'fizzle') {
        projectile.dead = true;
        continue;
      }
      if (result !== 'hit') continue;
      projectile.dead = true;
      const target = projectile.target;
      spawnBurst(state.particles, target.x, target.y, projectile.type === 'storm' ? '#c9a7ff' : projectile.type === 'frost' ? '#7fd4ff' : '#ff9a3c', projectile.splash ? 8 : 4, 70, 0.35, 2.5);
      events |= hitEnemy(target, projectile.damage, projectile.slow, projectile.slowTime, harmless, projectile.tower);
      if (projectile.splash > 0) {
        spawnRing(state.particles, target.x, target.y, '#c9a7ff', projectile.splash);
        for (const other of state.enemies) {
          if (other === target || other.dead || other.reachedLantern) continue;
          if (Math.hypot(other.x - target.x, other.y - target.y) <= projectile.splash) {
            events |= hitEnemy(other, Math.round(projectile.damage * 0.6), 0, 0, harmless, projectile.tower);
          }
        }
      }
    }

    state.enemies = state.enemies.filter((e) => !e.dead && !e.reachedLantern);
    state.projectiles = state.projectiles.filter((p) => !p.dead);
    updateParticles(state.particles, dt);
    updateFloaters(state.floaters, dt);

    if (!harmless && state.coreHp <= 0) {
      state.coreHp = 0;
      state.outcome = 'lost';
      events |= EVENT_LOSE;
      return { events, shots };
    }

    if (!harmless && state.wave.phase !== 'idle' && state.wave.queue.length === 0 && state.enemies.length === 0) {
      if (state.wave.wave >= TOTAL_WAVES) {
        state.outcome = 'won';
        state.score += SCORE.victory + state.coreHp * SCORE.coreHealth;
        events |= EVENT_WIN;
      } else {
        const bonus = waveClearBonus(state.wave.wave);
        state.embers += bonus;
        state.embersEarned += bonus;
        state.score += SCORE.waveClear;
        state.wavesCleared = state.wave.wave;
        state.wave.phase = 'idle';
        spawnFloater(state.floaters, 440, 90, `Wave clear +${bonus}`, '#8fe08a', 17);
        events |= EVENT_WAVE_CLEAR;
      }
    }
    return { events, shots };
  }

  function enemiesLeft() {
    return waveRemaining(state.wave, state.enemies.length);
  }

  reset();
  return {
    state,
    reset,
    step,
    placeTower,
    upgradeTowerById,
    sellTowerById,
    selectedTower,
    startWave,
    spawnEnemy,
    towerAtTile,
    towerAtPoint,
    placementProblem,
    enemiesLeft,
  };
}
