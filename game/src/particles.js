// Short-lived visual feedback: sparks, puffs, shockwaves and floating numbers. The
// simulation spawns them; the renderer draws them; nothing here affects the rules.

export function createParticlePool() {
  return [];
}

export function spawnBurst(particles, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const power = speed * (0.4 + Math.random() * 0.8);
    particles.push({
      kind: 'spark',
      x,
      y,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power - speed * 0.25,
      life: life * (0.6 + Math.random() * 0.6),
      maxLife: life,
      size: size * (0.7 + Math.random() * 0.6),
      color,
      drag: 3.2,
      gravity: 160,
    });
  }
}

export function spawnPuff(particles, x, y, color, count, size) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const power = 14 + Math.random() * 30;
    particles.push({
      kind: 'puff',
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power - 12,
      life: 0.45 + Math.random() * 0.3,
      maxLife: 0.7,
      size: size * (0.8 + Math.random() * 0.7),
      color,
      drag: 2.0,
      gravity: -30,
    });
  }
}

export function spawnRing(particles, x, y, color, maxRadius) {
  particles.push({
    kind: 'ring',
    x,
    y,
    vx: 0,
    vy: 0,
    life: 0.4,
    maxLife: 0.4,
    size: maxRadius,
    color,
    drag: 0,
    gravity: 0,
  });
}

export function spawnMuzzle(particles, x, y, color) {
  particles.push({
    kind: 'flash',
    x,
    y,
    vx: 0,
    vy: 0,
    life: 0.09,
    maxLife: 0.09,
    size: 14,
    color,
    drag: 0,
    gravity: 0,
  });
}

export function spawnEmberMote(particles, x, y) {
  particles.push({
    kind: 'mote',
    x: x + (Math.random() - 0.5) * 26,
    y: y + (Math.random() - 0.5) * 10,
    vx: (Math.random() - 0.5) * 8,
    vy: -14 - Math.random() * 16,
    life: 1.4 + Math.random() * 1.2,
    maxLife: 2.6,
    size: 1.5 + Math.random() * 2,
    color: Math.random() < 0.5 ? '#ffb347' : '#ffd76a',
    drag: 0.2,
    gravity: -6,
  });
}

export function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    const drag = Math.max(0, 1 - p.drag * dt);
    p.vx *= drag;
    p.vy = p.vy * drag + p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  if (particles.length > 420) particles.splice(0, particles.length - 420);
}

export function createFloaterPool() {
  return [];
}

export function spawnFloater(floaters, x, y, text, color, size) {
  floaters.push({ x, y, text, color, size: size || 15, life: 0.9, maxLife: 0.9 });
}

export function updateFloaters(floaters, dt) {
  for (let i = floaters.length - 1; i >= 0; i -= 1) {
    const f = floaters[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) floaters.splice(i, 1);
  }
}
