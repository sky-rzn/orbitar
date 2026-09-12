// ============================================================
//  ORBITAR — звук: PSG-блипы и FM-удары для эффектов,
//  хард-роковая группа (перегруженные гитары, бас, живая установка) для музыки.
//  Ничего не грузится — всё синтезируется на лету.
// ============================================================
'use strict';

const SFX = (() => {

// ---------- узлы ----------
let ctx = null, comp, master, sfxBus, musBus, echoIn, panOK = false;
let gtrAmp, bassAmp, leadAmp, cleanAmp, musEcho;   // тракт музыкальной группы
let on = true, musicOn = true;
let voices = 0;                          // грубый счётчик голосов эффектов: страховка от каши
const MAX_VOICES = 32;
// музыку лимит не режет: её голоса ограничены самим паттерном (4 канала)
const busy = o => voices > MAX_VOICES && o.bus !== musBus;
const waves = {};                        // PeriodicWave по скважности
const noiseBufs = {};
const lastAt = {};                       // троттлинг одинаковых звуков

const VOL = { master: 0.5, sfx: 0.9, music: 0.38 };

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

  // эхо музыки идёт в свой посыл: при выключенной музыке не остаётся хвостов
  const mdl = ctx.createDelay(0.9); mdl.delayTime.value = 0.2;
  const mfb = ctx.createGain(); mfb.gain.value = 0.3;
  const mtone = ctx.createBiquadFilter(); mtone.type = 'lowpass'; mtone.frequency.value = 2400;
  musEcho = ctx.createGain(); musEcho.gain.value = 0.3;
  musEcho.connect(mdl); mdl.connect(mtone); mtone.connect(mfb); mfb.connect(mdl); mdl.connect(musBus);
  musEcho.delay = mdl;

  // усилители группы: ритм-гитара, соло-гитара и бас
  gtrAmp  = amp({ pre: 1.35, drive: 6.5, hp: 110, mid: 2200, midDb: 4,  lp: 4200, out: 0.11 });
  leadAmp = amp({ pre: 1.2,  drive: 11, asym: 0.12, hp: 220, mid: 1500, midDb: 6, lp: 5200, out: 0.065 });
  bassAmp = amp({ pre: 1.25, drive: 3,  hp: 38,  mid: 800,  midDb: 3,  lp: 2600, out: 0.13 });
  // почти чистый канал: на нём играют арпеджио спокойных секций
  cleanAmp = amp({ pre: 0.55, drive: 1,  hp: 90,  mid: 1200, midDb: 2,  lp: 5600, out: 0.2 });
  leadAmp.out.connect(musEcho); cleanAmp.out.connect(musEcho);

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
  // ---- лёд: цепкие стены, сталактиты, наледь, пурга ----
  wallJump: (t, o) => {                              // толчок от цепкой стены: скрип инея и прыжок
    noise({ t0: t, kind: 'metal', filter: 'bandpass', f: 2600, f2: 900, q: 3.2, dur: 0.12, vol: 0.1 * o.v, pan: o.pan });
    blip({ t0: t, wave: 'p25', f: 360, f2: 720, gl: 0.5, dur: 0.14, vol: 0.17 * o.v, a: 0.005, pan: o.pan });
  },
  crack: (t, o) => {                                 // сталактит затрещал
    noise({ t0: t, kind: 'lfsr', filter: 'bandpass', f: 4200, f2: 2200, q: 3.4, dur: 0.09, vol: 0.11 * o.v, pan: o.pan });
    blip({ t0: t, wave: 'p12', f: 2100, f2: 1500, dur: 0.06, vol: 0.07 * o.v, pan: o.pan });
  },
  shatter: (t, o) => {                               // сталактит разбился
    noise({ t0: t, kind: 'metal', filter: 'highpass', f: 3800, dur: 0.3, vol: 0.15 * o.v, pan: o.pan });
    ['b6', 'e6', 'g6'].forEach((n, i) =>
      blip({ t0: t + i * 0.03, wave: 'p12', f: nf(n), dur: 0.12, vol: 0.08 * o.v, pan: o.pan, echo: true }));
  },
  skid: (t, o) => noise({ t0: t, kind: 'white', filter: 'bandpass', f: 2800, f2: 900, q: 2.2, dur: 0.16, vol: 0.1 * o.v, pan: o.pan }),
  gust: (t, o) => {                                  // раструб дунул
    noise({ t0: t, kind: 'white', filter: 'bandpass', f: 500, f2: 2400, q: 0.9, dur: 0.5, vol: 0.14 * o.v, pan: o.pan });
    fm({ t0: t, f: 170, f2: 90, ratio: 1.5, index: 3, dur: 0.45, vol: 0.08 * o.v, wave: 'sine', pan: o.pan });
  },

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
  hail: (t, o) => {                                  // колосс кинул веер осколков
    blip({ t0: t, wave: 'p12', f: 2200, f2: 900, dur: 0.16, vol: 0.1 * o.v, pan: o.pan, echo: true });
    noise({ t0: t, kind: 'lfsr', filter: 'highpass', f: 3000, dur: 0.1, vol: 0.06 * o.v, pan: o.pan });
  },
  drop: (t, o) => blip({ t0: t, wave: 'p25', f: 900, f2: 300, dur: 0.18, vol: 0.1 * o.v, pan: o.pan }),
  charge: (t, o) => {                                // взвесь копит заряд под игроком
    blip({ t0: t, wave: 'p12', f: 240, f2: 1500, gl: 0.85, dur: 0.5, vol: 0.07 * o.v, pan: o.pan });
    noise({ t0: t, kind: 'lfsr', filter: 'bandpass', f: 900, f2: 3600, q: 2.6, dur: 0.5, vol: 0.05 * o.v, pan: o.pan });
  },
  zap: (t, o) => {                                   // разряд ударил снизу вверх
    fm({ t0: t, f: 1600, f2: 180, ratio: 2.9, index: 9, idxDecay: 0.4, dur: 0.26, vol: 0.17 * o.v, wave: 'square', pan: o.pan, echo: true });
    noise({ t0: t, kind: 'white', filter: 'highpass', f: 3400, f2: 1400, dur: 0.22, vol: 0.13 * o.v, pan: o.pan });
  },
  jet: (t, o) => {                                   // столб стужи бьёт вверх
    noise({ t0: t, kind: 'white', filter: 'bandpass', f: 300, f2: 4200, q: 1.3, dur: 0.6, vol: 0.2 * o.v, pan: o.pan });
    fm({ t0: t, f: 120, f2: 380, ratio: 1.02, index: 8, idxDecay: 0.5, dur: 0.55, vol: 0.2 * o.v, wave: 'sine', pan: o.pan });
  },
  dash: (t, o) => {
    noise({ t0: t, kind: 'white', filter: 'bandpass', f: 400, f2: 2600, q: 1.1, dur: 0.42, vol: 0.15 * o.v, pan: o.pan });
    fm({ t0: t, f: 140, f2: 320, ratio: 1.5, index: 4, dur: 0.4, vol: 0.12 * o.v, wave: 'sawtooth', pan: o.pan });
  },
  slam: (t, o) => {
    noise({ t0: t, kind: 'white', filter: 'lowpass', f: 3200, f2: 120, dur: 0.55, vol: 0.26 * o.v });
    fm({ t0: t, f: 90, f2: 32, ratio: 1.01, index: 9, idxDecay: 0.4, dur: 0.6, vol: 0.3 * o.v, wave: 'sine' });
    blip({ t0: t, wave: 'p50', f: 260, f2: 60, dur: 0.3, vol: 0.12 * o.v });
  },
  // ---- корона-разлом: осколок сходит с привязи, отбит, звякнул мимо ----
  release: (t, o) => {                               // осколок отстегнулся от короны
    blip({ t0: t, wave: 'p12', f: 1700, f2: 520, dur: 0.22, vol: 0.11 * o.v, pan: o.pan, echo: true });
    fm({ t0: t + 0.04, f: 420, f2: 210, ratio: 3.01, index: 4, dur: 0.3, vol: 0.1 * o.v, wave: 'sine', pan: o.pan });
  },
  spike: (t, o) => {                                 // отбил в столбе — осколок ушёл обратно в корону
    ['e5', 'b5', 'e6'].forEach((n, i) =>
      blip({ t0: t + i * 0.035, wave: 'p25', f: nf(n), dur: 0.3, vol: 0.16 * o.v, pan: o.pan, echo: true }));
    fm({ t0: t, f: 900, f2: 2600, gl: 0.6, ratio: 2.01, index: 6, dur: 0.26, vol: 0.15 * o.v, wave: 'square', pan: o.pan });
    noise({ t0: t, kind: 'metal', filter: 'bandpass', f: 2600, f2: 5200, q: 2.2, dur: 0.18, vol: 0.1 * o.v, pan: o.pan });
  },
  clank: (t, o) => {                                 // отбил мимо столба — глухой удар
    noise({ t0: t, kind: 'metal', filter: 'bandpass', f: 1400, f2: 420, q: 3, dur: 0.16, vol: 0.13 * o.v, pan: o.pan });
    blip({ t0: t, wave: 'p50', f: 340, f2: 180, dur: 0.12, vol: 0.09 * o.v, pan: o.pan });
  },
  graze: (t, o) => {                                 // задел осколок сбоку — отброс, а не смерть
    noise({ t0: t, kind: 'lfsr', filter: 'bandpass', f: 2200, f2: 700, q: 2.6, dur: 0.12, vol: 0.1 * o.v, pan: o.pan });
    blip({ t0: t, wave: 'p12', f: 620, f2: 260, dur: 0.16, vol: 0.1 * o.v, pan: o.pan });
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
             tell: 150, leap: 80, leapTell: 80, boom: 70, spore: 60, lance: 60, cell: 40, spawn: 120,
             crack: 90, shatter: 70, skid: 110, gust: 200, hail: 60, drop: 60 };

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
  // гул привязи: пока осколок короны на луче, он поёт — тихая квинта с биением
  tether: () => {
    const a = ctx.createOscillator(); a.type = 'triangle'; a.frequency.value = 233;
    const b = ctx.createOscillator(); b.type = 'triangle'; b.frequency.value = 349.5;
    const c = ctx.createOscillator(); c.type = 'sine'; c.frequency.value = 116.5;
    const trem = ctx.createOscillator(), tg = ctx.createGain();   // биение громкости
    trem.frequency.value = 5.5; tg.gain.value = 0.4;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.2;
    const swp = ctx.createOscillator(), sg = ctx.createGain();    // медленный проход фильтра
    swp.frequency.value = 0.35; sg.gain.value = 420; swp.connect(sg); sg.connect(f.frequency);
    const vca = ctx.createGain(); vca.gain.value = 0.6;
    trem.connect(tg); tg.connect(vca.gain);
    a.connect(f); b.connect(f); c.connect(f); f.connect(vca);
    a.start(); b.start(); c.start(); trem.start(); swp.start();
    return { out: vca, vol: 0.12, stop: t => { a.stop(t); b.stop(t); c.stop(t); trem.stop(t); swp.stop(t); } };
  },
  // вой пурги: широкий шум с медленным качанием — пока раструб дует
  blow: () => {
    const src = ctx.createBufferSource(); src.buffer = noiseBufs.white; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.8;
    const lfo = ctx.createOscillator(), la = ctx.createGain();
    lfo.frequency.value = 0.45; la.gain.value = 620; lfo.connect(la); la.connect(f.frequency);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
    src.connect(f); f.connect(hp); src.start(); lfo.start();
    return { out: hp, vol: 0.16, stop: t => { src.stop(t); lfo.stop(t); } };
  },
  // столб стужи HOARFROST: шипение вверх плюс высокий обертон
  jet: () => {
    const src = ctx.createBufferSource(); src.buffer = noiseBufs.white; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 1.6;
    const swp = ctx.createOscillator(), sg = ctx.createGain();
    swp.frequency.value = 2.2; sg.gain.value = 900; swp.connect(sg); sg.connect(f.frequency);
    const tone = ctx.createOscillator(); tone.type = 'triangle'; tone.frequency.value = 1174;
    const tg = ctx.createGain(); tg.gain.value = 0.12;
    const vca = ctx.createGain(); vca.gain.value = 0.9;
    src.connect(f); f.connect(vca); tone.connect(tg); tg.connect(vca);
    src.start(); swp.start(); tone.start();
    return { out: vca, vol: 0.17, stop: t => { src.stop(t); swp.stop(t); tone.stop(t); } };
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

// ---------- гитарный тракт: перегруз + «кабинет» ----------
// Кривая мягкого клиппинга: tanh — овердрайв лампы, asym добавляет чётных гармоник.
function shaperCurve(drive, asym) {
  const n = 2048, c = new Float32Array(n), ws = ctx.createWaveShaper();
  const bias = asym || 0, ref = Math.tanh(drive + bias) - Math.tanh(bias);
  for (let i = 0; i < n; i++) {
    const x = i * 2 / n - 1;
    c[i] = (Math.tanh(x * drive + bias) - Math.tanh(bias)) / ref;
  }
  ws.curve = c; ws.oversample = '4x';
  return ws;
}
// Голова + кабинет: пре-гейн → срез низа → клиппинг → серединный горб → два ФНЧ.
// ВАЖНО: WaveShaper зажимает вход в [-1,1], поэтому pre держим так,
// чтобы пик ноты подходил к 1, а характер перегруза задавал drive.
function amp(o) {
  const inp = ctx.createGain(); inp.gain.value = o.pre;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = o.hp; hp.Q.value = 0.7;
  const ws = shaperCurve(o.drive, o.asym);
  const mid = ctx.createBiquadFilter(); mid.type = 'peaking';
  mid.frequency.value = o.mid; mid.Q.value = 1.1; mid.gain.value = o.midDb;
  const lp1 = ctx.createBiquadFilter(); lp1.type = 'lowpass'; lp1.frequency.value = o.lp; lp1.Q.value = 1.1;
  const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = o.lp * 1.5; lp2.Q.value = 0.6;
  const out = ctx.createGain(); out.gain.value = o.out;
  inp.connect(hp); hp.connect(ws); ws.connect(mid); mid.connect(lp1); lp1.connect(lp2); lp2.connect(out);
  out.connect(musBus);
  return { in: inp, out };
}

// ---------- голоса группы ----------
// Ритм-гитара: квинт-аккорд (тоника + квинта + октава) расстроенными пилами.
// Одношаговые ноты играются глушением ладонью — тот самый «чаг».
function gtrNote(o) {
  const t = o.t0, dur = o.dur, v = o.vol;
  const g = ctx.createGain();
  let node = g;
  if (o.mute) {                                  // palm mute: завал верха по ходу ноты
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.9;
    lp.frequency.setValueAtTime(2800, t);
    lp.frequency.exponentialRampToValueAtTime(800, t + dur);
    g.connect(lp); node = lp;
  }
  node.connect(o.amp.in);

  const parts = o.chord ? [[1, -8], [1, 8], [1.49831, 5], [2, -5]] : [[1, -7], [1, 7]];
  const lvl = v / parts.length;                  // сумма голосов ≈ v, чтобы не зажать шейпер
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(lvl, t + 0.003);
  if (o.mute) {
    g.gain.exponentialRampToValueAtTime(lvl * 0.22, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  } else {
    g.gain.linearRampToValueAtTime(lvl * 0.8, t + Math.max(0.02, dur - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  for (const [mul, det] of parts) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = o.f * mul;
    osc.detune.value = det;
    osc.connect(g);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  pick(t, o.amp.in, (o.mute ? 0.5 : 0.85) * v);
}
// щелчок медиатора — короткий шумовой транзиент в тот же вход усилителя
function pick(t, dest, v) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBufs.metal; src.loop = true;
  src.playbackRate.value = 0.8 + Math.random() * 0.5;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
  const g = ctx.createGain();
  g.gain.setValueAtTime(v * 0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.016);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t); src.stop(t + 0.05);
}
// Соло: одна пила с задержанным вибрато — «поёт» на длинных нотах.
function leadNote(o) {
  const t = o.t0, dur = o.dur, v = o.vol;
  const g = ctx.createGain();
  g.connect(leadAmp.in);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v * 0.5, t + 0.006);
  g.gain.linearRampToValueAtTime(v * 0.42, t + Math.max(0.03, dur - 0.06));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const det of [-7, 7]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = o.f; osc.detune.value = det;
    if (o.vib) {                                 // вибрато включается не сразу, как у живого гитариста
      const lfo = ctx.createOscillator(), la = ctx.createGain();
      lfo.frequency.value = 5.6; la.gain.value = 0.0001;
      la.gain.setValueAtTime(0.0001, t + dur * 0.25);
      la.gain.linearRampToValueAtTime(16, t + Math.min(dur * 0.7, dur * 0.25 + 0.18));
      lfo.connect(la); la.connect(osc.detune);
      lfo.start(t); lfo.stop(t + dur + 0.02);
    }
    osc.connect(g);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  pick(t, leadAmp.in, v * 0.4);
}
// Бас: пила с лёгким овердрайвом плюс чистый саб-синус ниже перегруза.
function bassNote(o) {
  const t = o.t0, dur = o.dur, v = o.vol;
  const mk = (type, f, lvl, dest) => {
    const osc = ctx.createOscillator(); osc.type = type; osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(lvl, t + 0.004);
    g.gain.linearRampToValueAtTime(lvl * 0.8, t + Math.max(0.02, dur - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.02);
  };
  mk('sawtooth', o.f, v * 0.62, bassAmp.in);
  mk('sine', o.f, v * 0.13, musBus);             // саб мимо перегруза — низ остаётся чистым
}

// ---------- музыка: мини-трекер в стиле хард-рока ----------
//  Нотация: один токен = 1/16, шестнадцать токенов = такт. 'a4' — нота, '-' — держать, '.' — пауза.
//  Гитара: нота длиной в один шаг звучит глушением (чаг), длинная — открытым аккордом.
//  Ударные: k — бочка, s — малый, h — хэт, H — открытый, c — крэш, r — райд,
//  x — кросс-стик, t/T — низкий/высокий том. Несколько символов в токене бьют
//  одновременно: 'kc', 'sc'.
//
//  Тема — не петля в четыре такта, а песня: секции (вступление, куплет, припев,
//  брейк, соло, кода) выстраиваются в порядке order. Повторы переиспользуют одни и
//  те же такты, поэтому 34–38 тактов формы (около минуты) стоят недорого.
//  Секция с полем from наследует каналы указанной секции — так соло играется поверх
//  того же рифа, а переписывается только партия лида. Такт '=' в переписанном канале
//  тоже берётся у родителя: удобно менять один такт из четырёх (скажем, сбивку).
//  Поле feel: 'clean' переводит гитару на чистый канал и даёт нотам звенеть —
//  так между тяжёлыми секциями появляется передышка с арпеджио.
const R = '.  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .';     // пустой такт
const TRACKS = {
  foundry: {                                     // ORBITAL FOUNDRY — маршевый риф в Am
    bpm: 158,
    vol: { gtr: 0.62, bass: 0.66, lead: 0.5, drum: 0.52 },
    order: ['intro', 'verse', 'verse2', 'pre', 'chorus', 'interlude', 'verse2',
            'bridge', 'solo', 'solo2', 'pre', 'chorus', 'chorus2', 'outro'],
    sections: {
      intro: {
        gtr: ['a2 .  .  .  a2 .  .  .  a2 .  .  .  a2 .  a2 a2',
              'a2 .  .  .  a2 .  .  .  a2 .  .  .  a2 .  a2 a2',
              'a2 .  .  .  a2 .  .  .  c3 .  .  .  d3 .  e3 . ',
              'f2 -  -  -  -  -  -  .  g2 -  -  -  -  -  .  . '],
        bass: ['a1 .  .  .  a1 .  .  .  a1 .  .  .  a1 .  a1 a1',
               'a1 .  .  .  a1 .  .  .  a1 .  .  .  a1 .  a1 a1',
               'a1 .  .  .  a1 .  .  .  c2 .  .  .  d2 .  e2 . ',
               'f1 -  -  -  -  -  -  .  g1 -  -  -  -  -  .  . '],
        lead: [R, R, R,
               '.  .  .  .  .  .  .  .  .  .  .  .  e5 -  g5 - '],
        drum: ['kc .  .  .  .  .  .  .  .  .  .  .  .  .  .  . ',
               'k  .  .  .  h  .  .  .  k  .  .  .  h  .  .  . ',
               'k  .  h  .  s  .  h  .  k  .  h  .  s  .  h  . ',
               'k  .  h  .  s  .  h  .  t  .  t  .  T  .  T  . '],
      },
      verse: {
        gtr: ['a2 .  a2 a2 .  a2 .  a2 a2 .  a2 a2 .  c3 .  d3',
              'a2 .  a2 a2 .  a2 .  a2 a2 .  c3 .  d3 .  e3 . ',
              'f2 -  -  .  f2 .  f2 .  g2 -  -  .  g2 .  g2 . ',
              'f2 -  -  .  g2 -  -  .  a2 -  -  -  a2 .  g2 f2'],
        bass: ['a1 .  a1 a1 .  a1 .  a1 a1 .  a1 a1 .  c2 .  d2',
               'a1 .  a1 a1 .  a1 .  a1 a1 .  c2 .  d2 .  e2 . ',
               'f1 .  f2 .  f1 .  f1 .  g1 .  g2 .  g1 .  g1 . ',
               'f1 .  f2 .  g1 .  g2 .  a1 .  a2 .  a1 .  g1 f1'],
        lead: [R, R, R, R],
        drum: ['kc .  h  .  s  .  h  k  .  .  h  k  s  .  h  . ',
               'k  .  h  .  s  .  h  k  .  .  h  k  s  .  h  H ',
               'kc .  h  .  s  .  h  k  .  .  h  k  s  .  h  . ',
               'k  .  h  .  s  .  h  .  t  .  t  T  .  s  s  s '],
      },
      verse2: {
        gtr: ['a2 .  a2 a2 .  a2 .  a2 a2 .  a2 a2 .  c3 .  d3',
              'a2 .  a2 a2 .  a2 .  a2 e3 .  e3 .  d3 .  c3 . ',
              'f2 -  -  .  f2 .  f2 .  g2 -  -  .  g2 .  g2 . ',
              'a2 -  -  .  c3 -  -  .  d3 -  -  -  -  -  .  . '],
        bass: ['a1 .  a1 a1 .  a1 .  a1 a1 .  a1 a1 .  c2 .  d2',
               'a1 .  a1 a1 .  a1 .  a1 e2 .  e2 .  d2 .  c2 . ',
               'f1 .  f2 .  f1 .  f1 .  g1 .  g2 .  g1 .  g1 . ',
               'a1 .  a2 .  c2 .  c1 .  d2 .  d1 .  d2 .  e2 . '],
        lead: ['.  .  .  .  e5 -  .  .  .  .  .  .  a5 -  .  . ',
               '.  .  .  .  g5 -  .  .  .  .  e5 -  d5 -  .  . ',
               'c6 -  -  .  a5 -  -  .  b5 -  -  .  g5 -  -  . ',
               'a5 -  -  -  -  -  -  .  .  .  .  .  e5 -  g5 - '],
        drum: ['kc .  h  .  s  .  h  k  .  .  h  k  s  .  h  . ',
               'k  .  h  .  s  .  h  k  .  .  h  k  s  .  h  . ',
               'kc .  h  .  s  .  h  k  .  .  h  k  s  .  h  . ',
               'k  .  h  .  s  .  h  .  t  t  .  T  T  .  s  s '],
      },
      chorus: {
        gtr: ['f2 -  -  -  -  -  -  .  f2 .  f2 .  f2 .  f2 . ',
              'c3 -  -  -  -  -  -  .  c3 .  c3 .  c3 .  c3 . ',
              'g2 -  -  -  -  -  -  .  g2 .  g2 .  g2 .  g2 . ',
              'a2 -  -  -  -  -  -  .  a2 .  a2 .  e3 .  g3 . '],
        bass: ['f1 .  .  f1 .  .  f1 .  f1 .  f1 .  f1 .  f2 . ',
               'c2 .  .  c2 .  .  c2 .  c2 .  c2 .  c2 .  c3 . ',
               'g1 .  .  g1 .  .  g1 .  g1 .  g1 .  g1 .  g2 . ',
               'a1 .  .  a1 .  .  a1 .  a1 .  a1 .  e2 .  g2 . '],
        lead: ['c6 -  -  -  a5 -  -  -  f5 -  -  -  -  -  .  . ',
               'g5 -  -  -  e5 -  -  -  c6 -  -  -  -  -  -  - ',
               'd6 -  -  -  b5 -  -  -  g5 -  -  -  a5 -  b5 - ',
               'c6 -  -  -  -  -  -  -  b5 -  a5 -  g5 -  e5 - '],
        drum: ['kc .  r  .  s  .  r  k  .  .  r  k  s  .  r  . ',
               'k  .  r  .  s  .  r  k  .  .  r  k  s  .  r  . ',
               'kc .  r  .  s  .  r  k  .  .  r  k  s  .  r  . ',
               'k  .  r  .  s  .  r  .  k  .  t  .  T  .  s  s '],
      },
      bridge: {
        gtr: ['d3 -  -  -  -  -  -  -  c3 -  -  -  -  -  -  - ',
              'bb2 - -  -  -  -  -  -  a2 -  -  -  -  -  -  - ',
              'f2 -  -  -  -  -  -  -  g2 -  -  -  -  -  -  - ',
              'a2 -  -  -  -  -  -  -  -  -  -  -  e3 .  g3 . '],
        bass: ['d1 .  .  .  d1 .  .  .  c2 .  .  .  c2 .  .  . ',
               'bb1 . .  .  bb1 . .  .  a1 .  .  .  a1 .  .  . ',
               'f1 .  .  .  f1 .  .  .  g1 .  .  .  g1 .  .  . ',
               'a1 .  .  .  a1 .  .  .  a1 .  .  .  e2 .  g2 . '],
        lead: ['a5 -  -  -  -  -  c6 -  b5 -  -  -  -  -  -  . ',
               'g5 -  -  -  a5 -  -  -  f5 -  -  -  -  -  -  . ',
               'e5 -  -  -  f5 -  g5 -  a5 -  -  -  -  -  -  . ',
               'c6 -  -  -  b5 -  -  -  a5 -  -  -  -  -  -  . '],
        drum: ['k  .  .  .  .  .  .  .  s  .  .  .  .  .  .  H ',
               'k  .  .  .  .  .  .  .  s  .  .  .  .  .  .  . ',
               'k  .  .  .  .  .  .  .  s  .  .  .  .  .  .  H ',
               'k  .  .  .  .  .  .  .  s  .  .  .  t  .  T  . '],
      },
      solo: {
        from: 'verse',
        lead: ['a5 -  c6 -  b5 -  a5 -  g5 -  a5 -  e5 -  g5 - ',
               'a5 -  -  -  g5 -  e5 -  d5 -  e5 -  g5 -  a5 - ',
               'c6 -  d6 -  e6 -  d6 -  c6 -  a5 -  g5 -  e5 - ',
               'd6 -  c6 -  b5 -  a5 -  g5 -  e5 -  a5 -  -  - '],
      },
      outro: {
        gtr: ['a2 .  a2 a2 .  a2 .  a2 c3 .  c3 .  d3 .  e3 . ',
              'a2 -  -  -  -  -  -  -  -  -  -  -  -  -  -  - '],
        bass: ['a1 .  a1 a1 .  a1 .  a1 c2 .  c2 .  d2 .  e2 . ',
               'a1 -  -  -  -  -  -  -  -  -  -  -  -  -  -  - '],
        lead: [R,
               'a5 -  -  -  -  -  -  -  -  -  -  -  -  -  -  - '],
        drum: ['k  .  h  .  s  .  h  k  t  t  T  T  s  s  s  s ',
               'kc .  .  .  .  .  .  .  .  .  .  .  .  .  .  . '],
      },
      pre: {                                     // подход к припеву: полутемп и подъём
        gtr: ['d2 -  -  -  -  -  .  d2 .  d2 .  .  d2 .  .  . ',
              'e2 -  -  -  -  -  .  e2 .  e2 .  .  e2 .  .  . ',
              'f2 -  -  -  -  -  .  f2 .  f2 .  .  f2 .  .  . ',
              'g2 -  -  -  .  g2 .  g2 .  g2 .  g2 .  g2 g2 g2'],
        bass: ['d1 .  .  .  d1 .  .  d2 .  d1 .  .  d1 .  .  . ',
               'e1 .  .  .  e1 .  .  e2 .  e1 .  .  e1 .  .  . ',
               'f1 .  .  .  f1 .  .  f2 .  f1 .  .  f1 .  .  . ',
               'g1 .  .  .  g1 .  .  g2 .  g1 .  g1 .  g1 g1 g1'],
        lead: ['.  .  .  .  .  .  .  .  d5 -  -  -  f5 -  -  - ',
               'e5 -  -  -  -  -  .  .  g5 -  -  -  b5 -  -  - ',
               'a5 -  -  -  c6 -  -  -  a5 -  -  -  -  -  .  . ',
               'b5 -  -  -  c6 -  -  -  d6 -  -  -  e6 -  -  - '],
        drum: ['kc .  .  .  .  .  .  .  s  .  .  .  .  .  .  . ',
               'k  .  .  .  .  .  .  k  s  .  .  .  .  .  .  . ',
               'kc .  .  .  .  .  .  .  s  .  .  .  .  .  .  H ',
               'k  .  h  h  s  .  h  h  t  t  T  T  s  s  s  s '],
      },
      chorus2: {                                 // второй припев: лид выше, райд плотнее
        from: 'chorus',
        lead: ['a5 -  -  -  c6 -  -  -  f5 -  a5 -  c6 -  -  - ',
               'g5 -  -  -  b5 -  -  -  e6 -  -  -  -  -  d6 - ',
               'd6 -  -  -  b5 -  -  -  g5 -  b5 -  d6 -  e6 - ',
               'c6 -  -  -  b5 -  a5 -  a5 -  -  -  -  -  -  - '],
        drum: ['kc k  r  .  s  .  r  k  k  .  r  k  s  .  r  r ',
               'k  k  r  .  s  .  r  k  k  .  r  k  s  .  r  . ',
               'kc k  r  .  s  .  r  k  k  .  r  k  s  .  r  r ',
               'k  k  r  .  s  .  r  .  t  t  T  T  s  s  s  s '],
      },
      interlude: {                               // передышка: чистые арпеджио Am-F-C-G
        feel: 'clean',
        gtr: ['a3 .  c4 .  e4 .  a4 .  e4 .  c4 .  e4 .  a3 . ',
              'f3 .  a3 .  c4 .  f4 .  c4 .  a3 .  c4 .  f3 . ',
              'c4 .  e4 .  g4 .  c5 .  g4 .  e4 .  g4 .  c4 . ',
              'g3 .  b3 .  d4 .  g4 .  d4 .  b3 .  d4 .  e4 f4'],
        bass: ['a1 -  -  -  -  -  -  -  a1 -  -  -  -  -  .  . ',
               'f1 -  -  -  -  -  -  -  f1 -  -  -  -  -  .  . ',
               'c2 -  -  -  -  -  -  -  c2 -  -  -  -  -  .  . ',
               'g1 -  -  -  -  -  -  -  g1 -  -  -  .  g1 .  . '],
        lead: [R,
               'e5 -  -  -  -  -  .  .  a5 -  -  -  -  -  .  . ',
               'g5 -  -  -  e5 -  -  -  c6 -  -  -  -  -  -  . ',
               'b5 -  -  -  a5 -  g5 -  a5 -  -  -  -  -  .  . '],
        drum: ['.  .  h  .  x  .  h  .  .  .  h  .  x  .  h  . ',
               'k  .  h  .  x  .  h  .  .  .  h  .  x  .  h  . ',
               '.  .  h  .  x  .  h  .  .  .  h  .  x  .  h  . ',
               'k  .  h  .  x  .  h  .  k  .  h  .  x  .  h  H '],
      },
      solo2: {                                   // вторая половина соло — шестнадцатыми
        from: 'verse',
        lead: ['a5 g5 e5 g5 a5 -  c6 -  b5 a5 g5 e5 d5 -  e5 - ',
               'g5 a5 c6 d6 e6 -  d6 -  c6 a5 g5 e5 a5 -  -  - ',
               'c6 b5 a5 g5 a5 -  e5 -  f5 g5 a5 c6 b5 -  g5 - ',
               'a5 -  e6 -  d6 c6 b5 a5 g5 -  e5 -  a5 -  -  - '],
        drum: ['=', '=', '=',
               'k  .  r  k  s  .  r  k  t  t  T  T  s  s  s  s '],
      },
    },
  },

  reactor: {                                     // VERDANT REACTOR — упругий грув в Dm
    bpm: 168,
    vol: { gtr: 0.6, bass: 0.66, lead: 0.5, drum: 0.52 },
    order: ['intro', 'verse', 'verse2', 'pre', 'chorus', 'interlude', 'verse2', 'break',
            'solo', 'solo2', 'pre', 'chorus', 'chorus2', 'outro'],
    sections: {
      intro: {
        gtr: [R, R,
              'd2 d2 .  d2 .  d2 d2 .  d2 .  f2 .  g2 .  a2 . ',
              'd2 d2 .  d2 .  d2 d2 .  d2 .  c3 .  a2 .  g2 f2'],
        bass: ['d1 d1 .  d1 .  d1 d1 .  d1 .  f1 .  g1 .  a1 . ',
               'd1 d1 .  d1 .  d1 d1 .  d1 .  c2 .  a1 .  g1 f1',
               'd1 d1 .  d1 .  d1 d1 .  d1 .  f1 .  g1 .  a1 . ',
               'd1 d1 .  d1 .  d1 d1 .  d1 .  c2 .  a1 .  g1 f1'],
        lead: [R, R, R,
               '.  .  .  .  .  .  .  .  .  .  .  .  d5 -  f5 - '],
        drum: [R,
               'h  .  h  .  h  .  h  .  h  .  h  .  h  .  h  . ',
               'k  .  h  k  s  .  h  .  k  .  h  k  s  .  h  . ',
               'k  .  h  k  s  .  h  .  k  .  t  .  T  .  s  s '],
      },
      verse: {
        gtr: ['d2 d2 .  d2 .  d2 d2 .  d2 .  f2 .  g2 .  a2 . ',
              'd2 d2 .  d2 .  d2 d2 .  d2 .  c3 .  a2 .  g2 f2',
              'bb2 - -  .  bb2 . c3 -  -  .  c3 .  d3 -  -  . ',
              'a2 -  -  .  g2 -  -  .  f2 .  f2 .  e2 .  e2 . '],
        bass: ['d1 d1 .  d1 .  d1 d1 .  d1 .  f1 .  g1 .  a1 . ',
               'd1 d1 .  d1 .  d1 d1 .  d1 .  c2 .  a1 .  g1 f1',
               'bb1 . bb2 . bb1 . c2 .  c2 .  c3 .  d2 .  d2 . ',
               'a1 .  a2 .  g1 .  g2 .  f1 .  f2 .  e1 .  e2 . '],
        lead: [R, R, R, R],
        drum: ['kc .  h  k  s  .  h  .  k  .  h  k  s  .  h  . ',
               'k  .  h  k  s  .  h  .  k  .  h  k  s  .  h  H ',
               'kc .  h  .  s  .  h  k  .  .  h  .  s  .  h  . ',
               'k  .  h  .  s  .  h  .  k  .  t  T  s  .  s  s '],
      },
      verse2: {
        from: 'verse',
        lead: [R,
               'd5 -  f5 -  a5 -  -  -  g5 -  f5 -  d5 -  -  . ',
               'f5 -  -  .  g5 -  a5 -  c6 -  -  -  a5 -  -  - ',
               'a5 -  g5 -  f5 -  e5 -  d5 -  -  -  -  -  -  . '],
      },
      chorus: {
        gtr: ['d2 -  -  -  -  -  .  d2 .  d2 .  d2 .  d2 .  . ',
              'bb2 - -  -  -  -  .  bb2 . bb2 . bb2 . bb2 . . ',
              'f2 -  -  -  -  -  .  f2 .  f2 .  f2 .  f2 .  . ',
              'c3 -  -  -  -  -  .  c3 .  c3 .  a2 .  g2 .  f2'],
        bass: ['d1 .  d1 .  d2 .  d1 .  d1 .  d1 .  d2 .  a1 . ',
               'bb1 . bb1 . bb2 . bb1 . bb1 . bb1 . bb2 . f1 . ',
               'f1 .  f1 .  f2 .  f1 .  f1 .  f1 .  f2 .  c2 . ',
               'c2 .  c2 .  c3 .  c2 .  a1 .  a1 .  g1 .  f1 . '],
        lead: ['a5 -  -  -  d6 -  -  -  c6 -  a5 -  -  -  -  . ',
               'f5 -  -  -  bb5 - -  -  a5 -  f5 -  -  -  -  . ',
               'c6 -  -  -  a5 -  -  -  f5 -  g5 -  a5 -  -  . ',
               'g5 -  a5 -  c6 -  d6 -  c6 -  a5 -  g5 -  f5 - '],
        drum: ['kc .  r  k  s  .  r  .  k  .  r  k  s  .  r  . ',
               'k  .  r  k  s  .  r  .  k  .  r  k  s  .  r  . ',
               'kc .  r  k  s  .  r  .  k  .  r  k  s  .  r  . ',
               'k  .  r  k  s  .  r  .  k  .  t  .  T  .  s  s '],
      },
      break: {
        gtr: [R, R, R, R],
        bass: ['d1 .  d1 d2 .  d1 .  d1 f1 .  f1 .  a1 .  a1 . ',
               'd1 .  d1 d2 .  d1 .  d1 c2 .  c2 .  g1 .  g1 . ',
               'bb1 . bb1 bb2 . bb1 . bb1 c2 . c2 c3 .  c2 .  c2',
               'a1 .  a1 a2 .  a1 .  a1 a1 .  a2 .  a1 .  a1 . '],
        lead: ['.  .  .  .  d5 -  f5 -  a5 -  -  -  -  -  .  . ',
               '.  .  .  .  c6 -  a5 -  g5 -  f5 -  d5 -  .  . ',
               'f5 -  g5 -  a5 -  bb5 - c6 -  -  -  -  -  .  . ',
               'a5 -  -  -  g5 -  -  -  f5 -  e5 -  d5 -  .  . '],
        drum: ['k  .  h  .  s  .  h  .  k  .  h  .  s  .  h  . ',
               'k  .  h  .  s  .  h  .  k  .  h  .  s  .  h  H ',
               'k  .  h  .  s  .  h  .  k  .  h  .  s  .  h  . ',
               'k  .  h  .  s  .  h  .  t  .  t  T  .  s  s  s '],
      },
      solo: {
        from: 'verse',
        lead: ['d6 -  c6 -  a5 -  g5 -  f5 -  g5 -  a5 -  c6 - ',
               'd6 -  -  -  c6 -  a5 -  g5 -  f5 -  d5 -  f5 - ',
               'a5 -  bb5 - c6 -  d6 -  e6 -  d6 -  c6 -  a5 - ',
               'g5 -  a5 -  f5 -  d5 -  a5 -  -  -  -  -  -  . '],
      },
      outro: {
        gtr: ['d2 d2 .  d2 .  d2 d2 .  f2 .  g2 .  a2 .  c3 . ',
              'd2 -  -  -  -  -  -  -  -  -  -  -  -  -  -  - '],
        bass: ['d1 d1 .  d1 .  d1 d1 .  f1 .  g1 .  a1 .  c2 . ',
               'd1 -  -  -  -  -  -  -  -  -  -  -  -  -  -  - '],
        lead: [R,
               'd6 -  -  -  -  -  -  -  -  -  -  -  -  -  -  - '],
        drum: ['k  .  h  k  s  .  h  .  t  t  T  T  s  s  s  s ',
               'kc .  .  .  .  .  .  .  .  .  .  .  .  .  .  . '],
      },
      pre: {                                     // Bb-C-D: полутемповый разгон в припев
        gtr: ['bb2 - -  -  .  bb2 .  bb2 .  bb2 .  .  bb2 .  .  . ',
              'c3 -  -  -  .  c3 .  c3 .  c3 .  .  c3 .  .  . ',
              'd3 -  -  -  .  d3 .  d3 .  d3 .  .  d3 .  .  . ',
              'a2 -  -  .  a2 .  a2 .  a2 .  a2 .  a2 a2 a2 a2'],
        bass: ['bb1 . .  .  bb1 .  .  bb2 .  bb1 .  .  bb1 .  .  . ',
               'c2 .  .  .  c2 .  .  c3 .  c2 .  .  c2 .  .  . ',
               'd2 .  .  .  d2 .  .  d3 .  d2 .  .  d2 .  .  . ',
               'a1 .  .  .  a1 .  .  a2 .  a1 .  a1 .  a1 a1 a1'],
        lead: ['.  .  .  .  .  .  .  .  d5 -  -  -  f5 -  -  - ',
               'g5 -  -  -  -  -  .  .  a5 -  -  -  c6 -  -  - ',
               'd6 -  -  -  c6 -  a5 -  f5 -  -  -  -  -  .  . ',
               'e5 -  -  -  f5 -  g5 -  a5 -  -  -  c6 -  d6 - '],
        drum: ['kc .  .  .  .  .  .  .  s  .  .  .  .  .  .  . ',
               'k  .  .  .  .  .  .  k  s  .  .  .  .  .  .  . ',
               'kc .  .  .  .  .  .  .  s  .  .  .  .  .  .  H ',
               'k  .  h  h  s  .  h  h  t  t  T  T  s  s  s  s '],
      },
      chorus2: {                                 // тот же припев с новой мелодией и двойной бочкой
        from: 'chorus',
        lead: ['d6 -  -  -  a5 -  -  -  f5 -  a5 -  d6 -  -  - ',
               'c6 -  -  -  a5 -  -  -  f5 -  -  -  bb5 - -  - ',
               'a5 -  c6 -  d6 -  e6 -  d6 -  -  -  c6 -  a5 - ',
               'g5 -  a5 -  bb5 - c6 -  d6 -  -  -  -  -  -  - '],
        drum: ['kc k  r  k  s  .  r  k  k  k  r  k  s  .  r  r ',
               'k  k  r  k  s  .  r  k  k  k  r  k  s  .  r  . ',
               'kc k  r  k  s  .  r  k  k  k  r  k  s  .  r  r ',
               'k  k  r  k  s  .  r  .  t  t  T  T  s  s  s  s '],
      },
      interlude: {                               // чистые арпеджио Dm-Bb-F-C
        feel: 'clean',
        gtr: ['d3 .  f3 .  a3 .  d4 .  a3 .  f3 .  a3 .  d3 . ',
              'bb2 . d3 .  f3 .  bb3 .  f3 .  d3 .  f3 .  bb2 . ',
              'f3 .  a3 .  c4 .  f4 .  c4 .  a3 .  c4 .  f3 . ',
              'c3 .  e3 .  g3 .  c4 .  g3 .  e3 .  g3 .  a3 bb3'],
        bass: ['d1 -  -  -  -  -  -  -  d1 -  -  -  -  -  .  . ',
               'bb1 - -  -  -  -  -  -  bb1 -  -  -  -  -  .  . ',
               'f1 -  -  -  -  -  -  -  f1 -  -  -  -  -  .  . ',
               'c2 -  -  -  -  -  -  -  c2 -  -  -  .  c2 .  . '],
        lead: [R,
               'd5 -  -  -  -  -  .  .  f5 -  -  -  -  -  .  . ',
               'a5 -  -  -  g5 -  -  -  f5 -  -  -  -  -  -  . ',
               'e5 -  -  -  g5 -  f5 -  e5 -  -  -  -  -  .  . '],
        drum: ['.  .  h  .  x  .  h  .  .  .  h  .  x  .  h  h ',
               'k  .  h  .  x  .  h  .  k  .  h  .  x  .  h  . ',
               '.  .  h  .  x  .  h  .  .  .  h  .  x  .  h  h ',
               'k  .  h  .  x  .  h  k  .  .  h  .  x  .  t  T '],
      },
      solo2: {                                   // продолжение соло — бег шестнадцатыми
        from: 'verse',
        lead: ['d6 c6 a5 g5 f5 -  a5 -  g5 f5 d5 f5 a5 -  -  - ',
               'c6 -  a5 -  bb5 -  g5 -  a5 f5 d5 c5 d5 -  -  - ',
               'f5 g5 a5 c6 d6 -  c6 -  a5 g5 f5 d5 e5 -  g5 - ',
               'a5 -  d6 -  c6 a5 g5 f5 d5 -  a5 -  d6 -  -  - '],
        drum: ['=', '=', '=',
               'k  .  r  k  s  .  r  k  t  t  T  T  s  s  s  s '],
      },
    },
  },

  citadel: {                                     // ASHEN CITADEL — тяжёлый полутемп в Em
    bpm: 140,
    vol: { gtr: 0.64, bass: 0.68, lead: 0.48, drum: 0.56 },
    order: ['intro', 'verse', 'verse2', 'pre', 'chorus', 'interlude', 'verse2',
            'bridge', 'solo', 'solo2', 'pre', 'chorus', 'chorus2', 'outro'],
    sections: {
      intro: {
        gtr: [R, R,
              'e2 -  -  -  -  -  -  -  e2 -  -  -  -  -  -  - ',
              'f2 -  -  -  -  -  -  -  e2 -  -  -  .  e2 .  . '],
        bass: ['e1 -  -  -  -  -  -  -  e1 -  -  -  -  -  -  - ',
               'e1 -  -  -  -  -  -  -  f1 -  -  -  -  -  -  - ',
               'e1 .  .  .  e1 .  .  .  e1 .  .  .  e1 .  .  . ',
               'f1 .  .  .  f1 .  .  .  e1 .  .  .  e1 .  e1 . '],
        lead: ['b4 -  -  -  -  -  -  -  e5 -  -  -  -  -  -  - ',
               'g5 -  -  -  f5 -  -  -  e5 -  -  -  -  -  -  . ',
               R, R],
        drum: [R,
               '.  .  .  .  .  .  .  .  .  .  .  .  t  .  T  . ',
               'k  .  .  .  h  .  s  .  k  .  .  k  h  .  s  . ',
               'k  .  .  .  h  .  s  .  t  .  t  .  T  .  T  . '],
      },
      verse: {
        gtr: ['e2 -  -  .  e2 .  e2 .  f2 -  -  .  e2 .  .  . ',
              'e2 -  -  .  e2 .  e2 .  g2 -  .  f2 -  .  e2 . ',
              'c3 -  -  .  c3 .  b2 -  -  .  b2 .  a2 -  -  . ',
              'g2 -  -  .  f2 -  -  .  e2 -  -  -  e2 .  f2 g2'],
        bass: ['e1 .  e1 .  e1 .  e1 e1 f1 .  f1 .  e1 .  e1 . ',
               'e1 .  e1 .  e1 .  e1 e1 g1 .  g1 .  f1 .  e1 . ',
               'c2 .  c2 .  c2 .  b1 .  b1 .  b1 .  a1 .  a1 . ',
               'g1 .  g1 .  f1 .  f1 .  e1 .  e2 .  e1 .  f1 g1'],
        lead: [R, R, R, R],
        drum: ['kc .  .  .  h  .  s  .  k  .  .  k  h  .  s  . ',
               'k  .  .  .  h  .  s  .  k  .  .  k  h  .  s  H ',
               'kc .  .  .  h  .  s  .  k  .  .  k  h  .  s  . ',
               'k  .  .  k  h  .  s  .  t  .  T  .  s  .  s  s '],
      },
      verse2: {
        from: 'verse',
        lead: [R,
               'b4 -  -  -  e5 -  -  -  g5 -  f5 -  e5 -  -  - ',
               'c6 -  -  -  b5 -  -  -  a5 -  g5 -  f5 -  -  - ',
               'g5 -  f5 -  e5 -  d5 -  e5 -  -  -  -  -  -  . '],
      },
      chorus: {
        gtr: ['c3 -  -  -  -  -  -  -  -  -  -  .  c3 .  c3 . ',
              'g2 -  -  -  -  -  -  -  -  -  -  .  g2 .  g2 . ',
              'd3 -  -  -  -  -  -  -  -  -  -  .  d3 .  d3 . ',
              'e3 -  -  -  -  -  -  -  -  -  -  -  -  -  .  . '],
        bass: ['c2 .  .  c2 .  .  c2 .  c1 .  .  c2 .  c2 .  . ',
               'g1 .  .  g1 .  .  g1 .  g1 .  .  g2 .  g1 .  . ',
               'd2 .  .  d2 .  .  d2 .  d1 .  .  d2 .  d2 .  . ',
               'e1 .  .  e1 .  .  e1 .  e2 .  .  e1 .  b1 .  . '],
        lead: ['e5 -  -  -  g5 -  -  -  c6 -  -  -  -  -  -  . ',
               'b5 -  -  -  d6 -  -  -  b5 -  -  -  -  -  -  . ',
               'a5 -  -  -  f#5 - -  -  d6 -  -  -  -  -  -  . ',
               'b5 -  -  -  a5 -  g5 -  e5 -  -  -  -  -  -  . '],
        drum: ['kc .  .  .  h  .  s  .  k  .  .  k  h  .  s  . ',
               'k  .  .  .  h  .  s  .  k  .  .  k  h  .  s  . ',
               'kc .  .  .  h  .  s  .  k  .  .  k  h  .  s  . ',
               'k  .  .  .  h  .  s  .  t  .  T  .  s  .  s  s '],
      },
      bridge: {
        gtr: [R, R, R, R],
        bass: ['e1 .  .  .  e1 .  .  .  e1 .  .  .  e1 .  .  . ',
               'c2 .  .  .  c2 .  .  .  c2 .  .  .  b1 .  .  . ',
               'a1 .  .  .  a1 .  .  .  a1 .  .  .  a1 .  .  . ',
               'b1 .  .  .  b1 .  .  .  b1 .  .  .  b1 .  b2 . '],
        lead: ['e5 -  -  -  -  -  g5 -  b5 -  -  -  -  -  -  . ',
               'c6 -  -  -  b5 -  -  -  g5 -  -  -  -  -  -  . ',
               'a5 -  -  -  c6 -  -  -  b5 -  a5 -  -  -  -  . ',
               'g5 -  -  -  f#5 - -  -  e5 -  -  -  -  -  .  . '],
        drum: [R,
               '.  .  .  .  .  .  .  .  .  .  .  .  h  .  h  . ',
               'k  .  .  .  .  .  s  .  .  .  .  .  .  .  .  . ',
               'k  .  .  .  .  .  s  .  t  .  t  .  T  .  T  . '],
      },
      solo: {
        from: 'verse',
        lead: ['e5 -  g5 -  b5 -  a5 -  g5 -  f#5 - e5 -  -  - ',
               'b5 -  c6 -  d6 -  c6 -  b5 -  a5 -  g5 -  -  - ',
               'e6 -  d6 -  c6 -  b5 -  a5 -  g5 -  f#5 - e5 - ',
               'g5 -  a5 -  b5 -  c6 -  b5 -  -  -  -  -  -  . '],
      },
      outro: {
        gtr: ['e2 -  -  .  f2 -  -  .  g2 -  -  .  e2 .  .  . ',
              'e2 -  -  -  -  -  -  -  -  -  -  -  -  -  -  - '],
        bass: ['e1 .  e1 .  f1 .  f1 .  g1 .  g1 .  e1 .  e1 . ',
               'e1 -  -  -  -  -  -  -  -  -  -  -  -  -  -  - '],
        lead: [R,
               'e5 -  -  -  -  -  -  -  -  -  -  -  -  -  -  - '],
        drum: ['k  .  .  .  h  .  s  .  t  .  t  .  T  .  T  . ',
               'kc .  .  .  .  .  .  .  .  .  .  .  .  .  .  . '],
      },
      pre: {                                     // C-D-Am-B: тяжёлый подъём к припеву
        gtr: ['c3 -  -  -  -  -  .  c3 .  c3 .  .  c3 .  .  . ',
              'd3 -  -  -  -  -  .  d3 .  d3 .  .  d3 .  .  . ',
              'a2 -  -  -  -  -  .  a2 .  a2 .  .  a2 .  .  . ',
              'b2 -  -  -  .  b2 .  b2 .  b2 .  b2 .  b2 b2 b2'],
        bass: ['c2 .  .  .  c2 .  .  c1 .  c2 .  .  c2 .  .  . ',
               'd2 .  .  .  d2 .  .  d1 .  d2 .  .  d2 .  .  . ',
               'a1 .  .  .  a1 .  .  a2 .  a1 .  .  a1 .  .  . ',
               'b1 .  .  .  b1 .  .  b2 .  b1 .  b1 .  b1 b1 b1'],
        lead: ['.  .  .  .  .  .  .  .  e5 -  -  -  g5 -  -  - ',
               'a5 -  -  -  -  -  .  .  b5 -  -  -  d6 -  -  - ',
               'c6 -  -  -  b5 -  a5 -  g5 -  -  -  -  -  .  . ',
               'f#5 - -  -  g5 -  a5 -  b5 -  -  -  d6 -  e6 - '],
        drum: ['kc .  .  .  .  .  .  .  s  .  .  .  .  .  .  . ',
               'k  .  .  .  .  .  .  k  s  .  .  .  .  .  .  . ',
               'kc .  .  .  .  .  .  .  s  .  .  .  .  .  .  H ',
               'k  .  h  h  s  .  h  h  t  t  T  T  s  s  s  s '],
      },
      chorus2: {                                 // припев на повторе: верхний регистр, райд
        from: 'chorus',
        lead: ['g5 -  -  -  b5 -  -  -  e6 -  -  -  -  -  d6 - ',
               'd6 -  -  -  b5 -  -  -  g5 -  b5 -  d6 -  -  - ',
               'a5 -  -  -  d6 -  -  -  c6 -  a5 -  f#5 - -  - ',
               'e6 -  -  -  d6 -  b5 -  a5 -  g5 -  e5 -  -  - '],
        drum: ['kc .  r  k  s  .  r  .  k  .  r  k  s  .  r  r ',
               'k  .  r  k  s  .  r  .  k  .  r  k  s  .  r  . ',
               'kc .  r  k  s  .  r  .  k  .  r  k  s  .  r  r ',
               'k  .  r  k  s  .  r  .  t  t  T  T  s  s  s  s '],
      },
      interlude: {                               // чистые арпеджио Em-C-G-D
        feel: 'clean',
        gtr: ['e3 .  g3 .  b3 .  e4 .  b3 .  g3 .  b3 .  e3 . ',
              'c3 .  e3 .  g3 .  c4 .  g3 .  e3 .  g3 .  c3 . ',
              'g3 .  b3 .  d4 .  g4 .  d4 .  b3 .  d4 .  g3 . ',
              'd3 .  f#3 .  a3 .  d4 .  a3 .  f#3 .  a3 .  b3 c4'],
        bass: ['e1 -  -  -  -  -  -  -  e1 -  -  -  -  -  .  . ',
               'c2 -  -  -  -  -  -  -  c2 -  -  -  -  -  .  . ',
               'g1 -  -  -  -  -  -  -  g1 -  -  -  -  -  .  . ',
               'd2 -  -  -  -  -  -  -  d2 -  -  -  .  d2 .  . '],
        lead: [R,
               'e5 -  -  -  -  -  .  .  g5 -  -  -  -  -  .  . ',
               'b5 -  -  -  a5 -  -  -  g5 -  -  -  -  -  -  . ',
               'f#5 - -  -  a5 -  g5 -  f#5 -  -  -  -  -  .  . '],
        drum: ['.  .  h  .  x  .  h  .  .  .  h  .  x  .  h  . ',
               'k  .  h  .  x  .  h  .  .  .  h  .  x  .  h  . ',
               '.  .  h  .  x  .  h  .  .  .  h  .  x  .  h  . ',
               'k  .  h  .  x  .  h  k  .  .  h  .  x  .  t  T '],
      },
      solo2: {                                   // соло уходит вверх и сыплется вниз
        from: 'verse',
        lead: ['e6 -  d6 -  b5 -  a5 -  g5 -  a5 -  b5 -  d6 - ',
               'e6 d6 b5 a5 g5 -  e5 -  f#5 g5 a5 b5 c6 -  b5 - ',
               'a5 -  c6 -  b5 -  a5 -  g5 f#5 e5 d5 e5 -  g5 - ',
               'b5 -  a5 -  g5 -  e5 -  b5 -  -  -  e5 -  -  - '],
        drum: ['=', '=', '=',
               'k  .  .  k  h  .  s  .  t  t  T  T  s  s  s  s '],
      },
    },
  },

  glacial: {                                    // GLACIAL DESCENT — стылый маршевый риф в Bm
    bpm: 150,
    vol: { gtr: 0.63, bass: 0.67, lead: 0.5, drum: 0.54 },
    order: ['intro', 'verse', 'verse2', 'pre', 'chorus', 'interlude', 'verse2',
            'bridge', 'solo', 'solo2', 'pre', 'chorus', 'chorus2', 'outro'],
    sections: {
      intro: {
        gtr: [R,
              R,
              'b2 -  -  -  -  -  -  -  b2 -  -  -  -  -  -  - ',
              'd3 -  -  -  -  -  -  -  a2 -  -  -  .  a2 .  . '],
        bass: ['b1 -  -  -  -  -  -  -  b1 -  -  -  -  -  -  - ',
               'b1 -  -  -  -  -  -  -  d2 -  -  -  -  -  -  - ',
               'b1 .  .  .  b1 .  .  .  b1 .  .  .  b1 .  .  . ',
               'd2 .  .  .  d2 .  .  .  a1 .  .  .  a1 .  a1 . '],
        lead: ['f#5 -  -  -  -  -  -  -  b5 -  -  -  -  -  -  - ',
               'a5 -  -  -  g5 -  -  -  f#5 -  -  -  -  -  -  . ',
               R,
               R],
        drum: [R,
               '.  .  .  .  .  .  .  .  .  .  .  .  t  .  T  . ',
               'k  .  .  .  h  .  s  .  k  .  .  k  h  .  s  . ',
               'k  .  .  .  h  .  s  .  t  .  t  .  T  .  T  . '],
      },
      verse: {
        gtr: ['b2 -  -  .  b2 .  b2 .  d3 -  -  .  b2 .  .  . ',
              'b2 -  -  .  b2 .  b2 .  a2 -  .  g2 -  .  b2 . ',
              'g2 -  -  .  g2 .  a2 -  -  .  a2 .  b2 -  -  . ',
              'd3 -  -  .  a2 -  -  .  b2 -  -  -  b2 .  d3 e3'],
        bass: ['b1 .  b1 .  b1 .  b1 b1 d2 .  d2 .  b1 .  b1 . ',
               'b1 .  b1 .  b1 .  b1 b1 a1 .  a1 .  g1 .  b1 . ',
               'g1 .  g1 .  g1 .  a1 .  a1 .  a1 .  b1 .  b1 . ',
               'd2 .  d2 .  a1 .  a1 .  b1 .  b2 .  b1 .  d2 e2'],
        lead: [R,
               R,
               R,
               R],
        drum: ['kc .  .  .  h  .  s  .  k  .  .  k  h  .  s  . ',
               'k  .  .  .  h  .  s  .  k  .  .  k  h  .  s  H ',
               'kc .  .  .  h  .  s  .  k  .  .  k  h  .  s  . ',
               'k  .  .  k  h  .  s  .  t  .  T  .  s  .  s  s '],
      },
      verse2: {
        from: 'verse',
        lead: [R,
               'f#5 -  -  -  b5 -  -  -  d6 -  a5 -  f#5 -  -  - ',
               'g5 -  -  -  f#5 -  -  -  e5 -  d5 -  e5 -  -  - ',
               'f#5 -  a5 -  b5 -  a5 -  f#5 -  -  -  -  -  -  . '],
      },
      chorus: {
        gtr: ['d3 -  -  -  -  -  -  -  -  -  -  .  d3 .  d3 . ',
              'a2 -  -  -  -  -  -  -  -  -  -  .  a2 .  a2 . ',
              'g2 -  -  -  -  -  -  -  -  -  -  .  g2 .  g2 . ',
              'b2 -  -  -  -  -  -  -  -  -  -  -  -  -  .  . '],
        bass: ['d2 .  .  d2 .  .  d2 .  d1 .  .  d2 .  d2 .  . ',
               'a1 .  .  a1 .  .  a1 .  a1 .  .  a2 .  a1 .  . ',
               'g1 .  .  g1 .  .  g1 .  g1 .  .  g2 .  g1 .  . ',
               'b1 .  .  b1 .  .  b1 .  b2 .  .  b1 .  f#1 .  . '],
        lead: ['d6 -  -  -  a5 -  -  -  f#5 -  -  -  -  -  -  . ',
               'e6 -  -  -  c#6 -  -  -  a5 -  -  -  -  -  -  . ',
               'd6 -  -  -  b5 -  -  -  g5 -  -  -  -  -  -  . ',
               'f#6 -  -  -  e6 -  d6 -  b5 -  -  -  -  -  -  . '],
        drum: ['kc .  .  .  h  .  s  .  k  .  .  k  h  .  s  . ',
               'k  .  .  .  h  .  s  .  k  .  .  k  h  .  s  . ',
               'kc .  .  .  h  .  s  .  k  .  .  k  h  .  s  . ',
               'k  .  .  .  h  .  s  .  t  .  T  .  s  .  s  s '],
      },
      bridge: {
        gtr: [R,
              R,
              R,
              R],
        bass: ['b1 .  .  .  b1 .  .  .  b1 .  .  .  b1 .  .  . ',
               'g1 .  .  .  g1 .  .  .  g1 .  .  .  f#1 .  .  . ',
               'e1 .  .  .  e1 .  .  .  e1 .  .  .  e1 .  .  . ',
               'f#1 .  .  .  f#1 .  .  .  f#1 .  .  .  f#1 .  f#2 . '],
        lead: ['b4 -  -  -  -  -  d5 -  f#5 -  -  -  -  -  -  . ',
               'g5 -  -  -  f#5 -  -  -  d5 -  -  -  -  -  -  . ',
               'e5 -  -  -  g5 -  -  -  f#5 -  e5 -  -  -  -  . ',
               'd5 -  -  -  c#5 -  -  -  b4 -  -  -  -  -  .  . '],
        drum: [R,
               '.  .  .  .  .  .  .  .  .  .  .  .  h  .  h  . ',
               'k  .  .  .  .  .  s  .  .  .  .  .  .  .  .  . ',
               'k  .  .  .  .  .  s  .  t  .  t  .  T  .  T  . '],
      },
      solo: {
        from: 'verse',
        lead: ['b5 -  d6 -  f#6 -  e6 -  d6 -  c#6 -  b5 -  -  - ',
               'f#6 -  g6 -  a6 -  g6 -  f#6 -  e6 -  d6 -  -  - ',
               'b6 -  a6 -  g6 -  f#6 -  e6 -  d6 -  c#6 -  b5 - ',
               'd6 -  e6 -  f#6 -  g6 -  f#6 -  -  -  -  -  -  . '],
      },
      outro: {
        gtr: ['b2 -  -  .  g2 -  -  .  a2 -  -  .  b2 .  .  . ',
              'b2 -  -  -  -  -  -  -  -  -  -  -  -  -  -  - '],
        bass: ['b1 .  b1 .  g1 .  g1 .  a1 .  a1 .  b1 .  b1 . ',
               'b1 -  -  -  -  -  -  -  -  -  -  -  -  -  -  - '],
        lead: [R,
               'f#5 -  -  -  -  -  -  -  -  -  -  -  -  -  -  - '],
        drum: ['k  .  .  .  h  .  s  .  t  .  t  .  T  .  T  . ',
               'kc .  .  .  .  .  .  .  .  .  .  .  .  .  .  . '],
      },
      pre: {                                     // G-A-Bm-D: стылый подъём к припеву
        gtr: ['g2 -  -  -  -  -  .  g2 .  g2 .  .  g2 .  .  . ',
              'a2 -  -  -  -  -  .  a2 .  a2 .  .  a2 .  .  . ',
              'b2 -  -  -  -  -  .  b2 .  b2 .  .  b2 .  .  . ',
              'd3 -  -  -  .  d3 .  d3 .  d3 .  d3 .  d3 d3 d3'],
        bass: ['g1 .  .  .  g1 .  .  g2 .  g1 .  .  g1 .  .  . ',
               'a1 .  .  .  a1 .  .  a2 .  a1 .  .  a1 .  .  . ',
               'b1 .  .  .  b1 .  .  b2 .  b1 .  .  b1 .  .  . ',
               'd2 .  .  .  d2 .  .  d1 .  d2 .  d2 .  d2 d2 d2'],
        lead: ['.  .  .  .  .  .  .  .  b4 -  -  -  d5 -  -  - ',
               'e5 -  -  -  -  -  .  .  f#5 -  -  -  a5 -  -  - ',
               'b5 -  -  -  a5 -  g5 -  f#5 -  -  -  -  -  .  . ',
               'g5 -  -  -  a5 -  b5 -  d6 -  -  -  e6 -  f#6 - '],
        drum: ['kc .  .  .  .  .  .  .  s  .  .  .  .  .  .  . ',
               'k  .  .  .  .  .  .  k  s  .  .  .  .  .  .  . ',
               'kc .  .  .  .  .  .  .  s  .  .  .  .  .  .  H ',
               'k  .  h  h  s  .  h  h  t  t  T  T  s  s  s  s '],
      },
      chorus2: {                                 // припев на повторе: верхний регистр, райд
        from: 'chorus',
        lead: ['a5 -  -  -  d6 -  -  -  f#6 -  -  -  -  -  e6 - ',
               'e6 -  -  -  c#6 -  -  -  a5 -  c#6 -  e6 -  -  - ',
               'd6 -  -  -  g6 -  -  -  f#6 -  d6 -  b5 -  -  - ',
               'f#6 -  -  -  e6 -  c#6 -  b5 -  a5 -  f#5 -  -  - '],
        drum: ['kc .  r  k  s  .  r  .  k  .  r  k  s  .  r  r ',
               'k  .  r  k  s  .  r  .  k  .  r  k  s  .  r  . ',
               'kc .  r  k  s  .  r  .  k  .  r  k  s  .  r  r ',
               'k  .  r  k  s  .  r  .  t  t  T  T  s  s  s  s '],
      },
      interlude: {                               // чистые арпеджио Bm-G-D-A
        feel: 'clean',
        gtr: ['b3 .  d4 .  f#4 .  b4 .  f#4 .  d4 .  f#4 .  b3 . ',
              'g3 .  b3 .  d4 .  g4 .  d4 .  b3 .  d4 .  g3 . ',
              'd3 .  f#3 .  a3 .  d4 .  a3 .  f#3 .  a3 .  d3 . ',
              'a3 .  c#4 .  e4 .  a4 .  e4 .  c#4 .  e4 .  f#4 g4'],
        bass: ['b1 -  -  -  -  -  -  -  b1 -  -  -  -  -  .  . ',
               'g1 -  -  -  -  -  -  -  g1 -  -  -  -  -  .  . ',
               'd2 -  -  -  -  -  -  -  d2 -  -  -  -  -  .  . ',
               'a1 -  -  -  -  -  -  -  a1 -  -  -  .  a1 .  . '],
        lead: [R,
               'b5 -  -  -  -  -  .  .  d6 -  -  -  -  -  .  . ',
               'f#5 -  -  -  e5 -  -  -  d5 -  -  -  -  -  -  . ',
               'c#5 -  -  -  e5 -  d5 -  c#5 -  -  -  -  -  .  . '],
        drum: ['.  .  h  .  x  .  h  .  .  .  h  .  x  .  h  . ',
               'k  .  h  .  x  .  h  .  .  .  h  .  x  .  h  . ',
               '.  .  h  .  x  .  h  .  .  .  h  .  x  .  h  . ',
               'k  .  h  .  x  .  h  k  .  .  h  .  x  .  t  T '],
      },
      solo2: {                                   // соло уходит вверх и сыплется вниз
        from: 'verse',
        lead: ['b6 -  a6 -  f#6 -  e6 -  d6 -  e6 -  f#6 -  a6 - ',
               'b6 a6 f#6 e6 d6 -  b5 -  c#6 d6 e6 f#6 g6 -  f#6 - ',
               'e6 -  g6 -  f#6 -  e6 -  d6 c#6 b5 a5 b5 -  d6 - ',
               'f#6 -  e6 -  d6 -  b5 -  f#5 -  -  -  b5 -  -  - '],
        drum: ['=',
               '=',
               '=',
               'k  .  .  k  h  .  s  .  t  t  T  T  s  s  s  s '],
      },
    },
  },

  boss: {                                        // тема боссов — галоп и хроматика
    bpm: 176,
    vol: { gtr: 0.62, bass: 0.66, lead: 0.52, drum: 0.56 },
    order: ['intro', 'riff', 'riff2', 'chorus', 'riff3', 'break', 'solo', 'solo2',
            'stomp', 'chorus', 'chorus2', 'riff2', 'riff3'],
    sections: {
      intro: {
        gtr: [R,
              'd2 d2 d2 .  d2 d2 d2 .  d2 d2 d2 .  eb2 . e2 . '],
        bass: ['.  .  .  .  .  .  .  .  d1 d1 d1 .  d1 d1 d1 . ',
               'd1 d1 d1 .  d1 d1 d1 .  d1 d1 d1 .  eb1 . e1 . '],
        lead: [R, R],
        drum: ['h  h  h  h  h  h  h  h  k  k  k  k  k  k  k  k ',
               'kc k  h  k  s  k  h  k  k  k  h  k  s  k  h  k '],
      },
      riff: {
        gtr: ['d2 d2 d2 .  d2 d2 d2 .  d2 d2 d2 .  eb2 . e2 . ',
              'd2 d2 d2 .  d2 d2 d2 .  d2 d2 d2 .  c3 .  bb2 . ',
              'd2 d2 d2 .  d2 d2 d2 .  f2 .  g2 .  ab2 . a2 . ',
              'bb2 - .  bb2 . a2 -  .  ab2 - .  g2 .  f#2 . f2'],
        bass: ['d1 d1 d1 .  d1 d1 d1 .  d1 d1 d1 .  eb1 . e1 . ',
               'd1 d1 d1 .  d1 d1 d1 .  d1 d1 d1 .  c2 .  bb1 . ',
               'd1 d1 d1 .  d1 d1 d1 .  f1 .  g1 .  ab1 . a1 . ',
               'bb1 . bb2 . a1 .  a2 .  ab1 . g1 .  f#1 . f1 . '],
        lead: [R, R, R, R],
        drum: ['kc k  h  k  s  k  h  k  k  k  h  k  s  k  h  k ',
               'k  k  h  k  s  k  h  k  k  k  h  k  s  k  h  H ',
               'kc k  h  k  s  k  h  k  k  k  h  k  s  k  h  k ',
               'k  k  h  k  s  k  h  k  t  t  T  T  s  s  s  s '],
      },
      riff2: {
        from: 'riff',
        lead: ['a5 -  .  a5 .  f5 -  .  a5 .  d6 -  c6 -  a5 - ',
               'g5 -  .  g5 .  eb5 - .  g5 .  c6 -  bb5 - g5 - ',
               'a5 -  .  c6 .  d6 -  .  f6 -  e6 -  d6 -  c6 - ',
               'd6 -  c6 -  bb5 - a5 -  ab5 - g5 -  f5 -  d5 - '],
      },
      chorus: {
        gtr: ['d2 -  -  .  d2 .  d2 .  d2 -  -  .  d2 .  d2 . ',
              'bb2 - -  .  bb2 . bb2 . bb2 - -  .  bb2 . c3 . ',
              'c3 -  -  .  c3 .  c3 .  c3 -  -  .  c3 .  bb2 . ',
              'a2 -  -  .  a2 .  a2 .  d3 -  -  -  -  -  .  . '],
        bass: ['d1 d1 .  d1 .  d1 .  d1 d2 .  d1 .  d1 .  d1 . ',
               'bb1 bb1 . bb1 . bb1 . bb1 bb2 . bb1 . c2 . c2 . ',
               'c2 c2 .  c2 .  c2 .  c2 c3 .  c2 .  bb1 . bb1 . ',
               'a1 a1 .  a1 .  a1 .  a1 d2 .  d1 .  d2 .  a1 . '],
        lead: ['d6 -  -  -  c6 -  a5 -  f5 -  -  -  a5 -  -  . ',
               'bb5 - -  -  a5 -  f5 -  d5 -  -  -  f5 -  -  . ',
               'c6 -  -  -  bb5 - g5 -  e5 -  -  -  g5 -  -  . ',
               'a5 -  c6 -  d6 -  e6 -  f6 -  -  -  -  -  -  . '],
        drum: ['kc k  r  k  s  k  r  k  k  k  r  k  s  k  r  k ',
               'k  k  r  k  s  k  r  k  k  k  r  k  s  k  r  k ',
               'kc k  r  k  s  k  r  k  k  k  r  k  s  k  r  k ',
               'k  k  r  k  s  k  r  k  t  t  T  T  s  s  s  s '],
      },
      break: {
        gtr: ['d2 -  -  -  -  -  -  -  .  .  d2 .  d2 .  .  . ',
              'eb2 - -  -  -  -  -  -  .  .  eb2 . eb2 . .  . ',
              'f2 -  -  -  -  -  -  -  .  .  f2 .  e2 .  .  . ',
              'd2 -  -  -  -  -  -  -  .  .  .  .  eb2 . e2 . '],
        bass: ['d1 -  -  -  -  -  -  -  .  .  d1 .  d1 .  .  . ',
               'eb1 - -  -  -  -  -  -  .  .  eb1 . eb1 . .  . ',
               'f1 -  -  -  -  -  -  -  .  .  f1 .  e1 .  .  . ',
               'd1 -  -  -  -  -  -  -  .  .  .  .  eb1 . e1 . '],
        lead: ['a5 -  -  -  -  -  -  -  -  -  -  -  -  -  -  . ',
               'bb5 - -  -  -  -  -  -  -  -  -  -  -  -  -  . ',
               'c6 -  -  -  -  -  -  -  b5 -  -  -  -  -  -  . ',
               'a5 -  -  -  -  -  -  -  -  -  -  -  .  .  .  . '],
        drum: ['kc .  .  .  .  .  .  .  s  .  .  .  .  .  .  . ',
               'k  .  .  .  .  .  .  .  s  .  .  .  .  .  .  . ',
               'kc .  .  .  .  .  .  .  s  .  .  .  .  .  .  . ',
               'k  .  .  .  .  .  .  .  s  .  .  .  t  t  T  T '],
      },
      solo: {
        from: 'riff',
        lead: ['d6 -  e6 -  f6 -  e6 -  d6 -  c6 -  bb5 - a5 - ',
               'g5 -  a5 -  bb5 - c6 -  d6 -  c6 -  a5 -  g5 - ',
               'f6 -  e6 -  d6 -  c6 -  bb5 - a5 -  g5 -  f5 - ',
               'e6 -  d6 -  c6 -  bb5 - a5 -  -  -  d6 -  -  - '],
      },
      riff3: {                                   // риф едет вверх по хроматике
        from: 'riff',
        gtr: ['d2 d2 d2 .  d2 d2 d2 .  eb2 eb2 eb2 .  e2 e2 e2 . ',
              'f2 f2 f2 .  f2 f2 f2 .  e2 e2 e2 .  eb2 .  d2 . ',
              'g2 g2 g2 .  g2 g2 g2 .  ab2 .  a2 .  bb2 .  c3 . ',
              'd3 -  -  .  c3 -  -  .  bb2 -  -  .  a2 .  ab2 g2'],
        bass: ['d1 d1 d1 .  d1 d1 d1 .  eb1 eb1 eb1 .  e1 e1 e1 . ',
               'f1 f1 f1 .  f1 f1 f1 .  e1 e1 e1 .  eb1 .  d1 . ',
               'g1 g1 g1 .  g1 g1 g1 .  ab1 .  a1 .  bb1 .  c2 . ',
               'd2 .  d1 .  c2 .  c1 .  bb1 .  bb2 .  a1 .  ab1 g1'],
        lead: [R,
               '.  .  .  .  .  .  .  .  a5 -  ab5 -  g5 -  f5 - ',
               'd5 -  f5 -  g5 -  ab5 -  a5 -  c6 -  d6 -  -  - ',
               'f6 -  e6 -  d6 -  c6 -  bb5 -  a5 -  ab5 -  g5 - '],
      },
      chorus2: {                                 // припев с другой вершиной
        from: 'chorus',
        lead: ['f6 -  -  -  e6 -  d6 -  c6 -  a5 -  d6 -  -  - ',
               'd6 -  -  -  c6 -  bb5 -  a5 -  f5 -  bb5 -  -  - ',
               'e6 -  -  -  d6 -  c6 -  bb5 -  g5 -  c6 -  -  - ',
               'd6 -  e6 -  f6 -  e6 -  d6 -  c6 -  a5 -  d6 - '],
      },
      solo2: {                                   // соло на второй круг: сплошной бег
        from: 'riff',
        lead: ['d6 e6 f6 e6 d6 c6 bb5 a5 g5 a5 bb5 c6 d6 -  -  - ',
               'a5 bb5 c6 d6 e6 f6 e6 d6 c6 bb5 a5 g5 f5 -  d5 - ',
               'f5 g5 ab5 a5 bb5 c6 d6 eb6 e6 -  d6 -  c6 -  a5 - ',
               'd6 -  c6 -  bb5 -  a5 -  ab5 -  g5 -  f5 -  d5 - '],
      },
      stomp: {                                   // галоп обрывается: полутемп в пол-скорости
        gtr: ['d2 -  -  -  -  -  -  -  d2 -  -  .  d2 .  .  . ',
              'bb2 -  -  -  -  -  -  -  bb2 -  -  .  bb2 .  .  . ',
              'ab2 -  -  -  -  -  -  -  ab2 -  -  .  ab2 .  .  . ',
              'a2 -  -  -  -  -  -  -  a2 .  a2 .  a2 a2 a2 a2'],
        bass: ['d1 -  -  -  -  -  -  -  d1 -  -  .  d1 .  .  . ',
               'bb1 -  -  -  -  -  -  -  bb1 -  -  .  bb1 .  .  . ',
               'ab1 -  -  -  -  -  -  -  ab1 -  -  .  ab1 .  .  . ',
               'a1 -  -  -  -  -  -  -  a1 .  a1 .  a1 a1 a1 a1'],
        lead: ['d5 -  -  -  -  -  -  -  -  -  -  -  -  -  .  . ',
               'f5 -  -  -  -  -  -  -  -  -  -  -  -  -  .  . ',
               'ab5 -  -  -  -  -  -  -  -  -  -  -  -  -  .  . ',
               'a5 -  -  -  -  -  -  -  c6 -  -  -  d6 -  -  - '],
        drum: ['kc .  .  .  .  .  .  .  s  .  .  .  .  .  .  . ',
               'k  .  .  .  .  .  .  .  s  .  .  .  .  .  .  . ',
               'kc .  .  .  .  .  .  .  s  .  .  .  .  .  .  H ',
               'k  .  .  .  .  .  .  k  s  .  .  .  t  t  T  T '],
      },
    },
  },
};
const MUS_CH = ['gtr', 'bass', 'lead'];
const ALL_CH = [...MUS_CH, 'drum'];
// Разворачиваем форму в сплошные дорожки один раз: секции по order, пустые
// каналы добиваются паузами, чтобы все дорожки шли шаг в шаг.
for (const key in TRACKS) {
  const tr = TRACKS[key];
  const rows = {};
  for (const ch of ALL_CH) rows[ch] = [];
  const feel = [];
  for (const name of tr.order) {
    const sec = tr.sections[name], base = sec.from ? tr.sections[sec.from] : null;
    const chan = ch => sec[ch] || (base && base[ch]) || null;
    let bars = 0;
    for (const ch of ALL_CH) { const a = chan(ch); if (a) bars = Math.max(bars, a.length); }
    for (const ch of ALL_CH) {
      const a = chan(ch), bs = base && base[ch];
      for (let b = 0; b < bars; b++) {
        let bar = a && a[b];
        if (bar === '=') bar = bs && bs[b];       // такт как у родителя
        rows[ch].push(bar || R);
      }
    }
    for (let b = 0; b < bars; b++) feel.push(sec.feel || '');
  }
  for (const ch of ALL_CH) tr[ch] = { vol: tr.vol[ch], steps: rows[ch].join(' ').trim().split(/\s+/) };
  tr.feel = feel;
  tr.stepDur = 60 / tr.bpm / 4;
}

const mus = { name: null, def: null, step: 0, next: 0, pending: null, fadeAt: 0 };

// рок-установка: бочка с телом, малый с «треском», тарелки и томы
function drumHit(kind, t, v) {
  if (kind === 'k') {
    blip({ t0: t, wave: 'sine', f: 155, f2: 42, gl: 0.35, dur: 0.26, vol: 0.62 * v, a: 0.002, bus: musBus });
    blip({ t0: t, wave: 'triangle', f: 320, f2: 70, gl: 0.12, dur: 0.055, vol: 0.22 * v, bus: musBus });
    noise({ t0: t, kind: 'white', filter: 'highpass', f: 3200, dur: 0.018, vol: 0.16 * v, bus: musBus });
  } else if (kind === 's') {
    noise({ t0: t, kind: 'white', filter: 'bandpass', f: 1700, q: 0.7, dur: 0.17, vol: 0.4 * v, bus: musBus });
    noise({ t0: t, kind: 'white', filter: 'highpass', f: 4200, dur: 0.055, vol: 0.2 * v, bus: musBus });
    blip({ t0: t, wave: 'triangle', f: 255, f2: 170, dur: 0.1, vol: 0.18 * v, bus: musBus });
    blip({ t0: t, wave: 'triangle', f: 180, f2: 125, dur: 0.13, vol: 0.12 * v, bus: musBus });
  } else if (kind === 'h') {
    noise({ t0: t, kind: 'metal', filter: 'highpass', f: 7800, dur: 0.035, vol: 0.12 * v, bus: musBus });
  } else if (kind === 'H') {
    noise({ t0: t, kind: 'metal', filter: 'highpass', f: 6800, dur: 0.2, vol: 0.13 * v, bus: musBus });
  } else if (kind === 'c') {
    noise({ t0: t, kind: 'metal', filter: 'highpass', f: 4200, dur: 1.3, vol: 0.19 * v, bus: musBus });
    noise({ t0: t, kind: 'white', filter: 'highpass', f: 8200, dur: 0.85, vol: 0.08 * v, bus: musBus });
  } else if (kind === 'x') {                      // кросс-стик: сухой деревянный щелчок
    blip({ t0: t, wave: 'triangle', f: 950, f2: 520, dur: 0.035, vol: 0.3 * v, bus: musBus });
    noise({ t0: t, kind: 'white', filter: 'bandpass', f: 2600, q: 2.2, dur: 0.03, vol: 0.13 * v, bus: musBus });
  } else if (kind === 'r') {
    noise({ t0: t, kind: 'metal', filter: 'bandpass', f: 5200, q: 2.5, dur: 0.3, vol: 0.11 * v, bus: musBus });
  } else if (kind === 't' || kind === 'T') {
    const f = kind === 't' ? 150 : 235;
    blip({ t0: t, wave: 'sine', f, f2: f * 0.6, gl: 0.7, dur: 0.28, vol: 0.4 * v, bus: musBus });
    noise({ t0: t, kind: 'white', filter: 'bandpass', f: f * 3, q: 1.2, dur: 0.09, vol: 0.11 * v, bus: musBus });
  }
}

function musicStep(t, i) {
  const tr = mus.def;
  const clean = tr.feel[((i / 16) | 0) % tr.feel.length] === 'clean';
  for (const name of MUS_CH) {
    const c = tr[name];
    if (!c) continue;
    const tok = c.steps[i % c.steps.length];
    if (!tok || tok === '.' || tok === '-') continue;
    let len = 1;
    while (len < 32 && c.steps[(i + len) % c.steps.length] === '-') len++;
    const dur = len * tr.stepDur, f = nf(tok);
    if (name === 'gtr')
      clean                                      // чистый звук: без квинты, нота звенит дольше сетки
        ? gtrNote({ t0: t, f, dur: Math.max(dur, tr.stepDur * 4) * 0.98, vol: c.vol * 0.8, amp: cleanAmp })
        : gtrNote({ t0: t, f, dur: dur * (len === 1 ? 0.85 : 0.97), vol: c.vol, chord: true, mute: len === 1, amp: gtrAmp });
    else if (name === 'bass')
      bassNote({ t0: t, f, dur: dur * (len === 1 ? 0.9 : 0.96), vol: c.vol });
    else
      leadNote({ t0: t, f, dur: dur * 0.98, vol: c.vol * (clean ? 0.8 : 1), vib: len > 2 });
  }
  const d = tr.drum;
  if (d) {
    const tok = d.steps[i % d.steps.length];
    if (tok && tok !== '.' && tok !== '-')
      for (const ch of tok) drumHit(ch, t, d.vol);
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
  if (ctx && musEcho && mus.def)                 // эхо в такт: пунктирная восьмая
    musEcho.delay.delayTime.setTargetAtTime(mus.def.stepDur * 3, ctx.currentTime, 0.05);
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
