// ============================================================
//  ORBITAR — звук: PSG-блипы, FM-удары и трекерная музыка
//  (SN76489 + YM2612 + эхо SPC700 — всё синтезируется на лету)
// ============================================================
'use strict';

const SFX = (() => {

// ---------- узлы ----------
let ctx = null, comp, master, sfxBus, musBus, echoIn, panOK = false;
let on = true, musicOn = true;
let voices = 0;                          // грубый счётчик голосов эффектов: страховка от каши
const MAX_VOICES = 32;
// музыку лимит не режет: её голоса ограничены самим паттерном (4 канала)
const busy = o => voices > MAX_VOICES && o.bus !== musBus;
const waves = {};                        // PeriodicWave по скважности
const noiseBufs = {};
const lastAt = {};                       // троттлинг одинаковых звуков

const VOL = { master: 0.5, sfx: 0.9, music: 0.34 };

function pulseWave(duty) {
  const n = 20, real = new Float32Array(n), imag = new Float32Array(n);
  for (let i = 1; i < n; i++) imag[i] = 2 / (i * Math.PI) * Math.sin(i * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}
// white — обычный шум, lfsr — ступенчатый (ближе к PSG), metal — плотный высокий
function makeNoise(kind) {
  const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  const step = kind === 'lfsr' ? 12 : 1;
  let v = 0;
  for (let i = 0; i < len; i++) {
    if (i % step === 0) v = Math.random() * 2 - 1;
    d[i] = kind === 'metal' ? v * (0.6 + 0.4 * Math.sin(i * 0.7)) : v;
  }
  return buf;
}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();

  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 14; comp.ratio.value = 7;
  comp.attack.value = 0.003; comp.release.value = 0.2;

  master = ctx.createGain(); master.gain.value = on ? VOL.master : 0;
  comp.connect(master); master.connect(ctx.destination);

  sfxBus = ctx.createGain(); sfxBus.gain.value = VOL.sfx; sfxBus.connect(comp);
  musBus = ctx.createGain(); musBus.gain.value = musicOn ? VOL.music : 0; musBus.connect(comp);

  // эхо в духе SPC700 — общий посыл, звучит «по-консольному»
  const dl = ctx.createDelay(0.6); dl.delayTime.value = 0.126;
  const fb = ctx.createGain(); fb.gain.value = 0.32;
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600;
  echoIn = ctx.createGain(); echoIn.gain.value = 0.5;
  echoIn.connect(dl); dl.connect(tone); tone.connect(fb); fb.connect(dl); dl.connect(comp);

  waves.p12 = pulseWave(0.125); waves.p25 = pulseWave(0.25); waves.p50 = pulseWave(0.5);
  noiseBufs.white = makeNoise('white');
  noiseBufs.lfsr = makeNoise('lfsr');
  noiseBufs.metal = makeNoise('metal');
  panOK = typeof ctx.createStereoPanner === 'function';
  return ctx;
}

// ---------- базовые голоса ----------
function chain(o, t, dur) {                       // общий хвост: пан + эхо + учёт голосов
  const g = ctx.createGain();
  let out = g;
  if (panOK && o.pan) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); g.connect(p); out = p; }
  out.connect(o.bus || sfxBus);
  if (o.echo) out.connect(echoIn);
  if (o.bus !== musBus) { voices++; setTimeout(() => voices--, (dur + 0.1) * 1000); }
  return g;
}
function env(g, t, o) {
  const vol = o.vol ?? 0.3, a = o.a ?? 0.004, dur = o.dur ?? 0.15;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + a);
  if (o.sus) {
    const rel = o.rel ?? 0.05;
    g.gain.setValueAtTime(vol, t + Math.max(a, dur - rel));
  } else if (o.hold) {
    g.gain.setValueAtTime(vol, t + a + o.hold);
  }
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function pitch(param, t, o) {
  const dur = o.dur ?? 0.15;
  param.setValueAtTime(o.f, t);
  if (o.f2 && o.f2 !== o.f) {
    const gl = t + dur * (o.gl ?? 1);
    if (o.lin) param.linearRampToValueAtTime(o.f2, gl);
    else param.exponentialRampToValueAtTime(Math.max(1, o.f2), gl);
  }
}

// тон: p12/p25/p50 (PSG), sine/triangle/sawtooth/square
function blip(o) {
  if (!ctx || busy(o)) return;
  const t = o.t0 ?? ctx.currentTime, dur = o.dur ?? 0.15;
  const osc = ctx.createOscillator();
  if (waves[o.wave]) osc.setPeriodicWave(waves[o.wave]); else osc.type = o.wave || 'square';
  pitch(osc.frequency, t, o);
  const g = chain(o, t, dur);
  env(g, t, o);
  osc.connect(g);
  if (o.vib) {                                   // вибрато: LFO в герцах поверх частоты
    const lfo = ctx.createOscillator(), la = ctx.createGain();
    lfo.frequency.value = o.vibHz || 7; la.gain.value = o.vib;
    lfo.connect(la); la.connect(osc.frequency);
    lfo.start(t); lfo.stop(t + dur + 0.02);
  }
  osc.start(t); osc.stop(t + dur + 0.02);
}

// FM-голос: модулятор в частоту несущей — металл и «мясо» YM2612
function fm(o) {
  if (!ctx || busy(o)) return;
  const t = o.t0 ?? ctx.currentTime, dur = o.dur ?? 0.2;
  const car = ctx.createOscillator();
  if (waves[o.wave]) car.setPeriodicWave(waves[o.wave]); else car.type = o.wave || 'sine';
  pitch(car.frequency, t, o);

  const mod = ctx.createOscillator(); mod.type = o.modWave || 'sine';
  mod.frequency.setValueAtTime(o.f * (o.ratio ?? 2), t);
  if (o.f2) mod.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2 * (o.ratio ?? 2)), t + dur * (o.gl ?? 1));
  const mg = ctx.createGain();
  const idx = o.f * (o.index ?? 3);
  mg.gain.setValueAtTime(idx, t);
  mg.gain.exponentialRampToValueAtTime(Math.max(1, idx * (o.idxEnd ?? 0.04)), t + dur * (o.idxDecay ?? 0.7));
  mod.connect(mg); mg.connect(car.frequency);

  const g = chain(o, t, dur);
  env(g, t, o);
  car.connect(g);
  mod.start(t); mod.stop(t + dur + 0.02);
  car.start(t); car.stop(t + dur + 0.02);
}

// шум через фильтр с разгоном/спадом — удары, взрывы, шипение
function noise(o) {
  if (!ctx || busy(o)) return;
  const t = o.t0 ?? ctx.currentTime, dur = o.dur ?? 0.15;
  const src = ctx.createBufferSource();
  src.buffer = noiseBufs[o.kind || 'white'];
  src.loop = true;
  src.playbackRate.value = o.rate ?? 1;
  const f = ctx.createBiquadFilter();
  f.type = o.filter || 'lowpass';
  f.Q.value = o.q ?? 1;
  pitch(f.frequency, t, { f: o.f ?? 2000, f2: o.f2, dur, gl: o.gl, lin: o.lin });
  const g = chain(o, t, dur);
  env(g, t, o);
  src.connect(f); f.connect(g);
  src.start(t); src.stop(t + dur + 0.02);
}

// ---------- ноты ----------
const SEMI = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const freqCache = {};
function nf(tok) {
  if (freqCache[tok]) return freqCache[tok];
  const m = /^([a-g])([#b]?)(-?\d)$/.exec(tok);
  if (!m) return 440;
  let s = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
  return (freqCache[tok] = 440 * Math.pow(2, (s - 69) / 12));
}

// ---------- каталог эффектов ----------
// Каждый — функция (t, o): t — время старта, o — { pan, vol }
const DEFS = {
  // ---- игрок ----
  jump: (t, o) => blip({ t0: t, wave: 'p25', f: 300, f2: 660, gl: 0.55, dur: 0.15, vol: 0.2 * o.v, a: 0.005, pan: o.pan }),
  land: (t, o) => {
    noise({ t0: t, kind: 'lfsr', filter: 'lowpass', f: 1700, f2: 300, dur: 0.09, vol: 0.13 * o.v, pan: o.pan });
    blip({ t0: t, wave: 'triangle', f: 150, f2: 70, dur: 0.07, vol: 0.12 * o.v, pan: o.pan });
  },
  stomp: (t, o) => {
    noise({ t0: t, kind: 'lfsr', filter: 'bandpass', f: 2600, f2: 500, q: 1.4, dur: 0.14, vol: 0.2 * o.v, pan: o.pan });
    fm({ t0: t, f: 440, f2: 110, ratio: 1.5, index: 5, dur: 0.16, vol: 0.16 * o.v, wave: 'square', pan: o.pan });
    blip({ t0: t + 0.02, wave: 'p12', f: 900, f2: 1500, dur: 0.08, vol: 0.09 * o.v, pan: o.pan, echo: true });
  },
  spring: (t, o) => blip({ t0: t, wave: 'p50', f: 200, f2: 1200, gl: 0.7, dur: 0.28, vol: 0.19 * o.v, vib: 26, vibHz: 15, pan: o.pan, echo: true }),
  cell: (t, o) => {                                  // «монетка»: две ноты вверх
    blip({ t0: t, wave: 'p12', f: nf('e6'), dur: 0.05, vol: 0.15 * o.v, pan: o.pan });
    blip({ t0: t + 0.05, wave: 'p12', f: nf('b6'), dur: 0.17, vol: 0.15 * o.v, pan: o.pan, echo: true });
  },
  checkpoint: (t, o) => ['e5', 'a5', 'c6', 'e6'].forEach((n, i) =>
    blip({ t0: t + i * 0.065, wave: 'p25', f: nf(n), dur: i === 3 ? 0.3 : 0.09, vol: 0.15 * o.v, echo: true })),
  die: (t, o) => {
    blip({ t0: t, wave: 'p25', f: 620, f2: 300, dur: 0.12, vol: 0.2 * o.v });
    blip({ t0: t + 0.12, wave: 'p25', f: 440, f2: 55, gl: 1, dur: 0.55, vol: 0.22 * o.v, vib: 10, vibHz: 12, echo: true });
    noise({ t0: t + 0.1, kind: 'lfsr', filter: 'lowpass', f: 2200, f2: 200, dur: 0.45, vol: 0.12 * o.v });
  },
  respawn: (t, o) => {
    blip({ t0: t, wave: 'p12', f: 180, f2: 900, gl: 0.8, dur: 0.22, vol: 0.13 * o.v, echo: true });
  },

  // ---- мир ----
  crumble: (t, o) => noise({ t0: t, kind: 'lfsr', filter: 'bandpass', f: 3000, f2: 1400, q: 2.4, dur: 0.1, vol: 0.1 * o.v, pan: o.pan }),
  crumbleGone: (t, o) => {
    noise({ t0: t, kind: 'white', filter: 'bandpass', f: 2000, f2: 420, q: 1.2, dur: 0.3, vol: 0.16 * o.v, pan: o.pan });
    blip({ t0: t, wave: 'triangle', f: 190, f2: 60, dur: 0.18, vol: 0.1 * o.v, pan: o.pan });
  },
  pressSlam: (t, o) => {
    noise({ t0: t, kind: 'white', filter: 'lowpass', f: 2600, f2: 160, dur: 0.34, vol: 0.22 * o.v, pan: o.pan });
    fm({ t0: t, f: 110, f2: 40, ratio: 1.02, index: 7, idxDecay: 0.5, dur: 0.4, vol: 0.26 * o.v, wave: 'sine', pan: o.pan });
  },
  gateWarn: (t, o) => blip({ t0: t, wave: 'p25', f: 1500, dur: 0.06, vol: 0.08 * o.v, pan: o.pan }),
  gateOn: (t, o) => {
    fm({ t0: t, f: 320, f2: 150, ratio: 3.01, index: 6, dur: 0.3, vol: 0.13 * o.v, wave: 'sawtooth', pan: o.pan });
    noise({ t0: t, kind: 'metal', filter: 'bandpass', f: 3400, f2: 1200, q: 3, dur: 0.26, vol: 0.09 * o.v, pan: o.pan });
  },
  phase: (t, o) => blip({ t0: t, wave: 'p12', f: 1900, f2: 1300, dur: 0.05, vol: 0.06 * o.v }),

  // ---- враги ----
  shot: (t, o) => {
    fm({ t0: t, f: 900, f2: 260, ratio: 2.5, index: 4, dur: 0.16, vol: 0.13 * o.v, wave: 'square', pan: o.pan });
    noise({ t0: t, kind: 'lfsr', filter: 'highpass', f: 2200, dur: 0.07, vol: 0.05 * o.v, pan: o.pan });
  },
  leap: (t, o) => blip({ t0: t, wave: 'p50', f: 220, f2: 520, gl: 0.6, dur: 0.14, vol: 0.1 * o.v, pan: o.pan }),
  leapTell: (t, o) => blip({ t0: t, wave: 'p12', f: 700, f2: 480, dur: 0.09, vol: 0.07 * o.v, pan: o.pan }),
  spawn: (t, o) => {
    blip({ t0: t, wave: 'p12', f: 1400, f2: 420, dur: 0.18, vol: 0.11 * o.v, pan: o.pan, echo: true });
    noise({ t0: t, kind: 'white', filter: 'bandpass', f: 1600, f2: 600, q: 2, dur: 0.2, vol: 0.08 * o.v, pan: o.pan });
  },

  // ---- боссы ----
  bossWake: (t, o) => {
    for (let i = 0; i < 4; i++) {                    // тревожная сирена
      blip({ t0: t + i * 0.3, wave: 'p25', f: nf('a4'), f2: nf('e5'), gl: 0.5, dur: 0.26, vol: 0.18 * o.v, echo: true });
      blip({ t0: t + i * 0.3 + 0.14, wave: 'p25', f: nf('e5'), f2: nf('a4'), gl: 0.5, dur: 0.26, vol: 0.18 * o.v });
    }
    fm({ t0: t, f: 55, ratio: 1.01, index: 4, dur: 1.4, vol: 0.2 * o.v, sus: true, rel: 0.5, wave: 'sawtooth' });
  },
  bossShot: (t, o) => fm({ t0: t, f: 620, f2: 180, ratio: 1.41, index: 6, dur: 0.22, vol: 0.15 * o.v, wave: 'square', pan: o.pan }),
  lance: (t, o) => fm({ t0: t, f: 1100, f2: 300, ratio: 3.5, index: 5, dur: 0.2, vol: 0.13 * o.v, wave: 'sawtooth', pan: o.pan, echo: true }),
  spore: (t, o) => {
    blip({ t0: t, wave: 'p12', f: 260, f2: 760, gl: 0.5, dur: 0.2, vol: 0.12 * o.v, pan: o.pan });
    noise({ t0: t, kind: 'white', filter: 'bandpass', f: 900, f2: 2400, q: 1.6, dur: 0.22, vol: 0.1 * o.v, pan: o.pan });
  },
  drip: (t, o) => blip({ t0: t, wave: 'p12', f: 1500, f2: 420, dur: 0.14, vol: 0.09 * o.v, pan: o.pan, echo: true }),
  dash: (t, o) => {
    noise({ t0: t, kind: 'white', filter: 'bandpass', f: 400, f2: 2600, q: 1.1, dur: 0.42, vol: 0.15 * o.v, pan: o.pan });
    fm({ t0: t, f: 140, f2: 320, ratio: 1.5, index: 4, dur: 0.4, vol: 0.12 * o.v, wave: 'sawtooth', pan: o.pan });
  },
  slam: (t, o) => {
    noise({ t0: t, kind: 'white', filter: 'lowpass', f: 3200, f2: 120, dur: 0.55, vol: 0.26 * o.v });
    fm({ t0: t, f: 90, f2: 32, ratio: 1.01, index: 9, idxDecay: 0.4, dur: 0.6, vol: 0.3 * o.v, wave: 'sine' });
    blip({ t0: t, wave: 'p50', f: 260, f2: 60, dur: 0.3, vol: 0.12 * o.v });
  },
  blink: (t, o) => {
    blip({ t0: t, wave: 'p12', f: 1800, f2: 200, dur: 0.13, vol: 0.12 * o.v, echo: true });
    blip({ t0: t + 0.1, wave: 'p12', f: 260, f2: 1900, dur: 0.13, vol: 0.12 * o.v, pan: o.pan, echo: true });
  },
  bossOpen: (t, o) => {                              // броня раскрылась — «бей сюда»
    ['c5', 'g5', 'c6'].forEach((n, i) => blip({ t0: t + i * 0.07, wave: 'p25', f: nf(n), dur: 0.22, vol: 0.13 * o.v, echo: true }));
    noise({ t0: t, kind: 'metal', filter: 'bandpass', f: 1200, f2: 3000, q: 2, dur: 0.25, vol: 0.1 * o.v });
  },
  tell: (t, o) => [0, 0.12, 0.24].forEach((dt, i) =>
    blip({ t0: t + dt, wave: 'p12', f: 1000 + i * 220, dur: 0.08, vol: 0.1 * o.v, pan: o.pan })),
  boom: (t, o) => {
    noise({ t0: t, kind: 'white', filter: 'lowpass', f: 2400, f2: 150, dur: 0.3, vol: 0.16 * o.v, pan: o.pan });
    fm({ t0: t, f: 100, f2: 38, ratio: 1.02, index: 7, dur: 0.32, vol: 0.16 * o.v, wave: 'sine', pan: o.pan });
  },
  bossHit: (t, o) => {
    fm({ t0: t, f: 300, f2: 90, ratio: 2.41, index: 9, idxDecay: 0.5, dur: 0.4, vol: 0.26 * o.v, wave: 'square' });
    noise({ t0: t, kind: 'metal', filter: 'bandpass', f: 3600, f2: 700, q: 1.6, dur: 0.3, vol: 0.18 * o.v });
    blip({ t0: t + 0.03, wave: 'p25', f: 1400, f2: 700, dur: 0.16, vol: 0.1 * o.v, echo: true });
  },
  bossDie: (t, o) => {
    for (let i = 0; i < 7; i++) {                    // серия взрывов
      const tt = t + i * 0.16;
      noise({ t0: tt, kind: 'white', filter: 'lowpass', f: 2600 - i * 260, f2: 110, dur: 0.4, vol: 0.2 * o.v, pan: (i % 2 ? 0.5 : -0.5) });
      fm({ t0: tt, f: 120 - i * 8, f2: 36, ratio: 1.02, index: 8, dur: 0.45, vol: 0.2 * o.v, wave: 'sine' });
    }
    blip({ t0: t + 1.1, wave: 'p25', f: 900, f2: 40, gl: 1, dur: 1.2, vol: 0.14 * o.v, echo: true });
  },

  // ---- интерфейс ----
  intro: (t, o) => ['a4', 'c5', 'e5', 'a5'].forEach((n, i) =>
    blip({ t0: t + i * 0.1, wave: 'p25', f: nf(n), dur: i === 3 ? 0.5 : 0.12, vol: 0.14 * o.v, echo: true })),
  select: (t, o) => {
    blip({ t0: t, wave: 'p25', f: nf('e5'), dur: 0.06, vol: 0.14 * o.v });
    blip({ t0: t + 0.06, wave: 'p25', f: nf('a5'), dur: 0.16, vol: 0.14 * o.v, echo: true });
  },
  cheat: (t, o) => ['c5', 'f#5', 'c6', 'f#6'].forEach((n, i) =>
    blip({ t0: t + i * 0.05, wave: 'p12', f: nf(n), dur: 0.1, vol: 0.12 * o.v, echo: true })),
  clear: (t, o) => {                                 // фанфара уровня
    const notes = [['c5', 0], ['e5', 0.11], ['g5', 0.22], ['c6', 0.33], ['g5', 0.47], ['c6', 0.58]];
    for (const [n, dt] of notes) {
      blip({ t0: t + dt, wave: 'p25', f: nf(n), dur: dt > 0.4 ? 0.9 : 0.16, vol: 0.2 * o.v, echo: true });
      blip({ t0: t + dt, wave: 'p12', f: nf(n) * 2, dur: dt > 0.4 ? 0.7 : 0.12, vol: 0.07 * o.v });
    }
    blip({ t0: t, wave: 'p50', f: nf('c3'), dur: 0.5, vol: 0.16 * o.v });
    blip({ t0: t + 0.47, wave: 'p50', f: nf('c3'), dur: 1.0, vol: 0.16 * o.v, sus: true, rel: 0.3 });
  },
  win: (t, o) => {                                   // финальная фанфара
    const seq = [['c5', 0, 0.14], ['e5', 0.14, 0.14], ['g5', 0.28, 0.14], ['c6', 0.42, 0.3],
                 ['b5', 0.76, 0.14], ['c6', 0.9, 0.16], ['d6', 1.06, 0.16], ['e6', 1.22, 1.4]];
    for (const [n, dt, du] of seq) {
      blip({ t0: t + dt, wave: 'p25', f: nf(n), dur: du, vol: 0.2 * o.v, sus: du > 0.5, rel: 0.4, echo: true });
      blip({ t0: t + dt, wave: 'p12', f: nf(n) * 1.5, dur: du * 0.8, vol: 0.07 * o.v });
    }
    [['c3', 0, 0.4], ['g3', 0.42, 0.3], ['c3', 0.76, 0.4], ['c3', 1.22, 1.4]].forEach(([n, dt, du]) =>
      blip({ t0: t + dt, wave: 'p50', f: nf(n), dur: du, vol: 0.17 * o.v, sus: du > 0.5, rel: 0.4 }));
    noise({ t0: t + 1.22, kind: 'metal', filter: 'highpass', f: 5000, dur: 1.2, vol: 0.08 * o.v });
  },
  toggle: (t, o) => blip({ t0: t, wave: 'p25', f: 520, f2: 780, dur: 0.1, vol: 0.14 * o.v }),
};

// минимальный интервал между повторами одного звука, мс
const GAP = { land: 60, crumble: 90, phase: 120, shot: 40, drip: 50, gateWarn: 70, gateOn: 70, pressSlam: 60,
             tell: 150, leap: 80, leapTell: 80, boom: 70, spore: 60, lance: 60, cell: 40, spawn: 120 };

function play(name, o) {
  if (!on || !ctx || ctx.state !== 'running') return;
  const def = DEFS[name];
  if (!def) return;
  const now = performance.now();
  if (now - (lastAt[name] || -1e9) < (GAP[name] ?? 25)) return;
  lastAt[name] = now;
  def(ctx.currentTime + 0.005 + ((o && o.delay) || 0), { pan: (o && o.pan) || 0, v: (o && o.vol) ?? 1 });
}

// ---------- зацикленные звуки (поток вентилятора, луч босса) ----------
const LOOPS = {
  vent: () => {
    const src = ctx.createBufferSource(); src.buffer = noiseBufs.white; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 760; f.Q.value = 1.1;
    const lfo = ctx.createOscillator(), la = ctx.createGain();
    lfo.frequency.value = 0.7; la.gain.value = 240; lfo.connect(la); la.connect(f.frequency);
    src.connect(f); src.start(); lfo.start();
    return { out: f, vol: 0.13, stop: t => { src.stop(t); lfo.stop(t); } };
  },
  beam: () => {
    const a = ctx.createOscillator(); a.type = 'sawtooth'; a.frequency.value = 58;
    const b = ctx.createOscillator(); b.type = 'square'; b.frequency.value = 87;
    const src = ctx.createBufferSource(); src.buffer = noiseBufs.metal; src.loop = true;
    const ng = ctx.createGain(); ng.gain.value = 0.25; src.connect(ng);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1300; f.Q.value = 4;
    const lfo = ctx.createOscillator(), la = ctx.createGain();
    lfo.frequency.value = 11; la.gain.value = 700; lfo.connect(la); la.connect(f.frequency);
    a.connect(f); b.connect(f); ng.connect(f);
    a.start(); b.start(); src.start(); lfo.start();
    return { out: f, vol: 0.16, stop: t => { a.stop(t); b.stop(t); src.stop(t); lfo.stop(t); } };
  },
};
const active = {};
function loop(name, want, o) {
  if (!ctx || ctx.state !== 'running' || !LOOPS[name]) return;
  want = want && on;
  const cur = active[name];
  if (want && !cur) {
    const v = LOOPS[name]();
    const g = ctx.createGain(); g.gain.value = 0.0001;
    let out = g;
    if (panOK) { v.pan = ctx.createStereoPanner(); g.connect(v.pan); out = v.pan; }
    out.connect(sfxBus);
    v.out.connect(g);
    g.gain.exponentialRampToValueAtTime(v.vol * ((o && o.vol) ?? 1), ctx.currentTime + 0.08);
    v.gain = g;
    active[name] = v;
  } else if (!want && cur) {
    const t = ctx.currentTime;
    cur.gain.gain.cancelScheduledValues(t);
    cur.gain.gain.setValueAtTime(Math.max(0.0001, cur.gain.gain.value), t);
    cur.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    cur.stop(t + 0.14);
    delete active[name];
  }
  if (want && active[name] && active[name].pan && o && o.pan != null)
    active[name].pan.pan.value = Math.max(-1, Math.min(1, o.pan));
}
function stopLoops() { for (const k in active) loop(k, false); }

// ---------- музыка: мини-трекер ----------
//  Нотация: один токен = 1/16. 'a4' — нота, '-' — держать, '.' — пауза.
//  Ударные: k — бочка, s — малый, h — хэт, H — открытый, c — крэш.
const TRACKS = {
  foundry: {                                     // ORBITAL FOUNDRY — холодный драйв, Am
    bpm: 152,
    bass: { wave: 'p50', vol: 0.3, pat: [
      'a2 . a2 . a2 . a2 . a2 . a2 . a2 . a3 .',
      'a2 . a2 . a2 . a2 . a2 . a2 . e3 . e2 .',
      'f2 . f2 . f2 . f2 . f2 . f2 . f2 . f3 .',
      'g2 . g2 . g2 . g2 . g2 . g2 . g3 . b2 .'] },
    arp: { wave: 'p12', vol: 0.1, echo: true, pat: [
      'a4 c5 e5 c5 a4 c5 e5 c5 a4 c5 e5 c5 a4 c5 e5 c5',
      'a4 c5 e5 c5 a4 c5 e5 c5 a4 c5 e5 c5 b4 d5 g5 d5',
      'f4 a4 c5 a4 f4 a4 c5 a4 f4 a4 c5 a4 f4 a4 c5 a4',
      'g4 b4 d5 b4 g4 b4 d5 b4 g4 b4 d5 b4 g4 b4 d5 f5'] },
    lead: { wave: 'p25', vol: 0.19, echo: true, pat: [
      '. . . . e5 - . g5 a5 - - - . . . .',
      'c6 - - . b5 - a5 - e5 - - - . . . .',
      'f5 - - . a5 - - . g5 - - - . . . .',
      'e5 - d5 - c5 - b4 - a4 - - - - . . .'] },
    drum: { vol: 0.5, pat: [
      'k . . . h . s . k . . k h . s .',
      'k . . . h . s . k . . k h . s h',
      'k . . . h . s . k . . k h . s .',
      'k . . k h . s . k . k . s . s s'] },
  },
  reactor: {                                     // VERDANT REACTOR — упругий дориец, Dm
    bpm: 144,
    bass: { wave: 'p50', vol: 0.3, pat: [
      'd2 . d2 - . d2 . . d3 . d2 . a2 . a2 .',
      'f2 . f2 - . f2 . . f3 . f2 . c3 . c3 .',
      'g2 . g2 - . g2 . . g3 . g2 . d3 . d3 .',
      'd2 . d2 - . d2 . . d3 . a2 . d3 . e3 .'] },
    arp: { wave: 'p12', vol: 0.1, echo: true, pat: [
      'd4 f4 a4 f4 d4 f4 a4 f4 d4 f4 a4 f4 d4 f4 a4 c5',
      'f4 a4 c5 a4 f4 a4 c5 a4 f4 a4 c5 a4 f4 a4 c5 e5',
      'g4 b4 d5 b4 g4 b4 d5 b4 g4 b4 d5 b4 g4 b4 d5 f5',
      'd4 f4 a4 f4 d4 f4 a4 f4 a4 c5 e5 c5 a4 c5 e5 g5'] },
    lead: { wave: 'p25', vol: 0.19, echo: true, pat: [
      'd5 - . f5 - . a5 - - - . g5 - . . .',
      'f5 - - . e5 - d5 - c5 - - - . . . .',
      'g5 - . b5 - . a5 - - - . f5 - . . .',
      'd5 - e5 - f5 - e5 - d5 - - - - . . .'] },
    drum: { vol: 0.5, pat: [
      'k . h . s . h k . . k . s . h .',
      'k . h . s . h k . . k . s . h H',
      'k . h . s . h k . . k . s . h .',
      'k . h k s . h . k . s . s s H .'] },
  },
  citadel: {                                     // ASHEN CITADEL — тяжёлый фригийский, Em
    bpm: 132,
    bass: { wave: 'p50', vol: 0.32, pat: [
      'e2 - . e2 . . e2 . e2 - . e3 . . b2 .',
      'f2 - . f2 . . f2 . f2 - . f3 . . c3 .',
      'g2 - . g2 . . g2 . g2 - . g3 . . d3 .',
      'f2 - . f2 . . f2 . f2 - . c3 . . b2 .'] },
    arp: { wave: 'p12', vol: 0.09, echo: true, pat: [
      'e4 b4 e5 b4 e4 b4 e5 b4 e4 b4 e5 b4 e4 b4 e5 b4',
      'f4 c5 f5 c5 f4 c5 f5 c5 f4 c5 f5 c5 f4 c5 f5 c5',
      'g4 d5 g5 d5 g4 d5 g5 d5 g4 d5 g5 d5 g4 d5 g5 d5',
      'f4 c5 f5 c5 f4 c5 f5 c5 f4 c5 f5 c5 e4 b4 e5 g5'] },
    lead: { wave: 'p25', vol: 0.18, echo: true, pat: [
      'b4 - - . e5 - - . g5 - f5 - e5 - - -',
      'f5 - - - c5 - - . a4 - - - . . . .',
      'g5 - - . b5 - a5 - g5 - - - . . . .',
      'f5 - e5 - d5 - c5 - b4 - - - - . . .'] },
    drum: { vol: 0.55, pat: [
      'k . . . . . h . s . . . k . h .',
      'k . . . . . h . s . . k . . h H',
      'k . . . . . h . s . . . k . h .',
      'k . . k . . h . s . k . s . s s'] },
  },
  boss: {                                        // общая тема боссов — злой хроматизм
    bpm: 168,
    bass: { wave: 'p50', vol: 0.33, pat: [
      'd2 d2 d2 d2 d2 d2 d2 d2 d2 d2 d2 d2 d3 d3 c3 c3',
      'c2 c2 c2 c2 c2 c2 c2 c2 c2 c2 c2 c2 c3 c3 b2 b2',
      'd2 d2 d2 d2 d2 d2 d2 d2 d2 d2 d2 d2 d3 d3 e3 e3',
      'eb2 eb2 eb2 eb2 eb2 eb2 eb2 eb2 e2 e2 e2 e2 f2 f2 f#2 f#2'] },
    arp: { wave: 'p12', vol: 0.1, echo: true, pat: [
      'd4 a4 d5 a4 f4 a4 d5 a4 d4 a4 d5 a4 f4 a4 d5 f5',
      'c4 g4 c5 g4 eb4 g4 c5 g4 c4 g4 c5 g4 eb4 g4 c5 eb5',
      'd4 a4 d5 a4 f4 a4 d5 a4 d4 a4 d5 a4 f4 a4 d5 f5',
      'eb4 bb4 eb5 bb4 e4 b4 e5 b4 f4 c5 f5 c5 f#4 c#5 f#5 c#5'] },
    lead: { wave: 'p25', vol: 0.2, echo: true, pat: [
      'a5 - . a5 - . f5 - . . a5 - . c6 - .',
      'g5 - . g5 - . eb5 - . . g5 - . bb5 - .',
      'a5 - . a5 - . f5 - . . d6 - c6 - a5 -',
      'f5 - e5 - eb5 - d5 - c#5 - - - d5 - - -'] },
    drum: { vol: 0.6, pat: [
      'k . h . s . h . k . h k s . h .',
      'k . h . s . h . k . h k s . h H',
      'k . h . s . h . k . h k s . h .',
      'k . h k s . h . k k s . s s H .'] },
  },
};
for (const k in TRACKS) {                        // разбор паттернов один раз
  const tr = TRACKS[k];
  for (const ch of ['bass', 'arp', 'lead', 'drum'])
    if (tr[ch]) tr[ch].steps = tr[ch].pat.join(' ').trim().split(/\s+/);
  tr.stepDur = 60 / tr.bpm / 4;
}

const mus = { name: null, def: null, step: 0, next: 0, pending: null, fadeAt: 0 };

function drumHit(kind, t, v) {
  if (kind === 'k') {
    blip({ t0: t, wave: 'sine', f: 160, f2: 44, gl: 0.5, dur: 0.16, vol: 0.5 * v, bus: musBus });
    noise({ t0: t, kind: 'lfsr', filter: 'lowpass', f: 1600, f2: 400, dur: 0.03, vol: 0.2 * v, bus: musBus });
  } else if (kind === 's') {
    noise({ t0: t, kind: 'white', filter: 'bandpass', f: 1900, q: 0.9, dur: 0.13, vol: 0.32 * v, bus: musBus });
    blip({ t0: t, wave: 'triangle', f: 230, f2: 160, dur: 0.08, vol: 0.16 * v, bus: musBus });
  } else if (kind === 'h' || kind === 'H') {
    noise({ t0: t, kind: 'metal', filter: 'highpass', f: 7200, dur: kind === 'H' ? 0.11 : 0.032,
            vol: (kind === 'H' ? 0.12 : 0.1) * v, bus: musBus });
  } else if (kind === 'c') {
    noise({ t0: t, kind: 'metal', filter: 'highpass', f: 5200, dur: 0.6, vol: 0.14 * v, bus: musBus });
  }
}

function musicStep(t, i) {
  const tr = mus.def;
  for (const name of ['bass', 'arp', 'lead']) {
    const c = tr[name];
    if (!c) continue;
    const tok = c.steps[i % c.steps.length];
    if (!tok || tok === '.' || tok === '-') continue;
    let len = 1;
    while (len < 24 && c.steps[(i + len) % c.steps.length] === '-') len++;
    blip({ t0: t, wave: c.wave, f: nf(tok), dur: len * tr.stepDur * 0.92, vol: c.vol,
           a: 0.008, sus: len > 1, rel: 0.05, echo: c.echo, bus: musBus });
  }
  const d = tr.drum;
  if (d) {
    const tok = d.steps[i % d.steps.length];
    if (tok && tok !== '.' && tok !== '-') drumHit(tok, t, d.vol);
  }
}

function music(name, delay) {
  if (name && !TRACKS[name]) name = null;
  if (delay && ctx) { mus.pending = name; mus.fadeAt = ctx.currentTime + delay; return; }
  mus.pending = null;
  if (mus.name === name) return;
  mus.name = name;
  mus.def = name ? TRACKS[name] : null;
  mus.step = 0;
  mus.next = ctx ? ctx.currentTime + 0.06 : 0;
}

function tick() {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (mus.pending !== null && now >= mus.fadeAt) { const p = mus.pending; mus.pending = null; music(p); }
  if (!musicOn || !on || !mus.def) return;
  if (mus.next < now) mus.next = now + 0.03;      // после паузы/лага — без догоняющей очереди
  while (mus.next < now + 0.16) {
    musicStep(mus.next, mus.step);
    mus.next += mus.def.stepDur;
    mus.step++;
  }
}

// ---------- разблокировка по первому действию ----------
let unlocked = false;
function unlock() {
  if (unlocked) return;
  const c = ensure();
  if (!c) return;
  unlocked = true;
  if (c.state === 'suspended') c.resume();
  mus.next = c.currentTime + 0.06;
}
for (const ev of ['keydown', 'pointerdown', 'touchstart'])
  window.addEventListener(ev, unlock, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) { stopLoops(); ctx.suspend(); }
  else if (on) ctx.resume().then(() => { mus.next = ctx.currentTime + 0.06; });
});

// ---------- настройки ----------
function save() {
  try { localStorage.setItem('orbitar.audio', JSON.stringify({ on, musicOn })); } catch (e) { /* приватный режим */ }
}
try {
  const s = JSON.parse(localStorage.getItem('orbitar.audio') || 'null');
  if (s) { on = !!s.on; musicOn = !!s.musicOn; }
} catch (e) { /* нет хранилища — играем со звуком */ }

function setOn(v) {
  on = v;
  unlock();
  if (!on) stopLoops();
  if (ctx) {
    master.gain.setTargetAtTime(on ? VOL.master : 0, ctx.currentTime, 0.02);
    musBus.gain.setTargetAtTime(on && musicOn ? VOL.music : 0, ctx.currentTime, 0.02);
    mus.next = ctx.currentTime + 0.06;
  }
  save();
  if (on) play('toggle');
}
function setMusic(v) {
  musicOn = v;
  unlock();
  if (ctx) {
    musBus.gain.setTargetAtTime(musicOn && on ? VOL.music : 0, ctx.currentTime, 0.05);
    mus.next = ctx.currentTime + 0.06;
  }
  save();
  play('toggle');
}

return {
  play, loop, stopLoops, music, tick,
  toggleSound: () => { setOn(!on); return on; },
  toggleMusic: () => { setMusic(!musicOn); return musicOn; },
  get on() { return on; },
  get musicOn() { return musicOn; },
};
})();
