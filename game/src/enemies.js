// Enemy kinds and their walk: spawning from a wave group, following the road's
// waypoints, slowing, splitting and dying. No drawing here, only the rules.

import { ENEMIES, PATH } from './config.js';
import { randomRange } from './random.js';

let nextEnemyId = 1;

/** How much tougher and quicker a kind gets as the waves climb. */
export function scaledStats(type, wave) {
  const def = ENEMIES[type];
  const hpScale = type === 'boss' ? 1 : 1 + 0.31 * (wave - 1);
  const speedScale = 1 + Math.min(0.2, 0.02 * (wave - 1));
  return { hp: Math.round(def.hp * hpScale), speed: def.speed * speedScale };
}

export function createEnemy(type, wave, random) {
  const def = ENEMIES[type];
  const stats = scaledStats(type, wave);
  // Small per-enemy jitter from the seeded stream, so replays stay identical but
  // no two runs play out exactly alike.
  const hp = Math.round(stats.hp * (0.92 + random() * 0.16));
  const speed = stats.speed * (0.95 + random() * 0.1);
  // A small sideways offset per enemy, so the column does not march single file.
  const lateral = randomRange(random, -7, 7);
  return {
    id: nextEnemyId++,
    type,
    def,
    x: PATH[0][0],
    y: PATH[0][1] + lateral,
    lateral,
    waypoint: 1,
    progress: 0,
    hp,
    maxHp: hp,
    speed,
    slowLeft: 0,
    slowFactor: 0,
    hitFlash: 0,
    wobble: random() * Math.PI * 2,
    dead: false,
    reachedLantern: false,
  };
}

export function resetEnemyIds() {
  nextEnemyId = 1;
}

export function enemySpeed(enemy) {
  return enemy.slowLeft > 0 ? enemy.speed * (1 - enemy.slowFactor) : enemy.speed;
}

/** Move one step along the road. Returns true when the enemy reaches the lantern. */
export function moveEnemy(enemy, dt) {
  let remaining = enemySpeed(enemy) * dt;
  while (remaining > 0 && enemy.waypoint < PATH.length) {
    const target = PATH[enemy.waypoint];
    const tx = target[0];
    // The sideways offset applies across the road: on horizontal stretches it shifts y,
    // on vertical ones it shifts x, so the column stays on the stones.
    const prev = PATH[enemy.waypoint - 1];
    const horizontal = Math.abs(target[1] - prev[1]) < 1;
    const ty = target[1] + (horizontal ? enemy.lateral : 0);
    const targetX = tx + (horizontal ? 0 : enemy.lateral);
    const dx = targetX - enemy.x;
    const dy = ty - enemy.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= remaining) {
      enemy.x = targetX;
      enemy.y = ty;
      enemy.progress += dist;
      remaining -= dist;
      enemy.waypoint += 1;
    } else {
      enemy.x += (dx / dist) * remaining;
      enemy.y += (dy / dist) * remaining;
      enemy.progress += remaining;
      remaining = 0;
    }
  }
  if (enemy.slowLeft > 0) enemy.slowLeft = Math.max(0, enemy.slowLeft - dt);
  if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
  return enemy.waypoint >= PATH.length;
}

export function damageEnemy(enemy, amount) {
  enemy.hp -= amount;
  enemy.hitFlash = 0.09;
  if (enemy.hp <= 0) enemy.dead = true;
  return enemy.dead;
}

export function slowEnemy(enemy, factor, duration) {
  if (factor >= enemy.slowFactor || enemy.slowLeft <= 0) {
    enemy.slowFactor = factor;
    enemy.slowLeft = duration;
  } else {
    enemy.slowLeft = Math.max(enemy.slowLeft, duration);
  }
}

/** The children a splitter leaves behind, continuing from where it fell. */
export function splitEnemy(enemy, wave, random) {
  const children = [];
  const count = enemy.def.splitCount || 0;
  for (let i = 0; i < count; i += 1) {
    const child = createEnemy(enemy.def.splitsInto, wave, random);
    child.x = enemy.x + (i === 0 ? -8 : 8);
    child.y = enemy.y + (i === 0 ? -6 : 6);
    child.waypoint = enemy.waypoint;
    child.progress = enemy.progress;
    children.push(child);
  }
  return children;
}
