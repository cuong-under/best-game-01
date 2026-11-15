// The autopilot that plays the real rules, and the scene staging for screenshots.
// The autopilot has no special powers: it places towers on ranked tiles, upgrades
// when it can afford to, and starts waves, all through the world's own commands.
// stageShot() plays a fresh world forward to a named moment so every screenshot is a
// genuine frame of a real game. This file is DOM-free, so the same autopilot can run
// headless in Node to test the balance.

import { GRID, PATH, TOWERS, TOTAL_WAVES, isLanternTile, isRoadTile, tileCentre } from './config.js';
import { createRandom } from './random.js';
import { canUpgrade, upgradeCost } from './towers.js';
import { EVENT_PLACED, createWorld } from './world.js';

const PROFILES = {
  strong: {
    plan: ['ember', 'ember', 'frost', 'ember', 'storm', 'ember', 'frost', 'ember', 'storm', 'frost', 'ember', 'storm', 'ember', 'frost', 'storm', 'ember'],
    upgradeAfter: 5,
    reserve: 30,
    earlyCall: true,
  },
  decent: {
    plan: ['ember', 'ember', 'ember', 'frost', 'ember', 'ember', 'storm', 'ember', 'frost', 'ember', 'ember'],
    upgradeAfter: 8,
    reserve: 130,
    earlyCall: false,
  },
  passive: {
    plan: [],
    upgradeAfter: 99,
    reserve: 0,
    earlyCall: false,
  },
};

function pathSamples() {
  const samples = [];
  for (let i = 0; i < PATH.length - 1; i += 1) {
    const from = PATH[i];
    const to = PATH[i + 1];
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const count = Math.max(1, Math.floor(length / 16));
    for (let j = 0; j < count; j += 1) {
      samples.push({
        x: from[0] + ((to[0] - from[0]) * j) / count,
        y: from[1] + ((to[1] - from[1]) * j) / count,
      });
    }
  }
  return samples;
}

/** Buildable tiles ranked by how much road a tower there can watch. */
export function rankBuildTiles() {
  const samples = pathSamples();
  const scored = [];
  for (let row = 0; row < GRID.rows; row += 1) {
    for (let col = 0; col < GRID.cols; col += 1) {
      if (isRoadTile(col, row) || isLanternTile(col, row)) continue;
      const centre = tileCentre(col, row);
      let score = 0;
      for (const sample of samples) {
        const dist = Math.hypot(sample.x - centre.x, sample.y - centre.y);
        if (dist < 150) score += 1 - dist / 150;
      }
      scored.push({ col, row, score });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.row - b.row || a.col - b.col);
  return scored;
}

export function createAutopilot(profileName) {
  const profile = PROFILES[profileName] || PROFILES.decent;
  let tiles = null;
  let tileIndex = 0;
  let lastAct = -1;

  function decide(world) {
    const state = world.state;
    if (state.outcome) return;
    if (profileName === 'passive') {
      if (state.wave.phase === 'idle' && state.wave.wave < TOTAL_WAVES) world.startWave();
      return;
    }
    if (!tiles) tiles = rankBuildTiles();
    if (state.wave.phase === 'idle' && state.wave.wave < TOTAL_WAVES) {
      world.startWave();
    } else if (profile.earlyCall && state.wave.phase !== 'idle' && state.wave.wave < TOTAL_WAVES && state.towers.length >= 9 && world.enemiesLeft() <= 3) {
      world.startWave();
    }
    if (state.time - lastAct < 0.3) return;
    if (state.towers.length < profile.plan.length) {
      const type = profile.plan[state.towers.length];
      if (state.embers >= TOWERS[type].cost) {
        while (tileIndex < tiles.length && world.placementProblem(type, tiles[tileIndex].col, tiles[tileIndex].row)) {
          tileIndex += 1;
        }
        if (tileIndex < tiles.length) {
          const tile = tiles[tileIndex];
          if (world.placeTower(type, tile.col, tile.row) & EVENT_PLACED) {
            tileIndex += 1;
            lastAct = state.time;
            return;
          }
          tileIndex += 1;
        }
      }
    }
    if (state.towers.length >= profile.upgradeAfter) {
      let best = null;
      let bestCost = Infinity;
      for (const tower of state.towers) {
        if (!canUpgrade(tower)) continue;
        const cost = upgradeCost(tower);
        if (cost < bestCost && state.embers >= cost + profile.reserve) {
          best = tower;
          bestCost = cost;
        }
      }
      if (best) {
        world.upgradeTowerById(best.id);
        lastAct = state.time;
      }
    }
  }

  return { decide };
}

/**
 * Play a fresh world forward to a named scene. Returns the screen the game should
 * be showing when the screenshot is taken. The world keeps its state, so the frame
 * rendered afterwards is the real position reached by the autopilot.
 */
export function stageShot(name, world) {
  const dt = 1 / 60;
  if (name === 'title') {
    const pilot = createAutopilot('decent');
    let spawnIn = 0;
    for (let t = 0; t < 16; t += dt) {
      pilot.decide(world);
      spawnIn -= dt;
      if (spawnIn <= 0 && world.state.enemies.length < 6) {
        world.spawnEnemy('shade', 1);
        spawnIn = 2.2;
      }
      world.step(dt, true);
    }
    return { screen: 'title' };
  }
  const pilot = createAutopilot('strong');
  const leadProgress = () => world.state.enemies.reduce((best, enemy) => Math.max(best, enemy.progress), 0);
  if (name === 'action') {
    for (let t = 0; t < 240 && !world.state.outcome; t += dt) {
      pilot.decide(world);
      world.step(dt, false);
      if (world.state.wave.wave >= 3 && world.state.enemies.length >= 6 && leadProgress() >= 1500) break;
    }
    return { screen: 'play' };
  }
  if (name === 'onslaught') {
    for (let t = 0; t < 650 && !world.state.outcome; t += dt) {
      pilot.decide(world);
      world.step(dt, false);
      // Several enemies deep on the road, not just stragglers from the last wave.
      const deep = world.state.enemies.filter((enemy) => enemy.progress >= 1800).length;
      if (world.state.wave.wave >= 7 && world.state.enemies.length >= 12 && deep >= 4) break;
    }
    return { screen: 'play' };
  }
  if (name === 'victory') {
    for (let t = 0; t < 900 && !world.state.outcome; t += dt) {
      pilot.decide(world);
      world.step(dt, false);
    }
    return { screen: world.state.outcome === 'won' ? 'won' : 'lost' };
  }
  return { screen: 'play' };
}

/** Headless full game for balance testing: returns the outcome and the numbers. */
export function runAutopilotGame(seed, profileName) {
  const world = createWorld(createRandom(seed));
  const pilot = createAutopilot(profileName);
  const dt = 1 / 60;
  let steps = 0;
  const maxSteps = 60 * 900;
  while (!world.state.outcome && steps < maxSteps) {
    pilot.decide(world);
    world.step(dt, false);
    steps += 1;
  }
  const state = world.state;
  return {
    seed,
    profile: profileName,
    outcome: state.outcome || 'timeout',
    score: state.score,
    wave: state.wave.wave,
    kills: state.kills,
    leaks: state.leaks,
    towers: state.towers.length,
    coreHp: state.coreHp,
    time: Math.round(state.time),
  };
}
