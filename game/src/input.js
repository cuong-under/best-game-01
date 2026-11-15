// Keyboard and pointer input. One-shot presses (start, pause, hotkeys) are queued as
// bit flags and taken once by the loop, so a press between two frames is never lost
// and never counted twice. Pointer events arrive already converted to logical field
// coordinates, and clicks queue up the same way.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_START_WAVE = 4;
export const ACTION_SPEED = 8;
export const ACTION_UPGRADE = 16;
export const ACTION_SELL = 32;
export const ACTION_RESTART = 64;
export const ACTION_MUTE = 128;
export const ACTION_CANCEL = 256;
export const ACTION_TOWER_1 = 512;
export const ACTION_TOWER_2 = 1024;
export const ACTION_TOWER_3 = 2048;

const KEY_ACTIONS = new Map([
  ['Space', ACTION_START_WAVE],
  ['Enter', ACTION_CONFIRM],
  ['KeyP', ACTION_PAUSE],
  ['KeyF', ACTION_SPEED],
  ['KeyU', ACTION_UPGRADE],
  ['KeyX', ACTION_SELL],
  ['Delete', ACTION_SELL],
  ['Backspace', ACTION_SELL],
  ['KeyR', ACTION_RESTART],
  ['KeyM', ACTION_MUTE],
  ['Escape', ACTION_CANCEL],
  ['Digit1', ACTION_TOWER_1],
  ['Numpad1', ACTION_TOWER_1],
  ['Digit2', ACTION_TOWER_2],
  ['Numpad2', ACTION_TOWER_2],
  ['Digit3', ACTION_TOWER_3],
  ['Numpad3', ACTION_TOWER_3],
]);

export function createInput(canvas, toLogical) {
  let actions = 0;
  let pointer = { x: -100, y: -100, inside: false };
  const clicks = [];
  let rightClicks = 0;

  window.addEventListener('keydown', (event) => {
    const action = KEY_ACTIONS.get(event.code);
    if (action === undefined) return;
    if (!event.repeat) actions |= action;
    if (event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('blur', () => {
    pointer = { x: -100, y: -100, inside: false };
  });
  canvas.addEventListener('pointermove', (event) => {
    pointer = { ...toLogical(event.clientX, event.clientY), inside: true };
  });
  canvas.addEventListener('pointerleave', () => {
    pointer = { x: -100, y: -100, inside: false };
  });
  canvas.addEventListener('pointerdown', (event) => {
    const at = toLogical(event.clientX, event.clientY);
    if (event.button === 2) {
      rightClicks += 1;
      return;
    }
    clicks.push({ x: at.x, y: at.y, time: performance.now() });
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** The pointer's logical position, or off-field when it left the canvas. */
    pointer() {
      return pointer;
    },
    /** One-shot key presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Clicks since the last call, in logical coordinates, oldest first. */
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
    /** Right-clicks since the last call (used to cancel placement). */
    takeRightClicks() {
      const taken = rightClicks;
      rightClicks = 0;
      return taken;
    },
  };
}
