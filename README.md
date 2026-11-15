# best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/cuong-under/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/cuong-under/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

The Last Lantern — an original tower-defense game for the make.fun best-game-01 bounty. Night is coming down the road, and one lantern still burns at the middle of the field. Build towers beside the road, spend embers wisely, and hold the light through ten waves of shadows — fast Swifts, armoured Bulwarks, Splitters that burst into Sparks, and the Nightmaw itself on the final wave.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step: `game/` is plain static files.

---

<sub>Entered on [make.fun](https://make.fun/?ref=envcarcq&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

## How it plays

- **Build** three tower types, each with three levels: the rapid Ember Spire, the slowing Frost Lantern, and the splash-damage Storm Obelisk. Click a card (or press 1/2/3), then click a tile. Click a tower to upgrade or sell it.
- **Earn embers** for every shadow banished, for clearing a wave, and for calling the next wave early while one still runs.
- **Win** by surviving all ten waves. **Lose** if the shadows drain the lantern's health to zero.
- **Controls**: mouse-first, plus hotkeys — Space starts a wave, F toggles 2× speed, P pauses, U upgrades, X sells, R restarts, M mutes, Esc cancels or pauses.
- Everything is procedural: Canvas 2D art drawn in code, WebAudio-synthesised sound effects and a generative ambient music loop. No assets, no libraries, no network requests. The best score is kept in the browser only.

## Layout

- `game/index.html` — the page and canvas.
- `game/src/main.js` — boot, fixed-step loop, screens.
- `game/src/world.js` — the rules: towers, enemies, waves, economy, win/lose.
- `game/src/config.js` — every tuning number, colour and layout fact.
- `game/src/towers.js`, `enemies.js`, `waves.js` — one job each.
- `game/src/render.js`, `hud.js` — the battlefield and the chrome around it.
- `game/src/input.js`, `audio.js`, `particles.js`, `random.js` — support.
- `game/src/shots.js` — the seeded autopilot that stages the screenshots and balance-tests the game headlessly.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to the output directory and writes `dossier.json`.
- `screenshots/` — four real renders of real games, staged by the autopilot.

## Balance

Simulated headlessly over seeds 1–20 with the autopilot in `shots.js`: a strong player wins 18/20, a decent player wins 9/20, and building nothing loses 20/20. The game is meant to be lost sometimes.
