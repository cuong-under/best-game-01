// Every tuning number, colour and layout fact in one place. The simulation runs on a
// fixed 1280x720 logical field: the battlefield on the left, the command sidebar on the
// right. Nothing here touches the browser, so the rules can be simulated headlessly.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Build grid: 40px tiles over the battlefield (880px wide, 22 columns by 18 rows). */
export const GRID = { tile: 40, cols: 22, rows: 18, width: 880, height: 720 };

/** The sidebar's strip on the right of the field. */
export const SIDEBAR = { x: 880, width: 400 };

/** The slim status strip drawn across the top of the battlefield. */
export const TOPBAR = { height: 52 };

/**
 * The road the shadows walk, as tile-centre waypoints: in from the left edge, snaking
 * down and around, and ending at the lantern near the middle of the field.
 */
export const PATH_TILES = [
  [-1, 2],
  [19, 2],
  [19, 15],
  [3, 15],
  [3, 5],
  [16, 5],
  [16, 12],
  [6, 12],
  [6, 8],
  [11, 8],
];

export const PATH = PATH_TILES.map(([col, row]) => [(col + 0.5) * GRID.tile, (row + 0.5) * GRID.tile]);

/** The lantern's tile and pixel position: the last waypoint, the thing to defend. */
export const LANTERN_TILE = { col: 11, row: 8 };
export const LANTERN = { x: (LANTERN_TILE.col + 0.5) * GRID.tile, y: (LANTERN_TILE.row + 0.5) * GRID.tile };

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Tiles the road runs over: a tile is road when its centre is close to a path segment. */
export const ROAD_TILES = (() => {
  const tiles = new Set();
  for (let row = 0; row < GRID.rows; row += 1) {
    for (let col = 0; col < GRID.cols; col += 1) {
      const x = (col + 0.5) * GRID.tile;
      const y = (row + 0.5) * GRID.tile;
      for (let i = 0; i < PATH.length - 1; i += 1) {
        if (distanceToSegment(x, y, PATH[i][0], PATH[i][1], PATH[i + 1][0], PATH[i + 1][1]) < 22) {
          tiles.add(`${col},${row}`);
          break;
        }
      }
    }
  }
  return tiles;
})();

export function isRoadTile(col, row) {
  return ROAD_TILES.has(`${col},${row}`);
}

export function isLanternTile(col, row) {
  return col === LANTERN_TILE.col && row === LANTERN_TILE.row;
}

export function tileCentre(col, row) {
  return { x: (col + 0.5) * GRID.tile, y: (row + 0.5) * GRID.tile };
}

export const START_EMBERS = 170;
export const CORE_HP = 20;
export const SELL_REFUND = 0.7;
export const MAX_TOWERS = 40;

/** Embers for clearing a wave, and for calling the next wave while one still runs. */
export function waveClearBonus(wave) {
  return 28 + 5 * wave;
}
export function earlyCallBonus(wave) {
  return 12 + 2 * wave;
}

/**
 * The three towers. Each has three levels: the build cost buys level 1, and each level
 * names what upgrading to the next costs (0 on the last). Frost slows, storm splashes.
 */
export const TOWERS = {
  ember: {
    key: 'ember',
    name: 'Ember Spire',
    hotkey: '1',
    cost: 55,
    color: '#ff9a3c',
    glow: '#ffd76a',
    projectileSpeed: 430,
    blurb: 'Rapid bolts of living ember.',
    levels: [
      { damage: 5, range: 100, rate: 2.0, upgrade: 50 },
      { damage: 9, range: 110, rate: 2.2, upgrade: 80 },
      { damage: 14, range: 120, rate: 2.6, upgrade: 0 },
    ],
  },
  frost: {
    key: 'frost',
    name: 'Frost Lantern',
    hotkey: '2',
    cost: 85,
    color: '#7fd4ff',
    glow: '#d8f4ff',
    projectileSpeed: 340,
    blurb: 'Chills the march to a crawl.',
    levels: [
      { damage: 3, range: 95, rate: 1.0, slow: 0.3, slowTime: 1.6, upgrade: 70 },
      { damage: 6, range: 105, rate: 1.1, slow: 0.4, slowTime: 1.8, upgrade: 110 },
      { damage: 10, range: 115, rate: 1.2, slow: 0.5, slowTime: 2.2, upgrade: 0 },
    ],
  },
  storm: {
    key: 'storm',
    name: 'Storm Obelisk',
    hotkey: '3',
    cost: 140,
    color: '#c9a7ff',
    glow: '#efe0ff',
    projectileSpeed: 300,
    blurb: 'Heavy skyfire over groups.',
    levels: [
      { damage: 24, range: 150, rate: 0.6, splash: 55, upgrade: 120 },
      { damage: 40, range: 160, rate: 0.65, splash: 68, upgrade: 180 },
      { damage: 62, range: 170, rate: 0.75, splash: 80, upgrade: 0 },
    ],
  },
};

export const TOWER_ORDER = ['ember', 'frost', 'storm'];

/** Enemy kinds. hp and speed scale a little with the wave (see waves.js). */
export const ENEMIES = {
  shade: { name: 'Shade', hp: 30, speed: 66, bounty: 7, core: 1, radius: 13, body: '#3a3f5e', rim: '#5a5f86', eye: '#ffd76a' },
  swift: { name: 'Swift', hp: 18, speed: 110, bounty: 8, core: 1, radius: 10, body: '#4a3a5e', rim: '#6e5686', eye: '#8ef0ff' },
  bulwark: { name: 'Bulwark', hp: 170, speed: 36, bounty: 16, core: 2, radius: 18, body: '#2e3348', rim: '#4c5470', eye: '#ff7a5c' },
  splitter: { name: 'Splitter', hp: 60, speed: 54, bounty: 9, core: 1, radius: 15, body: '#3e4a3a', rim: '#5c7052', eye: '#a8ff7a', splitsInto: 'spark', splitCount: 2 },
  spark: { name: 'Spark', hp: 13, speed: 115, bounty: 3, core: 1, radius: 8, body: '#4a3a5e', rim: '#6e5686', eye: '#ffe98a' },
  boss: { name: 'Nightmaw', hp: 9000, speed: 26, bounty: 200, core: 10, radius: 26, body: '#241d33', rim: '#453a5e', eye: '#ff4d6d' },
};

/**
 * The ten waves. Each group spawns its count at its gap, starting after its delay
 * (seconds from the wave's start). The last wave holds the boss and its escort.
 */
export const WAVES = [
  { groups: [{ type: 'shade', count: 8, gap: 0.9, delay: 0 }] },
  { groups: [{ type: 'shade', count: 12, gap: 0.8, delay: 0 }] },
  {
    groups: [
      { type: 'shade', count: 8, gap: 0.8, delay: 0 },
      { type: 'swift', count: 6, gap: 0.6, delay: 2 },
    ],
  },
  {
    groups: [
      { type: 'shade', count: 10, gap: 0.75, delay: 0 },
      { type: 'bulwark', count: 4, gap: 1.4, delay: 3 },
    ],
  },
  {
    groups: [
      { type: 'swift', count: 14, gap: 0.55, delay: 0 },
      { type: 'shade', count: 6, gap: 0.8, delay: 2 },
    ],
  },
  {
    groups: [
      { type: 'splitter', count: 10, gap: 0.9, delay: 0 },
      { type: 'shade', count: 10, gap: 0.7, delay: 2 },
    ],
  },
  {
    groups: [
      { type: 'bulwark', count: 8, gap: 1.2, delay: 0 },
      { type: 'swift', count: 18, gap: 0.5, delay: 2 },
    ],
  },
  {
    groups: [
      { type: 'splitter', count: 14, gap: 0.75, delay: 0 },
      { type: 'bulwark', count: 8, gap: 1.1, delay: 3 },
    ],
  },
  {
    groups: [
      { type: 'shade', count: 24, gap: 0.55, delay: 0 },
      { type: 'swift', count: 20, gap: 0.45, delay: 2 },
      { type: 'bulwark', count: 8, gap: 1.0, delay: 4 },
      { type: 'splitter', count: 6, gap: 0.9, delay: 6 },
    ],
  },
  {
    groups: [
      { type: 'boss', count: 1, gap: 1, delay: 0 },
      { type: 'shade', count: 12, gap: 0.7, delay: 4 },
      { type: 'splitter', count: 6, gap: 1.0, delay: 8 },
    ],
  },
];

export const TOTAL_WAVES = WAVES.length;

/** Score: bounty fivefold per kill, a flat wave bonus, and a victory bonus on the core's health. */
export const SCORE = { killMultiplier: 5, waveClear: 100, victory: 500, coreHealth: 25 };

export const PALETTE = {
  backdrop: '#0d0a18',
  groundA: '#1e1834',
  groundB: '#221c3c',
  road: '#5a4766',
  roadEdge: '#71608a',
  roadSpeck: '#84719a',
  panel: '#241d3a',
  panelEdge: '#3d3358',
  card: '#2b2344',
  cardHover: '#352a52',
  cardDisabled: '#211b33',
  text: '#f2ead8',
  muted: '#a99fc0',
  ember: '#ffb347',
  emberBright: '#ffd76a',
  core: '#ff6b4a',
  frost: '#7fd4ff',
  storm: '#c9a7ff',
  good: '#8fe08a',
  bad: '#ff6b6b',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'last-lantern.best';
