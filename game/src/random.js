// A tiny seeded generator (splitmix32): the same seed replays the same run, which is
// what makes the screenshot scenes repeatable and the balance simulations fair.

export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function random() {
    state = (state + 0x9e3779b9) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 16), 0x21f0aaad);
    mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a2d97);
    mixed ^= mixed >>> 15;
    return (mixed >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function randomRange(random, min, max) {
  return min + random() * (max - min);
}

/** A whole number in [min, max]. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** One element of a list, uniformly. */
export function randomPick(random, list) {
  return list[Math.floor(random() * list.length)];
}
