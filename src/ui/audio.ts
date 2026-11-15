// Tiny sound effects made with the Web Audio API (no files). Off until the player turns it on; remembered in localStorage.
let ctx: AudioContext | null = null;
let on = false;
try { on = localStorage.getItem('catalyx.sound') === '1'; } catch { /* ignore */ }

export const soundOn = () => on;
export function setSound(v: boolean) {
  on = v;
  try { localStorage.setItem('catalyx.sound', v ? '1' : '0'); } catch { /* ignore */ }
  if (v) beep(660, 0.08, 'sine', 0.05);
}

function ac(): AudioContext | null {
  if (!on) return null;
  try {
    const A = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!A) return null;
    ctx = ctx ?? new A();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

export function beep(freq: number, dur = 0.12, type: OscillatorType = 'sine', gain = 0.06, when = 0) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  const t = c.currentTime + when;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

/** Low rumble for liftoff. */
export function rumble(seconds = 1.6) {
  const c = ac();
  if (!c) return;
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5 * Math.min(1, i / (len * 0.2)) * (1 - i / len); }
  const src = c.createBufferSource(), g = c.createGain();
  src.buffer = buf; g.gain.value = 0.5;
  src.connect(g).connect(c.destination);
  src.start();
}

export const sfx = {
  tick: () => beep(520, 0.07, 'square', 0.03),
  go: () => beep(880, 0.12, 'sine', 0.05),
  nogo: () => beep(220, 0.2, 'sawtooth', 0.04),
  good: () => { beep(660, 0.1, 'sine', 0.05); beep(880, 0.14, 'sine', 0.05, 0.1); },
  warn: () => beep(330, 0.18, 'triangle', 0.06),
  bad: () => { beep(220, 0.2, 'sawtooth', 0.05); beep(165, 0.3, 'sawtooth', 0.05, 0.18); },
  alert: () => { beep(740, 0.1, 'square', 0.04); beep(740, 0.1, 'square', 0.04, 0.2); },
};
