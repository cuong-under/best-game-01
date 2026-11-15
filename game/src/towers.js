// Tower definitions and tower behaviour: building, targeting the shadow furthest
// along the road, firing, upgrading and selling. No drawing here, only the rules.

import { GRID, SELL_REFUND, TOWERS, tileCentre } from './config.js';

let nextTowerId = 1;

export function resetTowerIds() {
  nextTowerId = 1;
}

export function towerLevelStats(type, level) {
  return TOWERS[type].levels[level];
}

export function towerTotalCost(tower) {
  const def = TOWERS[tower.type];
  let total = def.cost;
  for (let level = 0; level < tower.level; level += 1) total += def.levels[level].upgrade;
  return total;
}

export function towerSellValue(tower) {
  return Math.floor(towerTotalCost(tower) * SELL_REFUND);
}

export function createTower(type, col, row) {
  const centre = tileCentre(col, row);
  return {
    id: nextTowerId++,
    type,
    def: TOWERS[type],
    col,
    row,
    x: centre.x,
    y: centre.y,
    level: 0,
    cooldown: 0,
    aimAngle: -Math.PI / 2,
    flash: 0,
    kills: 0,
  };
}

/** The enemy in range furthest along the road, or null when the tower sees nothing. */
export function acquireTarget(tower, enemies) {
  const stats = towerLevelStats(tower.type, tower.level);
  let best = null;
  let bestProgress = -1;
  for (const enemy of enemies) {
    if (enemy.dead || enemy.reachedLantern) continue;
    const dx = enemy.x - tower.x;
    const dy = enemy.y - tower.y;
    if (dx * dx + dy * dy > stats.range * stats.range) continue;
    if (enemy.progress > bestProgress) {
      bestProgress = enemy.progress;
      best = enemy;
    }
  }
  return best;
}

/** One step of aiming and firing. Returns a projectile to launch, or null. */
export function towerStep(tower, enemies, dt) {
  tower.cooldown = Math.max(0, tower.cooldown - dt);
  if (tower.flash > 0) tower.flash = Math.max(0, tower.flash - dt);
  const target = acquireTarget(tower, enemies);
  if (!target) return null;
  tower.aimAngle = Math.atan2(target.y - tower.y, target.x - tower.x);
  if (tower.cooldown > 0) return null;
  const stats = towerLevelStats(tower.type, tower.level);
  tower.cooldown = 1 / stats.rate;
  tower.flash = 0.09;
  return {
    x: tower.x + Math.cos(tower.aimAngle) * 16,
    y: tower.y - 14 + Math.sin(tower.aimAngle) * 16,
    target,
    targetId: target.id,
    speed: tower.def.projectileSpeed,
    damage: stats.damage,
    type: tower.type,
    splash: stats.splash || 0,
    slow: stats.slow || 0,
    slowTime: stats.slowTime || 0,
    tower,
    dead: false,
  };
}

export function upgradeCost(tower) {
  const stats = towerLevelStats(tower.type, tower.level);
  return stats.upgrade;
}

export function canUpgrade(tower) {
  return tower.level < TOWERS[tower.type].levels.length - 1;
}

export function upgradeTower(tower) {
  if (canUpgrade(tower)) tower.level += 1;
}

/** Move a projectile toward its target. Returns 'hit', 'fizzle' or 'fly'. */
export function projectileStep(projectile, dt) {
  const target = projectile.target;
  if (!target || target.dead || target.reachedLantern) return 'fizzle';
  const dx = target.x - projectile.x;
  const dy = target.y - projectile.y;
  const dist = Math.hypot(dx, dy);
  const step = projectile.speed * dt;
  if (dist <= step + target.def.radius * 0.5) return 'hit';
  projectile.x += (dx / dist) * step;
  projectile.y += (dy / dist) * step;
  return 'fly';
}

/** Tiles a tower may stand on, for placement previews and the autopilot. */
export function buildableTiles(isBlocked) {
  const tiles = [];
  for (let row = 0; row < GRID.rows; row += 1) {
    for (let col = 0; col < GRID.cols; col += 1) {
      if (!isBlocked(col, row)) tiles.push({ col, row });
    }
  }
  return tiles;
}
