// Headless-запуск движка ORBITAR в node: vm-контекст с заглушками DOM и канваса.
// Кадр — вызов пойманного колбэка requestAnimationFrame; состояние читается
// через window.__dbg(), ввод — через слушателей keydown/keyup.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['js/audio.js', 'js/save.js', 'js/assets.js', 'js/level.js', 'js/level2.js',
               'js/level3.js', 'js/level4.js', 'js/level5.js', 'js/game.js'];

// детерминированный Math.random на инстанс — иначе два движка в одном процессе
// делят один генератор и расходятся на анимационных фазах
function seededMath(seed) {
  if (!seed) return Math;
  const m = Object.create(Math);
  let s = seed >>> 0;
  m.random = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  return m;
}

function noopCtx(canvas) {
  const base = { canvas, imageSmoothingEnabled: false, fillStyle: '#000', globalAlpha: 1 };
  return new Proxy(base, {
    get(t, k) {
      if (k in t) return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

function makeEl(tag) {
  const el = { tagName: tag, width: 0, height: 0, style: {} };
  el.getContext = () => (el._ctx || (el._ctx = noopCtx(el)));
  el.addEventListener = () => {};
  return el;
}

function boot(hash = '', seed = 0) {
  const listeners = { keydown: [], keyup: [] };
  let rafCb = null;
  const els = { game: makeEl('canvas'), scan: makeEl('div'), help: makeEl('div') };
  const win = {
    innerWidth: 1280, innerHeight: 800,
    addEventListener: (t, f) => { (listeners[t] || (listeners[t] = [])).push(f); },
    requestAnimationFrame: cb => { rafCb = cb; return 1; },
    performance: { now: () => nowMs },
    location: { hash },
    localStorage: (() => {                     // на инстанс — своё хранилище
      const store = {};
      return { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); },
               removeItem: k => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } };
    })(),
    Math: seededMath(seed), JSON, console,
  };
  win.window = win;
  win.document = {
    getElementById: id => els[id] || makeEl('div'),
    createElement: makeEl,
    addEventListener: (t, f) => { (listeners[t] || (listeners[t] = [])).push(f); },
    hidden: false,
  };
  let nowMs = 0;
  win.performance = { now: () => nowMs };
  win.requestAnimationFrame = win.requestAnimationFrame;
  const ctx = vm.createContext(win);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });

  const api = {
    win,
    dbg: () => win.__dbg(),
    // чтение того, что объявлено в контексте вне IIFE движка (карты уровней)
    eval: expr => vm.runInContext(expr, ctx),
    key(code, down) {
      const e = { code, repeat: false, preventDefault() {} };
      for (const f of listeners[down ? 'keydown' : 'keyup']) f(e);
    },
    type(str) { for (const ch of str) { const c = /\d/.test(ch) ? 'Digit' + ch : 'Key' + ch; api.key(c, true); api.key(c, false); } },
    hold: {},
    setKeys(keys) {
      const want = new Set(keys);
      for (const k of Object.keys(api.hold)) if (!want.has(k)) { api.key(k, false); delete api.hold[k]; }
      for (const k of want) if (!api.hold[k]) { api.key(k, true); api.hold[k] = true; }
    },
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        nowMs += 1000 / 60;
        const cb = rafCb; rafCb = null;
        if (cb) cb(nowMs);
      }
    },
  };
  // первый кадр уже запрошен из game.js
  api.step(1);
  return api;
}

module.exports = { boot };
