// The chrome around the battlefield: the top status strip, the command sidebar with
// its tower cards and buttons, and the title, pause and end panels. It also owns the
// hit-testing for every canvas button, so the loop can answer clicks without knowing
// the layout. The sidebar is 400px wide on the right of the 1280x720 field.

import { FIELD, FONT, PALETTE, SIDEBAR, TOWERS, TOWER_ORDER, TOTAL_WAVES, earlyCallBonus } from './config.js';
import { canUpgrade, towerSellValue, towerLevelStats, upgradeCost } from './towers.js';

const CARD_X = SIDEBAR.x + 16;
const CARD_W = SIDEBAR.width - 32;
const CARD_H = 104;
const CARD_GAP = 12;
const CARD_TOP = 88;

export const CARD_RECTS = TOWER_ORDER.map((type, i) => ({
  type,
  x: CARD_X,
  y: CARD_TOP + i * (CARD_H + CARD_GAP),
  w: CARD_W,
  h: CARD_H,
}));

export const SELECTED_RECT = { x: CARD_X, y: 436, w: CARD_W, h: 120 };
export const UPGRADE_BTN = { x: CARD_X + 12, y: 508, w: 168, h: 36 };
export const SELL_BTN = { x: CARD_X + 192, y: 508, w: 164, h: 36 };
export const START_BTN = { x: CARD_X, y: 568, w: CARD_W, h: 56 };
export const SPEED_BTN = { x: CARD_X, y: 636, w: 114, h: 44 };
export const PAUSE_BTN = { x: CARD_X + 126, y: 636, w: 114, h: 44 };
export const RESTART_BTN = { x: CARD_X + 252, y: 636, w: 116, h: 44 };
export const MUTE_BTN = { x: SIDEBAR.x + SIDEBAR.width - 76, y: 10, w: 60, h: 36 };
export const END_PANEL = { x: 160, y: 150, w: 560, h: 420 };
export const END_RESTART_BTN = { x: 330, y: 490, w: 220, h: 52 };

function inside(rect, x, y) {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

/** Which sidebar control, if any, the logical point sits on. */
export function hitTestSidebar(x, y) {
  if (inside(MUTE_BTN, x, y)) return { kind: 'mute' };
  for (const card of CARD_RECTS) {
    if (inside(card, x, y)) return { kind: 'card', type: card.type };
  }
  if (inside(UPGRADE_BTN, x, y)) return { kind: 'upgrade' };
  if (inside(SELL_BTN, x, y)) return { kind: 'sell' };
  if (inside(START_BTN, x, y)) return { kind: 'start' };
  if (inside(SPEED_BTN, x, y)) return { kind: 'speed' };
  if (inside(PAUSE_BTN, x, y)) return { kind: 'pause' };
  if (inside(RESTART_BTN, x, y)) return { kind: 'restart' };
  return null;
}

export function hitTestEndPanel(x, y) {
  return inside(END_RESTART_BTN, x, y);
}

const fonts = new Map();
function text(ctx, value, x, y, size, color, align, weight) {
  const key = `${weight || ''}${size}`;
  if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`);
  ctx.font = fonts.get(key);
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function roundRect(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawButton(ctx, rect, label, sublabel, enabled, hovered, accent) {
  ctx.fillStyle = !enabled ? PALETTE.cardDisabled : hovered ? PALETTE.cardHover : PALETTE.card;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
  ctx.fill();
  ctx.strokeStyle = enabled ? accent || PALETTE.panelEdge : PALETTE.panelEdge;
  ctx.lineWidth = enabled ? 2 : 1;
  ctx.stroke();
  ctx.fillStyle = enabled ? PALETTE.text : PALETTE.muted;
  if (sublabel) {
    text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2 - 2, 18, enabled ? PALETTE.text : PALETTE.muted, 'center', 'bold');
    text(ctx, sublabel, rect.x + rect.w / 2, rect.y + rect.h / 2 + 18, 12, PALETTE.muted, 'center');
  } else {
    text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 6, 18, enabled ? PALETTE.text : PALETTE.muted, 'center', 'bold');
  }
}

function drawTowerIcon(ctx, type, cx, cy, scale) {
  const def = TOWERS[type];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#171226';
  ctx.beginPath();
  ctx.ellipse(0, 12, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (type === 'ember') {
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(9, 8);
    ctx.lineTo(-9, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = def.glow;
    ctx.beginPath();
    ctx.arc(0, -20, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'frost') {
    ctx.strokeStyle = '#8a7aa8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(0, -8);
    ctx.stroke();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(0, -12, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = def.glow;
    ctx.beginPath();
    ctx.arc(-3, -15, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#3d3358';
    ctx.beginPath();
    ctx.moveTo(-7, 10);
    ctx.lineTo(-4, -18);
    ctx.lineTo(4, -18);
    ctx.lineTo(7, 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(-3, -6);
    ctx.lineTo(3, -2);
    ctx.lineTo(-1, 8);
    ctx.stroke();
  }
  ctx.restore();
}

function statLine(type) {
  const level = TOWERS[type].levels[0];
  let line = `DMG ${level.damage}  ·  RNG ${level.range}  ·  ${level.rate.toFixed(1)}/s`;
  if (level.slow) line += `  ·  SLOW ${Math.round(level.slow * 100)}%`;
  if (level.splash) line += `  ·  SPLASH ${level.splash}`;
  return line;
}

function drawCard(ctx, card, state, ui) {
  const def = TOWERS[card.type];
  const afford = state.embers >= def.cost;
  const placing = ui.placing === card.type;
  const hovered = ui.hoverAction && ui.hoverAction.kind === 'card' && ui.hoverAction.type === card.type;
  ctx.fillStyle = placing ? '#3d2c4e' : hovered ? PALETTE.cardHover : PALETTE.card;
  roundRect(ctx, card.x, card.y, card.w, card.h, 12);
  ctx.fill();
  ctx.strokeStyle = placing ? def.color : PALETTE.panelEdge;
  ctx.lineWidth = placing ? 3 : 1;
  ctx.stroke();
  drawTowerIcon(ctx, card.type, card.x + 44, card.y + 52, 1.5);
  text(ctx, def.name, card.x + 84, card.y + 32, 20, afford ? PALETTE.text : PALETTE.muted, 'left', 'bold');
  text(ctx, def.blurb, card.x + 84, card.y + 54, 13, PALETTE.muted, 'left');
  text(ctx, statLine(card.type), card.x + 84, card.y + 76, 13, PALETTE.muted, 'left');
  text(ctx, `◈ ${def.cost}`, card.x + card.w - 16, card.y + 32, 19, afford ? PALETTE.gold : PALETTE.bad, 'right', 'bold');
  ctx.fillStyle = PALETTE.panelEdge;
  roundRect(ctx, card.x + card.w - 44, card.y + 40, 28, 26, 6);
  ctx.fill();
  text(ctx, def.hotkey, card.x + card.w - 30, card.y + 59, 15, PALETTE.text, 'center', 'bold');
}

function drawSelectedPanel(ctx, state, ui) {
  const rect = SELECTED_RECT;
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
  const tower = ui.selected;
  if (!tower) {
    if (ui.placing) {
      text(ctx, `Placing: ${TOWERS[ui.placing].name}`, rect.x + 16, rect.y + 30, 17, PALETTE.text, 'left', 'bold');
      text(ctx, 'Click a glowing tile to build.', rect.x + 16, rect.y + 54, 14, PALETTE.muted, 'left');
      text(ctx, 'Right-click or Esc cancels.', rect.x + 16, rect.y + 76, 14, PALETTE.muted, 'left');
      text(ctx, 'Towers cannot stand on the road.', rect.x + 16, rect.y + 98, 14, PALETTE.muted, 'left');
    } else {
      text(ctx, 'How to hold the light', rect.x + 16, rect.y + 30, 17, PALETTE.text, 'left', 'bold');
      text(ctx, 'Build beside the road. Frost slows the column', rect.x + 16, rect.y + 54, 14, PALETTE.muted, 'left');
      text(ctx, 'so ember and storm can finish it.', rect.x + 16, rect.y + 76, 14, PALETTE.muted, 'left');
      text(ctx, 'Click a tower to upgrade or sell it.', rect.x + 16, rect.y + 98, 14, PALETTE.muted, 'left');
    }
    return;
  }
  const stats = towerLevelStats(tower.type, tower.level);
  drawTowerIcon(ctx, tower.type, rect.x + 36, rect.y + 40, 1.3);
  text(ctx, tower.def.name, rect.x + 68, rect.y + 30, 19, PALETTE.text, 'left', 'bold');
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i <= tower.level ? PALETTE.gold : PALETTE.panelEdge;
    ctx.beginPath();
    ctx.arc(rect.x + 76 + i * 18, rect.y + 48, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  text(ctx, `Level ${tower.level + 1} of 3`, rect.x + 138, rect.y + 53, 13, PALETTE.muted, 'left');
  let line = `DMG ${stats.damage}  ·  RNG ${stats.range}  ·  ${stats.rate.toFixed(1)}/s`;
  if (stats.slow) line += `  ·  SLOW ${Math.round(stats.slow * 100)}%`;
  if (stats.splash) line += `  ·  SPLASH ${stats.splash}`;
  text(ctx, line, rect.x + 16, rect.y + 84, 13, PALETTE.muted, 'left');
  text(ctx, `${tower.kills} banished`, rect.x + rect.w - 16, rect.y + 30, 13, PALETTE.muted, 'right');
  const upgradable = canUpgrade(tower);
  const cost = upgradable ? upgradeCost(tower) : 0;
  const affordUpgrade = upgradable && state.embers >= cost;
  const hovered = ui.hoverAction && ui.hoverAction.kind;
  const ended = ui.screen === 'won' || ui.screen === 'lost';
  drawButton(ctx, UPGRADE_BTN, upgradable ? `Upgrade ◈ ${cost}` : 'Fully grown', null, !ended && affordUpgrade, !ended && hovered === 'upgrade', PALETTE.gold);
  drawButton(ctx, SELL_BTN, `Sell ◈ ${towerSellValue(tower)}`, null, !ended, !ended && hovered === 'sell', null);
}

function drawStartButton(ctx, state, ui) {
  const hovered = ui.hoverAction && ui.hoverAction.kind === 'start';
  const wave = state.wave;
  if (state.outcome) {
    drawButton(ctx, START_BTN, 'The run is over', null, false, false, null);
    return;
  }
  if (wave.phase === 'idle') {
    const next = wave.wave + 1;
    drawButton(ctx, START_BTN, next > TOTAL_WAVES ? 'All waves faced' : `START WAVE ${next}  ▶`, 'or press Space', next <= TOTAL_WAVES, hovered, PALETTE.ember);
  } else if (wave.wave < TOTAL_WAVES) {
    drawButton(ctx, START_BTN, `CALL WAVE ${wave.wave + 1} EARLY`, `+${earlyCallBonus(wave.wave + 1)} embers now`, true, hovered, PALETTE.ember);
  } else {
    drawButton(ctx, START_BTN, 'FINAL WAVE', 'hold the light', false, false, null);
  }
}

export function drawSidebar(ctx, state, ui, time) {
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(SIDEBAR.x, 0, SIDEBAR.width, FIELD.height);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(SIDEBAR.x, 0, 2, FIELD.height);
  text(ctx, 'THE LAST LANTERN', SIDEBAR.x + 16, 34, 22, PALETTE.emberBright, 'left', 'bold');
  text(ctx, 'hold the light through ten waves', SIDEBAR.x + 16, 52, 12, PALETTE.muted, 'left');
  drawButton(ctx, MUTE_BTN, ui.muted ? 'Muted' : 'Sound', null, true, ui.hoverAction && ui.hoverAction.kind === 'mute', null);
  text(ctx, 'BUILD TOWERS', CARD_X, CARD_TOP - 10, 13, PALETTE.muted, 'left', 'bold');
  for (const card of CARD_RECTS) drawCard(ctx, card, state, ui);
  drawSelectedPanel(ctx, state, ui);
  drawStartButton(ctx, state, ui);
  const hovered = ui.hoverAction && ui.hoverAction.kind;
  const ended = ui.screen === 'won' || ui.screen === 'lost';
  drawButton(ctx, SPEED_BTN, ui.speed === 2 ? 'Speed 2×' : 'Speed 1×', null, !ended, !ended && hovered === 'speed', null);
  drawButton(ctx, PAUSE_BTN, ui.screen === 'paused' ? 'Resume' : 'Pause', null, !ended, !ended && hovered === 'pause', null);
  drawButton(ctx, RESTART_BTN, 'Restart', null, true, hovered === 'restart', null);
  text(ctx, '1/2/3 build · U upgrade · X sell · Space wave · F speed · P pause', SIDEBAR.x + SIDEBAR.width / 2, 708, 12, PALETTE.muted, 'center');
  void time;
}

export function drawTopBar(ctx, state) {
  ctx.fillStyle = 'rgba(13, 10, 24, 0.72)';
  ctx.fillRect(0, 0, SIDEBAR.x, 52);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(0, 52, SIDEBAR.x, 1);
  const wave = state.wave;
  const waveLabel = wave.wave === 0 ? 'WAVE –/10' : `WAVE ${wave.wave}/10`;
  text(ctx, waveLabel, 16, 33, 20, PALETTE.text, 'left', 'bold');
  if (wave.phase !== 'idle') {
    text(ctx, `${state.enemies.length} on the road`, 150, 33, 15, PALETTE.muted, 'left');
  } else if (wave.wave > 0) {
    text(ctx, 'the road is quiet', 150, 33, 15, PALETTE.good, 'left');
  } else {
    text(ctx, 'build, then start wave 1', 150, 33, 15, PALETTE.muted, 'left');
  }
  text(ctx, 'LANTERN', 392, 33, 15, PALETTE.muted, 'left', 'bold');
  const barX = 470;
  const barW = 150;
  ctx.fillStyle = '#171226';
  roundRect(ctx, barX, 18, barW, 16, 8);
  ctx.fill();
  const fraction = Math.max(0, state.coreHp / state.maxCoreHp);
  ctx.fillStyle = fraction > 0.5 ? PALETTE.ember : fraction > 0.25 ? PALETTE.gold : PALETTE.bad;
  if (fraction > 0) {
    roundRect(ctx, barX, 18, Math.max(16, barW * fraction), 16, 8);
    ctx.fill();
  }
  text(ctx, `${state.coreHp}/${state.maxCoreHp}`, barX + barW + 10, 33, 15, PALETTE.text, 'left', 'bold');
  text(ctx, `◈ ${state.embers}`, 690, 33, 20, PALETTE.gold, 'left', 'bold');
  text(ctx, `SCORE ${state.score}`, SIDEBAR.x - 8, 33, 15, PALETTE.muted, 'right');
}

function drawDim(ctx, alpha) {
  ctx.fillStyle = `rgba(9, 7, 18, ${alpha})`;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

function drawPanelBox(ctx, rect) {
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ember;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawTitlePanel(ctx, best, time) {
  drawDim(ctx, 0.55);
  const rect = { x: 110, y: 118, w: 660, h: 484 };
  drawPanelBox(ctx, rect);
  const cx = rect.x + rect.w / 2;
  text(ctx, 'THE LAST LANTERN', cx, rect.y + 72, 46, PALETTE.emberBright, 'center', 'bold');
  text(ctx, 'Night is coming down the road. Hold the light.', cx, rect.y + 104, 17, PALETTE.muted, 'center');
  const lines = [
    'Shadows walk the road toward your lantern. Build towers beside it',
    'to banish them before they reach the flame. Ten waves. One light.',
    '',
    'Ember Spire — fast bolts.  Frost Lantern — slows the column.',
    'Storm Obelisk — heavy skyfire over groups. Upgrade what works.',
    '',
    'Click a tower card (or press 1 / 2 / 3), then click a tile to build.',
    'Click a tower to upgrade or sell it. Space starts the next wave.',
  ];
  for (let i = 0; i < lines.length; i += 1) {
    text(ctx, lines[i], cx, rect.y + 146 + i * 28, 16, PALETTE.text, 'center');
  }
  if (best > 0) text(ctx, `Best score ${best}`, cx, rect.y + 392, 15, PALETTE.gold, 'center');
  const pulse = 0.6 + 0.4 * Math.sin(time * 3);
  ctx.globalAlpha = pulse;
  text(ctx, 'CLICK OR PRESS SPACE TO BEGIN', cx, rect.y + 436, 20, PALETTE.emberBright, 'center', 'bold');
  ctx.globalAlpha = 1;
}

export function drawPausePanel(ctx) {
  drawDim(ctx, 0.55);
  const rect = { x: 280, y: 250, w: 320, h: 200 };
  drawPanelBox(ctx, rect);
  const cx = rect.x + rect.w / 2;
  text(ctx, 'PAUSED', cx, rect.y + 72, 38, PALETTE.text, 'center', 'bold');
  text(ctx, 'The shadows wait with you.', cx, rect.y + 112, 15, PALETTE.muted, 'center');
  text(ctx, 'Press P or click to resume', cx, rect.y + 152, 16, PALETTE.emberBright, 'center');
}

export function drawEndPanel(ctx, state, best, won, time) {
  drawDim(ctx, 0.6);
  const rect = END_PANEL;
  drawPanelBox(ctx, rect);
  const cx = rect.x + rect.w / 2;
  text(ctx, won ? 'VICTORY' : 'THE LIGHT FALLS', cx, rect.y + 72, 44, won ? PALETTE.emberBright : PALETTE.bad, 'center', 'bold');
  text(ctx, won ? 'Dawn breaks. The lantern still burns.' : 'The shadows swallow the road.', cx, rect.y + 106, 16, PALETTE.muted, 'center');
  const lines = [
    `Waves held: ${won ? TOTAL_WAVES : state.wavesCleared} of ${TOTAL_WAVES}`,
    `Shadows banished: ${state.kills}`,
    `Lantern health left: ${state.coreHp} of ${state.maxCoreHp}`,
    `Embers earned: ${state.embersEarned}`,
    '',
    `Score: ${state.score}`,
    `Best: ${Math.max(best, state.score)}`,
  ];
  for (let i = 0; i < lines.length; i += 1) {
    text(ctx, lines[i], cx, rect.y + 150 + i * 30, lines[i].startsWith('Score') ? 22 : 16, lines[i].startsWith('Score') ? PALETTE.text : PALETTE.muted, 'center', lines[i].startsWith('Score') ? 'bold' : '');
  }
  const pulse = 0.75 + 0.25 * Math.sin(time * 3);
  ctx.globalAlpha = pulse;
  drawButton(ctx, END_RESTART_BTN, 'PLAY AGAIN', null, true, false, PALETTE.ember);
  ctx.globalAlpha = 1;
  text(ctx, 'or press Space', cx, rect.y + 406, 13, PALETTE.muted, 'center');
}
