// Boot, the fixed-step loop, screens and the wiring between input, world, audio and
// rendering. Shot mode (?shot=<scene>&seed=<n>) stages a scene through the real rules
// and then holds the frame still, setting window.__shotReady after two paints so a
// screenshot driver knows the canvas is settled.

import { BEST_KEY, FIELD, GRID, SIDEBAR, TOWER_ORDER } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_CORE_HIT,
  EVENT_DENIED,
  EVENT_KILL,
  EVENT_LOSE,
  EVENT_PLACED,
  EVENT_SHOT,
  EVENT_SOLD,
  EVENT_UPGRADED,
  EVENT_WAVE_CLEAR,
  EVENT_WAVE_START,
  EVENT_WIN,
  createWorld,
} from './world.js';
import { spawnEmberMote } from './particles.js';
import { createRenderer } from './render.js';
import {
  ACTION_CANCEL,
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  ACTION_SELL,
  ACTION_SPEED,
  ACTION_START_WAVE,
  ACTION_TOWER_1,
  ACTION_TOWER_2,
  ACTION_TOWER_3,
  ACTION_UPGRADE,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { hitTestEndPanel, hitTestSidebar } from './hud.js';
import { createAutopilot, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotMode = Boolean(shotName);
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;
const random = shotMode ? createRandom(seed) : createRandom((Date.now() % 2147483647) || 1);
const world = createWorld(random);
// The title screen runs an attract game behind its panel; the HUD above it shows a
// fresh, unplayed run instead, so the title never claims a wave is already running.
const freshHudWorld = createWorld(createRandom(12345));
const renderer = createRenderer(canvas);
const input = createInput(canvas, renderer.toLogical);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function writeBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // A private window without storage still plays fine.
  }
}

let screen = 'title';
let speed = 1;
let muted = false;
let best = readBest();
let placing = null;
let endTime = 0;
let elapsed = 0;
let moteTimer = 0;
let lastShotSound = 0;
let lastKillSound = 0;
let paints = 0;
const attract = createAutopilot('decent');
let attractSpawnIn = 0;

renderer.buildBackground(world);

if (shotMode) {
  const staged = stageShot(shotName, world);
  screen = staged.screen;
  if (screen === 'won' || screen === 'lost') endTime = -10;
}

// A read handle for automated checks; the game never reads it back.
window.__world = world;
window.__screen = () => screen;

function playEventSounds(events, shots) {
  if (shotMode) return;
  if (events & EVENT_PLACED) audio.play('place');
  if (events & EVENT_UPGRADED) audio.play('upgrade');
  if (events & EVENT_SOLD) audio.play('sell');
  if (events & EVENT_DENIED) audio.play('denied');
  if (events & EVENT_WAVE_START) audio.play('wave');
  if (events & EVENT_WAVE_CLEAR) audio.play('clear');
  if (events & EVENT_CORE_HIT) audio.play('coreHit');
  if (events & EVENT_WIN) audio.play('victory');
  if (events & EVENT_LOSE) audio.play('defeat');
  if (shots > 0 && elapsed - lastShotSound > 0.09) {
    audio.play('shoot');
    lastShotSound = elapsed;
  }
  if (events & EVENT_KILL && elapsed - lastKillSound > 0.06) {
    audio.play('die');
    lastKillSound = elapsed;
  }
}

function finishRun() {
  endTime = elapsed;
  if (world.state.score > best) {
    best = world.state.score;
    writeBest(best);
  }
}

function startRun() {
  world.reset();
  renderer.buildBackground(world);
  placing = null;
  speed = 1;
  screen = 'play';
  audio.unlock();
  audio.startMusic();
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
}

function handleSidebarAction(action) {
  switch (action.kind) {
    case 'mute':
      toggleMute();
      break;
    case 'card':
      if (screen !== 'play') break;
      placing = placing === action.type ? null : action.type;
      world.state.selectedId = null;
      audio.play('click');
      break;
    case 'upgrade': {
      if (screen !== 'play') break;
      const selected = world.selectedTower();
      if (selected) playEventSounds(world.upgradeTowerById(selected.id), 0);
      break;
    }
    case 'sell': {
      if (screen !== 'play') break;
      const selected = world.selectedTower();
      if (selected) playEventSounds(world.sellTowerById(selected.id), 0);
      break;
    }
    case 'start':
      if (screen !== 'play') break;
      playEventSounds(world.startWave(), 0);
      break;
    case 'speed':
      speed = speed === 1 ? 2 : 1;
      audio.play('click');
      break;
    case 'pause':
      if (screen === 'play') screen = 'paused';
      else if (screen === 'paused') screen = 'play';
      audio.play('click');
      break;
    case 'restart':
      startRun();
      break;
    default:
      break;
  }
}

function handleFieldClick(x, y) {
  if (screen === 'title') {
    startRun();
    return;
  }
  if (screen === 'paused') {
    screen = 'play';
    return;
  }
  if (screen === 'won' || screen === 'lost') {
    if (elapsed - endTime < 0.6) return;
    if (hitTestEndPanel(x, y)) startRun();
    return;
  }
  const col = Math.floor(x / GRID.tile);
  const row = Math.floor(y / GRID.tile);
  if (placing) {
    const events = world.placeTower(placing, col, row);
    playEventSounds(events, 0);
    if (events & EVENT_PLACED) placing = null;
    return;
  }
  const tower = world.towerAtPoint(x, y);
  world.state.selectedId = tower ? tower.id : null;
  if (tower) audio.play('click');
}

function handleClick(click) {
  if (click.x >= SIDEBAR.x) {
    const action = hitTestSidebar(click.x, click.y);
    if (action) {
      handleSidebarAction(action);
      return;
    }
  }
  handleFieldClick(click.x, click.y);
}

function handleActions(actions) {
  if (actions & ACTION_MUTE) toggleMute();
  if (actions & ACTION_TOWER_1 && screen === 'play') {
    placing = placing === TOWER_ORDER[0] ? null : TOWER_ORDER[0];
    world.state.selectedId = null;
  }
  if (actions & ACTION_TOWER_2 && screen === 'play') {
    placing = placing === TOWER_ORDER[1] ? null : TOWER_ORDER[1];
    world.state.selectedId = null;
  }
  if (actions & ACTION_TOWER_3 && screen === 'play') {
    placing = placing === TOWER_ORDER[2] ? null : TOWER_ORDER[2];
    world.state.selectedId = null;
  }
  if (actions & ACTION_CANCEL) {
    if (placing) placing = null;
    else if (world.state.selectedId) world.state.selectedId = null;
    else if (screen === 'play') screen = 'paused';
    else if (screen === 'paused') screen = 'play';
  }
  if (actions & ACTION_PAUSE) {
    if (screen === 'play') screen = 'paused';
    else if (screen === 'paused') screen = 'play';
  }
  if (actions & ACTION_SPEED && (screen === 'play' || screen === 'paused')) {
    speed = speed === 1 ? 2 : 1;
  }
  if (actions & ACTION_UPGRADE && screen === 'play') {
    const selected = world.selectedTower();
    if (selected) playEventSounds(world.upgradeTowerById(selected.id), 0);
  }
  if (actions & ACTION_SELL && screen === 'play') {
    const selected = world.selectedTower();
    if (selected) playEventSounds(world.sellTowerById(selected.id), 0);
  }
  if (actions & ACTION_RESTART && screen !== 'title') startRun();
  if (actions & (ACTION_START_WAVE | ACTION_CONFIRM)) {
    if (screen === 'title') {
      startRun();
    } else if (screen === 'play') {
      playEventSounds(world.startWave(), 0);
    } else if ((screen === 'won' || screen === 'lost') && elapsed - endTime >= 0.6) {
      startRun();
    }
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') screen = 'paused';
});

const STEP = 1 / 60;
let last = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const frameDt = Math.min(0.25, (now - last) / 1000);
  last = now;
  elapsed += frameDt;

  const pointer = input.pointer();
  const hoverAction = pointer.x >= SIDEBAR.x ? hitTestSidebar(pointer.x, pointer.y) : null;
  const hoverTile =
    pointer.inside && pointer.x < SIDEBAR.x && pointer.x >= 0 && pointer.y >= 0 && pointer.y < FIELD.height
      ? { col: Math.floor(pointer.x / GRID.tile), row: Math.floor(pointer.y / GRID.tile) }
      : null;

  if (!shotMode) {
    handleActions(input.takeActions());
    for (const click of input.takeClicks()) handleClick(click);
    if (input.takeRightClicks() > 0) {
      if (placing) placing = null;
      else world.state.selectedId = null;
    }
  }

  if (!shotMode) {
    accumulator += frameDt * (screen === 'play' ? speed : 1);
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      accumulator -= STEP;
      steps += 1;
      if (screen === 'title') {
        attract.decide(world);
        attractSpawnIn -= STEP;
        if (attractSpawnIn <= 0 && world.state.enemies.length < 6) {
          world.spawnEnemy('shade', 1);
          attractSpawnIn = 2.4;
        }
        world.step(STEP, true);
      } else if (screen === 'play') {
        const before = world.state.outcome;
        const { events, shots } = world.step(STEP, false);
        playEventSounds(events, shots);
        if (!before && world.state.outcome) {
          screen = world.state.outcome;
          finishRun();
        }
      } else {
        world.step(STEP, false);
      }
    }
    if (steps === 5) accumulator = 0;
    moteTimer -= frameDt;
    if (moteTimer <= 0 && (screen === 'play' || screen === 'title')) {
      const lantern = { x: 460, y: 340 };
      spawnEmberMote(world.state.particles, lantern.x, lantern.y);
      moteTimer = 0.5;
    }
  }

  renderer.render(
    world,
    {
      screen,
      placing: screen === 'title' ? null : placing,
      hoverTile,
      hoverAction,
      selected: screen === 'title' ? null : world.selectedTower(),
      hudState: screen === 'title' ? freshHudWorld.state : world.state,
      muted,
      speed,
      best,
    },
    elapsed,
  );

  if (shotMode) {
    paints += 1;
    if (paints >= 2) window.__shotReady = true;
  }
}

requestAnimationFrame(frame);
