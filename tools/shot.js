// Скриншот кадра движка: node tools/shot.js <уровень> <тайл-x> <тайл-y> <файл> [кадров] [клавиши]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { makeCanvas, png, zoom } = require('./pixcanvas');

const ROOT = path.join(__dirname, '..');
const FILES = ['js/audio.js', 'js/assets.js', 'js/level.js', 'js/level2.js',
               'js/level3.js', 'js/level4.js', 'js/level5.js', 'js/game.js'];

function boot(hash) {
  const listeners = {};
  let rafCb = null, nowMs = 0;
  const game = makeCanvas(320, 224);
  game.style = {};
  const els = { game, scan: { style: {} }, help: { style: {} } };
  let s = 20260912;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const M = Object.create(Math); M.random = rnd;
  const win = {
    innerWidth: 1280, innerHeight: 800, Math: M, JSON, console,
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    requestAnimationFrame: cb => { rafCb = cb; return 1; },
    location: { hash },
    localStorage: { getItem: () => null, setItem: () => {} },
  };
  win.window = win;
  win.performance = { now: () => nowMs };
  win.document = {
    getElementById: id => els[id] || { style: {} },
    createElement: () => {
      const c = makeCanvas(1, 1);
      return new Proxy(c, {
        set(t, k, v) {
          t[k] = v;
          if ((k === 'width' || k === 'height') && t.width && t.height && (t._w !== t.width || t._h !== t.height)) {
            const n = makeCanvas(t.width, t.height);
            t._px = n._px; t._w = n._w; t._h = n._h; t.getContext = n.getContext;
          }
          return true;
        },
      });
    },
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
  };
  const ctx = vm.createContext(win);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return {
    win, game,
    key(code, down) { for (const f of (listeners[down ? 'keydown' : 'keyup'] || [])) f({ code, repeat: false, preventDefault() {} }); },
    step(n = 1) { for (let i = 0; i < n; i++) { nowMs += 1000 / 60; const cb = rafCb; rafCb = null; if (cb) cb(nowMs); } },
  };
}

module.exports = { boot };

// ---------- CLI ----------
if (require.main === module) {
  const [, , lvArg, txArg, tyArg, out, framesArg, keysArg, gdirArg] = process.argv;
  const g = boot('#lv=' + (lvArg || 1) + (txArg ? '&x=' + txArg + '&y=' + tyArg : ''));
  g.step(1);
  if (gdirArg) {                      // поставить игрока с заданным направлением тяги
    const gd = +gdirArg, tx = +txArg, ty = +tyArg;
    g.win.__place(tx * 16 + 3, gd > 0 ? ty * 16 - 20 : (ty + 1) * 16, gd);
    g.step(1);
  }
  const keys = (keysArg || '').split(',').filter(Boolean);
  for (const k of keys) g.key(k, true);
  g.step(+(framesArg || 2));
  fs.writeFileSync(out || 'shot.png', png(zoom(g.game, 3)));
  console.log('записан', out, 'кадров', framesArg || 2);
}
