// Everything drawn on the battlefield: the pre-rendered ground and road, the
// lantern, towers, shadows, projectiles, particles and floating text. The sidebar,
// top bar and panels come from hud.js. The renderer also owns canvas sizing and the
// screen-to-logical coordinate mapping, so input never does its own maths.

import { FIELD, FONT, GRID, PALETTE, PATH, SIDEBAR, TOWERS, tileCentre } from './config.js';
import { towerLevelStats } from './towers.js';
import { drawEndPanel, drawPausePanel, drawSidebar, drawTitlePanel, drawTopBar } from './hud.js';

function tileHash(col, row) {
  const value = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const background = document.createElement('canvas');
  background.width = FIELD.width;
  background.height = FIELD.height;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  const fonts = new Map();

  function font(size, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`);
    return fonts.get(key);
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fit = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    scale = fit;
    offsetX = (window.innerWidth - FIELD.width * fit) / 2;
    offsetY = (window.innerHeight - FIELD.height * fit) / 2;
    canvas.style.width = `${Math.floor(FIELD.width * fit)}px`;
    canvas.style.height = `${Math.floor(FIELD.height * fit)}px`;
    canvas.width = Math.round(FIELD.width * fit * dpr);
    canvas.height = Math.round(FIELD.height * fit * dpr);
  }

  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / (rect.width / FIELD.width),
      y: (clientY - rect.top) / (rect.height / FIELD.height),
    };
  }

  function buildBackground(world) {
    const bctx = background.getContext('2d');
    bctx.fillStyle = PALETTE.groundA;
    bctx.fillRect(0, 0, FIELD.width, FIELD.height);
    for (let row = 0; row < GRID.rows; row += 1) {
      for (let col = 0; col < GRID.cols; col += 1) {
        const hash = tileHash(col, row);
        bctx.fillStyle = hash < 0.5 ? PALETTE.groundA : PALETTE.groundB;
        bctx.fillRect(col * GRID.tile, row * GRID.tile, GRID.tile, GRID.tile);
        if (hash > 0.86) {
          bctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
          bctx.beginPath();
          bctx.arc(col * GRID.tile + 20, row * GRID.tile + 20, 3, 0, Math.PI * 2);
          bctx.fill();
        }
      }
    }
    // The road: one thick stroke along the waypoints, so it reads as a path.
    bctx.lineCap = 'round';
    bctx.lineJoin = 'round';
    bctx.strokeStyle = PALETTE.roadEdge;
    bctx.lineWidth = 38;
    bctx.beginPath();
    bctx.moveTo(PATH[0][0], PATH[0][1]);
    for (const point of PATH.slice(1)) bctx.lineTo(point[0], point[1]);
    bctx.stroke();
    bctx.strokeStyle = PALETTE.road;
    bctx.lineWidth = 30;
    bctx.beginPath();
    bctx.moveTo(PATH[0][0], PATH[0][1]);
    for (const point of PATH.slice(1)) bctx.lineTo(point[0], point[1]);
    bctx.stroke();
    bctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    bctx.lineWidth = 2;
    bctx.setLineDash([10, 14]);
    bctx.beginPath();
    bctx.moveTo(PATH[0][0], PATH[0][1]);
    for (const point of PATH.slice(1)) bctx.lineTo(point[0], point[1]);
    bctx.stroke();
    bctx.setLineDash([]);
    // Pale stones set along the road, placed by a hash so they never move.
    bctx.fillStyle = PALETTE.roadSpeck;
    for (let i = 0; i < PATH.length - 1; i += 1) {
      const from = PATH[i];
      const to = PATH[i + 1];
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const count = Math.floor(length / 46);
      for (let j = 1; j < count; j += 1) {
        const t = j / count;
        const hash = tileHash(i * 31 + j, 7);
        const x = from[0] + (to[0] - from[0]) * t + (hash - 0.5) * 20;
        const y = from[1] + (to[1] - from[1]) * t + (tileHash(j, i * 17 + 3) - 0.5) * 20;
        bctx.beginPath();
        bctx.arc(x, y, 1.6 + hash * 1.4, 0, Math.PI * 2);
        bctx.fill();
      }
    }
    // Decorations, seeded by the world so every run paints the same field.
    for (const item of world.state.decor) {
      bctx.save();
      bctx.translate(item.x, item.y);
      bctx.scale(item.scale, item.scale);
      if (item.kind === 'tuft') {
        bctx.strokeStyle = '#3f5a3a';
        bctx.lineWidth = 2;
        for (let i = -1; i <= 1; i += 1) {
          bctx.beginPath();
          bctx.moveTo(i * 4, 4);
          bctx.quadraticCurveTo(i * 6, -4, i * 8, -9);
          bctx.stroke();
        }
      } else if (item.kind === 'flower') {
        bctx.fillStyle = item.variant > 0.5 ? '#c86b9a' : '#7f6fb8';
        for (let i = 0; i < 5; i += 1) {
          const angle = (i / 5) * Math.PI * 2;
          bctx.beginPath();
          bctx.arc(Math.cos(angle) * 4, Math.sin(angle) * 4, 2.5, 0, Math.PI * 2);
          bctx.fill();
        }
        bctx.fillStyle = '#f2c94c';
        bctx.beginPath();
        bctx.arc(0, 0, 2, 0, Math.PI * 2);
        bctx.fill();
      } else if (item.kind === 'rock') {
        bctx.fillStyle = '#3a3350';
        bctx.beginPath();
        bctx.ellipse(0, 0, 7, 5, item.variant, 0, Math.PI * 2);
        bctx.fill();
        bctx.fillStyle = 'rgba(255,255,255,0.08)';
        bctx.beginPath();
        bctx.ellipse(-2, -2, 3, 2, item.variant, 0, Math.PI * 2);
        bctx.fill();
      } else if (item.kind === 'glowshroom') {
        bctx.fillStyle = '#d9d2ea';
        bctx.fillRect(-1, -2, 2, 6);
        bctx.fillStyle = '#8fe08a';
        bctx.beginPath();
        bctx.arc(0, -2, 5, Math.PI, 0);
        bctx.fill();
      } else {
        bctx.fillStyle = '#2e2748';
        bctx.beginPath();
        bctx.arc(0, 0, 3, 0, Math.PI * 2);
        bctx.fill();
      }
      bctx.restore();
    }
    // Vignette to pull the eye toward the lantern.
    const vignette = bctx.createRadialGradient(440, 360, 220, 440, 360, 640);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(6, 4, 14, 0.45)');
    bctx.fillStyle = vignette;
    bctx.fillRect(0, 0, SIDEBAR.x, FIELD.height);
  }

  function drawLantern(state, time) {
    const lantern = tileCentre(11, 8);
    const health = Math.max(0, state.coreHp / state.maxCoreHp);
    const pulse = 1 + 0.08 * Math.sin(time * 2.2);
    const glowRadius = (60 + 24 * health) * pulse;
    const halo = ctx.createRadialGradient(lantern.x, lantern.y, 8, lantern.x, lantern.y, glowRadius);
    halo.addColorStop(0, `rgba(255, 190, 90, ${0.5 * health + 0.12})`);
    halo.addColorStop(1, 'rgba(255, 150, 60, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(lantern.x, lantern.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#241d3a';
    ctx.beginPath();
    ctx.ellipse(lantern.x, lantern.y + 16, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3d3358';
    ctx.fillRect(lantern.x - 14, lantern.y - 6, 28, 20);
    ctx.fillStyle = '#171226';
    ctx.fillRect(lantern.x - 10, lantern.y - 26, 20, 22);
    ctx.fillStyle = health > 0.25 ? '#ffcf7d' : '#ff8a5c';
    ctx.beginPath();
    ctx.ellipse(lantern.x, lantern.y - 15, 7, 9 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.ellipse(lantern.x, lantern.y - 16, 3.5, 5 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#241d3a';
    ctx.beginPath();
    ctx.moveTo(lantern.x - 14, lantern.y - 26);
    ctx.lineTo(lantern.x, lantern.y - 38);
    ctx.lineTo(lantern.x + 14, lantern.y - 26);
    ctx.closePath();
    ctx.fill();
    if (health <= 0.25 && state.outcome !== 'lost') {
      ctx.fillStyle = `rgba(255, 107, 107, ${0.5 + 0.5 * Math.sin(time * 6)})`;
      ctx.font = font(13, 'bold');
      ctx.textAlign = 'center';
      ctx.fillText('THE LIGHT IS FAILING', lantern.x, lantern.y - 48);
    }
  }

  function drawRangeRing(x, y, radius, color, dashed) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    if (dashed) ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawTower(tower, time) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(tower.x, tower.y + 14, 18, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2344';
    ctx.fillRect(tower.x - 15, tower.y + 2, 30, 12);
    if (tower.type === 'ember') {
      ctx.fillStyle = '#4a3560';
      ctx.beginPath();
      ctx.moveTo(tower.x, tower.y - 30);
      ctx.lineTo(tower.x + 11, tower.y + 4);
      ctx.lineTo(tower.x - 11, tower.y + 4);
      ctx.closePath();
      ctx.fill();
      const tipX = tower.x + Math.cos(tower.aimAngle) * 8;
      const tipY = tower.y - 30 + Math.sin(tower.aimAngle) * 8;
      ctx.fillStyle = tower.flash > 0 ? '#fff3d6' : '#ff9a3c';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 6 + (tower.flash > 0 ? 2 : 0), 0, Math.PI * 2);
      ctx.fill();
    } else if (tower.type === 'frost') {
      ctx.fillStyle = '#3d3358';
      ctx.fillRect(tower.x - 4, tower.y - 16, 8, 20);
      const glow = 1 + 0.12 * Math.sin(time * 3 + tower.id);
      ctx.fillStyle = '#7fd4ff';
      ctx.beginPath();
      ctx.arc(tower.x, tower.y - 22, 10 * glow, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#eaf8ff';
      ctx.beginPath();
      ctx.arc(tower.x - 3, tower.y - 25, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(127, 212, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y - 22, 15 * glow, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#3d3358';
      ctx.beginPath();
      ctx.moveTo(tower.x - 9, tower.y + 4);
      ctx.lineTo(tower.x - 5, tower.y - 34);
      ctx.lineTo(tower.x + 5, tower.y - 34);
      ctx.lineTo(tower.x + 9, tower.y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#c9a7ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tower.x, tower.y - 32);
      ctx.lineTo(tower.x - 4, tower.y - 20);
      ctx.lineTo(tower.x + 3, tower.y - 14);
      ctx.lineTo(tower.x - 2, tower.y - 2);
      ctx.stroke();
      if (tower.flash > 0) {
        ctx.fillStyle = 'rgba(201, 167, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(tower.x, tower.y - 30, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let i = 0; i <= tower.level; i += 1) {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(tower.x - 8 + i * 8, tower.y + 18, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawEnemy(enemy, time) {
    const def = enemy.def;
    const wobble = Math.sin(time * 6 + enemy.wobble) * 1.5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(enemy.x, enemy.y + def.radius * 0.8, def.radius * 0.9, def.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = enemy.hitFlash > 0 ? '#f2ead8' : def.body;
    ctx.beginPath();
    ctx.ellipse(enemy.x, enemy.y + wobble * 0.4, def.radius, def.radius * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = def.rim;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (enemy.def.splitsInto) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, def.radius * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (enemy.type === 'boss') {
      ctx.strokeStyle = def.rim;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(enemy.x - 14, enemy.y - def.radius + 6);
      ctx.lineTo(enemy.x - 20, enemy.y - def.radius - 10);
      ctx.moveTo(enemy.x + 14, enemy.y - def.radius + 6);
      ctx.lineTo(enemy.x + 20, enemy.y - def.radius - 10);
      ctx.stroke();
    }
    const eyeOffset = def.radius * 0.35;
    const eyeY = enemy.y - def.radius * 0.15 + wobble * 0.4;
    ctx.fillStyle = def.eye;
    ctx.beginPath();
    ctx.arc(enemy.x - eyeOffset, eyeY, enemy.type === 'boss' ? 4 : 2.8, 0, Math.PI * 2);
    ctx.arc(enemy.x + eyeOffset, eyeY, enemy.type === 'boss' ? 4 : 2.8, 0, Math.PI * 2);
    ctx.fill();
    if (enemy.slowLeft > 0) {
      ctx.strokeStyle = 'rgba(127, 212, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, def.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (enemy.hp < enemy.maxHp) {
      const barW = def.radius * 2;
      const barY = enemy.y - def.radius - 10;
      ctx.fillStyle = '#171226';
      ctx.fillRect(enemy.x - barW / 2, barY, barW, 4);
      ctx.fillStyle = enemy.hp / enemy.maxHp > 0.35 ? '#8fe08a' : '#ff6b6b';
      ctx.fillRect(enemy.x - barW / 2, barY, barW * (enemy.hp / enemy.maxHp), 4);
    }
  }

  function drawProjectile(projectile) {
    const colors = { ember: '#ff9a3c', frost: '#7fd4ff', storm: '#c9a7ff' };
    const color = colors[projectile.type] || '#ffffff';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.type === 'storm' ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEffects(state) {
    for (const particle of state.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      if (particle.kind === 'ring') {
        ctx.strokeStyle = particle.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * (1 - alpha) + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * (0.4 + 0.6 * alpha), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    for (const floater of state.floaters) {
      const alpha = Math.max(0, floater.life / floater.maxLife);
      ctx.globalAlpha = alpha;
      ctx.font = font(floater.size, 'bold');
      ctx.textAlign = 'center';
      ctx.fillStyle = floater.color;
      ctx.fillText(floater.text, floater.x, floater.y);
      ctx.globalAlpha = 1;
    }
  }

  function drawPlacementPreview(world, ui) {
    const tile = ui.hoverTile;
    if (!ui.placing || !tile) return;
    const centre = tileCentre(tile.col, tile.row);
    const problem = world.placementProblem(ui.placing, tile.col, tile.row);
    ctx.fillStyle = problem ? 'rgba(255, 107, 107, 0.3)' : 'rgba(143, 224, 138, 0.3)';
    ctx.fillRect(tile.col * GRID.tile, tile.row * GRID.tile, GRID.tile, GRID.tile);
    ctx.strokeStyle = problem ? PALETTE.bad : PALETTE.good;
    ctx.lineWidth = 2;
    ctx.strokeRect(tile.col * GRID.tile + 1, tile.row * GRID.tile + 1, GRID.tile - 2, GRID.tile - 2);
    const stats = TOWERS[ui.placing].levels[0];
    drawRangeRing(centre.x, centre.y, stats.range, problem ? 'rgba(255, 107, 107, 0.5)' : 'rgba(255, 255, 255, 0.4)', true);
    ctx.globalAlpha = 0.7;
    drawTower({ type: ui.placing, level: 0, x: centre.x, y: centre.y, id: 0, aimAngle: -Math.PI / 2, flash: 0, kills: 0 }, 0);
    ctx.globalAlpha = 1;
    if (problem === 'road') {
      ctx.font = font(13, 'bold');
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.bad;
      ctx.fillText('THE ROAD IS NO PLACE TO BUILD', centre.x, centre.y - 44);
    }
  }

  function render(world, ui, time) {
    const state = world.state;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.fillStyle = '#0b0817';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.save();
    if (state.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    ctx.drawImage(background, 0, 0);
    drawLantern(state, time);
    const selected = ui.selected;
    if (selected) {
      const stats = towerLevelStats(selected.type, selected.level);
      drawRangeRing(selected.x, selected.y, stats.range, 'rgba(255, 255, 255, 0.45)', true);
    }
    drawPlacementPreview(world, ui);
    const sorted = [...state.towers].sort((a, b) => a.y - b.y);
    for (const tower of sorted) drawTower(tower, time);
    const enemies = [...state.enemies].sort((a, b) => a.y - b.y);
    for (const enemy of enemies) drawEnemy(enemy, time);
    for (const projectile of state.projectiles) drawProjectile(projectile);
    drawEffects(state);
    ctx.restore();
    const hudState = ui.hudState || state;
    drawTopBar(ctx, hudState);
    drawSidebar(ctx, hudState, ui, time);
    if (ui.screen === 'title') drawTitlePanel(ctx, ui.best, time);
    if (ui.screen === 'paused') drawPausePanel(ctx);
    if (ui.screen === 'won' || ui.screen === 'lost') drawEndPanel(ctx, state, ui.best, ui.screen === 'won', time);
    canvas.style.cursor = ui.hoverAction ? 'pointer' : 'default';
  }

  window.addEventListener('resize', resize);
  resize();

  return { resize, toLogical, buildBackground, render };
}
