// Every sound is synthesised with WebAudio: no audio files, nothing loaded. Short
// effects are envelopes over oscillators and filtered noise; the music is a slow pad
// progression with sparse plucks, scheduled ahead so it never stutters. The context
// is created only after a user gesture, and every call is safe when audio is off.

const CHORDS = [
  [110.0, 164.81, 261.63],
  [87.31, 130.81, 220.0],
  [98.0, 146.83, 246.94],
  [130.81, 196.0, 293.66],
];
const PLUCK_SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
const CHORD_SECONDS = 5;

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let chordIndex = 0;
  let nextChordAt = 0;
  let nextPluckAt = 0;
  let noiseBuffer = null;

  function ensureContext() {
    if (context) return context;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      const length = context.sampleRate;
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      context = null;
    }
    return context;
  }

  /** Call from a user gesture: browsers keep audio suspended until one. */
  function unlock() {
    const ctx = ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function tone({ frequency, endFrequency, type, start, duration, gain, destination }) {
    if (!context) return;
    try {
      const osc = context.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, start);
      if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(gain, start + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(envelope);
      envelope.connect(destination || master);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    } catch {
      // A failed blip never breaks the game.
    }
  }

  function noise({ start, duration, gain, filterFrequency, type }) {
    if (!context || !noiseBuffer) return;
    try {
      const source = context.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = type || 'lowpass';
      filter.frequency.value = filterFrequency;
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(gain, start + 0.01);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(master);
      source.start(start);
      source.stop(start + duration + 0.05);
    } catch {
      // A failed burst never breaks the game.
    }
  }

  function now() {
    return context ? context.currentTime : 0;
  }

  function playChord(at, notes) {
    for (const frequency of notes) {
      tone({ frequency, type: 'triangle', start: at, duration: CHORD_SECONDS + 1.2, gain: 0.05, destination: musicGain });
      tone({ frequency: frequency * 2.001, type: 'sine', start: at, duration: CHORD_SECONDS + 1.2, gain: 0.02, destination: musicGain });
    }
  }

  function scheduleMusic() {
    if (!context) return;
    const ahead = now() + 0.6;
    if (nextChordAt < ahead) {
      playChord(Math.max(nextChordAt, now() + 0.05), CHORDS[chordIndex % CHORDS.length]);
      chordIndex += 1;
      nextChordAt = Math.max(nextChordAt, now()) + CHORD_SECONDS;
    }
    if (nextPluckAt < ahead) {
      const note = PLUCK_SCALE[Math.floor(Math.random() * PLUCK_SCALE.length)];
      tone({ frequency: note, type: 'sine', start: Math.max(nextPluckAt, now() + 0.05), duration: 1.4, gain: 0.045, destination: musicGain });
      nextPluckAt = Math.max(nextPluckAt, now()) + 1.7 + Math.random() * 2.4;
    }
  }

  function startMusic() {
    if (!ensureContext() || musicTimer) return;
    nextChordAt = now() + 0.1;
    nextPluckAt = now() + 1.2;
    scheduleMusic();
    musicTimer = setInterval(scheduleMusic, 250);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function setMuted(value) {
    muted = value;
    if (master && context) master.gain.setTargetAtTime(muted ? 0 : 0.9, context.currentTime, 0.05);
  }

  function effect(name) {
    if (!context || muted || context.state !== 'running') return;
    const t = now();
    switch (name) {
      case 'shoot':
        tone({ frequency: 720, endFrequency: 420, type: 'square', start: t, duration: 0.07, gain: 0.05 });
        break;
      case 'frost':
        tone({ frequency: 1180, endFrequency: 900, type: 'sine', start: t, duration: 0.1, gain: 0.05 });
        break;
      case 'storm':
        tone({ frequency: 190, endFrequency: 60, type: 'sawtooth', start: t, duration: 0.16, gain: 0.07 });
        noise({ start: t, duration: 0.12, gain: 0.05, filterFrequency: 3200, type: 'highpass' });
        break;
      case 'die':
        noise({ start: t, duration: 0.16, gain: 0.09, filterFrequency: 900 });
        tone({ frequency: 260, endFrequency: 70, type: 'sine', start: t, duration: 0.18, gain: 0.07 });
        break;
      case 'place':
        tone({ frequency: 190, endFrequency: 95, type: 'sine', start: t, duration: 0.14, gain: 0.12 });
        tone({ frequency: 660, type: 'sine', start: t + 0.06, duration: 0.16, gain: 0.05 });
        break;
      case 'upgrade':
        [523.25, 659.25, 783.99].forEach((frequency, i) => {
          tone({ frequency, type: 'triangle', start: t + i * 0.07, duration: 0.22, gain: 0.08 });
        });
        break;
      case 'sell':
        tone({ frequency: 880, type: 'sine', start: t, duration: 0.09, gain: 0.07 });
        tone({ frequency: 660, type: 'sine', start: t + 0.08, duration: 0.12, gain: 0.07 });
        break;
      case 'denied':
        tone({ frequency: 110, type: 'square', start: t, duration: 0.09, gain: 0.06 });
        break;
      case 'wave':
        tone({ frequency: 174, type: 'sawtooth', start: t, duration: 0.5, gain: 0.06 });
        tone({ frequency: 261.63, type: 'sawtooth', start: t + 0.08, duration: 0.5, gain: 0.05 });
        break;
      case 'coreHit':
        tone({ frequency: 68, endFrequency: 40, type: 'sine', start: t, duration: 0.3, gain: 0.2 });
        noise({ start: t, duration: 0.2, gain: 0.08, filterFrequency: 500 });
        break;
      case 'clear':
        [392.0, 523.25, 659.25].forEach((frequency, i) => {
          tone({ frequency, type: 'triangle', start: t + i * 0.08, duration: 0.25, gain: 0.07 });
        });
        break;
      case 'victory':
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
          tone({ frequency, type: 'triangle', start: t + i * 0.12, duration: 0.5, gain: 0.09 });
        });
        break;
      case 'defeat':
        tone({ frequency: 220, endFrequency: 55, type: 'sawtooth', start: t, duration: 1.1, gain: 0.08 });
        tone({ frequency: 110, endFrequency: 40, type: 'sine', start: t + 0.1, duration: 1.2, gain: 0.1 });
        break;
      case 'click':
        tone({ frequency: 940, type: 'sine', start: t, duration: 0.04, gain: 0.04 });
        break;
      default:
        break;
    }
  }

  return {
    unlock,
    startMusic,
    stopMusic,
    setMuted,
    isMuted: () => muted,
    play: effect,
  };
}
