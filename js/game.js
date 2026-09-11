// ============================================================
//  ORBITAR — игровой движок (два сектора)
// ============================================================
'use strict';
(() => {
const W = 320, H = 224, T = TILE, EPS = 0.001;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const A = buildAssets();
const LEVELS = [LEVEL1, LEVEL2];

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
// чит-коды: BOSS — на чекпоинт перед боссом, NEXT — сразу в следующий сектор
const CHEATS = { BOSS: 'boss', NEXT: 'next' };
const CHEAT_LEN = 4;
let cheatBuf = '', cheatMsg = 0, cheatText = '', cheatQueued = null;
window.addEventListener('keydown', e => {
  if (!/^Key[A-Z]$/.test(e.code) || e.repeat) return;
  cheatBuf = (cheatBuf + e.code[3]).slice(-CHEAT_LEN);
  if (CHEATS[cheatBuf]) { cheatQueued = CHEATS[cheatBuf]; cheatText = cheatBuf; cheatBuf = ''; }
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
let LV, MAP, LW, LH, LEVEL_W, TL, TH, levelCanvas, ents, checkpoints, crumbleMask, levelIdx;

function ch(x, y) { if (x < 0 || x >= LW) return '#'; if (y < 0 || y >= LH) return '.'; return MAP[y][x]; }
// грунт, платформы и решётки вентиляторов держат всегда; осыпающаяся плита — пока цела
function isSolid(x, y) {
  const c = ch(x, y);
  if (c === '#' || c === 'P' || c === 'U') return true;
  if (c === 'X') return crumbleMask[y * LW + x] === 1;
  return false;
}
const isStatic = (x, y) => { const c = ch(x, y); return c === '#' || c === 'P' || c === 'U'; };
const isOneWay = (x, y) => ch(x, y) === '-';

const PHYS = { accel: 0.22, maxSpeed: 1.7, friction: 0.28, airAccel: 0.16, gravity: 0.24, maxFall: 5.2, jump: -5.3, jumpCut: -1.8, spring: -7.6, coyote: 6, buffer: 6 };
const CRUMBLE = { hold: 42, gone: 150 };     // кадров под ногами / до восстановления
const GATE = { period: 170, warn: 90, on: 110 }; // цикл затвора: выкл → предупреждение → луч

let ARENA, boss, shots, waves, totalCells, cellsBank = 0, runTime = 0;

// ---------- разбор уровня ----------
function loadLevel(idx) {
  levelIdx = idx;
  LV = LEVELS[idx];
  MAP = LV.map; LW = MAP[0].length; LH = MAP.length; LEVEL_W = LW * T;
  TH = A.themes[LV.theme]; TL = TH.tiles;
  crumbleMask = new Int8Array(LW * LH);
  ents = { cells: [], drones: [], crawlers: [], turrets: [], movers: [], springs: [], anim: [],
           crumbles: [], vents: [], gates: [], melt: [], portal: null, spawn: { x: 16, y: 100 } };
  checkpoints = [];

  levelCanvas = makeCanvas(LEVEL_W, H);
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
        ents.gates.push({ x: px, y: py, beamY: (y + 1) * T, beamH: (yy - y - 1) * T, phase: (x * 53) % GATE.period }); break;
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
    }
  }
  for (const col of LV.checkpoints) {
    let row = 0; while (row < LH && ch(col, row) !== '#') row++;
    checkpoints.push({ x: col * T + 3, y: row * T - 20, col });
  }
  totalCells = ents.cells.length;
  ARENA = { left: (LW - 20) * T, trigger: (LW - 18) * T, floorY: 11 * T,
            xMin: (LW - 20) * T + 10, xMax: (LW - 6) * T - BOSS_BOX[LV.boss].w };
  boss = null;
}

// ---------- боссы ----------
const BOSS_BOX = {
  warden:   { w: 32, h: 24, box: [2, 4, 28, 14], core: [2, 4, 28, 8],
              shield: ['wake', 'hover', 'aim', 'slam'], weak: 'stun' },
  rootmind: { w: 40, h: 34, box: [3, 7, 34, 27], core: [6, 0, 28, 16],
              shield: ['wake', 'stalk', 'tell', 'dash', 'close'], weak: 'open' },
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
           x: (LW - 10) * T + 8, y: ARENA.floorY - d.h };
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
  ents.turrets.forEach(t => { t.t = 0; });       // после возрождения турель даёт полный телеграф
  ents.crawlers = ents.crawlers.filter(c => c.home);
  for (const c of ents.crawlers) { c.alive = true; c.dir = -1; }
  for (const c of ents.crumbles) { c.st = 0; c.t = 0; crumbleMask[c.ty * LW + c.tx] = 1; }
  if (full || boss.state !== 'dead') resetBoss(); // побеждённый босс не воскресает на чекпоинте
  shots = [];
  const sp = full ? ents.spawn : checkpoints[cp];
  P = { x: sp.x, y: sp.y, vx: 0, vy: 0, w: 10, h: 20, face: 1, grounded: false, coyote: 0, jbuf: 0,
        animT: 0, onMover: null, squash: 0, jumping: false, lift: 0 };
  cam = { x: Math.max(0, Math.min(LEVEL_W - W, P.x - W / 2)) };
  particles = [];
  state = 'play'; deadTimer = 0; shake = 0;
  if (full) frame = 0;
}

// ---------- состояние ----------
let P, cam, particles, frame = 0, state, deadTimer, cp, intro, elapsed, shake;

function startLevel(idx) { loadLevel(idx); reset(true); }
function restartRun() { cellsBank = 0; runTime = 0; startLevel(0); }   // с финального экрана — сначала
function nextLevel() {
  cellsBank += ents.cells.filter(c => c.taken).length;
  runTime += elapsed;
  startLevel(levelIdx + 1);
}
function warpToBossCheckpoint() {
  if (state === 'win' || state === 'clear') return;
  cp = checkpoints.length - 1;
  reset(false);
  cam.x = Math.max(0, Math.min(LEVEL_W - W, P.x - W / 2)); // без плавного пролёта камеры через весь уровень
  intro = 0; cheatMsg = 150;
  spawnParticles(P.x + 5, P.y + 10, 30, ['#ff3fa8', '#22e5ff', '#e6ecff'], 2.5, 0.02, 30);
}

startLevel(0);
// отладка: #lv=2&x=25&y=10 — сектор и тайл старта (для скриншотов уровня)
{
  const lv = /lv=(\d+)/.exec(location.hash);
  if (lv && +lv[1] >= 1 && +lv[1] <= LEVELS.length) startLevel(+lv[1] - 1);
  const m = /x=(\d+)&y=(\d+)/.exec(location.hash);
  if (m) { P.x = +m[1] * T + 3; P.y = +m[2] * T + T - 20; cam.x = Math.max(0, Math.min(LEVEL_W - W, P.x - W / 2)); intro = 0; }
}

// ---------- утилиты ----------
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function spawnParticles(x, y, n, cols, spread = 2.5, g = 0.12, life = 30) {
  for (let i = 0; i < n; i++) particles.push({
    x, y, vx: (Math.random() - 0.5) * spread * 2, vy: (Math.random() - 0.8) * spread, g,
    life: life + Math.random() * life * 0.5, col: cols[Math.floor(Math.random() * cols.length)] });
}
function die() {
  if (state !== 'play') return;
  state = 'dead'; deadTimer = 55; shake = 8;
  spawnParticles(P.x + 5, P.y + 10, 40, ['#aab4d4', '#ff9a2e', '#22e5ff', '#e6ecff'], 3.5, 0.15, 40);
}
const onScreen = x => x > cam.x - 32 && x < cam.x + W + 32;
const gateStage = g => {
  const t = (frame + g.phase) % GATE.period;
  return t < GATE.warn ? 0 : t < GATE.on ? 1 : 2;
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
        spawnParticles(c.x + 8, c.y + 10, 14, ['#3d7053', '#1e3f2d', '#a8ff3d'], 2, 0.18, 34);
      }
    } else if (c.st === 2) {
      if (--c.t <= 0 && !overlap(P, { x: c.x, y: c.y, w: T, h: T })) {
        c.st = 0; crumbleMask[c.ty * LW + c.tx] = 1;
        spawnParticles(c.x + 8, c.y + 8, 8, ['#a8ff3d', '#ecfff2'], 1.4, 0, 20);
      }
    }
  }
}
function touchCrumbles() {                       // плита начинает сыпаться под весом игрока
  if (!P.grounded) return;
  const ty = Math.floor((P.y + P.h) / T);
  for (let tx = Math.floor(P.x / T); tx <= Math.floor((P.x + P.w - EPS) / T); tx++) {
    if (ch(tx, ty) !== 'X' || crumbleMask[ty * LW + tx] !== 1) continue;
    const c = ents.crumbles.find(k => k.tx === tx && k.ty === ty);
    if (c && c.st === 0) { c.st = 1; c.t = CRUMBLE.hold; }
  }
}

function updatePlayer() {
  // перенос платформой
  if (P.onMover) { P.x += P.onMover.dx; P.y += P.onMover.dy; }

  const wasGrounded = P.grounded;
  // горизонталь
  const ax = P.grounded ? PHYS.accel : PHYS.airAccel;
  if (inp.left()) { P.vx -= ax; P.face = -1; }
  else if (inp.right()) { P.vx += ax; P.face = 1; }
  else if (P.grounded) { P.vx = Math.abs(P.vx) < PHYS.friction ? 0 : P.vx - Math.sign(P.vx) * PHYS.friction; }
  else P.vx *= 0.98;
  P.vx = clamp(P.vx, -PHYS.maxSpeed, PHYS.maxSpeed);

  // прыжок: coyote + buffer
  P.coyote = P.grounded ? PHYS.coyote : Math.max(0, P.coyote - 1);
  P.jbuf = inp.jumpPressed() ? PHYS.buffer : Math.max(0, P.jbuf - 1);
  if (P.jbuf > 0 && P.coyote > 0) {
    P.vy = PHYS.jump; P.coyote = 0; P.jbuf = 0; P.grounded = false; P.onMover = null; P.jumping = true;
    spawnParticles(P.x + 5, P.y + P.h, 5, ['#6c7aa6', '#aab4d4'], 1.2, 0.05, 12);
  }
  if (P.jumping && !inp.jump() && P.vy < PHYS.jumpCut) P.vy = PHYS.jumpCut; // переменная высота
  if (P.vy >= 0) P.jumping = false;

  P.vy = Math.min(PHYS.maxFall, P.vy + PHYS.gravity);

  // восходящий поток вентилятора
  P.lift = Math.max(0, P.lift - 1);
  for (const v of ents.vents) {
    if (P.x + P.w > v.x + 1 && P.x < v.x + T - 1 && P.y + P.h > v.y && P.y < v.y + v.h) {
      P.vy = Math.max(P.vy - 0.72, -3.0); P.jumping = false; P.lift = 6;
      if (frame % 4 === 0) spawnParticles(P.x + 5, P.y + P.h, 1, ['#a8ff3d', '#ecfff2'], 0.8, -0.04, 18);
    }
  }

  moveX(P.vx);
  moveY(P.vy);
  touchCrumbles();
  if (bossActive() && P.x < ARENA.left + 16) { P.x = ARENA.left + 16; P.vx = 0; } // энергобарьер арены

  if (P.grounded && !wasGrounded) {
    P.squash = 6;
    spawnParticles(P.x + 5, P.y + P.h, 6, ['#6c7aa6', '#aab4d4'], 1.5, 0.05, 14);
  }
  if (P.squash > 0) P.squash--;

  // пружины
  for (const s of ents.springs) {
    if (s.timer > 0) s.timer--;
    const box = { x: s.x + 2, y: s.y + 4, w: 12, h: 12 };
    if (P.vy >= 0 && overlap({ x: P.x, y: P.y + P.h - 4, w: P.w, h: 4 }, box)) {
      P.vy = PHYS.spring; P.grounded = false; P.onMover = null; P.jumping = false; s.timer = 12; P.y = s.y + 4 - P.h;
      spawnParticles(s.x + 8, s.y + 6, 10, ['#ffe14a', '#ff9a2e'], 2, 0.08, 20);
    }
  }

  // чекпоинты
  if (P.grounded) for (let i = cp + 1; i < checkpoints.length; i++) if (P.x >= checkpoints[i].col * T) cp = i;

  // энергоячейки
  for (const c of ents.cells) {
    c.t++;
    if (!c.taken && overlap(P, { x: c.x, y: c.y + Math.sin(c.t / 12) * 2, w: c.w, h: c.h })) {
      c.taken = true;
      spawnParticles(c.x + 4, c.y + 5, 14, ['#4dff88', '#e6ecff', '#22e5ff'], 2, 0.02, 24);
    }
  }

  // опасности
  const hit = { x: P.x + 1, y: P.y + 2, w: P.w - 2, h: P.h - 3 };
  for (const a of ents.anim) if (a.kind === 'spikes' && overlap(hit, { x: a.x + 1, y: a.y + 2, w: 14, h: 10 })) die();
  for (const m of ents.melt) if (overlap(hit, { x: m.x, y: m.y + (m.top ? 5 : 0), w: T, h: m.top ? T - 5 : T })) die();
  for (const g of ents.gates) if (gateStage(g) === 2 && overlap(hit, { x: g.x + 5, y: g.beamY, w: 6, h: g.beamH })) die();
  for (const d of ents.drones) {
    if (!d.alive) continue;
    if (stompOrDie(hit, { x: d.x + 2, y: d.y + 3, w: 12, h: 6 }, d.y + 5)) {
      d.alive = false;
      spawnParticles(d.x + 8, d.y + 6, 24, ['#ff3b3b', '#aab4d4', '#ff9a2e', '#4a5680'], 3, 0.12, 36);
    }
  }
  for (const c of ents.crawlers) {
    if (!c.alive) continue;
    if (stompOrDie(hit, { x: c.x + 2, y: c.y + 2, w: 12, h: 9 }, c.y + 5)) {
      c.alive = false;
      spawnParticles(c.x + 8, c.y + 6, 24, ['#a8ff3d', '#3d7053', '#ecfff2', '#ff3b3b'], 3, 0.12, 36);
    }
  }
  for (const t of ents.turrets) {
    if (!t.alive) continue;
    if (stompOrDie(hit, { x: t.x + 2, y: t.y + 4, w: 13, h: 12 }, t.y + 7)) {
      t.alive = false;
      spawnParticles(t.x + 8, t.y + 10, 26, ['#ffe14a', '#ff9a2e', '#3d7053', '#ecfff2'], 3, 0.12, 38);
    }
  }
  bossHazards(hit);
  if (P.y > H + 8) die();

  // портал (закрыт, пока жив босс)
  const pt = ents.portal;
  if (pt && boss.state === 'dead' && overlap(P, { x: pt.x + 6, y: pt.y + 2, w: 20, h: 28 }))
    state = levelIdx < LEVELS.length - 1 ? 'clear' : 'win';

  // анимация
  P.animT += Math.abs(P.vx) > 0.3 ? Math.abs(P.vx) * 0.55 : 0.15;
}
// прыжок сверху убивает врага, иначе смерть игрока
function stompOrDie(hit, box, topY) {
  if (!overlap(hit, box)) return false;
  if (P.vy > 0 && P.y + P.h - P.vy <= topY) { P.vy = -4.2; P.jumping = false; shake = 3; return true; }
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
      spawnParticles(t.x + 8 + t.dir * 9, t.y + 11, 4, ['#ff3b3b', '#ffe14a'], 1, 0, 10);
    }
  }
}
const turretCharging = t => t.alive && t.t >= 90;

function updateShots() {
  for (const s of shots) { s.x += s.vx; s.y += s.vy; s.vy += s.g; s.life--; }
  shots = shots.filter(s => s.life > 0 && s.y < H + 8 && s.x > -8 && s.x < LEVEL_W + 8 &&
                            !isSolid(Math.floor(s.x / T), Math.floor(s.y / T)));
}
function updateParticles() {
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life--; }
  particles = particles.filter(p => p.life > 0);
}

// ---------- боссы: общее ----------
function bossHazards(hit) {
  const b = boss, d = bossDef();
  if (b.state !== 'idle' && b.state !== 'dead' && b.state !== 'dying') {
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
}
function hitBoss() {
  const b = boss;
  b.hp--; b.flash = 14; shake = 6;
  P.vy = -5; P.jumping = false;
  spawnParticles(b.x + bossDef().w / 2, b.y + 4, 24, ['#4dff88', '#e6ecff', '#ffe14a'], 3, 0.1, 30);
  if (b.hp <= 0) { b.state = 'dying'; b.timer = 120; shots = []; waves = []; }
  else { b.state = 'recoil'; b.timer = 45; }
}
function bossDeath() {
  const b = boss, d = bossDef();
  b.state = 'dead'; shake = 14;
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
      shake = 5; b.flash = 4;
    }
    b.y += (b.timer % 4 < 2) ? 0.6 : -0.4;
    if (--b.timer <= 0) bossDeath();
  } else if (b.kind === 'warden') updateWarden();
  else updateRootmind();
  updateShots();
  for (const w of waves) { w.x += w.dir * 2.4; w.t++; }
  waves = waves.filter(w => w.x > ARENA.left + 18 && w.x < (LW - 6) * T - 4);
}

// ---------- босс 1: WARDEN (сектор 7) ----------
function fireBolt() {
  const b = boss, sx = b.x + 16, sy = b.y + 18;
  const dx = P.x + P.w / 2 - sx, dy = P.y + P.h / 2 - sy, len = Math.hypot(dx, dy) || 1;
  const spd = 1.6 + bossRage() * 0.2;
  shots.push({ x: sx, y: sy, vx: dx / len * spd, vy: dy / len * spd, g: 0, r: 2, life: 260,
               cols: ['#8a1a1a', '#ff3b3b', '#e6ecff'] });
  spawnParticles(sx, sy, 4, ['#ff3b3b', '#ff9a2e'], 1, 0, 10);
}
function wardenLand() {
  const b = boss;
  b.y = ARENA.floorY - 24; shake = 10;
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
      if (state === 'play' && P.x >= ARENA.trigger) { b.state = 'wake'; b.timer = 100; shake = 4; }
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
      b.y = hoverY - 4 + (frame % 2);
      if (--b.timer <= 0) { b.state = 'slam'; b.vy = 0; }
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

// ---------- босс 2: ROOTMIND (сектор 12) ----------
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
  spawnParticles(sx, sy, 6, ['#a8ff3d', '#2bd6c0'], 1.4, 0, 14);
}
function dripMelt() {
  const x = clamp(P.x + (Math.random() * 90 - 45), ARENA.left + 28, LEVEL_W - 44);
  shots.push({ x, y: 6, vx: 0, vy: 1.1, g: 0.09, r: 3, life: 300, cols: ['#a04a0d', '#ff7a1e', '#ffc94a'] });
  spawnParticles(x, 8, 4, ['#ffc94a', '#ff7a1e'], 1, 0.05, 14);
}
function spawnAdd(side) {
  const x = side < 0 ? ARENA.left + 24 : LEVEL_W - 5 * T;
  ents.crawlers.push({ x, y: ARENA.floorY - 16, dir: side < 0 ? 1 : -1, alive: true, t: 0, home: false });
  spawnParticles(x + 8, ARENA.floorY - 8, 14, ['#a8ff3d', '#3d7053'], 2, 0.1, 26);
}
function rootmindCrash() {
  const b = boss;
  shake = 11;
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
      if (state === 'play' && P.x >= ARENA.trigger) { b.state = 'wake'; b.timer = 95; shake = 4; }
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
      if (--b.timer <= 0) { b.state = 'tell'; b.timer = 52; b.dir = P.x + P.w / 2 < b.x + 20 ? -1 : 1; }
      break;
    }
    case 'tell':                                                          // телеграф рывка
      b.x = clamp(b.x + (frame % 2 ? 1 : -1) * 0.6, ARENA.xMin, ARENA.xMax);
      b.y = floorTop;
      if (--b.timer <= 0) b.state = 'dash';
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

// ---------- главный такт ----------
function update() {
  frame++;
  updateMovers();
  updateDrones();
  updateCrawlers();
  updateTurrets();
  updateCrumbles();
  updateBoss();
  updateParticles();
  if (state === 'play') { elapsed++; if (intro > 0) intro--; updatePlayer(); }
  else if (state === 'dead') { if (--deadTimer <= 0) reset(false); }
  else if (state === 'clear') { if (inp.jumpPressed()) nextLevel(); }
  if (pressed.KeyR) { if (state === 'win') restartRun(); else reset(true); }
  if (cheatQueued) {
    if (cheatQueued === 'boss') warpToBossCheckpoint();
    else if (levelIdx < LEVELS.length - 1) { nextLevel(); cheatMsg = 150; }
    cheatQueued = null;
  }
  if (cheatMsg > 0) cheatMsg--;
  if (pressed.KeyC) { const s = document.getElementById('scan'); s.style.display = s.style.display === 'block' ? 'none' : 'block'; }
  // камера
  const target = bossActive() ? LEVEL_W - W : P.x + P.w / 2 - W / 2 + P.face * 24; // на арене камера заперта
  cam.x += (target - cam.x) * 0.08;
  cam.x = clamp(cam.x, 0, LEVEL_W - W);
  if (shake > 0) shake--;
  for (const k in pressed) pressed[k] = false;
}

// ---------- отрисовка ----------
function drawParallax(img, factor) {
  const w = img.width;
  const off = -((cam.x * factor) % w);
  for (let x = off; x < W; x += w) ctx.drawImage(img, Math.round(x), 0);
}

function draw() {
  const cx = Math.round(cam.x) + (shake > 0 ? Math.round((Math.random() - 0.5) * shake) : 0);
  const sy = shake > 0 ? Math.round((Math.random() - 0.5) * shake * 0.5) : 0;
  ctx.setTransform(1, 0, 0, 1, 0, sy);

  // фон
  drawParallax(TH.bg.far, 0.05);
  drawParallax(TH.bg.mid, 0.25);
  drawParallax(TH.bg.near, 0.5);

  ctx.translate(-cx, 0);

  // анимированный декор (за уровнем — светильники/консоли/кристаллы)
  for (const a of ents.anim) {
    if (a.x + T < cx || a.x > cx + W) continue;
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

  // тайлы
  ctx.drawImage(levelCanvas, cx, 0, W, H, cx, 0, W, H);

  // расплав (анимированная поверхность)
  for (const m of ents.melt) if (m.top && onScreen(m.x))
    ctx.drawImage(TL.meltTop[Math.floor((frame + m.x / 8) / 12) % 2], m.x, m.y);

  // шипы, пружины, вентиляторы, осыпающиеся плиты
  for (const a of ents.anim) if (a.kind === 'spikes' && onScreen(a.x)) ctx.drawImage(TL.spikes[Math.floor((frame + a.x / 4) / 10) % 2], a.x, a.y);
  for (const s of ents.springs) ctx.drawImage(TL.spring[s.timer > 6 ? 1 : 0], s.x, s.y);
  for (const v of ents.vents) {
    if (!onScreen(v.x)) continue;
    ctx.drawImage(TL.vent[Math.floor(frame / 5) % 2], v.x, v.tileY);
    ctx.globalAlpha = 0.2; ctx.fillStyle = '#a8ff3d';
    ctx.fillRect(v.x + 2, v.y, 12, v.h);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {                       // восходящие «шевроны»
      const y = v.y + v.h - ((frame * 2.2 + i * v.h / 6) % v.h);
      const w = 4 + (i % 2) * 2, x = v.x + 8 - w / 2 + ((i * 5) % 7) - 3;
      ctx.fillStyle = i % 2 ? '#a8ff3d' : '#ecfff2';
      ctx.fillRect(Math.round(x), Math.round(y), w, 2);
      ctx.fillRect(Math.round(x) + 1, Math.round(y) + 2, w - 2, 1);
    }
  }
  for (const c of ents.crumbles) {
    if (c.st === 2 || !onScreen(c.x)) continue;
    const sh = c.st === 1 ? ((frame % 4 < 2) ? 1 : -1) : 0;
    ctx.drawImage(TL.crumble[c.st === 0 ? 0 : (c.t < CRUMBLE.hold / 2 ? 2 : 1)], c.x + sh, c.y);
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

  // лазерные затворы
  for (const g of ents.gates) {
    if (!onScreen(g.x)) continue;
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

  // энергобарьер арены
  if (bossActive()) {
    const bx = ARENA.left + 14;
    for (let y = 0; y < ARENA.floorY; y += 4) {
      if ((y / 4 + Math.floor(frame / 3)) % 3 === 0) continue;
      ctx.fillStyle = (y / 4 + frame) % 7 === 0 ? '#e6ecff' : LV.accent2; ctx.fillRect(bx, y, 2, 3);
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
  const img = b.kind === 'warden' ? wardenFrame() : rootmindFrame();
  const bx = Math.round(b.x), by = Math.round(b.y);
  // щит (пунктир) — когда босс неуязвим
  if (d.shield.includes(b.state)) {
    ctx.fillStyle = frame % 8 < 4 ? LV.accent : LV.accent2;
    const x0 = bx - 3, y0 = by - 3, w = d.w + 6, h = d.h + 6, o = frame % 3;
    for (let i = o; i < w; i += 3) { ctx.fillRect(x0 + i, y0, 1, 1); ctx.fillRect(x0 + i, y0 + h, 1, 1); }
    for (let i = o; i < h; i += 3) { ctx.fillRect(x0, y0 + i, 1, 1); ctx.fillRect(x0 + w, y0 + i, 1, 1); }
  }
  ctx.drawImage(img, bx, by);
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

// ---------- HUD ----------
function drawHud() {
  const got = ents.cells.filter(c => c.taken).length;
  const secs = Math.floor(elapsed / 60);
  const clock = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  ctx.fillStyle = 'rgba(11,11,26,0.55)'; ctx.fillRect(0, 0, W, 12);
  ctx.drawImage(A.cell[0], 4, 1);
  textShadow(`${got}/${totalCells}`, 15, 3, '#4dff88');
  textShadow(`TIME ${clock(secs)}`, 84, 3, '#aab4d4');
  const screen = Math.floor((P.x + P.w / 2) / W) + 1;
  textShadow(`AREA ${screen}/${Math.ceil(LEVEL_W / W)}`, 170, 3, '#22e5ff');
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
  if (intro > 0 && state === 'play') {
    ctx.globalAlpha = Math.min(1, intro / 40);
    ctx.fillStyle = 'rgba(11,11,26,0.7)'; ctx.fillRect(0, 88, W, 44);
    textShadow('ORBITAR', mid('ORBITAR', 2), 96, '#22e5ff', 2);
    textShadow(LV.name, mid(LV.name), 116, '#aab4d4');
    ctx.globalAlpha = 1;
  }
  if (state === 'clear') {
    ctx.fillStyle = 'rgba(11,11,26,0.78)'; ctx.fillRect(0, 76, W, 72);
    textShadow('SECTOR CLEAR!', mid('SECTOR CLEAR!', 2), 84, '#ffe14a', 2);
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
  boss: { kind: boss.kind, state: boss.state, hp: boss.hp, x: Math.round(boss.x), y: Math.round(boss.y) },
  shots: shots.map(s => [Math.round(s.x), Math.round(s.y)]), waves: waves.map(w => Math.round(w.x)),
  cells: ents.cells.filter(c => c.taken).length, drones: ents.drones.filter(d => d.alive).length,
  crawlers: ents.crawlers.filter(c => c.alive).length, turrets: ents.turrets.filter(t => t.alive).length,
  crumbles: ents.crumbles.map(c => c.st), frame, jumping: P.jumping, coyote: P.coyote, jbuf: P.jbuf,
  mov: ents.movers.map(m => [Math.round(m.x), Math.round(m.y)]) });
window.__keys = keys;

// ---------- цикл ----------
let acc = 0, last = performance.now();
const STEP = 1000 / 60;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= STEP) { update(); acc -= STEP; }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
