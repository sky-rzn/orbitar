// ============================================================
//  ORBITAR — игровой движок (четыре уровня)
// ============================================================
'use strict';
(() => {
const W = 320, H = 224, T = TILE, EPS = 0.001;
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const A = buildAssets();
const LEVELS = [LEVEL1, LEVEL2, LEVEL3, LEVEL4];

// ---------- масштабирование под окно (целочисленное) ----------
function fit() {
  const s = Math.max(1, Math.floor(Math.min(window.innerWidth / W, (window.innerHeight - 48) / H)));
  canvas.style.width = W * s + 'px'; canvas.style.height = H * s + 'px';
}
window.addEventListener('resize', fit); fit();

// ---------- ввод ----------
const keys = {}, pressed = {};
window.addEventListener('keydown', e => {
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
// чит-коды: LVL1..LVL4 — в начало уровня, BOSS1..BOSS4 — к его боссу, NEXT — сразу на следующий уровень
const CHEATS = {
  LVL1: { lv: 0 }, LVL2: { lv: 1 }, LVL3: { lv: 2 }, LVL4: { lv: 3 },
  BOSS1: { lv: 0, boss: true }, BOSS2: { lv: 1, boss: true },
  BOSS3: { lv: 2, boss: true }, BOSS4: { lv: 3, boss: true },
  NEXT: { next: true },
};
const CHEAT_CODES = Object.keys(CHEATS);
const CHEAT_LEN = Math.max(...CHEAT_CODES.map(c => c.length));
let cheatBuf = '', cheatMsg = 0, cheatText = '', cheatQueued = null;
let toastText = '', toastT = 0, lastPhase = -1;             // короткие уведомления (звук/музыка)
const toast = t => { toastText = t; toastT = 100; };
window.addEventListener('keydown', e => {
  const m = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(e.code);
  if (!m || e.repeat) return;
  cheatBuf = (cheatBuf + (m[1] || m[2])).slice(-CHEAT_LEN);
  const code = CHEAT_CODES.find(c => cheatBuf.endsWith(c));
  if (code) { cheatQueued = CHEATS[code]; cheatText = code; cheatBuf = ''; }
});
const inp = {
  left: () => keys.ArrowLeft || keys.KeyA,
  right: () => keys.ArrowRight || keys.KeyD,
  jump: () => keys.KeyZ || keys.Space || keys.ArrowUp || keys.KeyW,
  jumpPressed: () => pressed.KeyZ || pressed.Space || pressed.ArrowUp || pressed.KeyW,
};

// ---------- битмап-шрифт 3x5 ----------
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001011001111',
  4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111',
  9: '111101111001111', ':': '000010000010000', '-': '000000111000000', '.': '000000000000010', '/': '001001010100100',
  '!': '010010010000010', ' ': '000000000000000',
};
function text(str, x, y, col, scale = 1) {
  ctx.fillStyle = col;
  for (let i = 0; i < str.length; i++) {
    const g = FONT[str[i].toUpperCase()] || FONT[' '];
    for (let k = 0; k < 15; k++) if (g[k] === '1')
      ctx.fillRect(x + (i * 4 + (k % 3)) * scale, y + Math.floor(k / 3) * scale, scale, scale);
  }
}
function textShadow(str, x, y, col, scale = 1) { text(str, x + scale, y + scale, '#0b0b1a', scale); text(str, x, y, col, scale); }
const mid = (str, scale = 1) => Math.round(W / 2 - str.length * 4 * scale / 2);

// ---------- текущий уровень ----------
let LV, MAP, LW, LH, LEVEL_W, LEVEL_H, VERT, TL, TH, levelCanvas, ents, checkpoints, crumbleMask, levelIdx;

function ch(x, y) { if (x < 0 || x >= LW) return '#'; if (y < 0 || y >= LH) return '.'; return MAP[y][x]; }
// грунт, платформы, решётки вентиляторов, ленты, наледь, цепкие стены и раструбы
// держат всегда; осыпающаяся плита — пока цела, фазовая — пока её группа не погасла
const STATIC = '#PU<>INGg';            // тайлы, которые держат всегда
function isSolid(x, y) {
  const c = ch(x, y);
  if (STATIC.includes(c)) return true;
  if (c === 'X') return crumbleMask[y * LW + x] === 1;
  if (c === '=') return phaseStage(0) !== 2;
  if (c === '+') return phaseStage(1) !== 2;
  return false;
}
const isStatic = (x, y) => STATIC.includes(ch(x, y));
const isOneWay = (x, y) => ch(x, y) === '-';

const PHYS = { accel: 0.22, maxSpeed: 1.7, friction: 0.28, airAccel: 0.16, gravity: 0.24, maxFall: 5.2, jump: -5.3, jumpCut: -1.8, spring: -7.6, coyote: 6, buffer: 6,
               iceAccel: 0.075, iceFriction: 0.014,          // наледь: разгон вязкий, торможения почти нет
               wallSlide: 0.95, wallJump: -5.0, wallKick: 2.3, wallLock: 9 };
const CRUMBLE = { hold: 42, gone: 150 };     // кадров под ногами / до восстановления
const SEEK_CALM = 60;                        // после возрождения искатель секунду висит дома
const GATE = { period: 170, warn: 90, on: 110 }; // цикл затвора: выкл → предупреждение → луч
// Фазовые плиты: группы гаснут по очереди, между ними есть окно `both`,
// когда тверды обе — в него и надо успеть перескочить.
const PHASE = { period: 260, solo: 90, both: 40 };
const PRESS = { wait: 74, warn: 26, hold: 24, accel: 0.85, maxFall: 8.5, rise: 0.62 };
const BELT = 0.62;                           // тяга конвейерной ленты, px/кадр
const GUST = { period: 240, warn: 140, on: 170, push: 0.55 };  // цикл раструба: покой → предупреждение → пурга
const ICICLE = { warn: 32, grav: 0.34, maxFall: 7.5, back: 210, reach: 12 };
const FLOOD = { rise: 0.1, drain: 2 * T };  // криовзвесь на арене: прибывает всегда, уходит от попаданий

// 0 — тверда, 1 — предупреждение (ещё тверда), 2 — призрак
function phaseStage(group) {
  const t = frame % PHASE.period;
  if (!group) return t < PHASE.solo ? 0 : t < PHASE.solo + PHASE.both ? 1
    : t < PHASE.period - PHASE.both ? 2 : 0;
  return t < PHASE.solo ? 2 : t < PHASE.period - PHASE.both ? 0 : 1;
}

let ARENA, boss, shots, waves, totalCells, cellsBank = 0, runTime = 0;

// ---------- звук ----------
const TRACKS = ['foundry', 'reactor', 'citadel', 'glacial'];
// панорама по положению источника относительно центра экрана
const panOf = x => Math.max(-1, Math.min(1, (x - cam.x - W / 2) / (W / 2)));
const snd = (name, x, o) => SFX.play(name, x == null ? o : Object.assign({ pan: panOf(x) }, o));
const curTrack = () => (boss && boss.state !== 'idle' && boss.state !== 'dead' ? 'boss' : TRACKS[levelIdx]);

// ---------- разбор уровня ----------
function loadLevel(idx) {
  levelIdx = idx;
  LV = LEVELS[idx];
  MAP = LV.map; LW = MAP[0].length; LH = MAP.length; LEVEL_W = LW * T; LEVEL_H = LH * T;
  VERT = !!LV.vertical;
  TH = A.themes[LV.theme]; TL = TH.tiles;
  crumbleMask = new Int8Array(LW * LH);
  ents = { cells: [], drones: [], crawlers: [], turrets: [], movers: [], springs: [], anim: [],
           crumbles: [], vents: [], gates: [], melt: [], phases: [], belts: [], presses: [],
           rifts: [], saws: [], leapers: [], seekers: [], cryos: [], icicles: [], gusts: [],
           drifters: [], skaters: [], howlers: [], portal: null, spawn: { x: 16, y: 100 } };
  checkpoints = [];

  levelCanvas = makeCanvas(LEVEL_W, LEVEL_H);
  const lc = levelCanvas.getContext('2d');
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    const c = MAP[y][x], px = x * T, py = y * T;
    switch (c) {
      case '#': {
        let img;
        if (!isStatic(x, y - 1)) img = TL.groundTop;
        else if (!isStatic(x - 1, y)) img = TL.groundLeft;
        else if (!isStatic(x + 1, y)) img = TL.groundRight;
        else img = ((x * 7 + y * 13) % 5 === 0) ? TL.groundFillVar : TL.groundFill;
        lc.drawImage(img, px, py); break;
      }
      case 'P': {
        const l = ch(x - 1, y) === 'P', r = ch(x + 1, y) === 'P';
        lc.drawImage(l && r ? TL.platM : l ? TL.platR : r ? TL.platL : TL.platS, px, py); break;
      }
      case '-': lc.drawImage(TL.oneWay, px, py); break;
      case '|': lc.drawImage(TL.pipeV, px, py); break;
      case '~': lc.drawImage(TL.pipeH, px, py); break;
      case 'a': lc.drawImage(TL.meltBody, px, py); ents.melt.push({ x: px, y: py, top: false }); break;
      case 'A': ents.melt.push({ x: px, y: py, top: true }); break;
      case '^': ents.anim.push({ kind: 'spikes', x: px, y: py }); break;
      case 'c': ents.anim.push({ kind: 'crystal', x: px, y: py }); break;
      case 'l': ents.anim.push({ kind: 'wallLight', x: px, y: py }); break;
      case 'n': ents.anim.push({ kind: 'console', x: px, y: py }); break;
      case 'S': ents.springs.push({ x: px, y: py, timer: 0 }); break;
      case '*': ents.cells.push({ x: px + 4, y: py + 3, w: 8, h: 10, taken: false, t: Math.random() * 60 }); break;
      case 'E': ents.portal = { x: px, y: py - T }; break;
      case '@': ents.spawn = { x: px + 3, y: py + T - 20 }; break;
      case 'X': {
        crumbleMask[y * LW + x] = 1;
        ents.crumbles.push({ tx: x, ty: y, x: px, y: py, st: 0, t: 0 }); break;
      }
      case 'U': {                                  // столб восходящего потока над решёткой
        let h = 0;
        for (let yy = y - 1; yy >= 0 && !isStatic(x, yy) && h < 8; yy--) h++;
        ents.vents.push({ x: px, y: (y - h) * T, h: h * T, tileY: py }); break;
      }
      case 'B': {                                  // лазерный затвор: луч от излучателя вниз
        let yy = y + 1;
        while (yy < LH && !isStatic(x, yy)) yy++;
        ents.gates.push({ x: px, y: py, beamY: (y + 1) * T, beamH: (yy - y - 1) * T, st: -1,
                          phase: (x * 53) % GATE.period }); break;
      }
      case 'D': {
        let minX = x, maxX = x;
        while (minX > 0 && !isStatic(minX - 1, y) && x - minX < 3) minX--;
        while (maxX < LW - 1 && !isStatic(maxX + 1, y) && maxX - x < 3) maxX++;
        ents.drones.push({ x: px, y: py, minX: minX * T, maxX: maxX * T, dir: 1, alive: true, t: Math.random() * 100 });
        break;
      }
      case 'w': ents.crawlers.push({ x: px, y: py + 4, dir: -1, alive: true, t: Math.random() * 60, home: true }); break;
      case 't': ents.turrets.push({ x: px, y: py, dir: -1, alive: true, t: Math.random() * 100 | 0 }); break;
      case 'H': ents.movers.push({ x: px, y: py, w: 32, h: 8, axis: 'x', from: px, to: px + 3 * T, t: 0, speed: 0.012, dx: 0, dy: 0 }); break;
      case 'V': ents.movers.push({ x: px, y: py, w: 32, h: 8, axis: 'y', from: py + T, to: py - 3 * T, t: 0, speed: 0.009, dx: 0, dy: 0 }); break;
      case '=': case '+': ents.phases.push({ x: px, y: py, group: c === '+' ? 1 : 0 }); break;
      case '<': case '>': ents.belts.push({ x: px, y: py, dir: c === '>' ? 1 : -1 }); break;
      case 'O': ents.rifts.push({ x: px, y: py, top: true }); break;
      case 'o': ents.rifts.push({ x: px, y: py, top: false }); break;
      case 'J': {                                  // пресс: ход от перекрытия до первого пола
        let yy = y + 1;
        while (yy < LH && !isStatic(x, yy)) yy++;
        const wait = PRESS.wait + (x * 29) % 52;   // соседние прессы бьют вразнобой
        ents.presses.push({ x: px, y: py, y0: py, y1: (yy - 1) * T, vy: 0, st: 0, wait, t: wait }); break;
      }
      case 'Q': {                                  // пила: катается по своей рельсе над полом
        let minX = x, maxX = x;
        while (minX > 0 && !isStatic(minX - 1, y) && isStatic(minX - 1, y + 1) && x - minX < 5) minX--;
        while (maxX < LW - 1 && !isStatic(maxX + 1, y) && isStatic(maxX + 1, y + 1) && maxX - x < 5) maxX++;
        ents.saws.push({ x: px, y: py, minX: minX * T, maxX: maxX * T, dir: 1 }); break;
      }
      case 'j': ents.leapers.push({ x: px, y: py + 2, hx: px, hy: py + 2, vx: 0, vy: 0, dir: -1,
                                    st: 0, t: 50 + (x * 17) % 60, alive: true, home: true }); break;
      case 'k': ents.seekers.push({ x: px + 2, y: py + 2, hx: px + 2, hy: py + 2, vx: 0, vy: 0,
                                    alive: true, t: (x * 23) % 60, calm: 0, home: true }); break;
      case 'I': lc.drawImage(TL.ice, px, py); break;
      case 'N': {                                  // цепкая стена: иней рисуем на открытой грани
        const l = !isStatic(x - 1, y), r = !isStatic(x + 1, y);
        lc.drawImage(TL.grip[l && r ? 'b' : l ? 'l' : 'r'], px, py); break;
      }
      case 'Y': {                                  // сталактит: считаем, докуда ему падать
        let yy = y + 1;
        while (yy < LH && !isStatic(x, yy)) yy++;
        ents.icicles.push({ x: px, y: py, y0: py, hitY: yy * T, vy: 0, st: 0, t: 0 }); break;
      }
      case 'G': case 'g': {                        // раструб пурги: полоса до первой стены
        const dir = c === 'G' ? 1 : -1;
        let n = 0, xx = x + dir;
        while (xx >= 0 && xx < LW && !isStatic(xx, y) && n < 16) { xx += dir; n++; }
        const up = !isStatic(x, y - 1) && n && !isStatic(x + dir, y - 1) ? 1 : 0;
        ents.gusts.push({ x: px, y: py, dir, tx: dir > 0 ? px + T : px - n * T, w: n * T,
                          top: py - up * T, h: (up + 1) * T, st: -1, phase: (y * 43) % GUST.period });
        break;
      }
      case 'Z': ents.cryos.push({ x: px, y: py, top: true }); break;
      case 'z': ents.cryos.push({ x: px, y: py, top: false }); break;
      case 'y': {                                  // дрейфер ходит по вертикали
        let minY = y, maxY = y;
        while (minY > 0 && !isStatic(x, minY - 1) && y - minY < 4) minY--;
        while (maxY < LH - 1 && !isStatic(x, maxY + 1) && maxY - y < 4) maxY++;
        ents.drifters.push({ x: px + 2, y: py + 2, hy: py + 2, minY: minY * T + 2, maxY: maxY * T + 2,
                             dir: 1, alive: true, t: Math.random() * 100 }); break;
      }
      case 's': ents.skaters.push({ x: px, y: py + 5, hx: px, dir: -1, alive: true,
                                    t: Math.random() * 60 | 0, home: true }); break;
      case 'h': ents.howlers.push({ x: px, y: py, t: 0 }); break;
    }
  }
  for (const def of LV.checkpoints) {
    if (Array.isArray(def)) {                     // вертикальный уровень: [колонка, строка пола]
      checkpoints.push({ x: def[0] * T + 3, y: def[1] * T - 20, col: def[0], row: def[1] });
      continue;
    }
    let c = def, row = LH;
    for (let d = 0; d < 8 && row === LH; d++) {   // колонка без пола: ищем ближайшую с твёрдой землёй
      for (const cc of [def - d, def + d]) {
        if (cc < 0 || cc >= LW) continue;         // ch() за краем карты врёт «#»
        row = 0; while (row < LH && ch(cc, row) !== '#') row++;
        if (row < LH) { c = cc; break; }
      }
    }
    checkpoints.push({ x: c * T + 3, y: row * T - 20, col: c, row });
  }
  totalCells = ents.cells.length;
  // Арена вертикального уровня — шахта в самом низу: барьер не сбоку, а над головой,
  // а пол ей заменяет криовзвесь, которую босс гонит вверх.
  ARENA = LV.arena
    ? { vert: true, left: 0, top: LV.arena.top * T, trigger: LV.arena.trigger * T,
        floorY: LV.arena.floor * T, xMin: LV.arena.x0 * T,
        xMax: LV.arena.x1 * T - BOSS_BOX[LV.boss].w }
    : { left: (LW - 20) * T, trigger: (LW - 18) * T, floorY: 11 * T,
        xMin: (LW - 20) * T + 10, xMax: (LW - 6) * T - BOSS_BOX[LV.boss].w };
  boss = null;
}

// ---------- боссы ----------
const BOSS_BOX = {
  warden:   { w: 32, h: 24, box: [2, 4, 28, 14], core: [2, 4, 28, 8],
              shield: ['wake', 'hover', 'aim', 'slam'], weak: 'stun' },
  rootmind: { w: 40, h: 34, box: [3, 7, 34, 27], core: [6, 0, 28, 16],
              shield: ['wake', 'stalk', 'tell', 'dash', 'close'], weak: 'open' },
  // Корона-разлом: топтать нечего — обод смертелен всегда, урон идёт только отбитым
  // осколком. Рамка вписана в круглый обод, чтобы не убивать в пустых углах спрайта.
  sovereign: { w: 44, h: 40, box: [7, 3, 30, 28], ring: true,
               shield: ['wake', 'reign', 'throne', 'tether', 'curtain', 'recoil'] },
  // Ледяной колосс стоит в криовзвеси по пояс: броня смертельна всегда, кроме
  // мгновений, когда он, выдохшись после столба, раскрывает корону на макушке.
  hoarfrost: { w: 48, h: 36, box: [5, 12, 38, 24], core: [6, 0, 36, 14],
               shield: ['wake', 'swim', 'aim', 'erupt', 'recoil'], weak: 'spent' },
};
const bossDef = () => BOSS_BOX[boss.kind];
const bossActive = () => boss.state !== 'idle' && boss.state !== 'dead';
const bossRage = () => LV.bossHp - boss.hp;
function bossRect(key) {
  const [ox, oy, w, h] = bossDef()[key];
  return { x: boss.x + ox, y: boss.y + oy, w, h };
}
const bossBox = () => bossRect('box');
function resetBoss() {
  const kind = LV.boss, d = BOSS_BOX[kind];
  boss = { kind, state: 'idle', hp: LV.bossHp, t: 0, timer: 0, boltT: 0, flash: 0, vy: 0, dir: -1,
           orb: null, anchorX: 0, sweep: 0, jetX: 0, flood: ARENA.floorY,
           x: ARENA.vert ? Math.round((ARENA.xMin + ARENA.xMax) / 2) : (LW - 10) * T + 8,
           y: ARENA.floorY - d.h + (ARENA.vert ? 14 : 0) };
  shots = []; waves = [];
}

function reset(full) {
  if (!boss) resetBoss();
  if (full) {
    for (const c of ents.cells) c.taken = false;
    for (const d of ents.drones) d.alive = true;
    ents.turrets.forEach(t => { t.alive = true; });
    cp = 0; elapsed = 0; intro = 180;
  }
  const sp = full ? ents.spawn : checkpoints[cp];
  ents.turrets.forEach(t => { t.t = 0; });       // после возрождения турель даёт полный телеграф
  ents.crawlers = ents.crawlers.filter(c => c.home);
  for (const c of ents.crawlers) { c.alive = true; c.dir = -1; }
  ents.leapers = ents.leapers.filter(l => l.home);
  for (const l of ents.leapers) {
    l.alive = true; l.st = 0; l.t = 50; l.vx = 0; l.vy = 0; l.x = l.hx; l.y = l.hy;
  }
  ents.seekers = ents.seekers.filter(k => k.home);
  for (const k of ents.seekers) {               // искатель возвращается домой и даёт осмотреться
    k.alive = true; k.vx = 0; k.vy = 0; k.x = k.hx; k.y = k.hy; k.calm = SEEK_CALM;
  }
  for (const p of ents.presses) { p.st = 0; p.t = p.wait; p.y = p.y0; p.vy = 0; }
  for (const q of ents.saws) {                   // пила неуязвима — даём на реакцию всю рельсу
    const far = Math.abs(q.minX - sp.x) >= Math.abs(q.maxX - sp.x) ? q.minX : q.maxX;
    q.x = far; q.dir = far === q.minX ? 1 : -1;
  }
  for (const c of ents.crumbles) { c.st = 0; c.t = 0; crumbleMask[c.ty * LW + c.tx] = 1; }
  for (const i of ents.icicles) { i.st = 0; i.t = 0; i.y = i.y0; i.vy = 0; }
  for (const d of ents.drifters) { d.alive = true; d.y = d.hy; d.dir = 1; }
  ents.skaters = ents.skaters.filter(k => k.home);
  for (const k of ents.skaters) { k.alive = true; k.dir = -1; k.x = k.hx; }
  for (const h of ents.howlers) h.t = 0;
  if (full || boss.state !== 'dead') resetBoss(); // побеждённый босс не воскресает на чекпоинте
  shots = [];
  P = { x: sp.x, y: sp.y, vx: 0, vy: 0, w: 10, h: 20, face: 1, grounded: false, coyote: 0, jbuf: 0,
        animT: 0, onMover: null, squash: 0, jumping: false, lift: 0, wall: 0, lock: 0, gust: 0 };
  cam = { x: clamp(P.x - W / 2, 0, LEVEL_W - W), y: clamp(P.y - H / 2, 0, LEVEL_H - H) };
  particles = [];
  state = 'play'; deadTimer = 0; shake = 0;
  if (full) frame = 0;
  SFX.stopLoops();
  SFX.music(curTrack());
  SFX.play(full ? 'intro' : 'respawn');
}

// ---------- состояние ----------
let P, cam, particles, frame = 0, state, deadTimer, cp, intro, elapsed, shake;

function startLevel(idx) { loadLevel(idx); reset(true); }
function restartRun() { cellsBank = 0; runTime = 0; startLevel(0); }   // с финального экрана — сначала
function nextLevel() {
  SFX.play('select');
  cellsBank += ents.cells.filter(c => c.taken).length;
  runTime += elapsed;
  startLevel(levelIdx + 1);
}
function camSnap() { cam.x = clamp(P.x - W / 2, 0, LEVEL_W - W); cam.y = clamp(P.y - H / 2, 0, LEVEL_H - H); }
function cheatWarp(lv, toBoss) {
  if (lv !== levelIdx || !toBoss) {                  // прыжок на другой уровень (и любой LVL) — уровень с нуля
    if (lv === 0) { cellsBank = 0; runTime = 0; }    // с первого уровня забег начинается заново
    startLevel(lv);
  }
  if (toBoss) { cp = checkpoints.length - 1; reset(false); }
  camSnap();                                         // без плавного пролёта камеры через весь уровень
  intro = 0; cheatMsg = 150;
  SFX.play('cheat');
  spawnParticles(P.x + 5, P.y + 10, 30, ['#ff3fa8', '#22e5ff', '#e6ecff'], 2.5, 0.02, 30);
}

startLevel(0);
// отладка: #lv=2&x=25&y=10 — уровень и тайл старта (для скриншотов уровня)
{
  const lv = /lv=(\d+)/.exec(location.hash);
  if (lv && +lv[1] >= 1 && +lv[1] <= LEVELS.length) startLevel(+lv[1] - 1);
  const m = /x=(\d+)&y=(\d+)/.exec(location.hash);
  if (m) { P.x = +m[1] * T + 3; P.y = +m[2] * T + T - 20; camSnap(); intro = 0; }
}

// ---------- утилиты ----------
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function spawnParticles(x, y, n, cols, spread = 2.5, g = 0.12, life = 30) {
  for (let i = 0; i < n; i++) particles.push({
    x, y, vx: (Math.random() - 0.5) * spread * 2, vy: (Math.random() - 0.8) * spread, g,
    life: life + Math.random() * life * 0.5, col: cols[Math.floor(Math.random() * cols.length)] });
}
function die() {
  if (state !== 'play') return;
  state = 'dead'; deadTimer = 55; shake = 8;
  SFX.stopLoops(); SFX.music(null); SFX.play('die');
  spawnParticles(P.x + 5, P.y + 10, 40, ['#aab4d4', '#ff9a2e', '#22e5ff', '#e6ecff'], 3.5, 0.15, 40);
}
const onScreen = (x, y) => x > cam.x - 40 && x < cam.x + W + 40 &&
                           (y == null || (y > cam.y - 40 && y < cam.y + H + 40));
const gateStage = g => {
  const t = (frame + g.phase) % GATE.period;
  return t < GATE.warn ? 0 : t < GATE.on ? 1 : 2;
};
const gustStage = q => {
  const t = (frame + q.phase) % GUST.period;
  return t < GUST.warn ? 0 : t < GUST.on ? 1 : 2;
};

// ---------- коллизии ----------
function moveX(dx) {
  P.x += dx;
  const y1 = Math.floor(P.y / T), y2 = Math.floor((P.y + P.h - EPS) / T);
  if (dx > 0) { const tx = Math.floor((P.x + P.w - EPS) / T); for (let ty = y1; ty <= y2; ty++) if (isSolid(tx, ty)) { P.x = tx * T - P.w; P.vx = 0; return; } }
  else if (dx < 0) { const tx = Math.floor(P.x / T); for (let ty = y1; ty <= y2; ty++) if (isSolid(tx, ty)) { P.x = (tx + 1) * T; P.vx = 0; return; } }
}
function moveY(dy) {
  const prevBottom = P.y + P.h;
  P.y += dy;
  P.grounded = false; P.onMover = null;
  const x1 = Math.floor(P.x / T), x2 = Math.floor((P.x + P.w - EPS) / T);
  if (dy > 0) {
    const ty = Math.floor((P.y + P.h) / T);
    for (let tx = x1; tx <= x2; tx++) {
      if (isSolid(tx, ty) || (isOneWay(tx, ty) && prevBottom <= ty * T + 0.01)) {
        P.y = ty * T - P.h; P.vy = 0; P.grounded = true; break;
      }
    }
    // движущиеся платформы (только сверху)
    for (const m of ents.movers) {
      const bottom = P.y + P.h;
      if (P.x < m.x + m.w && P.x + P.w > m.x && prevBottom <= m.y + 0.01 + Math.max(0, m.dy) && bottom >= m.y) {
        P.y = m.y - P.h; P.vy = 0; P.grounded = true; P.onMover = m;
      }
    }
  } else if (dy < 0) {
    const ty = Math.floor(P.y / T);
    for (let tx = x1; tx <= x2; tx++) if (isSolid(tx, ty)) { P.y = (ty + 1) * T; P.vy = 0; break; }
  }
}

// ---------- обновление ----------
function updateMovers() {
  for (const m of ents.movers) {
    m.t += m.speed;
    const k = (1 - Math.cos(m.t * Math.PI)) / 2; // плавный пинг-понг
    const v = m.from + (m.to - m.from) * k;
    if (m.axis === 'x') { m.dx = v - m.x; m.dy = 0; m.x = v; }
    else { m.dy = v - m.y; m.dx = 0; m.y = v; }
  }
}

function updateCrumbles() {
  for (const c of ents.crumbles) {
    if (c.st === 1) {
      if (--c.t <= 0) {
        c.st = 2; c.t = CRUMBLE.gone; crumbleMask[c.ty * LW + c.tx] = 0;
        if (onScreen(c.x)) snd('crumbleGone', c.x);
        spawnParticles(c.x + 8, c.y + 10, 14, LV.fx.dust, 2, 0.18, 34);
      }
    } else if (c.st === 2) {
      if (--c.t <= 0 && !overlap(P, { x: c.x, y: c.y, w: T, h: T })) {
        c.st = 0; crumbleMask[c.ty * LW + c.tx] = 1;
        spawnParticles(c.x + 8, c.y + 8, 8, LV.fx.lift, 1.4, 0, 20);
      }
    }
  }
}
function updatePresses() {
  for (const p of ents.presses) {
    switch (p.st) {
      case 0: if (--p.t <= 0) { p.st = 1; p.t = PRESS.warn; if (onScreen(p.x)) snd('tell', p.x); } break; // покой
      case 1: if (--p.t <= 0) { p.st = 2; p.vy = 0; } break;                    // телеграф: дрожит
      case 2:                                                                   // удар вниз
        p.vy = Math.min(PRESS.maxFall, p.vy + PRESS.accel);
        p.y += p.vy;
        if (p.y >= p.y1) {
          p.y = p.y1; p.st = 3; p.t = PRESS.hold;
          if (onScreen(p.x)) {
            shake = 6; snd('pressSlam', p.x);
            spawnParticles(p.x + 8, p.y + 16, 12, LV.fx.dust, 2.6, 0.14, 26);
          }
        }
        break;
      case 3: if (--p.t <= 0) p.st = 4; break;                                  // держит
      case 4:                                                                   // медленный подъём
        p.y -= PRESS.rise;
        if (p.y <= p.y0) { p.y = p.y0; p.st = 0; p.t = p.wait; }
        break;
    }
  }
}
function updateSaws() {
  for (const q of ents.saws) {
    q.x += q.dir * 1.15;
    if (q.x <= q.minX) { q.x = q.minX; q.dir = 1; }
    if (q.x >= q.maxX) { q.x = q.maxX; q.dir = -1; }
  }
}

// раструбы: звук на смене стадии (предупреждение → пурга)
function updateGusts() {
  for (const q of ents.gusts) {
    const st = gustStage(q);
    if (st === q.st) continue;
    if (q.st >= 0 && st > 0 && q.w && onScreen(q.x, q.y)) snd(st === 1 ? 'gateWarn' : 'gust', q.x);
    q.st = st;
  }
}

// Сталактит срывается, когда под ним проходят: трещит, падает, разбивается, отрастает
function updateIcicles() {
  for (const i of ents.icicles) {
    if (i.st === 0) {
      if (state === 'play' && P.y + P.h > i.y + T && onScreen(i.x, i.y) &&
          P.x + P.w > i.x - ICICLE.reach && P.x < i.x + T + ICICLE.reach) {
        i.st = 1; i.t = ICICLE.warn; snd('crack', i.x);
      }
    } else if (i.st === 1) {
      if (--i.t <= 0) { i.st = 2; i.vy = 0; }
    } else if (i.st === 2) {
      i.vy = Math.min(ICICLE.maxFall, i.vy + ICICLE.grav);
      i.y += i.vy;
      if (i.y + T >= i.hitY) {
        i.st = 3; i.t = ICICLE.back;
        if (onScreen(i.x, i.y)) {
          snd('shatter', i.x);
          spawnParticles(i.x + 8, i.hitY - 5, 14, ['#f0ffff', '#a5d8e2', ...LV.fx.lift], 2.6, 0.16, 28);
        }
      }
    } else if (--i.t <= 0) { i.st = 0; i.y = i.y0; i.vy = 0; }
  }
}

// затворы: звук на смене стадии (предупреждение → луч)
function updateGates() {
  for (const g of ents.gates) {
    const st = gateStage(g);
    if (st === g.st) continue;
    if (g.st >= 0 && st > 0 && onScreen(g.x)) snd(st === 1 ? 'gateWarn' : 'gateOn', g.x);
    g.st = st;
  }
}

// лента под ногами тянет игрока в сторону стрелок
function beltPush() {
  if (!P.grounded) return;
  const ty = Math.floor((P.y + P.h) / T);
  let dir = 0;
  for (let tx = Math.floor(P.x / T); tx <= Math.floor((P.x + P.w - EPS) / T); tx++) {
    const c = ch(tx, ty);
    if (c === '>') dir++; else if (c === '<') dir--;
  }
  if (dir) moveX(Math.sign(dir) * BELT);
}

// пол под ногами из наледи?
function onIce() {
  const ty = Math.floor((P.y + P.h) / T);
  for (let tx = Math.floor(P.x / T); tx <= Math.floor((P.x + P.w - EPS) / T); tx++)
    if (ch(tx, ty) === 'I') return true;
  return false;
}

// цепкая стена держит, пока игрок жмёт в неё
function wallGrip() {
  P.wall = 0;
  if (P.grounded) return;
  const y1 = Math.floor((P.y + 3) / T), y2 = Math.floor((P.y + P.h - 4) / T);
  for (const d of [-1, 1]) {
    if (d < 0 ? !inp.left() : !inp.right()) continue;
    const tx = Math.floor((d < 0 ? P.x - 1 : P.x + P.w) / T);
    for (let ty = y1; ty <= y2; ty++) if (ch(tx, ty) === 'N') { P.wall = d; break; }
  }
}

// пурга из раструба сдувает вбок — и с площадки, и со стены
function gustPush() {
  P.gust = 0;
  for (const q of ents.gusts) {
    if (!q.w || gustStage(q) !== 2) continue;
    if (P.x + P.w > q.tx && P.x < q.tx + q.w && P.y + P.h > q.top && P.y < q.top + q.h) {
      moveX(q.dir * GUST.push);
      P.gust = q.dir;
      if (frame % 6 === 0) spawnParticles(P.x + 5, P.y + 8, 1, ['#f0ffff', '#a5d8e2'], 1.2, 0, 14);
    }
  }
}

function touchCrumbles() {                       // плита начинает сыпаться под весом игрока
  if (!P.grounded) return;
  const ty = Math.floor((P.y + P.h) / T);
  for (let tx = Math.floor(P.x / T); tx <= Math.floor((P.x + P.w - EPS) / T); tx++) {
    if (ch(tx, ty) !== 'X' || crumbleMask[ty * LW + tx] !== 1) continue;
    const c = ents.crumbles.find(k => k.tx === tx && k.ty === ty);
    if (c && c.st === 0) { c.st = 1; c.t = CRUMBLE.hold; snd('crumble', c.x); }
  }
}

function updatePlayer() {
  // перенос платформой
  if (P.onMover) { P.x += P.onMover.dx; P.y += P.onMover.dy; }

  const wasGrounded = P.grounded;
  // горизонталь; на наледи разгон вязкий, а тормозить почти нечем
  const icy = P.grounded && onIce();
  const ax = P.grounded ? (icy ? PHYS.iceAccel : PHYS.accel) : PHYS.airAccel;
  const fric = icy ? PHYS.iceFriction : PHYS.friction;
  if (P.lock > 0) P.lock--;                       // после толчка от стены ввод не перебивает отскок
  if (P.lock > 0) { /* летим по инерции отскока */ }
  else if (inp.left()) { P.vx -= ax; P.face = -1; }
  else if (inp.right()) { P.vx += ax; P.face = 1; }
  else if (P.grounded) { P.vx = Math.abs(P.vx) < fric ? 0 : P.vx - Math.sign(P.vx) * fric; }
  else P.vx *= 0.98;
  P.vx = clamp(P.vx, -PHYS.maxSpeed, PHYS.maxSpeed);

  // прыжок: coyote + buffer
  P.coyote = P.grounded ? PHYS.coyote : Math.max(0, P.coyote - 1);
  P.jbuf = inp.jumpPressed() ? PHYS.buffer : Math.max(0, P.jbuf - 1);
  if (P.jbuf > 0 && P.coyote > 0) {
    P.vy = PHYS.jump; P.coyote = 0; P.jbuf = 0; P.grounded = false; P.onMover = null; P.jumping = true;
    SFX.play('jump');
    spawnParticles(P.x + 5, P.y + P.h, 5, ['#6c7aa6', '#aab4d4'], 1.2, 0.05, 12);
  } else if (P.jbuf > 0 && P.wall) {              // толчок от цепкой стены
    P.vy = PHYS.wallJump; P.vx = -P.wall * PHYS.wallKick; P.face = -P.wall;
    P.jbuf = 0; P.jumping = true; P.lock = PHYS.wallLock;
    SFX.play('wallJump');
    spawnParticles(P.x + (P.wall > 0 ? 10 : 0), P.y + 12, 7, LV.fx.lift, 1.8, 0.05, 18);
    P.wall = 0;
  }
  if (P.jumping && !inp.jump() && P.vy < PHYS.jumpCut) P.vy = PHYS.jumpCut; // переменная высота
  if (P.vy >= 0) P.jumping = false;

  P.vy = Math.min(PHYS.maxFall, P.vy + PHYS.gravity);

  // держась за иней цепкой стены, сползаем медленно
  if (P.wall && P.vy > PHYS.wallSlide) {
    P.vy = PHYS.wallSlide;
    if (frame % 5 === 0)
      spawnParticles(P.x + (P.wall > 0 ? 10 : 0), P.y + 14, 1, ['#f0ffff', '#a5d8e2'], 0.8, 0.06, 14);
  }

  // восходящий поток вентилятора
  P.lift = Math.max(0, P.lift - 1);
  for (const v of ents.vents) {
    if (P.x + P.w > v.x + 1 && P.x < v.x + T - 1 && P.y + P.h > v.y && P.y < v.y + v.h) {
      P.vy = Math.max(P.vy - 0.72, -3.0); P.jumping = false; P.lift = 6;
      if (frame % 4 === 0) spawnParticles(P.x + 5, P.y + P.h, 1, LV.fx.lift, 0.8, -0.04, 18);
    }
  }

  moveX(P.vx);
  moveY(P.vy);
  beltPush();
  gustPush();
  touchCrumbles();
  wallGrip();
  if (bossActive()) {                              // энергобарьер арены: сбоку или над головой
    if (ARENA.vert) { if (P.y < ARENA.top + 14) { P.y = ARENA.top + 14; P.vy = Math.max(0, P.vy); } }
    else if (P.x < ARENA.left + 16) { P.x = ARENA.left + 16; P.vx = 0; }
  }

  if (P.grounded && !wasGrounded) {
    P.squash = 6; SFX.play('land');
    spawnParticles(P.x + 5, P.y + P.h, 6, ['#6c7aa6', '#aab4d4'], 1.5, 0.05, 14);
  }
  if (P.squash > 0) P.squash--;

  // пружины
  for (const s of ents.springs) {
    if (s.timer > 0) s.timer--;
    const box = { x: s.x + 2, y: s.y + 4, w: 12, h: 12 };
    if (P.vy >= 0 && overlap({ x: P.x, y: P.y + P.h - 4, w: P.w, h: 4 }, box)) {
      P.vy = PHYS.spring; P.grounded = false; P.onMover = null; P.jumping = false; s.timer = 12; P.y = s.y + 4 - P.h;
      snd('spring', s.x);
      spawnParticles(s.x + 8, s.y + 6, 10, ['#ffe14a', '#ff9a2e'], 2, 0.08, 20);
    }
  }

  // чекпоинты
  if (P.grounded) {
    const was = cp;
    for (let i = cp + 1; i < checkpoints.length; i++)
      if (VERT ? P.y + P.h >= checkpoints[i].row * T : P.x >= checkpoints[i].col * T) cp = i;
    if (cp !== was && intro <= 0) SFX.play('checkpoint');
  }

  // энергоячейки
  for (const c of ents.cells) {
    c.t++;
    if (!c.taken && overlap(P, { x: c.x, y: c.y + Math.sin(c.t / 12) * 2, w: c.w, h: c.h })) {
      c.taken = true;
      snd('cell', c.x);
      spawnParticles(c.x + 4, c.y + 5, 14, ['#4dff88', '#e6ecff', '#22e5ff'], 2, 0.02, 24);
    }
  }

  // опасности
  const hit = { x: P.x + 1, y: P.y + 2, w: P.w - 2, h: P.h - 3 };
  for (const a of ents.anim) if (a.kind === 'spikes' && overlap(hit, { x: a.x + 1, y: a.y + 2, w: 14, h: 10 })) die();
  for (const m of ents.melt) if (overlap(hit, { x: m.x, y: m.y + (m.top ? 5 : 0), w: T, h: m.top ? T - 5 : T })) die();
  for (const r of ents.rifts) if (overlap(hit, { x: r.x, y: r.y + (r.top ? 4 : 0), w: T, h: r.top ? T - 4 : T })) die();
  for (const r of ents.cryos) if (overlap(hit, { x: r.x, y: r.y + (r.top ? 5 : 0), w: T, h: r.top ? T - 5 : T })) die();
  for (const i of ents.icicles) if (i.st === 2 && overlap(hit, { x: i.x + 5, y: i.y + 1, w: 6, h: 14 })) die();
  for (const h of ents.howlers) if (overlap(hit, { x: h.x + 2, y: h.y + 2, w: 12, h: 12 })) die();
  for (const p of ents.presses) if (overlap(hit, { x: p.x + 1, y: p.y, w: 14, h: 16 })) die();
  for (const q of ents.saws) if (overlap(hit, { x: q.x + 2, y: q.y + 2, w: 12, h: 12 })) die();
  for (const g of ents.gates) if (gateStage(g) === 2 && overlap(hit, { x: g.x + 5, y: g.beamY, w: 6, h: g.beamH })) die();
  for (const d of ents.drones) {
    if (!d.alive) continue;
    if (stompOrDie(hit, { x: d.x + 2, y: d.y + 3, w: 12, h: 6 }, d.y + 5)) {
      d.alive = false;
      spawnParticles(d.x + 8, d.y + 6, 24, [...LV.fx.dust, '#ff3b3b'], 3, 0.12, 36);
    }
  }
  for (const c of ents.crawlers) {
    if (!c.alive) continue;
    if (stompOrDie(hit, { x: c.x + 2, y: c.y + 2, w: 12, h: 9 }, c.y + 5)) {
      c.alive = false;
      spawnParticles(c.x + 8, c.y + 6, 24, [...LV.fx.dust, '#ff3b3b', '#e6ecff'], 3, 0.12, 36);
    }
  }
  for (const t of ents.turrets) {
    if (!t.alive) continue;
    if (stompOrDie(hit, { x: t.x + 2, y: t.y + 4, w: 13, h: 12 }, t.y + 7)) {
      t.alive = false;
      spawnParticles(t.x + 8, t.y + 10, 26, [...LV.fx.dust, '#ffe14a', '#e6ecff'], 3, 0.12, 38);
    }
  }
  for (const l of ents.leapers) {
    if (!l.alive) continue;
    if (stompOrDie(hit, { x: l.x + 2, y: l.y + 2, w: 12, h: 12 }, l.y + 5)) {
      l.alive = false;
      spawnParticles(l.x + 8, l.y + 8, 24, [...LV.fx.dust, '#ff3b3b'], 3, 0.12, 36);
    }
  }
  for (const k of ents.seekers) {
    if (!k.alive) continue;
    if (stompOrDie(hit, { x: k.x + 1, y: k.y + 1, w: 10, h: 10 }, k.y + 4)) {
      k.alive = false;
      spawnParticles(k.x + 6, k.y + 6, 22, ['#c46bff', ...LV.fx.lift], 3, 0.1, 34);
    }
  }
  for (const d of ents.drifters) {
    if (!d.alive) continue;
    if (stompOrDie(hit, { x: d.x + 1, y: d.y + 1, w: 10, h: 10 }, d.y + 4)) {
      d.alive = false;
      spawnParticles(d.x + 6, d.y + 6, 22, ['#9bf0ff', ...LV.fx.lift], 3, 0.1, 34);
    }
  }
  for (const k of ents.skaters) {
    if (!k.alive) continue;
    if (stompOrDie(hit, { x: k.x + 2, y: k.y + 2, w: 12, h: 8 }, k.y + 4)) {
      k.alive = false;
      spawnParticles(k.x + 8, k.y + 6, 24, [...LV.fx.dust, '#ff3b3b', '#f0ffff'], 3, 0.12, 36);
    }
  }
  bossHazards(hit);
  if (P.y > LEVEL_H + 8) die();

  // портал (закрыт, пока жив босс)
  const pt = ents.portal;
  if (pt && boss.state === 'dead' && overlap(P, { x: pt.x + 6, y: pt.y + 2, w: 20, h: 28 })) {
    state = levelIdx < LEVELS.length - 1 ? 'clear' : 'win';
    SFX.stopLoops(); SFX.music(null); SFX.play(state);
  }

  // анимация
  P.animT += Math.abs(P.vx) > 0.3 ? Math.abs(P.vx) * 0.55 : 0.15;
}
// прыжок сверху убивает врага, иначе смерть игрока
function stompOrDie(hit, box, topY) {
  if (!overlap(hit, box)) return false;
  if (P.vy > 0 && P.y + P.h - P.vy <= topY) {
    P.vy = -4.2; P.jumping = false; shake = 3; snd('stomp', box.x); return true;
  }
  die(); return false;
}

// ---------- враги ----------
function updateDrones() {
  for (const d of ents.drones) {
    if (!d.alive) continue;
    d.t++;
    d.x += d.dir * 0.6;
    if (d.x <= d.minX) { d.x = d.minX; d.dir = 1; }
    if (d.x >= d.maxX) { d.x = d.maxX; d.dir = -1; }
  }
}
function updateCrawlers() {
  for (const c of ents.crawlers) {
    if (!c.alive) continue;
    c.t++;
    const nx = c.x + c.dir * 0.55;
    const edge = c.dir > 0 ? nx + 15 : nx;
    const col = Math.floor(edge / T), row = Math.floor((c.y + 6) / T);
    if (isSolid(col, row) || !isSolid(col, row + 1)) c.dir *= -1;
    else c.x = nx;
  }
}
// Прыгун: сидит, приседает (телеграф), прыгает в сторону игрока
function updateLeapers() {
  for (const l of ents.leapers) {
    if (!l.alive) continue;
    if (l.st === 2) {
      l.vy = Math.min(PHYS.maxFall, l.vy + PHYS.gravity);
      const nx = l.x + l.vx;
      const side = l.vx > 0 ? nx + 15 : nx;
      if (isSolid(Math.floor(side / T), Math.floor((l.y + 8) / T))) l.vx *= -1; else l.x = nx;
      l.y += l.vy;
      if (l.vy > 0) {                              // приземление
        const row = Math.floor((l.y + 16) / T);
        const c0 = Math.floor((l.x + 3) / T), c1 = Math.floor((l.x + 12) / T);
        if (isSolid(c0, row) || isSolid(c1, row)) {
          l.y = row * T - 16; l.vy = 0; l.vx = 0; l.st = 0; l.t = 44 + (frame % 40);
          if (onScreen(l.x)) {
            snd('land', l.x, { vol: 0.6 });
            spawnParticles(l.x + 8, l.y + 16, 5, ['#6b5c74', '#d2c7cf'], 1.4, 0.08, 14);
          }
        }
      }
      if (l.y > LEVEL_H + 24) { l.x = l.hx; l.y = l.hy; l.vx = l.vy = 0; l.st = 0; l.t = 60; }
      continue;
    }
    if (!onScreen(l.x)) { l.t = Math.max(l.t, 24); continue; }
    if (--l.t > 0) continue;
    // присел
    if (l.st === 0) { l.st = 1; l.t = 28; l.dir = P.x + P.w / 2 < l.x + 8 ? -1 : 1; snd('leapTell', l.x); }
    else { l.st = 2; l.vy = -4.9; l.vx = l.dir * 1.25; snd('leap', l.x); }    // прыжок
  }
}
// Искатель: парящий глаз, медленно тянется к игроку, у стен останавливается
function updateSeekers() {
  for (const k of ents.seekers) {
    if (!k.alive) continue;
    k.t++;
    if (k.calm > 0) k.calm--;                    // пока не остыл — тянется к дому, а не к игроку
    const near = k.calm === 0 && onScreen(k.x);
    const tx = near ? P.x + P.w / 2 - 6 : k.hx, ty = near ? P.y + P.h / 2 - 6 : k.hy;
    k.vx = clamp(k.vx + Math.sign(tx - k.x) * 0.035, -0.85, 0.85);
    k.vy = clamp(k.vy + Math.sign(ty - k.y) * 0.035, -0.85, 0.85);
    const nx = k.x + k.vx, ny = k.y + k.vy;
    if (!isSolid(Math.floor((nx + 6) / T), Math.floor((k.y + 6) / T))) k.x = nx; else k.vx = 0;
    if (!isSolid(Math.floor((k.x + 6) / T), Math.floor((ny + 6) / T))) k.y = ny; else k.vy = 0;
  }
}

// Дрейфер: ледяная медуза, ходит вверх-вниз по своему колену шахты
function updateDrifters() {
  for (const d of ents.drifters) {
    if (!d.alive) continue;
    d.t++;
    d.y += d.dir * 0.5;
    if (d.y <= d.minY) { d.y = d.minY; d.dir = 1; }
    if (d.y >= d.maxY) { d.y = d.maxY; d.dir = -1; }
  }
}
// Конькобежец: разгоняется по наледи, у стен и обрывов уходит в занос и разворачивается
function updateSkaters() {
  for (const k of ents.skaters) {
    if (!k.alive) continue;
    k.t++;
    const nx = k.x + k.dir * 1.75;
    const edge = k.dir > 0 ? nx + 15 : nx;
    const c = Math.floor(edge / T), r = Math.floor((k.y + 8) / T);
    if (isSolid(c, r) || !isSolid(c, r + 1)) {
      k.dir *= -1;
      if (onScreen(k.x, k.y)) {
        snd('skid', k.x);
        spawnParticles(k.x + 8, k.y + 11, 5, ['#f0ffff', '#a5d8e2'], 1.8, 0.08, 16);
      }
    } else {
      k.x = nx;
      if (k.t % 5 === 0 && onScreen(k.x, k.y))
        spawnParticles(k.x + 8 - k.dir * 8, k.y + 11, 1, ['#a5d8e2'], 0.9, 0.05, 12);
    }
  }
}
// Выль: висит на потолке и роняет криобомбу, когда под ней проходят. Сбить нечем.
function updateHowlers() {
  for (const h of ents.howlers) {
    if (h.t < 0) { h.t++; continue; }
    if (!onScreen(h.x, h.y) || state !== 'play' ||
        !(P.y > h.y && P.x + P.w > h.x - 6 && P.x < h.x + T + 6)) { h.t = 0; continue; }
    if (++h.t < 40) continue;
    shots.push({ x: h.x + 8, y: h.y + 16, vx: 0, vy: 0.9, g: 0.12, r: 3, life: 320,
                 cols: ['#09202f', '#7fe9f5', '#eaffff'] });
    snd('drop', h.x); h.t = -80;
    spawnParticles(h.x + 8, h.y + 16, 5, ['#7fe9f5', '#eaffff'], 1.2, 0.05, 14);
  }
}
const howlerCharging = h => h.t >= 18;

function updateTurrets() {
  for (const t of ents.turrets) {
    if (!t.alive) continue;
    if (!onScreen(t.x)) { t.t = 0; continue; }
    t.t++;
    if (t.t === 90) t.dir = P.x + P.w / 2 < t.x + 8 ? -1 : 1;
    if (t.t >= 118) {
      t.t = 0;
      shots.push({ x: t.x + 8 + t.dir * 9, y: t.y + 11, vx: t.dir * 2.1, vy: 0, g: 0, r: 2, life: 220,
                   cols: ['#8a1a1a', '#ff3b3b', '#e6ecff'] });
      snd('shot', t.x);
      spawnParticles(t.x + 8 + t.dir * 9, t.y + 11, 4, ['#ff3b3b', '#ffe14a'], 1, 0, 10);
    }
  }
}
const turretCharging = t => t.alive && t.t >= 90;

function updateShots() {
  for (const s of shots) { s.x += s.vx; s.y += s.vy; s.vy += s.g; s.life--; }
  shots = shots.filter(s => s.life > 0 && s.y < LEVEL_H + 8 && s.x > -8 && s.x < LEVEL_W + 8 &&
                            !isSolid(Math.floor(s.x / T), Math.floor(s.y / T)));
}
function updateParticles() {
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life--; }
  particles = particles.filter(p => p.life > 0);
}

// ---------- боссы: общее ----------
function bossHazards(hit) {
  const b = boss, d = bossDef();
  if (b.state !== 'idle' && b.state !== 'dead' && b.state !== 'dying' && b.state !== d.ghost) {
    const box = bossBox(), push = () => { P.x = P.x + P.w / 2 < box.x + box.w / 2 ? box.x - P.w : box.x + box.w; P.vx = 0; };
    if (b.state === d.weak) {                                      // броня раскрыта: ядро сверху уязвимо
      const core = bossRect('core');
      if (overlap(hit, core) && P.vy > 0 && P.y + P.h - P.vy <= core.y + core.h) hitBoss();
      else if (overlap(hit, box)) push();
    } else if (overlap(hit, box)) {
      if (d.shield.includes(b.state)) die();                       // броня/щит — касание смертельно
      else push();
    }
  }
  for (const s of shots) if (overlap(hit, { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 })) die();
  for (const w of waves) if (overlap(hit, { x: w.x - 4, y: ARENA.floorY - 7, w: 8, h: 7 })) die();
  if (b.kind === 'hoarfrost' && bossActive()) {                     // взвесь и столб стужи
    if (P.y + P.h > b.flood + 3) die();
    if (b.state === 'erupt' && overlap(hit, hoarJet())) die();
  }
  if (b.kind === 'sovereign' && b.orb) {                            // осколок: сверху — отбить, сбоку — отброс
    const o = b.orb;
    if (o.mode !== 'back' && overlap(hit, { x: o.x - 6, y: o.y - 6, w: 12, h: 12 })) {
      // окно отбивки — верхняя половина осколка: падаешь сверху — отбил, а не погиб.
      // Остывший осколок отбить можно, а вот повредить игроку он уже не может
      if (P.vy > 0 && P.y + P.h - P.vy <= o.y + 3) sovereignSpike();
      else if (!o.cool) orbGraze();
    }
  }
}
function bossAwake() {                              // общий вход в бой: тревога + тема боссов
  boss.state = 'wake'; shake = 4;
  SFX.play('bossWake'); SFX.music('boss');
}
function hitBoss(bounce = true) {
  const b = boss;
  b.hp--; b.flash = 14; shake = 6; SFX.play('bossHit');
  if (bounce) { P.vy = -5; P.jumping = false; }        // корону бьёт её же осколок — игрока не подбрасывает
  if (b.kind === 'hoarfrost') b.flood = Math.min(ARENA.floorY, b.flood + FLOOD.drain); // взвесь отступает
  spawnParticles(b.x + bossDef().w / 2, b.y + 4, 24, ['#4dff88', '#e6ecff', '#ffe14a'], 3, 0.1, 30);
  if (b.hp <= 0) { b.state = 'dying'; b.timer = 120; shots = []; waves = []; b.orb = null; }
  else { b.state = 'recoil'; b.timer = 45; }
}
function bossDeath() {
  const b = boss, d = bossDef();
  b.state = 'dead'; shake = 14; b.flood = ARENA.floorY;   // взвесь уходит — к порталу снова можно пройти
  SFX.stopLoops(); SFX.play('bossDie'); SFX.music(null); SFX.music(TRACKS[levelIdx], 2.8);
  spawnParticles(b.x + d.w / 2, b.y + d.h / 2, 90, ['#ff3b3b', '#ff9a2e', '#ffe14a', '#e6ecff', '#22e5ff'], 5, 0.08, 60);
  spawnParticles(ents.portal.x + 16, ents.portal.y + 16, 30, ['#22e5ff', '#3b5bff', '#e6ecff'], 2, 0.01, 40);
}
function updateBoss() {
  const b = boss;
  if (b.state === 'dead') { updateShots(); return; }
  b.t++;
  if (b.flash > 0) b.flash--;
  if (b.state === 'dying') {
    const d = bossDef();
    if (b.timer % 9 === 0) {
      spawnParticles(b.x + 4 + Math.random() * (d.w - 8), b.y + 2 + Math.random() * (d.h - 4), 16,
        ['#ff3b3b', '#ff9a2e', '#ffe14a', '#e6ecff'], 3, 0.1, 34);
      shake = 5; b.flash = 4; snd('boom', b.x);
    }
    b.y += (b.timer % 4 < 2) ? 0.6 : -0.4;
    if (--b.timer <= 0) bossDeath();
  } else if (b.kind === 'warden') updateWarden();
  else if (b.kind === 'rootmind') updateRootmind();
  else if (b.kind === 'sovereign') updateSovereign();
  else updateHoarfrost();
  updateShots();
  for (const w of waves) { w.x += w.dir * 2.4; w.t++; }
  waves = waves.filter(w => w.x > ARENA.left + 18 && w.x < (LW - 6) * T - 4);
}

// ---------- босс 1: WARDEN (ORBITAL FOUNDRY) ----------
function fireBolt() {
  const b = boss, sx = b.x + 16, sy = b.y + 18;
  const dx = P.x + P.w / 2 - sx, dy = P.y + P.h / 2 - sy, len = Math.hypot(dx, dy) || 1;
  const spd = 1.6 + bossRage() * 0.2;
  shots.push({ x: sx, y: sy, vx: dx / len * spd, vy: dy / len * spd, g: 0, r: 2, life: 260,
               cols: ['#8a1a1a', '#ff3b3b', '#e6ecff'] });
  snd('bossShot', sx);
  spawnParticles(sx, sy, 4, ['#ff3b3b', '#ff9a2e'], 1, 0, 10);
}
function wardenLand() {
  const b = boss;
  b.y = ARENA.floorY - 24; shake = 10;
  snd('slam', b.x); SFX.play('bossOpen', { delay: 0.35 });
  spawnParticles(b.x + 6, b.y + 24, 12, ['#aab4d4', '#6c7aa6', '#ff9a2e'], 2.5, 0.12, 30);
  spawnParticles(b.x + 26, b.y + 24, 12, ['#aab4d4', '#6c7aa6', '#ff9a2e'], 2.5, 0.12, 30);
  waves = [{ x: b.x + 2, dir: -1, t: 0 }, { x: b.x + 30, dir: 1, t: 0 }]; // ударные волны по полу
  b.state = 'stun'; b.timer = 150 - bossRage() * 25;
}
function updateWarden() {
  const b = boss;
  const hoverY = ARENA.floorY - 24 - 76;
  const hoverTime = () => 230 - bossRage() * 35, boltEvery = () => 95 - bossRage() * 20;
  switch (b.state) {
    case 'idle':
      if (state === 'play' && P.x >= ARENA.trigger) { bossAwake(); b.timer = 100; }
      break;
    case 'wake':
      if (b.timer > 60) b.x += (frame % 2 ? 1 : -1) * 0.5;               // дрожит, просыпаясь
      else b.y = Math.max(hoverY, b.y - 1.5);                            // взлетает
      if (--b.timer <= 0) { b.state = 'hover'; b.y = hoverY; b.timer = hoverTime(); b.boltT = 50; }
      break;
    case 'hover': {
      const spd = 0.7 + bossRage() * 0.35;
      const tx = clamp(P.x + P.w / 2 - 16, ARENA.xMin, ARENA.xMax);
      b.x += clamp((tx - b.x) * 0.06, -spd, spd);
      b.y = hoverY + Math.sin(b.t / 14) * 3;
      if (--b.boltT <= 0) { fireBolt(); b.boltT = boltEvery(); }
      if (--b.timer <= 0) { b.state = 'aim'; b.timer = 45; }
      break;
    }
    case 'aim':                                                          // телеграф перед ударом
      if (b.timer === 45) snd('tell', b.x);
      b.y = hoverY - 4 + (frame % 2);
      if (--b.timer <= 0) { b.state = 'slam'; b.vy = 0; snd('dash', b.x); }
      break;
    case 'slam':
      b.vy = Math.min(7, b.vy + 0.45); b.y += b.vy;
      if (b.y + 24 >= ARENA.floorY) wardenLand();
      break;
    case 'stun':
      if (--b.timer <= 0) b.state = 'rise';
      break;
    case 'recoil':
      b.x += (frame % 2 ? 1 : -1) * 0.4;
      if (--b.timer <= 0) b.state = 'rise';
      break;
    case 'rise':
      b.y -= 1.4;
      if (b.y <= hoverY) { b.y = hoverY; b.state = 'hover'; b.timer = hoverTime(); b.boltT = 40; }
      break;
  }
}

// ---------- босс 2: ROOTMIND (VERDANT REACTOR) ----------
//  ходит по полу и плюётся спорами веером; телеграф → рывок через всю арену;
//  удар о стену раскрывает броню — ядро можно топтать. С третьего деления
//  сыплет расплавом с потолка и выпускает ползунов.
function fireSpores() {
  const b = boss, sx = b.x + 20, sy = b.y + 12;
  const dir = P.x + P.w / 2 < sx ? -1 : 1;
  for (const ang of [-0.98, -0.64, -0.32]) {
    const spd = 2.3 + bossRage() * 0.12;
    shots.push({ x: sx, y: sy, vx: Math.cos(ang) * spd * dir, vy: Math.sin(ang) * spd, g: 0.055, r: 3, life: 300,
                 cols: ['#3f8a1c', '#a8ff3d', '#ecfff2'] });
  }
  snd('spore', sx);
  spawnParticles(sx, sy, 6, ['#a8ff3d', '#2bd6c0'], 1.4, 0, 14);
}
function dripMelt() {
  const x = clamp(P.x + (Math.random() * 90 - 45), ARENA.left + 28, LEVEL_W - 44);
  shots.push({ x, y: 6, vx: 0, vy: 1.1, g: 0.09, r: 3, life: 300, cols: ['#a04a0d', '#ff7a1e', '#ffc94a'] });
  snd('drip', x);
  spawnParticles(x, 8, 4, ['#ffc94a', '#ff7a1e'], 1, 0.05, 14);
}
function spawnAdd(side) {
  const x = side < 0 ? ARENA.left + 24 : LEVEL_W - 5 * T;
  ents.crawlers.push({ x, y: ARENA.floorY - 16, dir: side < 0 ? 1 : -1, alive: true, t: 0, home: false });
  snd('spawn', x);
  spawnParticles(x + 8, ARENA.floorY - 8, 14, ['#a8ff3d', '#3d7053'], 2, 0.1, 26);
}
function rootmindCrash() {
  const b = boss;
  shake = 11;
  snd('slam', b.x); SFX.play('bossOpen', { delay: 0.35 });
  spawnParticles(b.x + (b.dir > 0 ? 38 : 2), b.y + 24, 20, ['#a3dcb4', '#3d7053', '#a8ff3d'], 3.2, 0.14, 34);
  for (let i = 0; i < 3; i++) dripMelt();
  b.state = 'open'; b.timer = 165 - bossRage() * 22;
}
function updateRootmind() {
  const b = boss, rage = bossRage();
  const stalkTime = () => 250 - rage * 30;
  const floorTop = ARENA.floorY - 34;
  switch (b.state) {
    case 'idle':
      if (state === 'play' && P.x >= ARENA.trigger) { bossAwake(); b.timer = 95; }
      break;
    case 'wake':
      b.x += (frame % 2 ? 1 : -1) * 0.6;
      if (b.timer % 10 === 0) spawnParticles(b.x + 20, b.y + 32, 6, ['#3d7053', '#a8ff3d'], 2, 0.12, 24);
      if (--b.timer <= 0) { b.state = 'stalk'; b.timer = stalkTime(); b.boltT = 70; }
      break;
    case 'stalk': {
      const spd = 0.55 + rage * 0.18;
      const tx = P.x + P.w / 2 - 20;
      b.dir = tx < b.x ? -1 : 1;
      b.x = clamp(b.x + b.dir * spd, ARENA.xMin, ARENA.xMax);
      b.y = floorTop;
      if (b.t % 14 === 0) spawnParticles(b.x + 20, ARENA.floorY - 2, 2, ['#3d7053', '#1e3f2d'], 1, 0.08, 16);
      if (--b.boltT <= 0) { fireSpores(); b.boltT = 115 - rage * 16; }
      if (rage >= 2 && b.t % 95 === 0) dripMelt();
      if (--b.timer <= 0) { b.state = 'tell'; b.timer = 52; b.dir = P.x + P.w / 2 < b.x + 20 ? -1 : 1; snd('tell', b.x); }
      break;
    }
    case 'tell':                                                          // телеграф рывка
      b.x = clamp(b.x + (frame % 2 ? 1 : -1) * 0.6, ARENA.xMin, ARENA.xMax);
      b.y = floorTop;
      if (--b.timer <= 0) { b.state = 'dash'; snd('dash', b.x); }
      break;
    case 'dash': {
      const spd = 3.0 + rage * 0.45;
      b.x += b.dir * spd;
      if (frame % 2 === 0) spawnParticles(b.x + (b.dir > 0 ? 4 : 36), ARENA.floorY - 4, 3, ['#a8ff3d', '#3d7053'], 2, 0.1, 20);
      if (b.x <= ARENA.xMin || b.x >= ARENA.xMax) { b.x = clamp(b.x, ARENA.xMin, ARENA.xMax); rootmindCrash(); }
      break;
    }
    case 'open':                                                          // броня раскрыта — ядро уязвимо
      b.y = floorTop;
      if (--b.timer <= 0) { b.state = 'close'; b.timer = 34; }
      break;
    case 'close':
      if (--b.timer <= 0) { b.state = 'stalk'; b.timer = stalkTime(); b.boltT = 60; }
      break;
    case 'recoil':
      b.x = clamp(b.x + (frame % 2 ? 1 : -1) * 0.5, ARENA.xMin, ARENA.xMax);
      if (--b.timer <= 0) {
        b.state = 'stalk'; b.timer = stalkTime(); b.boltT = 55;
        if (rage >= 2) { spawnAdd(-1); spawnAdd(1); }                     // раненый выпускает ползунов
      }
      break;
  }
}

// ---------- босс 3: SOVEREIGN (ASHEN CITADEL) ----------
//  Корона-разлом не подпускает к себе: её обод смертелен всегда, топтать нечего.
//  Бой идёт наоборот — урон наносит её же оружие. Корона встаёт на «трон»,
//  спускает с привязи осколок-сферу и светит под собой резонансным столбом.
//  Сферу надо сбить прыжком сверху, стоя в столбе: тогда она уходит обратно
//  в корону и сбивает деление. Промах или просрочка — корона сыплет занавес
//  осколков пустоты через всю арену.
const SOV = {
  top: 30,            // верхняя граница парения
  throne: 46,         // высота «трона»: ниже она не опускается — допрыгнуть до обода нельзя
  colW: 92,           // ширина резонансного столба — окно для отбивки
  reign: 150,         // сколько корона царствует между тронами
  curtain: 150,       // длительность занавеса осколков
};
const sovRing = () => ({ x: boss.x + 22, y: boss.y + 17 });      // центр кольца
function sovColumn() {                                           // резонансный столб под троном
  const c = sovRing();
  return { x: c.x - SOV.colW / 2, y: c.y + 16, w: SOV.colW, h: Math.max(0, ARENA.floorY - (c.y + 16)) };
}
const sovInColumn = x => { const c = sovColumn(); return x > c.x && x < c.x + c.w; };

function fireRegalia() {                                 // редкие искры регалий по дуге
  const c = sovRing(), dir = P.x + P.w / 2 < c.x ? -1 : 1;
  for (const ang of [0.42, 0.86]) {
    shots.push({ x: c.x, y: c.y + 14, vx: Math.cos(ang) * 1.5 * dir, vy: Math.sin(ang) * 1.5,
                 g: 0.07, r: 2, life: 300, cols: ['#8a1f3c', '#ff5a7a', '#fff4ef'] });
  }
  snd('lance', c.x);
  spawnParticles(c.x, c.y + 14, 5, ['#ffb02e', '#ff5a7a'], 1.4, 0.02, 12);
}
// осколки с потолка сыплются вразнобой по всей арене, а не на голову игроку
const sovDropX = () => {
  const lo = ARENA.left + 28, hi = LEVEL_W - 40;
  return lo + Math.random() * (hi - lo);
};
function dropShard(x) {                                  // осколок пустоты с потолка
  shots.push({ x, y: 6, vx: 0, vy: 1.2, g: 0.1, r: 3, life: 300, cols: ['#2e1358', '#7a3cff', '#dcbcff'] });
  snd('drip', x);
  spawnParticles(x, 8, 4, ['#7a3cff', '#dcbcff'], 1, 0.05, 14);
}
function spawnSeeker(side) {
  const x = side < 0 ? ARENA.left + 26 : LEVEL_W - 5 * T;
  ents.seekers.push({ x, y: 96, hx: x, hy: 96, vx: 0, vy: 0, alive: true, t: 0, home: false });
  snd('spawn', x);
  spawnParticles(x + 6, 102, 14, ['#c46bff', '#3cc8ff'], 2, 0.02, 26);
}

// ---- осколок на привязи: единственный способ достать корону ----
function releaseOrb() {
  const b = boss, c = sovRing();
  // осколок сперва отлетает в дальнюю от игрока сторону и падает к полу —
  // на голову он не сваливается, зато потом идёт через всю арену
  const away = P.x + P.w / 2 < ARENA.left + 112 ? 1 : -1;
  b.orb = { x: c.x, y: c.y + 20, vx: away * 1.7, vy: 0.6, mode: 'drop', t: 0, cool: 0,
            life: 340 - bossRage() * 36 };
  snd('release', c.x);
  spawnParticles(c.x, c.y + 18, 16, ['#ffe9a8', '#ffb02e', '#fff4ef'], 2.6, 0.02, 26);
}
function updateOrb() {
  const b = boss, o = b.orb;
  if (!o) return;
  o.t++;
  if (o.cool) o.cool--;
  if (o.mode === 'drop') {                               // выход с привязи: дуга в сторону от игрока
    o.vy = Math.min(2, o.vy + 0.09);
    o.x = clamp(o.x + o.vx, ARENA.left + 18, LEVEL_W - 20);
    o.y += o.vy;
    if (o.t % 4 === 0) spawnParticles(o.x, o.y, 1, ['#ffb02e', '#ffe9a8'], 0.7, 0, 14);
    if (o.y >= ARENA.floorY - 26) { o.mode = 'hunt'; o.vy = 0; }
    o.life--;
  } else if (o.mode === 'hunt') {
    // Осколок стелется на высоте колена и гонится по горизонтали: вниз падает
    // резво, вверх тянется еле-еле — поэтому его всегда можно перепрыгнуть
    // и упасть сверху, а вот стоять на месте нельзя.
    const spd = 1.05 + bossRage() * 0.11, turn = 0.06;
    const dx = P.x + P.w / 2 - o.x, ty = P.y + P.h - 8;
    // пока игрок падает сверху, осколок не подныривает под окно отбивки, а ждёт удара;
    // отброшенный осколок не гонится, пока не остынет
    const dive = P.vy > 0 && P.y + P.h <= o.y + 2 && Math.abs(dx) < 22;
    const wantVx = o.cool || Math.abs(dx) < 3 ? 0 : Math.sign(dx) * spd;
    const wantVy = dive || o.cool ? 0 : clamp((ty - o.y) * 0.06, -0.7, 1.6);
    o.vx += (wantVx - o.vx) * turn;
    o.vy += (wantVy - o.vy) * turn;
    if (dive && o.vy < 0) o.vy = 0;                      // окно отбивки не едет вверх
    o.x = clamp(o.x + o.vx, ARENA.left + 18, LEVEL_W - 20);
    o.y = clamp(o.y + o.vy, 12, ARENA.floorY - 6);
    if (o.t % 6 === 0) spawnParticles(o.x, o.y, 1, ['#ffb02e', '#ffe9a8'], 0.7, -0.02, 14);
    if (--o.life <= 0) orbBurst();                       // просрочил — осколок лопается искрами
  } else {                                               // отбит: идёт обратно в корону
    const c = sovRing();
    if (o.lock) o.vx += clamp((c.x - o.x) * 0.09, -1.1, 1.1);
    o.vy = Math.max(-7.5, o.vy - 0.5);
    o.x += o.vx; o.y += o.vy;
    spawnParticles(o.x, o.y, 2, ['#fff4ef', '#ffe9a8'], 1.2, 0.02, 12);
    if (o.lock && o.y <= c.y + 12 && Math.abs(o.x - c.x) < 20) { b.orb = null; hitBoss(false); }
    else if (o.y < 2) {                                  // ушёл в потолок мимо короны
      spawnParticles(o.x, 6, 18, ['#c6bac5', '#877a90', '#ffb02e'], 3, 0.08, 26);
      snd('boom', o.x); b.orb = null; sovCurtain();
    }
  }
}
function sovereignSpike() {                              // игрок сбил осколок прыжком сверху
  const b = boss, o = b.orb;
  P.vy = -3.8; P.jumping = false; shake = 4;             // отдача короткая: подбросить под обод она не должна
  o.mode = 'back'; o.t = 0; o.lock = sovInColumn(o.x);
  o.vy = -6; o.vx = o.lock ? o.vx * 0.3 : (o.vx > 0 ? 1.4 : -1.4);
  snd(o.lock ? 'spike' : 'clank', o.x);
  spawnParticles(o.x, o.y, o.lock ? 20 : 10,
    o.lock ? ['#fff4ef', '#ffe9a8', '#ffb02e'] : ['#c6bac5', '#877a90'], 3, 0.04, 24);
}
function orbGraze() {                                    // задел осколок сбоку: отброс, а не смерть
  const o = boss.orb, dir = P.x + P.w / 2 < o.x ? -1 : 1;
  moveX(dir * 8);                                        // вытолкнуть из осколка, но не сквозь стену
  P.vx = dir * PHYS.maxSpeed; P.vy = -3.2; P.jumping = false; shake = 4;
  o.cool = 70; o.vx = -dir * 1.4; o.vy = -0.6;           // осколок гаснет и отлетает — вплотную не липнет
  snd('graze', o.x);
  spawnParticles(o.x, o.y, 12, ['#dcbcff', '#7a3cff', '#fff4ef'], 2.2, 0.04, 20);
}
function orbBurst() {                                    // осколок лопается: фонтан искр вокруг себя
  const b = boss, o = b.orb;
  // искры бьют вверх и осыпаются рядом, а не стелются по арене вдогонку игроку:
  // отойти от трещащего осколка — и фонтан не заденет
  for (const a of [-2.6, -2.05, -1.57, -1.1, -0.55]) {
    shots.push({ x: o.x + Math.cos(a) * 7, y: o.y + Math.sin(a) * 7,
                 vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 2.2, g: 0.2, r: 2, life: 110,
                 cols: ['#2e1358', '#7a3cff', '#dcbcff'] });
  }
  snd('boom', o.x);
  spawnParticles(o.x, o.y, 22, ['#7a3cff', '#dcbcff', '#ffb02e'], 3.4, 0.05, 28);
  b.orb = null; sovCurtain();
}
function sovCurtain() {                                  // гнев: занавес осколков через всю арену
  const b = boss;
  b.state = 'curtain'; b.timer = SOV.curtain;
  b.dir = P.x + P.w / 2 < ARENA.left + 112 ? 1 : -1;     // метла идёт со стороны игрока и гонит его через арену
  b.sweep = b.dir > 0 ? ARENA.left + 20 : LEVEL_W - 24;
  b.boltT = 0;
  snd('tell', b.x); shake = 5;
}

function updateSovereign() {
  const b = boss, rage = bossRage();
  switch (b.state) {
    case 'idle':
      if (state === 'play' && P.x >= ARENA.trigger) { bossAwake(); b.timer = 100; }
      break;
    case 'wake':
      if (b.timer > 58) b.x += (frame % 2 ? 1 : -1) * 0.5;                  // кольцо дрожит на постаменте
      else b.y = Math.max(SOV.top, b.y - 1.6);                              // поднимается
      if (b.timer % 10 === 0) spawnParticles(b.x + 22, b.y + 34, 5, ['#ffb02e', '#6b5c74'], 2, 0.08, 22);
      if (--b.timer <= 0) { b.state = 'reign'; b.timer = SOV.reign; b.boltT = 60; }
      break;
    case 'reign': {                                                        // парит под потолком и давит искрами
      const tx = clamp(P.x + P.w / 2 - 22, ARENA.xMin, ARENA.xMax);
      b.x += clamp((tx - b.x) * 0.02, -0.75, 0.75);
      b.y += clamp(SOV.top + Math.sin(b.t / 22) * 4 - b.y, -0.7, 0.7);
      if (--b.boltT <= 0) { fireRegalia(); b.boltT = 78 - rage * 8; }
      if (rage >= 3 && b.t % 110 === 0) dropShard(sovDropX());
      if (--b.timer <= 0) {                                                // выбирает трон подальше от игрока
        let tx2 = b.x;
        for (let i = 0; i < 14; i++) {
          tx2 = ARENA.xMin + Math.random() * (ARENA.xMax - ARENA.xMin);
          if (Math.abs(tx2 + 22 - (P.x + P.w / 2)) > 72) break;
        }
        b.state = 'throne'; b.anchorX = tx2; b.timer = 54 - rage * 3;
        snd('tell', b.x);
      }
      break;
    }
    case 'throne': {                                                       // встаёт на трон — телеграф
      b.x += clamp(b.anchorX - b.x, -3.2, 3.2);
      b.y += clamp(SOV.throne - b.y, -1.6, 1.6);
      if (b.timer % 8 === 0) spawnParticles(b.x + 22, b.y + 30, 4, ['#ffe9a8', '#ffb02e'], 2, 0.03, 20);
      // отсчёт телеграфа идёт только когда корона встала: столб не должен ехать
      const set = Math.abs(b.anchorX - b.x) < 2 && Math.abs(SOV.throne - b.y) < 2;
      if (set && --b.timer <= 0) { b.state = 'tether'; b.timer = 0; releaseOrb(); }
      break;
    }
    case 'tether':                                                         // привязь: корона стоит, осколок охотится
      if (!b.orb) { sovCurtain(); break; }                                 // страховка от зависания без осколка
      b.y = SOV.throne + Math.sin(b.t / 18) * 1.5;
      if (rage >= 2 && b.t % (104 - rage * 12) === 0) dropShard(sovDropX());
      break;
    case 'curtain': {                                                      // занавес осколков метёт арену
      b.y += clamp(SOV.top + 6 - b.y, -1.4, 1.4);
      b.x += clamp(clamp(b.sweep - 22, ARENA.xMin, ARENA.xMax) - b.x, -2.6, 2.6);
      if (--b.boltT <= 0) {
        // метла всегда медленнее бега: с яростью занавес не разгоняется, а густеет
        dropShard(clamp(b.sweep, ARENA.left + 24, LEVEL_W - 26));
        b.sweep += b.dir * (20 - rage * 2);
        b.boltT = 12;
      }
      if (--b.timer <= 0) { b.state = 'reign'; b.timer = SOV.reign - rage * 16; b.boltT = 50; }
      break;
    }
    case 'recoil':                                                         // деление сбито: кольцо кренится и уходит вверх
      b.x += (frame % 2 ? 1 : -1) * 0.7;
      b.y = Math.max(SOV.top - 6, b.y - 0.9);
      if (b.timer % 6 === 0) spawnParticles(b.x + 22, b.y + 17, 6, ['#ffb02e', '#fff4ef', '#7a3cff'], 2.6, 0.04, 24);
      if (--b.timer <= 0) {
        b.state = 'reign'; b.timer = SOV.reign - rage * 16; b.boltT = 46;
        if (rage >= 3) { spawnSeeker(-1); spawnSeeker(1); }                // израненная корона зовёт искателей
      }
      break;
  }
  updateOrb();
}


// ---------- босс 4: HOARFROST (GLACIAL DESCENT) ----------
//  Этот бой идёт не вдоль арены, а вверх по ней. Колосс стоит в криовзвеси,
//  и взвесь всё время прибывает: нижние карнизы уходят под лёд, игрок лезет выше,
//  а колосс поднимается вместе с ней и остаётся в досягаемости.
//  Топтать броню нельзя. Он наводится на колонну, в которой стоит игрок, и бьёт
//  вверх столбом стужи до самого потолка — уйти можно только вбок. Колонна
//  намечается в начале наводки и дальше не следует за игроком: разметка — честное
//  предупреждение, у которого есть ответ, а не приговор. После столба
//  он выдыхается и раскрывает корону: вот тогда на макушку и надо спрыгнуть.
//  Каждое деление сбрасывает взвесь на три тайла — воздух выигрывается попаданиями.
const HOAR = { swim: 200, aim: 54, erupt: 66, spent: 155, jetW: 30 };
const hoarTop = () => boss.flood - BOSS_BOX.hoarfrost.h + 14;    // по пояс во взвеси
const hoarJet = () => ({ x: boss.jetX - HOAR.jetW / 2, y: ARENA.top,
                         w: HOAR.jetW, h: Math.max(0, boss.flood - ARENA.top) });
// колонна выбирается один раз, в начале наводки, и дальше не ездит за игроком
const hoarColumn = () => clamp(P.x + P.w / 2, ARENA.left + 26, LEVEL_W - 26);

function fireHail() {                                 // веер ледяных осколков в игрока
  const b = boss, sx = b.x + 24, sy = b.y + 12;
  const base = Math.atan2(P.y + P.h / 2 - sy, P.x + P.w / 2 - sx);
  for (const off of [-0.26, 0, 0.26]) {
    const spd = 2.6 + bossRage() * 0.14;
    shots.push({ x: sx, y: sy, vx: Math.cos(base + off) * spd, vy: Math.sin(base + off) * spd,
                 g: 0.05, r: 3, life: 300, cols: ['#09202f', '#7fe9f5', '#eaffff'] });
  }
  snd('hail', sx);
  spawnParticles(sx, sy, 6, ['#7fe9f5', '#eaffff'], 1.6, 0, 14);
}
function hoarShardFall() {                            // сосульки с потолка арены, вразнобой
  const x = ARENA.left + 28 + Math.random() * (LEVEL_W - 56 - ARENA.left);
  shots.push({ x, y: ARENA.top + 10, vx: 0, vy: 1.2, g: 0.11, r: 3, life: 320,
               cols: ['#09202f', '#7fe9f5', '#eaffff'] });
  snd('drop', x);
}

function updateHoarfrost() {
  const b = boss, rage = bossRage();
  const floodTop = ARENA.top + 5 * T;                  // выше взвесь не поднимается — воздух остаётся всегда
  if (bossActive() && b.state !== 'dying') b.flood = Math.max(floodTop, b.flood - FLOOD.rise);
  switch (b.state) {
    case 'idle':
      if (state === 'play' && P.y >= ARENA.trigger) { bossAwake(); b.timer = 110; }
      break;
    case 'wake':
      b.y += clamp(hoarTop() - b.y, -1.4, 1.4);
      if (b.timer % 9 === 0) spawnParticles(b.x + 24, b.flood, 8, ['#7fe9f5', '#eaffff'], 2.6, 0.04, 26);
      if (--b.timer <= 0) { b.state = 'swim'; b.timer = HOAR.swim; b.boltT = 60; }
      break;
    case 'swim': {                                     // бродит по взвеси и кидает осколки
      const tx = clamp(P.x + P.w / 2 - 24, ARENA.xMin, ARENA.xMax);
      b.x += clamp((tx - b.x) * 0.03, -0.6, 0.6);
      b.y = hoarTop() + Math.sin(b.t / 20) * 2;
      if (--b.boltT <= 0) { fireHail(); b.boltT = 92 - rage * 10; }
      if (rage >= 2 && b.t % (150 - rage * 14) === 0) hoarShardFall();
      if (--b.timer <= 0) {
        b.state = 'aim'; b.timer = HOAR.aim - rage * 3; b.jetX = hoarColumn(); snd('tell', b.x);
      }
      break;
    }
    case 'aim':                                        // колонна уже выбрана: только разметка и рёв
      b.y = hoarTop() + (frame % 2);
      if (b.timer % 6 === 0)
        spawnParticles(b.jetX, b.flood - 4, 4, ['#7fe9f5', '#eaffff'], 2, -0.06, 20);
      if (--b.timer <= 0) { b.state = 'erupt'; b.timer = HOAR.erupt + rage * 6; snd('jet', b.jetX); shake = 6; }
      break;
    case 'erupt':                                      // столб стужи до самого потолка
      b.y = hoarTop();
      if (frame % 3 === 0)
        spawnParticles(b.jetX + (Math.random() - 0.5) * HOAR.jetW,
                       ARENA.top + Math.random() * Math.max(1, b.flood - ARENA.top),
                       2, ['#eaffff', '#7fe9f5'], 1.4, -0.08, 22);
      if (--b.timer <= 0) { b.state = 'spent'; b.timer = HOAR.spent - rage * 14; SFX.play('bossOpen'); }
      break;
    case 'spent':                                      // выдохся: корона раскрыта, ядро можно топтать
      b.y = hoarTop() + Math.sin(b.t / 9) * 1.2;
      if (b.t % 12 === 0) spawnParticles(b.x + 24, b.y + 2, 4, ['#9bf0ff', '#f0ffff'], 1.8, -0.03, 22);
      if (--b.timer <= 0) { b.state = 'swim'; b.timer = HOAR.swim - rage * 16; b.boltT = 70; }
      break;
    case 'recoil':                                     // деление сбито: взвесь ушла вниз, он оседает
      b.y += clamp(hoarTop() - b.y, -2.2, 2.2);
      if (b.timer % 7 === 0) spawnParticles(b.x + 24, b.y + 16, 6, ['#7fe9f5', '#eaffff', '#ff6b9d'], 2.6, 0.05, 24);
      if (--b.timer <= 0) { b.state = 'swim'; b.timer = HOAR.swim - rage * 16; b.boltT = 55; }
      break;
  }
}

// ---------- главный такт ----------
function update() {
  frame++;
  updateMovers();
  updateDrones();
  updateCrawlers();
  updateTurrets();
  updateLeapers();
  updateSeekers();
  updateDrifters();
  updateSkaters();
  updateHowlers();
  updateCrumbles();
  updatePresses();
  updateSaws();
  updateGates();
  updateGusts();
  updateIcicles();
  updateBoss();
  updateParticles();
  if (state === 'play') { elapsed++; if (intro > 0) intro--; updatePlayer(); }
  else if (state === 'dead') { if (--deadTimer <= 0) reset(false); }
  else if (state === 'clear') { if (inp.jumpPressed()) nextLevel(); }
  if (pressed.KeyR) { if (state === 'win') restartRun(); else reset(true); }
  if (cheatQueued) {
    if (cheatQueued.next) { if (levelIdx < LEVELS.length - 1) { nextLevel(); cheatMsg = 150; } }
    else cheatWarp(Math.min(cheatQueued.lv, LEVELS.length - 1), cheatQueued.boss);
    cheatQueued = null;
  }
  if (cheatMsg > 0) cheatMsg--;
  if (toastT > 0) toastT--;
  if (pressed.KeyM) toast(SFX.toggleSound() ? 'SOUND ON' : 'SOUND OFF');
  if (pressed.KeyB) toast(SFX.toggleMusic() ? 'MUSIC ON' : 'MUSIC OFF');
  // фазовые плиты: тик на смене такта, если они на экране
  if (ents.phases.length) {
    const ps = phaseStage(0) * 3 + phaseStage(1);
    if (ps !== lastPhase && (phaseStage(0) === 1 || phaseStage(1) === 1) &&
        ents.phases.some(q => onScreen(q.x))) SFX.play('phase');
    lastPhase = ps;
  }
  // непрерывные источники: поток вентилятора, луч SOVEREIGN, пурга и столб HOARFROST
  SFX.loop('vent', state === 'play' && P.lift > 0);
  const orb = boss.kind === 'sovereign' ? boss.orb : null;
  SFX.loop('tether', state === 'play' && !!orb && orb.mode !== 'back', { pan: panOf(orb ? orb.x : 0) });
  SFX.loop('blow', state === 'play' && ents.gusts.some(q => q.w && gustStage(q) === 2 && onScreen(q.x, q.y)));
  SFX.loop('jet', state === 'play' && boss.kind === 'hoarfrost' && boss.state === 'erupt',
           { pan: panOf(boss.jetX) });
  if (pressed.KeyC) { const s = document.getElementById('scan'); s.style.display = s.style.display === 'block' ? 'none' : 'block'; }
  // камера: по горизонтали смотрит вперёд по бегу, по вертикали — вслед за падением
  const tx = bossActive() && !ARENA.vert ? LEVEL_W - W : P.x + P.w / 2 - W / 2 + (VERT ? 0 : P.face * 24);
  cam.x += (tx - cam.x) * 0.08;
  cam.x = clamp(cam.x, 0, LEVEL_W - W);
  if (LEVEL_H > H) {
    const ty = P.y + P.h / 2 - H / 2 + clamp(P.vy * 9, -28, 46);
    cam.y += (ty - cam.y) * 0.1;
    cam.y = clamp(cam.y, bossActive() && ARENA.vert ? ARENA.top : 0, LEVEL_H - H);
  } else cam.y = 0;
  if (shake > 0) shake--;
  for (const k in pressed) pressed[k] = false;
}

// ---------- отрисовка ----------
// слои фона повторяются по обеим осям: у вертикального уровня они стыкуются и по высоте
function drawParallax(img, factor) {
  const w = img.width, h = img.height;
  const ox = -((cam.x * factor) % w), oy = -(((cam.y * factor) % h + h) % h);
  for (let y = oy; y < H; y += h)
    for (let x = ox; x < W; x += w) ctx.drawImage(img, Math.round(x), Math.round(y));
}

function draw() {
  const cx = Math.round(cam.x) + (shake > 0 ? Math.round((Math.random() - 0.5) * shake) : 0);
  const cy = Math.round(cam.y);
  const sy = shake > 0 ? Math.round((Math.random() - 0.5) * shake * 0.5) : 0;
  ctx.setTransform(1, 0, 0, 1, 0, sy);

  // фон
  drawParallax(TH.bg.far, 0.05);
  drawParallax(TH.bg.mid, 0.25);
  drawParallax(TH.bg.near, 0.5);

  ctx.translate(-cx, -cy);

  // анимированный декор (за уровнем — светильники/консоли/кристаллы)
  for (const a of ents.anim) {
    if (!onScreen(a.x, a.y)) continue;
    if (a.kind === 'wallLight') ctx.drawImage(TL.wallLight[Math.floor((frame + a.x) / 40) % 2], a.x, a.y);
    else if (a.kind === 'console') ctx.drawImage(TL.console[Math.floor((frame + a.x) / 20) % 2], a.x, a.y);
    else if (a.kind === 'crystal') ctx.drawImage(TL.crystal[Math.floor((frame + a.x) / 30) % 2], a.x, a.y);
  }
  // портал (тусклый и заблокированный, пока жив босс)
  if (ents.portal) {
    const locked = boss.state !== 'dead';
    if (locked) ctx.globalAlpha = 0.35;
    ctx.drawImage(TH.portal[Math.floor(frame / 8) % 2], ents.portal.x, ents.portal.y);
    ctx.globalAlpha = 1;
    if (locked && Math.floor(frame / 20) % 2) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(ents.portal.x + 14, ents.portal.y + 14, 4, 4); }
  }

  // разлом пустоты и криовзвесь (под тайлами: грунт перекрывает их кромку)
  for (const r of ents.rifts) {
    if (!onScreen(r.x, r.y)) continue;
    ctx.drawImage(r.top ? A.rift.top[Math.floor((frame + r.x / 8) / 9) % 3]
                        : A.rift.body[Math.floor((frame + r.y) / 14) % 2], r.x, r.y);
  }
  for (const r of ents.cryos) {
    if (!onScreen(r.x, r.y)) continue;
    ctx.drawImage(r.top ? A.cryo.top[Math.floor((frame + r.x / 8) / 10) % 3]
                        : A.cryo.body[Math.floor((frame + r.y) / 14) % 2], r.x, r.y);
  }

  // тайлы
  ctx.drawImage(levelCanvas, cx, cy, W, H, cx, cy, W, H);

  // конвейерные ленты и фазовые плиты
  for (const b of ents.belts) {
    if (!onScreen(b.x, b.y)) continue;
    ctx.drawImage(TL.belt[b.dir > 0 ? 1 : 0][Math.floor(frame / 5) % 4], b.x, b.y);
  }
  for (const f of ents.phases) {
    if (!onScreen(f.x, f.y)) continue;
    const st = phaseStage(f.group);
    ctx.drawImage(TL.phase[f.group][st === 1 && frame % 8 < 4 ? 0 : st], f.x, f.y);
  }

  // расплав (анимированная поверхность)
  for (const m of ents.melt) if (m.top && onScreen(m.x, m.y))
    ctx.drawImage(TL.meltTop[Math.floor((frame + m.x / 8) / 12) % 2], m.x, m.y);

  // шипы, пружины, вентиляторы, осыпающиеся плиты
  for (const a of ents.anim) if (a.kind === 'spikes' && onScreen(a.x, a.y)) ctx.drawImage(TL.spikes[Math.floor((frame + a.x / 4) / 10) % 2], a.x, a.y);
  for (const s of ents.springs) ctx.drawImage(TL.spring[s.timer > 6 ? 1 : 0], s.x, s.y);
  for (const v of ents.vents) {
    if (!onScreen(v.x, v.y)) continue;
    ctx.drawImage(TL.vent[Math.floor(frame / 5) % 2], v.x, v.tileY);
    ctx.globalAlpha = 0.2; ctx.fillStyle = LV.fx.lift[0];
    ctx.fillRect(v.x + 2, v.y, 12, v.h);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {                       // восходящие «шевроны»
      const y = v.y + v.h - ((frame * 2.2 + i * v.h / 6) % v.h);
      const w = 4 + (i % 2) * 2, x = v.x + 8 - w / 2 + ((i * 5) % 7) - 3;
      ctx.fillStyle = LV.fx.lift[i % 2];
      ctx.fillRect(Math.round(x), Math.round(y), w, 2);
      ctx.fillRect(Math.round(x) + 1, Math.round(y) + 2, w - 2, 1);
    }
  }
  for (const c of ents.crumbles) {
    if (c.st === 2 || !onScreen(c.x, c.y)) continue;
    const sh = c.st === 1 ? ((frame % 4 < 2) ? 1 : -1) : 0;
    ctx.drawImage(TL.crumble[c.st === 0 ? 0 : (c.t < CRUMBLE.hold / 2 ? 2 : 1)], c.x + sh, c.y);
  }

  // прессы: штанга-шахта до перекрытия + голова
  for (const p of ents.presses) {
    if (!onScreen(p.x, p.y)) continue;
    for (let y = p.y - T; y >= p.y0; y -= T) ctx.drawImage(TL.shaft, p.x, y);
    const sh = p.st === 1 ? ((frame % 4 < 2) ? 1 : -1) : 0;
    ctx.drawImage(TL.press[p.st === 1 || p.st === 2 ? 1 : 0], p.x + sh, Math.round(p.y));
    if (p.st === 1 && frame % 6 < 3) {             // отметка зоны удара
      ctx.fillStyle = '#ffb02e';
      for (let y = p.y + 18; y < p.y1 + 16; y += 8) ctx.fillRect(p.x + 7, y, 2, 3);
    }
  }
  // пилы: рельса и диск
  for (const q of ents.saws) {
    if (!onScreen(q.x, q.y)) continue;
    ctx.fillStyle = '#3b2d44'; ctx.fillRect(q.minX + 8, q.y + 13, q.maxX - q.minX + 1, 2);
    ctx.fillStyle = '#6b5c74'; ctx.fillRect(q.minX + 8, q.y + 13, q.maxX - q.minX + 1, 1);
    ctx.drawImage(TH.saw[Math.floor(frame / 3) % 4], Math.round(q.x), q.y);
  }

  // сталактиты: висят, трещат, падают
  for (const i of ents.icicles) {
    if (i.st === 3 || !onScreen(i.x, i.y)) continue;
    const sh = i.st === 1 && frame % 4 < 2 ? 1 : 0;
    ctx.drawImage(TL.icicle[Math.min(2, i.st)], i.x + sh, Math.round(i.y));
  }
  // раструбы пурги: сам раструб и струи вдоль полосы
  for (const q of ents.gusts) {
    if (!onScreen(q.x, q.y)) continue;
    const st = gustStage(q);
    ctx.drawImage(TL.blower[q.dir > 0 ? 1 : 0][st], q.x, q.y);
    if (!q.w || st === 0) continue;
    if (st === 1) {                                     // предупреждение — пунктир вдоль полосы
      if (frame % 6 < 3) {
        ctx.fillStyle = '#ffd76b';
        for (let x = q.tx + 2; x < q.tx + q.w; x += 8) ctx.fillRect(x, q.top + q.h / 2 - 1, 3, 2);
      }
      continue;
    }
    for (let i = 0; i < 16; i++) {                      // струи пурги
      const off = (frame * 3.4 + i * 37) % q.w;
      const x = q.dir > 0 ? q.tx + off : q.tx + q.w - off;
      const y = q.top + 2 + ((i * 11 + Math.floor(frame / 4)) % Math.max(1, q.h - 4));
      ctx.fillStyle = i % 3 ? '#a5d8e2' : '#f0ffff';
      ctx.fillRect(Math.round(x), Math.round(y), 5, 1);
    }
  }

  // движущиеся платформы
  for (const m of ents.movers) {
    ctx.drawImage(TH.moving, Math.round(m.x), Math.round(m.y));
    if (frame % 4 < 2) { ctx.fillStyle = LV.accent; ctx.fillRect(Math.round(m.x) + 4, Math.round(m.y) + 8, 2, 2); ctx.fillRect(Math.round(m.x) + 26, Math.round(m.y) + 8, 2, 2); }
  }

  // ячейки
  for (const c of ents.cells) if (!c.taken) ctx.drawImage(A.cell[Math.floor(c.t / 10) % 2], c.x, Math.round(c.y + Math.sin(c.t / 12) * 2));

  // враги
  for (const d of ents.drones) if (d.alive) {
    const bob = Math.round(Math.sin(d.t / 10) * 1.5);
    ctx.drawImage(TH.drone[Math.floor(d.t / 6) % 2][d.dir > 0 ? 0 : 1], Math.round(d.x), Math.round(d.y) + bob);
  }
  for (const c of ents.crawlers) if (c.alive)
    ctx.drawImage(TH.crawler[Math.floor(c.t / 8) % 2][c.dir > 0 ? 0 : 1], Math.round(c.x), Math.round(c.y));
  for (const t of ents.turrets) if (t.alive)
    ctx.drawImage(TH.turret[turretCharging(t) && frame % 6 < 3 ? 1 : 0][t.dir > 0 ? 0 : 1], t.x, t.y);
  for (const l of ents.leapers) if (l.alive) {
    const pose = l.st === 2 ? 'air' : l.st === 1 ? 'crouch' : 'idle';
    const sh = l.st === 1 && frame % 4 < 2 ? 1 : 0;
    ctx.drawImage(TH.leaper[pose][l.dir > 0 ? 0 : 1], Math.round(l.x) + sh, Math.round(l.y));
  }
  for (const k of ents.seekers) if (k.alive) {
    const bob = Math.round(Math.sin(k.t / 14) * 1.5);
    ctx.drawImage(TH.seeker[Math.floor(k.t / 9) % 2][k.vx > 0 ? 0 : 1], Math.round(k.x), Math.round(k.y) + bob);
  }

  for (const d of ents.drifters) if (d.alive && onScreen(d.x, d.y)) {
    const sway = Math.round(Math.sin(d.t / 16) * 1.5);
    ctx.drawImage(TH.drifter[Math.floor(d.t / 10) % 2][d.dir > 0 ? 0 : 1], Math.round(d.x) + sway, Math.round(d.y));
  }
  for (const k of ents.skaters) if (k.alive && onScreen(k.x, k.y))
    ctx.drawImage(TH.skater[Math.floor(k.t / 6) % 2][k.dir > 0 ? 0 : 1], Math.round(k.x), Math.round(k.y));
  for (const h of ents.howlers) {
    if (!onScreen(h.x, h.y)) continue;
    const sh = howlerCharging(h) && frame % 4 < 2 ? 1 : 0;
    ctx.drawImage(TH.howler[howlerCharging(h) ? 1 : 0][0], h.x + sh, h.y);
  }

  // лазерные затворы
  for (const g of ents.gates) {
    if (!onScreen(g.x, g.y)) continue;
    const st = gateStage(g);
    ctx.drawImage(TL.gate[st], g.x, g.y);
    if (st === 1 && frame % 6 < 3) {                    // предупреждение — пунктир
      ctx.fillStyle = '#ffe14a';
      for (let y = g.beamY; y < g.beamY + g.beamH; y += 6) ctx.fillRect(g.x + 7, y, 2, 3);
    } else if (st === 2) {
      ctx.fillStyle = '#8a1a1a'; ctx.fillRect(g.x + 5, g.beamY, 6, g.beamH);
      ctx.fillStyle = '#ff3b3b'; ctx.fillRect(g.x + 6, g.beamY, 4, g.beamH);
      ctx.fillStyle = frame % 4 < 2 ? '#e6ecff' : '#ffe14a'; ctx.fillRect(g.x + 7, g.beamY, 2, g.beamH);
      ctx.fillStyle = '#ff3b3b';
      const fy = g.beamY + g.beamH - 3;
      ctx.fillRect(g.x + 3 + (frame % 3), fy, 10 - (frame % 3) * 2, 3);
    }
  }

  // резонансный столб SOVEREIGN: в нём отбитый осколок уходит обратно в корону
  if (boss.kind === 'sovereign' && boss.orb) {
    const c = sovColumn();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffb02e'; ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.globalAlpha = 1;
    for (let y = c.y; y < c.y + c.h; y += 2) {                 // дизер по кромкам столба
      if ((y + frame) % 6 < 3) continue;
      ctx.fillStyle = '#ffe9a8'; ctx.fillRect(c.x, y, 1, 1); ctx.fillRect(c.x + c.w - 1, y, 1, 1);
    }
    for (let i = 0; i < 4; i++) {                              // шевроны бегут вверх — «сюда»
      const y = c.y + c.h - 6 - ((frame * 1.4 + i * 26) % (c.h - 8));
      ctx.fillStyle = i % 2 ? '#ffb02e' : '#ffe9a8';
      for (let k = 0; k < 5; k++) {                            // «галочки» остриём вверх
        ctx.fillRect(c.x + c.w / 2 - 4 + k, y + 4 - k, 1, 1); ctx.fillRect(c.x + c.w / 2 + 4 - k, y + 4 - k, 1, 1);
      }
    }
    const fy = ARENA.floorY - 4;                               // площадка на полу
    ctx.fillStyle = '#a8670c'; ctx.fillRect(c.x, fy, c.w, 4);
    ctx.fillStyle = frame % 8 < 4 ? '#ffb02e' : '#ffe9a8'; ctx.fillRect(c.x, fy, c.w, 2);
    ctx.fillStyle = '#fff4ef';
    for (const bx of [c.x, c.x + c.w - 6]) ctx.fillRect(bx, fy - 3, 6, 2);
  }

  // криовзвесь, которую гонит вверх HOARFROST, и его столб стужи
  if (boss.kind === 'hoarfrost' && bossActive() && boss.flood < ARENA.floorY) {
    const fy = Math.round(boss.flood);
    ctx.fillStyle = '#09202f';
    ctx.fillRect(ARENA.left, fy + T, LEVEL_W - ARENA.left, ARENA.floorY - fy);
    for (let x = ARENA.left; x < LEVEL_W; x += T)
      ctx.drawImage(A.cryo.top[Math.floor((frame + x / 8) / 10) % 3], x, fy);
    for (let i = 0; i < 12; i++) {                      // искры в толще
      const x = ARENA.left + (i * 53 + frame * 2) % (LEVEL_W - ARENA.left);
      const y = fy + 20 + ((i * 37 + frame) % Math.max(1, ARENA.floorY - fy));
      ctx.fillStyle = i % 3 ? '#1d6f88' : '#7fe9f5';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
  if (boss.kind === 'hoarfrost' && (boss.state === 'aim' || boss.state === 'erupt')) {
    const j = hoarJet();
    if (boss.state === 'aim') {                         // разметка колонны — телеграф
      if (frame % 6 < 3) {
        ctx.fillStyle = '#ffd76b';
        for (let y = j.y; y < j.y + j.h; y += 8) { ctx.fillRect(j.x, y, 2, 4); ctx.fillRect(j.x + j.w - 2, y, 2, 4); }
      }
    } else {
      ctx.fillStyle = '#1d6f88'; ctx.fillRect(j.x, j.y, j.w, j.h);
      ctx.fillStyle = '#7fe9f5'; ctx.fillRect(j.x + 4, j.y, j.w - 8, j.h);
      ctx.fillStyle = frame % 4 < 2 ? '#eaffff' : '#f0ffff'; ctx.fillRect(j.x + 11, j.y, 8, j.h);
      for (let i = 0; i < 12; i++) {                    // иглы стужи летят вверх
        const y = j.y + j.h - ((frame * 5 + i * 31) % Math.max(1, j.h));
        ctx.fillStyle = '#eaffff';
        ctx.fillRect(j.x + 3 + ((i * 7) % (j.w - 6)), Math.round(y), 2, 5);
      }
    }
  }

  // энергобарьер арены: у вертикальной шахты он не сбоку, а над головой
  if (bossActive()) {
    if (ARENA.vert) {
      const by = ARENA.top + 12;
      for (let x = ARENA.left; x < LEVEL_W; x += 4) {
        if ((x / 4 + Math.floor(frame / 3)) % 3 === 0) continue;
        ctx.fillStyle = (x / 4 + frame) % 7 === 0 ? '#e6ecff' : LV.accent2; ctx.fillRect(x, by, 3, 2);
      }
    } else {
      const bx = ARENA.left + 14;
      for (let y = 0; y < ARENA.floorY; y += 4) {
        if ((y / 4 + Math.floor(frame / 3)) % 3 === 0) continue;
        ctx.fillStyle = (y / 4 + frame) % 7 === 0 ? '#e6ecff' : LV.accent2; ctx.fillRect(bx, y, 2, 3);
      }
    }
  }
  drawBoss();

  // игрок
  if (state !== 'dead') {
    let key;
    if (!P.grounded) key = P.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(P.vx) > 0.3) key = ['run0', 'run1', 'run2', 'run1'][Math.floor(P.animT / 2.2) % 4];
    else key = 'idle';
    const img = A.player[key][P.face > 0 ? 0 : 1];
    const bob = (key === 'run1') ? -1 : 0;
    const dx = Math.round(P.x) - 3, dy = Math.round(P.y) + bob;
    if (P.squash > 0) {  // сплющивание при приземлении
      const s = P.squash / 6;
      ctx.drawImage(img, 0, 0, 16, 20, dx - Math.round(2 * s), dy + Math.round(3 * s), 16 + Math.round(4 * s), 20 - Math.round(3 * s));
    } else ctx.drawImage(img, dx, dy);
  }

  // снаряды
  for (const s of shots) {
    const x = Math.round(s.x), y = Math.round(s.y);
    ctx.fillStyle = s.cols[0]; ctx.fillRect(Math.round(s.x - s.vx * 3) - 1, Math.round(s.y - s.vy * 3) - 1, 2, 2);
    ctx.fillStyle = s.cols[1]; ctx.fillRect(x - s.r, y - s.r, s.r * 2, s.r * 2);
    ctx.fillStyle = s.cols[2]; ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  // ударные волны (WARDEN)
  for (const w of waves) {
    const x = Math.round(w.x), fy = ARENA.floorY, f = w.t % 4 < 2;
    ctx.fillStyle = '#b25a12'; ctx.fillRect(x - 4, fy - 3, 8, 3);
    ctx.fillStyle = '#ff9a2e'; ctx.fillRect(x - 3, fy - 6, 6, 3);
    ctx.fillStyle = '#ffe14a'; ctx.fillRect(x - (f ? 2 : 1), fy - (f ? 8 : 7), f ? 4 : 2, 2);
  }

  // частицы
  for (const p of particles) { ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.life > 10 ? 2 : 1, p.life > 10 ? 2 : 1); }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHud();
}

function drawBoss() {
  const b = boss, d = bossDef();
  if (b.state === 'dead') return;
  const img = b.kind === 'warden' ? wardenFrame() : b.kind === 'rootmind' ? rootmindFrame()
            : b.kind === 'sovereign' ? sovereignFrame() : hoarfrostFrame();
  const bx = Math.round(b.x), by = Math.round(b.y);
  // шаг сквозь пространство: растворился — проявился на новом месте
  if (b.state === d.ghost) ctx.globalAlpha = b.timer > 20 ? (b.timer - 20) / 20 : 1 - b.timer / 20;
  // щит (пунктир) — когда босс неуязвим; у короны-разлома вместо рамки свои осколки
  if (d.ring) drawCrownShards();
  else if (d.shield.includes(b.state)) {
    ctx.fillStyle = frame % 8 < 4 ? LV.accent : LV.accent2;
    const x0 = bx - 3, y0 = by - 3, w = d.w + 6, h = d.h + 6, o = frame % 3;
    for (let i = o; i < w; i += 3) { ctx.fillRect(x0 + i, y0, 1, 1); ctx.fillRect(x0 + i, y0 + h, 1, 1); }
    for (let i = o; i < h; i += 3) { ctx.fillRect(x0, y0 + i, 1, 1); ctx.fillRect(x0 + w, y0 + i, 1, 1); }
  }
  ctx.drawImage(img, bx, by);
  ctx.globalAlpha = 1;
  if (d.ring) drawTetherOrb();
}
// осколки короны по кругу: сколько делений осталось — столько и осколков,
// на привязи один из них снят и висит на луче
function drawCrownShards() {
  const b = boss, c = sovRing();
  const n = b.hp - (b.orb ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const a = b.t * 0.018 + i * Math.PI * 2 / Math.max(1, n);
    const x = Math.round(c.x + Math.cos(a) * 30), y = Math.round(c.y + Math.sin(a) * 30);
    ctx.fillStyle = '#a8670c'; ctx.fillRect(x - 2, y - 2, 5, 5);           // огранка
    ctx.fillStyle = frame % 10 < 5 ? '#ffb02e' : '#ffe9a8';
    ctx.fillRect(x - 1, y - 3, 2, 7); ctx.fillRect(x - 3, y - 1, 7, 2);    // ромб
    ctx.fillStyle = '#fff4ef'; ctx.fillRect(x - 1, y - 1, 2, 2);
  }
}
// привязь и сам осколок: золотой на охоте, добела раскалённый на возврате
function drawTetherOrb() {
  const b = boss, o = b.orb;
  if (!o) return;
  const c = sovRing(), ox = Math.round(o.x), oy = Math.round(o.y);
  const dx = ox - c.x, dy = oy - c.y, len = Math.max(1, Math.hypot(dx, dy));
  for (let i = 6; i < len; i += 4) {                       // пунктирная привязь
    if (o.mode !== 'back' && (i / 4 + Math.floor(frame / 2)) % 3 === 0) continue;
    // чередуем белый с тёмным фиолетом — привязь видно и на золоте столба, и на фоне
    ctx.fillStyle = o.mode === 'back' ? '#fff4ef' : (i / 4 + Math.floor(frame / 3)) % 2 ? '#fff4ef' : '#3a1a66';
    ctx.fillRect(Math.round(c.x + dx / len * i), Math.round(c.y + dy / len * i), 1, 1);
  }
  const hot = o.mode === 'back';
  // остывший осколок (после отброса) гаснет до пепельного, а за 20 кадров до
  // возвращения в строй начинает мигать — видно, когда он снова кусается
  const cold = o.cool > 0 && (o.cool > 20 || frame % 6 < 3);
  ctx.fillStyle = cold ? '#3a3040' : '#2e1358';            // тёмная оправа — осколок виден и внутри столба
  ctx.fillRect(ox - 7, oy - 5, 14, 10); ctx.fillRect(ox - 5, oy - 7, 10, 14);
  ctx.fillStyle = hot ? '#ffe9a8' : cold ? '#6b5c74' : '#a8670c'; ctx.fillRect(ox - 5, oy - 5, 10, 10);
  ctx.fillStyle = hot ? '#fff4ef' : cold ? '#877a90' : '#ffb02e'; ctx.fillRect(ox - 4, oy - 4, 8, 8);
  ctx.fillStyle = cold ? '#c6bac5' : '#fff4ef'; ctx.fillRect(ox - 2, oy - 2, 4, 4);
  ctx.fillStyle = hot ? '#ffb02e' : '#fff4ef';             // вращающиеся жала
  for (let i = 0; i < 4; i++) {
    const a = o.t * 0.15 + i * Math.PI / 2;
    ctx.fillRect(Math.round(ox + Math.cos(a) * 7) - 1, Math.round(oy + Math.sin(a) * 7) - 1, 2, 2);
  }
  if (o.mode !== 'back' && o.life < 70 && frame % 6 < 3) {  // вот-вот лопнет
    ctx.fillStyle = '#dcbcff';
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + o.t * 0.2;
      ctx.fillRect(Math.round(ox + Math.cos(a) * 10) - 1, Math.round(oy + Math.sin(a) * 10) - 1, 2, 2);
    }
  }
}
function wardenFrame() {
  const b = boss, S = A.boss;
  let img;
  switch (b.state) {
    case 'idle': img = S.dormant; break;
    case 'wake': img = b.timer > 60 ? S.dormant : S.hover[Math.floor(b.t / 4) % 2]; break;
    case 'aim': case 'slam': img = S.aim[Math.floor(b.t / 3) % 2]; break;
    case 'stun': img = S.stun[Math.floor(b.t / 8) % 2]; break;
    case 'recoil': img = S.stun[0]; break;
    case 'dying': img = S.stun[Math.floor(b.t / 4) % 2]; break;
    default: img = S.hover[Math.floor(b.t / 4) % 2];
  }
  return (b.flash > 0 && b.flash % 4 < 2) ? S.flash : img;
}
function rootmindFrame() {
  const b = boss, S = A.boss2;
  let img;
  switch (b.state) {
    case 'idle': img = S.dormant[0]; break;
    case 'wake': img = S.dormant[Math.floor(b.t / 6) % 2]; break;
    case 'tell': img = S.aim[Math.floor(b.t / 3) % 2]; break;
    case 'dash': img = S.dash[Math.floor(b.t / 3) % 2]; break;
    case 'open': case 'recoil': img = S.open[Math.floor(b.t / 10) % 2]; break;
    case 'dying': img = S.open[Math.floor(b.t / 4) % 2]; break;
    default: img = S.walk[Math.floor(b.t / 8) % 2];   // stalk / close
  }
  return (b.flash > 0 && b.flash % 4 < 2) ? S.flash : img;
}
function sovereignFrame() {
  const b = boss, S = A.boss3, sp = Math.floor(b.t / 6) % 4;
  if (b.flash > 0 && b.flash % 4 < 2) return S.flash;
  switch (b.state) {
    case 'idle': return S.dim[0];
    case 'wake': return (b.t % 14 < 7 ? S.dim : S.live)[sp];
    case 'throne': return S.tell[sp];
    case 'tether': return S.hot[sp];
    case 'curtain': return (Math.floor(b.t / 4) % 2 ? S.hot : S.tell)[sp];
    case 'recoil': return (b.flash > 0 || b.t % 8 < 4 ? S.dim : S.tell)[sp];
    case 'dying': return S.dim[sp];
    default: return S.live[sp];                 // reign
  }
}

function hoarfrostFrame() {
  const b = boss, S = A.boss4, sp = Math.floor(b.t / 7) % 4;
  if (b.flash > 0 && b.flash % 4 < 2) return S.flash;
  switch (b.state) {
    case 'idle': return S.dormant[0];
    case 'wake': return (b.t % 12 < 6 ? S.dormant : S.live)[sp];
    case 'aim': return S.tell[sp];
    case 'erupt': return S.hot[sp];
    case 'spent': return S.open[sp];
    case 'recoil': return S.dormant[sp];
    case 'dying': return S.open[sp];
    default: return S.live[sp];                 // swim
  }
}

// ---------- HUD ----------
function drawHud() {
  const got = ents.cells.filter(c => c.taken).length;
  const secs = Math.floor(elapsed / 60);
  const clock = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  ctx.fillStyle = 'rgba(11,11,26,0.55)'; ctx.fillRect(0, 0, W, 12);
  ctx.drawImage(A.cell[0], 4, 1);
  textShadow(`${got}/${totalCells}`, 15, 3, '#4dff88');
  textShadow(`TIME ${clock(secs)}`, 84, 3, '#aab4d4');
  const screen = VERT ? Math.floor((P.y + P.h / 2) / H) + 1 : Math.floor((P.x + P.w / 2) / W) + 1;
  const screens = VERT ? Math.ceil(LEVEL_H / H) : Math.ceil(LEVEL_W / W);
  textShadow(`AREA ${screen}/${screens}`, 170, 3, '#22e5ff');
  textShadow(LV.short, W - 4 - LV.short.length * 4, 3, LV.accent);

  if (bossActive()) {
    ctx.fillStyle = 'rgba(11,11,26,0.6)'; ctx.fillRect(W / 2 - 64, H - 20, 128, 18);
    textShadow(LV.bossName, mid(LV.bossName), H - 18, LV.accent);
    const n = LV.bossHp, bw = Math.floor(120 / n) - 3;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i < boss.hp ? (boss.flash > 0 ? '#e6ecff' : '#ff3b3b') : '#2c3355';
      ctx.fillRect(W / 2 - 60 + i * (bw + 3), H - 9, bw, 5);
    }
    if (boss.state === 'wake' && Math.floor(frame / 8) % 2) textShadow('WARNING', mid('WARNING', 2), 60, '#ff3b3b', 2);
  }
  if (cheatMsg > 0) {
    ctx.globalAlpha = Math.min(1, cheatMsg / 30);
    ctx.fillStyle = 'rgba(11,11,26,0.7)'; ctx.fillRect(W / 2 - 60, 20, 120, 13);
    textShadow(`CHEAT: ${cheatText}`, mid(`CHEAT: ${cheatText}`), 24, '#ff3fa8');
    ctx.globalAlpha = 1;
  }
  if (toastT > 0) {
    ctx.globalAlpha = Math.min(1, toastT / 30);
    ctx.fillStyle = 'rgba(11,11,26,0.7)'; ctx.fillRect(W / 2 - 44, 36, 88, 13);
    textShadow(toastText, mid(toastText), 40, '#ffe14a');
    ctx.globalAlpha = 1;
  }
  if (intro > 0 && state === 'play') {
    ctx.globalAlpha = Math.min(1, intro / 40);
    ctx.fillStyle = 'rgba(11,11,26,0.7)'; ctx.fillRect(0, 88, W, 44);
    textShadow('ORBITAR', mid('ORBITAR', 2), 96, '#22e5ff', 2);
    textShadow(LV.name, mid(LV.name), 116, '#aab4d4');
    ctx.globalAlpha = 1;
  }
  if (state === 'clear') {
    ctx.fillStyle = 'rgba(11,11,26,0.78)'; ctx.fillRect(0, 76, W, 72);
    textShadow('LEVEL CLEAR!', mid('LEVEL CLEAR!', 2), 84, '#ffe14a', 2);
    const line = `CELLS ${got}/${totalCells}   TIME ${clock(secs)}`;
    textShadow(line, mid(line), 106, '#e6ecff');
    const nx = `NEXT - ${LEVELS[levelIdx + 1].name}`;
    textShadow(nx, mid(nx), 120, LEVELS[levelIdx + 1].accent);
    if (Math.floor(frame / 30) % 2) textShadow('PRESS Z TO CONTINUE', mid('PRESS Z TO CONTINUE'), 134, '#22e5ff');
  }
  if (state === 'win') {
    const total = cellsBank + got, allCells = LEVELS.reduce((s, l) => s + (l.map.join('').split('*').length - 1), 0);
    const t = Math.floor((runTime + elapsed) / 60);
    ctx.fillStyle = 'rgba(11,11,26,0.8)'; ctx.fillRect(0, 76, W, 72);
    textShadow('MISSION COMPLETE', mid('MISSION COMPLETE', 2), 84, '#ffe14a', 2);
    const line = `CELLS ${total}/${allCells}   TIME ${clock(t)}`;
    textShadow(line, mid(line), 106, '#e6ecff');
    textShadow('ORBITAR SECURED', mid('ORBITAR SECURED'), 120, '#a8ff3d');
    if (Math.floor(frame / 30) % 2) textShadow('PRESS R TO RESTART', mid('PRESS R TO RESTART'), 134, '#22e5ff');
  }
}

// отладочный доступ к состоянию (для автотестов)
window.__dbg = () => ({ level: levelIdx + 1, x: P.x, y: P.y, vx: P.vx, vy: P.vy, state, cp, grounded: P.grounded,
  boss: { kind: boss.kind, state: boss.state, hp: boss.hp, x: Math.round(boss.x), y: Math.round(boss.y),
          orb: boss.orb && { x: Math.round(boss.orb.x), y: Math.round(boss.orb.y), mode: boss.orb.mode,
                             life: boss.orb.life, cool: boss.orb.cool, inColumn: sovInColumn(boss.orb.x) } },
  shots: shots.map(s => [Math.round(s.x), Math.round(s.y)]), waves: waves.map(w => Math.round(w.x)),
  cells: ents.cells.filter(c => c.taken).length, drones: ents.drones.filter(d => d.alive).length,
  crawlers: ents.crawlers.filter(c => c.alive).length, turrets: ents.turrets.filter(t => t.alive).length,
  crumbles: ents.crumbles.map(c => c.st), frame, jumping: P.jumping, coyote: P.coyote, jbuf: P.jbuf,
  cam: { x: Math.round(cam.x), y: Math.round(cam.y) }, wall: P.wall, gust: P.gust, ice: P.grounded && onIce(),
  icicles: ents.icicles.map(i => i.st), drifters: ents.drifters.filter(d => d.alive).length,
  skaters: ents.skaters.filter(k => k.alive).length, flood: Math.round(boss.flood || 0),
  leapers: ents.leapers.filter(l => l.alive).length, seekers: ents.seekers.filter(k => k.alive).length,
  presses: ents.presses.map(p => p.st), phase: [phaseStage(0), phaseStage(1)],
  mov: ents.movers.map(m => [Math.round(m.x), Math.round(m.y)]) });
window.__keys = keys;

// ---------- цикл ----------
let acc = 0, last = performance.now();
const STEP = 1000 / 60;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= STEP) { update(); acc -= STEP; }
  SFX.tick();
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
