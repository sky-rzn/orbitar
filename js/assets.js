// ============================================================
//  ORBITAR — pixel-art asset generator (16-bit style)
//  Все ассеты рисуются кодом в оффскрин-канвасы при загрузке.
//  Тайлы/фоны собираются для каждой темы (уровня) отдельно.
// ============================================================
'use strict';

const PAL = {
  '.': null,
  // ---- база (ORBITAL FOUNDRY — орбитальная литейная) ----
  K: '#0b0b1a', // почти чёрный
  D: '#1e1f3a', // тёмно-синий
  d: '#2c3355', // тёмный металл
  M: '#4a5680', // металл
  m: '#6c7aa6', // светлый металл
  W: '#aab4d4', // блик металла
  w: '#e6ecff', // белый
  C: '#22e5ff', // неон-циан
  c: '#0a8fa8', // тёмный циан
  P: '#ff3fa8', // маджента
  p: '#8a1f66',
  O: '#ff9a2e', // оранжевый
  o: '#b25a12',
  Y: '#ffe14a', // жёлтый
  G: '#4dff88', // зелёный
  g: '#1c8a48',
  R: '#ff3b3b', // красный
  r: '#8a1a1a',
  B: '#3b5bff', // синий
  b: '#1c2f8a',
  V: '#2a1b4a', // фиолетовый (фон)
  v: '#3d2a6b',
  // ---- сдвиг палитры (VERDANT REACTOR — заросший реактор) ----
  //  та же гамма «неон по тёмному металлу», но металл зелёный,
  //  неон — фиолетовый/лаймовый, опасность — янтарный расплав.
  F: '#07130f', // почти чёрный (зелёный)
  f: '#132a1f', // тёмно-зелёный
  e: '#1e3f2d', // тёмный металл
  N: '#3d7053', // металл
  q: '#62a07b', // светлый металл
  A: '#a3dcb4', // блик металла
  x: '#ecfff2', // белый
  U: '#b76bff', // неон-фиолет
  u: '#5f2aa8', // тёмный фиолет
  L: '#a8ff3d', // лайм
  k: '#3f8a1c', // тёмный лайм
  a: '#ffc94a', // янтарь
  I: '#ff7a1e', // оранжевый расплав
  i: '#a04a0d',
  T: '#2bd6c0', // бирюза (споры/кристаллы)
  t: '#0d7a6d',
  y: '#3a1a66', // полутень фиолета (луна)
  h: '#1d0d38', // теневая сторона луны
  j: '#1a4d3a', // листва (фон)
  J: '#265c44',
  // ---- сдвиг палитры (ASHEN CITADEL — пепельная цитадель) ----
  //  тот же язык «неон по тёмному металлу»: металл пепельно-лиловый,
  //  неон — золото, подсветка антиграва — азур, кристаллы — аметист,
  //  опасность — разлом пустоты вместо ям и расплава.
  K3: '#120b16', // почти чёрный (лиловый)
  D3: '#241a2e', // сумрак
  d3: '#32263c', // тёмный металл
  M3: '#5b4d66', // металл (пепел)
  m3: '#877a90', // светлый металл
  W3: '#c6bac5', // блик металла (кость)
  w3: '#fff4ef', // белый
  C3: '#ffb02e', // неон-золото
  c3: '#a8670c', // тёмное золото
  P3: '#3cc8ff', // азур
  p3: '#1b5d94', // тёмный азур
  Y3: '#ffe9a8', // светлое золото
  O3: '#ff7a3c', // оранжевый
  o3: '#a8431a',
  G3: '#c46bff', // аметист
  g3: '#6a2ba8',
  B3: '#ff5a7a', // роза (энергия портала)
  b3: '#8a1f3c',
  V3: '#3a2450', // фон-фиолет
  v3: '#5c3b78',
  // разлом пустоты (только третий уровень, без подмены по теме)
  Z0: '#060310', // сердцевина разлома
  Z1: '#150a26', // толща
  Z2: '#2e1358', // свечение
  Z3: '#7a3cff', // край
  Z4: '#dcbcff', // искры
};

// Тема = таблица подмены ключей палитры. null — исходная (ORBITAL FOUNDRY).
const TH_FOUNDRY = null;
const TH_REACTOR = {
  K: 'F', D: 'f', d: 'e', M: 'N', m: 'q', W: 'A', w: 'x',
  C: 'U', c: 'u',   // неоновая кромка грунта — фиолетовая
  P: 'L', p: 'k',   // подсветка антиграв-платформ — лайм
  Y: 'a', O: 'I', o: 'i',
  G: 'T', g: 't',   // кристаллы → бирюзовые споровые наросты
  B: 'U', b: 'u', V: 'u', v: 'U',
};
// Пепельная цитадель: красный оставлен непеременным — опасность читается
// одинаково на всех уровнях, а вокруг неё меняется вся остальная гамма.
const TH_CITADEL = {
  K: 'K3', D: 'D3', d: 'd3', M: 'M3', m: 'm3', W: 'W3', w: 'w3',
  C: 'C3', c: 'c3',   // неоновая кромка грунта — золото
  P: 'P3', p: 'p3',   // подсветка антиграв-платформ — азур
  Y: 'Y3', O: 'O3', o: 'o3',
  G: 'G3', g: 'g3',   // кристаллы → аметистовые шпили
  B: 'B3', b: 'b3', V: 'V3', v: 'v3',
};
const THEMES = [TH_FOUNDRY, TH_REACTOR, TH_CITADEL];

const TILE = 16;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return c;
}
const themed = (th, key) => (th && th[key]) ? th[key] : key;

// Спрайт из строк-пиксельмапов
function spriteFromRows(rows, flip = false, th = null) {
  const h = rows.length, w = rows[0].length;
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const col = PAL[themed(th, rows[y][x])];
    if (!col) continue;
    ctx.fillStyle = col;
    ctx.fillRect(flip ? w - 1 - x : x, y, 1, 1);
  }
  return c;
}

// Небольшой "пиксельный" API поверх контекста (с подменой палитры по теме)
function px(ctx, th = null, mono = null) {
  const col = c => PAL[mono || themed(th, c)] || c;
  return {
    p(x, y, c) { ctx.fillStyle = col(c); ctx.fillRect(x, y, 1, 1); },
    r(x, y, w, h, c) { ctx.fillStyle = col(c); ctx.fillRect(x, y, w, h); },
    hl(x, y, w, c) { ctx.fillStyle = col(c); ctx.fillRect(x, y, w, 1); },
    vl(x, y, h, c) { ctx.fillStyle = col(c); ctx.fillRect(x, y, 1, h); },
  };
}

// Детерминированный ГПСЧ для процедурных фонов
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ------------------------------------------------------------
//  ИГРОК: тело + варианты ног (композиция), 16x20
// ------------------------------------------------------------
const PLAYER_BODY = [
  '......MMMMM.....',
  '.....MWWWWWM....',
  '....MWwwWWWWM...',
  '....MWKKKKKKM...',
  '....MWKCCCCKM...',
  '....MWKCCCwKM...',
  '....MWWKKKKWM...',
  '.....MWWWWWM....',
  '....OOMMMMMOO...',
  '...OMMWWWWWMMO..',
  '...OMMWCCCWMMO..',
  '...OMMWWWWWMMO..',
  '..MM.MMMMMMM.MM.',
  '..MM.DDDDDDD.MM.',
];
const PLAYER_LEGS = {
  idle: [
    '....MMM.MMM.....',
    '....MMM.MMM.....',
    '....DDD.DDD.....',
    '....OOO.OOO.....',
    '....OOO.OOO.....',
    '....KKK.KKK.....',
  ],
  run0: [
    '...MMM...MMM....',
    '..MMM.....MMM...',
    '..DDD.....DDD...',
    '.OOO.......OOO..',
    '.OOO.......OOO..',
    '.KKK.......KKK..',
  ],
  run1: [
    '....MMM.MMM.....',
    '....MMM..MMM....',
    '....DDD..DDD....',
    '...OOO....OOO...',
    '...OOO....OOO...',
    '...KKK....KKK...',
  ],
  run2: [
    '....MMMMMM......',
    '....MMM.MMM.....',
    '....DDD..DDD....',
    '....OOO..OOO....',
    '....OOO...OO....',
    '....KKK.........',
  ],
  jump: [
    '....MMMMMMM.....',
    '....MMM.MMM.....',
    '....DDD.DDD.....',
    '...OOO..OOO.....',
    '...OOO..OOO.....',
    '...KKK..KKK.....',
  ],
  fall: [
    '....MMM.MMM.....',
    '...MMM...MMM....',
    '...DDD...DDD....',
    '...OOO...OOO....',
    '..OOO.....OOO...',
    '..KKK.....KKK...',
  ],
};

// ------------------------------------------------------------
//  ДРОН 16x12, 2 кадра (в VERDANT REACTOR перекрашивается темой — «ОСА»)
// ------------------------------------------------------------
const DRONE = [
  [
    '.....RR.........',
    '....RRRR........',
    '...MMMMMMMM.....',
    '..MMWWWWWWMM....',
    '.MMWWKKKKWWMM...',
    '.MWWKKRRKKWWM...',
    '.MWWKKRRKKWWM...',
    '..MMKKKKKKMM....',
    '...MMMMMMMM.....',
    '....CC..CC......',
    '...C......C.....',
    '................',
  ],
  [
    '.....rr.........',
    '....RRRR........',
    '...MMMMMMMM.....',
    '..MMWWWWWWMM....',
    '.MMWWKKKKWWMM...',
    '.MWWKKwRKKWWM...',
    '.MWWKKRRKKWWM...',
    '..MMKKKKKKMM....',
    '...MMMMMMMM.....',
    '....cC..Cc......',
    '.....C..C.......',
    '....C....C......',
  ],
];

// ------------------------------------------------------------
//  ПОЛЗУН «CRAWLER» 16x12, 2 кадра — шагает по грунту, гибнет от прыжка сверху
// ------------------------------------------------------------
const CRAWLER = [
  [
    '................',
    '....MMMMMMMM....',
    '..MMWWWWWWWWMM..',
    '.MWWmmmmmmmmWWM.',
    '.MWmKKKKKKKKmWM.',
    '.MWmKRRKKRRKmWM.',
    '.MWmKKKKKKKKmWM.',
    '.MWmmmmmmmmmmWM.',
    '.MMMMMMMMMMMMMM.',
    '..M..MM..MM..M..',
    '.MM..MM..MM..MM.',
    '.M....M..M....M.',
  ],
  [
    '................',
    '....MMMMMMMM....',
    '..MMWWWWWWWWMM..',
    '.MWWmmmmmmmmWWM.',
    '.MWmKKKKKKKKmWM.',
    '.MWmKRwKKwRKmWM.',
    '.MWmKKKKKKKKmWM.',
    '.MWmmmmmmmmmmWM.',
    '.MMMMMMMMMMMMMM.',
    '..MM..M..M..MM..',
    '.MM..MM..MM..MM.',
    '.MM....MM....MM.',
  ],
];

// ------------------------------------------------------------
//  ТУРЕЛЬ «SENTRY» 16x16, 2 кадра (покой / заряд). Ствол смотрит вправо.
// ------------------------------------------------------------
const TURRET = [
  [
    '................',
    '................',
    '................',
    '................',
    '.....MMMM.......',
    '...MMWWWWMM.....',
    '..MWWKKKKWWMMMM.',
    '..MWKRRRRKWMdddM',
    '..MWWKKKKWWMMMM.',
    '...MMWWWWMM.....',
    '....MMMMMM......',
    '....MddddM......',
    '...MMMMMMMM.....',
    '..MWWWWWWWWM....',
    '..MddddddddM....',
    '..MMMMMMMMMM....',
  ],
  [
    '................',
    '................',
    '................',
    '................',
    '.....MMMM.......',
    '...MMWWWWMM.....',
    '..MWWKKKKWWMMMM.',
    '..MWKYwwYKWMYYYM',
    '..MWWKKKKWWMMMM.',
    '...MMWWWWMM.....',
    '....MMMMMM......',
    '....MYYYYM......',
    '...MMMMMMMM.....',
    '..MWWWWWWWWM....',
    '..MddddddddM....',
    '..MMMMMMMMMM....',
  ],
];

// ------------------------------------------------------------
//  ПРЫГУН «LEAPER» 16x14, 3 позы — сидит, приседает (телеграф), летит
// ------------------------------------------------------------
const LEAPER = {
  idle: [
    '................',
    '................',
    '.....MMMMMM.....',
    '...MMWWWWWWMM...',
    '..MWWKKKKKKWWM..',
    '..MWKRRKKRRKWM..',
    '..MWKKKKKKKKWM..',
    '..MWWmmmmmmWWM..',
    '...MMMMMMMMMM...',
    '..MM.MM..MM.MM..',
    '..MM.MM..MM.MM..',
    '.MMM.DD..DD.MMM.',
    '.MM..DD..DD..MM.',
    '.M...MM..MM...M.',
  ],
  crouch: [
    '................',
    '................',
    '................',
    '................',
    '.....MMMMMM.....',
    '...MMWWWWWWMM...',
    '..MWWKKKKKKWWM..',
    '..MWKYYKKYYKWM..',
    '..MWKKKKKKKKWM..',
    '..MWWmmmmmmWWM..',
    '.MMMMMMMMMMMMMM.',
    '.MM.DD....DD.MM.',
    'MMM.DD....DD.MMM',
    'MM...MMMMMM...MM',
  ],
  air: [
    '.....MMMMMM.....',
    '...MMWWWWWWMM...',
    '..MWWKKKKKKWWM..',
    '..MWKwwKKwwKWM..',
    '..MWKKKKKKKKWM..',
    '..MWWmmmmmmWWM..',
    '...MMMMMMMMMM...',
    '..M..MM..MM..M..',
    '.MM..DD..DD..MM.',
    '.M...DD..DD...M.',
    '.M...MM..MM...M.',
    '.....MM..MM.....',
    '.....M....M.....',
    '....MM....MM....',
  ],
};

// ------------------------------------------------------------
//  ИСКАТЕЛЬ «SEEKER» 12x12, 2 кадра — парящий глаз, медленно тянется к игроку
// ------------------------------------------------------------
const SEEKER = [
  [
    '....MMMM....',
    '..MMWWWWMM..',
    '.MWWKKKKWWM.',
    '.MWKKGGKKWM.',
    'MWKKGGGGKKWM',
    'MWKGGwwGGKWM',
    'MWKGGwwGGKWM',
    'MWKKGGGGKKWM',
    '.MWKKGGKKWM.',
    '.MWWKKKKWWM.',
    '..MMWWWWMM..',
    '....MMMM....',
  ],
  [
    '....MMMM....',
    '..MMWWWWMM..',
    '.MWWKKKKWWM.',
    '.MWKKKKKKWM.',
    'MWKKGGGGKKWM',
    'MWKGGGGwwKWM',
    'MWKGGGGwwKWM',
    'MWKKGGGGKKWM',
    '.MWKKKKKKWM.',
    '.MWWKKKKWWM.',
    '..MMWWWWMM..',
    '....MMMM....',
  ],
];

// ------------------------------------------------------------
//  ПИЛА «SAW» 16x16 — неуязвимая, катается по рельсе; кадр = поворот диска
// ------------------------------------------------------------
function sawSprite(frame, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  const cx = 7.5, cy = 7.5;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= 3.4) q.p(x, y, 'd');
    else if (d <= 5.2) q.p(x, y, 'M');
    else if (d <= 6.3) q.p(x, y, 'W');
  }
  for (let i = 0; i < 8; i++) {                       // зубья
    const a = (i / 8) * Math.PI * 2 + frame * Math.PI / 8;
    q.p(Math.round(cx + Math.cos(a) * 7), Math.round(cy + Math.sin(a) * 7), 'w');
    q.p(Math.round(cx + Math.cos(a) * 6), Math.round(cy + Math.sin(a) * 6), 'W');
    const b = a + Math.PI / 8;
    q.p(Math.round(cx + Math.cos(b) * 6), Math.round(cy + Math.sin(b) * 6), 'm');
  }
  q.r(6, 6, 4, 4, 'K'); q.r(7, 7, 2, 2, 'R');         // ступица
  return c;
}

// ------------------------------------------------------------
//  БОСС «WARDEN» 32x24 — композиция: люк + корпус + двигатели
// ------------------------------------------------------------
const BOSS_HATCH = {
  closed: [
    '............MMMMMMMM............',
    '...........MWWWWWWWWM...........',
    '...........MWmmmmmmWM...........',
    '..........MMMMMMMMMMMM..........',
  ],
  open: [ // X — ядро (заменяется на G/Y)
    '..........MM........MM..........',
    '.........MWWM.XXXX.MWWM.........',
    '.........MWWMXXwwXXMWWM.........',
    '..........MMMMXXXXMMMM..........',
  ],
};
const BOSS_BODY = [ // R — глаза (заменяются по состоянию)
  '......MMMMMMMMMMMMMMMMMMMM......',
  '....MMWWWWWWWWWWWWWWWWWWWWMM....',
  '...MWWmmmmmmmmmmmmmmmmmmmmWWM...',
  '..MWmKKKKKKKKKKKKKKKKKKKKKKmWM..',
  '..MWmKRRKKKRRKKKKKRRKKKRRKKmWM..',
  '..MWmKRRKKKRRKKKKKRRKKKRRKKmWM..',
  '..MWmKKKKKKKKKKKKKKKKKKKKKKmWM..',
  '..MWmmmmmmmmmmmmmmmmmmmmmmmmWM..',
  '..MMMMMMMMMMMddddddMMMMMMMMMMM..',
  '..MddddddddddCCCCCCddddddddddM..',
  '..MddddddddddcCCCCcddddddddddM..',
  '...MMMMMMMMMMddddddMMMMMMMMMM...',
  '....MMMMMMMMMDDDDDDMMMMMMMMM....',
  '.....DDDDDDDD......DDDDDDDD.....',
];
const BOSS_THRUST = {
  on0: [
    '.....MMMMMMMM......MMMMMMMM.....',
    '.....MWddddWM......MWddddWM.....',
    '.....MMMMMMMM......MMMMMMMM.....',
    '......YYYYYY........YYYYYY......',
    '.......OOOO..........OOOO.......',
    '........OO............OO........',
  ],
  on1: [
    '.....MMMMMMMM......MMMMMMMM.....',
    '.....MWddddWM......MWddddWM.....',
    '.....MMMMMMMM......MMMMMMMM.....',
    '......OYYYYO........OYYYYO......',
    '......OOOOOO........OOOOOO......',
    '.......O..O..........O..O.......',
  ],
  off: [
    '.....MMMMMMMM......MMMMMMMM.....',
    '.....MWddddWM......MWddddWM.....',
    '.....MMMMMMMM......MMMMMMMM.....',
    '......dddddd........dddddd......',
    '................................',
    '................................',
  ],
};
function bossSprite(hatch, core, eyes, thrust) {
  const rows = BOSS_HATCH[hatch].map(r => r.replace(/X/g, core))
    .concat(BOSS_BODY.map(r => r.replace(/R/g, eyes)))
    .concat(BOSS_THRUST[thrust]);
  return spriteFromRows(rows);
}
function bossFlashSprite() { // силуэт целиком белый (кадр попадания)
  const rows = BOSS_HATCH.closed.concat(BOSS_BODY, BOSS_THRUST.off).map(r => r.replace(/[^.]/g, 'w'));
  return spriteFromRows(rows);
}

// ------------------------------------------------------------
//  БОСС «ROOTMIND» 40x34 — корневая машина VERDANT REACTOR (рисуется процедурно)
//  open — броня раскрыта, ядро наружу; legs — фаза шага; mono — кадр вспышки
// ------------------------------------------------------------
function boss2Sprite(open, eyes, legs, mono) {
  const c = makeCanvas(40, 34), q = px(c.getContext('2d'), TH_REACTOR, mono);
  // ---- ноги-корни ----
  const feet = [2, 12, 23, 32];
  for (let i = 0; i < feet.length; i++) {
    const bx = feet[i];
    const k = legs === 0 ? 0 : (((i % 2 === 0) === (legs === 1)) ? 1 : -1);
    q.r(bx + 1, 24, 4, 6, 'd'); q.vl(bx + 1, 24, 6, 'M'); q.vl(bx + 4, 24, 6, 'K');
    q.r(bx + k, 30, 6, 2, 'M'); q.hl(bx + k, 30, 6, 'm');
    q.r(bx - 1 + k, 32, 3, 2, 'd'); q.r(bx + 4 + k, 32, 3, 2, 'd');
  }
  // ---- корпус ----
  const inset = [8, 5, 3, 2, 2, 1, 1, 1, 1, 1, 1, 2, 2, 3, 5, 8];
  for (let i = 0; i < inset.length; i++) {
    const y = 10 + i, x0 = inset[i], w = 40 - x0 * 2;
    q.r(x0, y, w, 1, 'M');
    q.hl(x0, y, 2, 'W'); q.hl(x0 + w - 2, y, 2, 'd');
  }
  q.hl(inset[0], 10, 40 - inset[0] * 2, 'W');
  q.hl(inset[inset.length - 1], 25, 40 - inset[inset.length - 1] * 2, 'K');
  // тёмная полость с глазами
  q.r(6, 13, 28, 8, 'K'); q.hl(6, 13, 28, 'D');
  for (const ex of [9, 16, 22, 29]) {
    q.r(ex, 15, 3, 2, eyes);
    q.p(ex + 1, 17, eyes === 'R' ? 'r' : eyes);
  }
  // нижняя вентиляция
  q.r(8, 22, 24, 2, 'd'); q.hl(8, 22, 24, 'm'); q.hl(12, 23, 16, 'C');
  // ---- броня / раскрытое ядро ----
  if (!open) {
    const crown = [[14, 12], [11, 18], [9, 22], [7, 26], [6, 28], [5, 30]];
    for (let i = 0; i < crown.length; i++) {
      const y = i + 3, x0 = crown[i][0], w = crown[i][1];
      q.r(x0, y, w, 1, 'M');
      q.hl(x0, y, 2, 'W'); q.hl(x0 + w - 2, y, 2, 'd');
    }
    q.hl(14, 3, 12, 'W');
    q.r(10, 6, 20, 3, 'm'); q.hl(10, 6, 20, 'W'); q.hl(10, 8, 20, 'd');
    q.r(5, 9, 30, 1, 'M');
    // прожилки на броне
    q.hl(13, 7, 6, 'C'); q.hl(21, 7, 6, 'C');
  } else {
    for (let i = 0; i < 7; i++) {                 // лепестки разошлись
      const y = i + 2, w = 7 - Math.floor(i / 3);
      q.r(2 + i, y, w, 1, 'M'); q.p(2 + i, y, 'W');
      q.r(38 - i - w, y, w, 1, 'M'); q.p(37 - i, y, 'd');
    }
    q.r(15, 2, 10, 8, 'g');                        // ядро
    q.r(16, 1, 8, 10, 'G');
    q.r(17, 3, 6, 5, 'G'); q.r(18, 4, 4, 3, 'w');
    q.p(15, 1, 'G'); q.p(24, 1, 'G');
    q.r(12, 9, 16, 1, 'M'); q.hl(12, 9, 16, 'W');
  }
  return c;
}

// ------------------------------------------------------------
//  БОСС «SOVEREIGN» 36x30 — венценосная машина ASHEN CITADEL (процедурно)
//  open — корона раскрыта, ядро наружу; wing — наклон боковых мантий
// ------------------------------------------------------------
function boss3Sprite(open, eyes, wing, mono) {
  const c = makeCanvas(36, 30), q = px(c.getContext('2d'), TH_CITADEL, mono);
  const tilt = wing === 1 ? 1 : wing === 2 ? -1 : 0;

  // ---- боковые мантии-пилоны ----
  for (const s of [-1, 1]) {
    for (let i = 0; i < 14; i++) {
      const w = 6 - Math.floor(Math.abs(i - 6) / 3);
      const y = 9 + i + (i < 7 ? tilt : 0);
      const x = s < 0 ? 1 : 35 - w;
      q.r(x, y, w, 1, i % 5 === 2 ? 'm' : 'M');
      q.p(s < 0 ? x : x + w - 1, y, s < 0 ? 'W' : 'd');
    }
    const vx = s < 0 ? 3 : 32;
    q.vl(vx, 13 + tilt, 6, 'C');                      // золотая прожилка мантии
    q.p(vx, 12 + tilt, 'Y');
  }

  // ---- корпус ----
  const inset = [10, 8, 7, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 8, 9, 11, 13];
  for (let i = 0; i < inset.length; i++) {
    const y = 7 + i, x0 = inset[i], w = 36 - x0 * 2;
    q.r(x0, y, w, 1, 'M');
    q.hl(x0, y, 2, 'W'); q.hl(x0 + w - 2, y, 2, 'd');
  }
  q.hl(inset[0], 7, 36 - inset[0] * 2, 'W');
  q.hl(inset[17], 24, 36 - inset[17] * 2, 'K');
  // визор с тремя глазами
  q.r(8, 11, 20, 7, 'K'); q.hl(8, 11, 20, 'D'); q.hl(8, 17, 20, 'D');
  for (const ex of [11, 17, 23]) {
    q.r(ex, 13, 3, 2, eyes);
    q.p(ex + 1, 15, eyes === 'R' ? 'r' : eyes);
  }
  // рёбра и вентиляция
  q.r(10, 19, 16, 2, 'd'); q.hl(10, 19, 16, 'm'); q.hl(13, 20, 10, 'C');
  q.r(14, 22, 8, 2, 'd'); q.hl(14, 22, 8, 'm');
  // антиграв-подвес
  for (let i = 0; i < 4; i++) {
    const w = 12 - i * 2;
    q.r(18 - w / 2, 25 + i, w, 1, i < 2 ? 'M' : 'P');
  }
  q.p(17, 29, 'P'); q.p(18, 29, 'w');

  // ---- корона / раскрытое ядро ----
  if (!open) {
    const crown = [[16, 4], [14, 8], [12, 12], [10, 16], [9, 18]];
    for (let i = 0; i < crown.length; i++) {
      const y = i + 2, x0 = crown[i][0], w = crown[i][1];
      q.r(x0, y, w, 1, 'M'); q.hl(x0, y, 2, 'W'); q.hl(x0 + w - 2, y, 2, 'd');
    }
    q.hl(16, 2, 4, 'W');
    q.r(15, 4, 6, 2, 'C'); q.p(17, 4, 'Y'); q.p(18, 5, 'w');   // камень короны
    q.p(8, 6, 'M'); q.p(27, 6, 'M');
  } else {
    for (let i = 0; i < 6; i++) {                     // лепестки короны разошлись
      const y = i + 1, w = 6 - Math.floor(i / 3);
      q.r(3 + i, y, w, 1, 'M'); q.p(3 + i, y, 'W');
      q.r(33 - i - w, y, w, 1, 'M'); q.p(32 - i, y, 'd');
    }
    q.r(13, 1, 10, 8, 'g');                           // ядро
    q.r(14, 0, 8, 10, 'G');
    q.r(15, 2, 6, 5, 'G'); q.r(16, 3, 4, 3, 'w');
    q.p(13, 0, 'G'); q.p(22, 0, 'G');
    q.r(11, 8, 14, 1, 'M'); q.hl(11, 8, 14, 'W');
  }
  return c;
}

// ------------------------------------------------------------
//  ЭНЕРГОЯЧЕЙКА 8x10, 2 кадра
// ------------------------------------------------------------
const CELL = [
  [
    '..MMMM..',
    '.MGGGGM.',
    '.MGwGGM.',
    '.MGwGGM.',
    '.MGGGGM.',
    '.MGGGGM.',
    '.MgGGgM.',
    '.MggggM.',
    '.MMMMMM.',
    '..M..M..',
  ],
  [
    '..MMMM..',
    '.MGGGGM.',
    '.MGGGGM.',
    '.MGGGwM.',
    '.MGGGwM.',
    '.MGGGGM.',
    '.MgGGgM.',
    '.MggggM.',
    '.MMMMMM.',
    '..M..M..',
  ],
];

// ------------------------------------------------------------
//  ТАЙЛЫ (процедурно, с учётом темы)
// ------------------------------------------------------------
function tileGroundTop(th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(0, 0, 16, 16, 'M');
  q.hl(0, 0, 16, 'W');
  q.hl(0, 1, 16, 'm');
  q.hl(0, 2, 16, 'C');          // неоновая кромка
  q.hl(0, 3, 16, 'c');
  q.r(0, 4, 16, 12, 'M');
  q.hl(0, 15, 16, 'd');
  q.vl(0, 4, 12, 'm'); q.vl(15, 4, 12, 'd');
  // заклёпки
  for (const x of [3, 12]) { q.p(x, 7, 'W'); q.p(x + 1, 7, 'd'); q.p(x, 12, 'W'); q.p(x + 1, 12, 'd'); }
  q.hl(6, 9, 4, 'd'); q.hl(6, 10, 4, 'm');
  return c;
}
function tileGroundFill(th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(0, 0, 16, 16, 'd');
  q.hl(0, 0, 16, 'M'); q.vl(0, 0, 16, 'M');
  q.hl(0, 15, 16, 'D'); q.vl(15, 0, 16, 'D');
  q.r(2, 2, 12, 5, 'D'); q.hl(2, 2, 12, 'K');
  q.r(2, 9, 12, 5, 'D'); q.hl(2, 9, 12, 'K');
  q.p(4, 4, 'M'); q.p(11, 4, 'M'); q.p(4, 11, 'M'); q.p(11, 11, 'M');
  return c;
}
function tileGroundFillVar(th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(0, 0, 16, 16, 'd');
  q.hl(0, 0, 16, 'M'); q.vl(0, 0, 16, 'M');
  q.hl(0, 15, 16, 'D'); q.vl(15, 0, 16, 'D');
  q.r(2, 2, 12, 12, 'D'); q.hl(2, 2, 12, 'K');
  // вентиляционная решётка
  for (let y = 5; y < 13; y += 2) q.hl(4, y, 8, 'K');
  for (let y = 4; y < 13; y += 2) q.hl(4, y, 8, 'M');
  q.p(13, 3, 'C');
  return c;
}
function tileGroundLeft(th) {  // левый край (пустота слева)
  const c = tileGroundFill(th), q = px(c.getContext('2d'), th);
  q.vl(0, 0, 16, 'W'); q.vl(1, 0, 16, 'm');
  return c;
}
function tileGroundRight(th) {
  const c = tileGroundFill(th), q = px(c.getContext('2d'), th);
  q.vl(15, 0, 16, 'K'); q.vl(14, 0, 16, 'D');
  return c;
}

// Парящая платформа: три секции
function tilePlatform(kind, th) { // 'l' | 'm' | 'r' | 's' (одиночная)
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  const L = kind === 'l' || kind === 's', R = kind === 'r' || kind === 's';
  q.r(0, 0, 16, 9, 'M');
  q.hl(0, 0, 16, 'W'); q.hl(0, 1, 16, 'm');
  q.hl(0, 8, 16, 'd');
  q.r(0, 9, 16, 3, 'D');
  q.hl(0, 10, 16, 'P');   // подсветка антиграва
  q.hl(0, 11, 16, 'p');
  if (L) { q.vl(0, 0, 12, 'W'); q.p(0, 12, 'M'); q.p(1, 12, 'd'); q.hl(0, 13, 2, 'd'); }
  if (R) { q.vl(15, 0, 12, 'd'); q.p(15, 12, 'M'); q.p(14, 12, 'd'); q.hl(14, 13, 2, 'd'); }
  // панели
  q.hl(3, 4, 4, 'd'); q.hl(9, 4, 4, 'd'); q.hl(3, 5, 4, 'm'); q.hl(9, 5, 4, 'm');
  return c;
}
// Односторонняя решётчатая платформа (тонкая)
function tileOneWay(th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.hl(0, 0, 16, 'W'); q.hl(0, 1, 16, 'm');
  for (let x = 0; x < 16; x += 4) q.r(x, 2, 2, 3, 'M');   // просветы между прутьями сквозные
  q.hl(0, 5, 16, 'd');
  q.p(1, 6, 'C'); q.p(14, 6, 'C');
  return c;
}
// Лазерные шипы (опасность)
function tileSpikes(frame, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(0, 12, 16, 4, 'd'); q.hl(0, 12, 16, 'M'); q.hl(0, 15, 16, 'K');
  for (let x = 1; x < 16; x += 5) {
    q.r(x, 10, 3, 2, 'M');
    const h = frame ? 7 : 8;
    q.vl(x + 1, 10 - h, h, 'R');
    q.p(x + 1, 10 - h, 'w');
    q.p(x, 10 - h + 2, 'r'); q.p(x + 2, 10 - h + 2, 'r');
  }
  return c;
}
function tilePipeV(th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(4, 0, 8, 16, 'M'); q.vl(4, 0, 16, 'W'); q.vl(5, 0, 16, 'm'); q.vl(11, 0, 16, 'd'); q.vl(10, 0, 16, 'd');
  q.r(3, 6, 10, 3, 'm'); q.hl(3, 6, 10, 'W'); q.hl(3, 8, 10, 'd');
  return c;
}
function tilePipeH(th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(0, 4, 16, 8, 'M'); q.hl(0, 4, 16, 'W'); q.hl(0, 5, 16, 'm'); q.hl(0, 11, 16, 'd'); q.hl(0, 10, 16, 'd');
  q.r(6, 3, 3, 10, 'm'); q.vl(6, 3, 10, 'W'); q.vl(8, 3, 10, 'd');
  return c;
}
function tileCrystal(frame, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  const g = frame ? 'G' : 'g';
  // большой кристалл
  q.r(6, 4, 4, 12, 'g'); q.p(7, 2, g); q.r(6, 3, 4, 1, g); q.vl(6, 3, 13, 'G'); q.vl(7, 4, 4, 'w');
  // малые
  q.r(2, 9, 3, 7, 'g'); q.p(3, 8, g); q.vl(2, 9, 7, 'G');
  q.r(11, 10, 3, 6, 'g'); q.p(12, 9, g); q.vl(11, 10, 6, 'G');
  q.hl(1, 15, 14, 'd');
  return c;
}
function tileWallLight(frame, th) {  // декоративная панель фона со светильником
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(2, 2, 12, 12, 'D'); q.hl(2, 2, 12, 'd'); q.vl(2, 2, 12, 'd');
  q.r(5, 5, 6, 6, frame ? 'C' : 'c'); q.r(6, 6, 4, 4, frame ? 'w' : 'C');
  q.hl(4, 13, 8, 'K');
  return c;
}
function tileSpring(compressed, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(2, 13, 12, 3, 'M'); q.hl(2, 13, 12, 'm');
  const top = compressed ? 10 : 4;
  for (let y = top + 2; y < 13; y += 2) { q.hl(5, y, 6, 'd'); q.hl(4, y + 1, 8, 'm'); }
  q.r(1, top, 14, 2, 'O'); q.hl(1, top, 14, 'Y'); q.hl(1, top + 2, 14, 'o');
  return c;
}
function tileConsole(frame, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(1, 4, 14, 12, 'M'); q.hl(1, 4, 14, 'W'); q.vl(1, 4, 12, 'm'); q.hl(1, 15, 14, 'd');
  q.r(3, 6, 10, 5, 'K');
  const cols = frame ? ['G', 'C', 'Y'] : ['C', 'G', 'C'];
  q.hl(4, 7, 3, cols[0]); q.hl(4, 9, 5, cols[1]); q.hl(9, 7, 3, cols[2]);
  q.p(5, 13, 'R'); q.p(8, 13, 'G'); q.p(11, 13, frame ? 'Y' : 'o');
  return c;
}

// --- новые тайлы VERDANT REACTOR ---

// Осыпающаяся плита: 0 — целая, 1 — трещины, 2 — рассыпается
function tileCrumble(stage, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(0, 0, 16, 16, 'd');
  q.hl(0, 0, 16, 'm'); q.vl(0, 0, 16, 'm');
  q.hl(0, 15, 16, 'K'); q.vl(15, 0, 16, 'K');
  q.r(2, 2, 12, 12, 'M'); q.hl(2, 2, 12, 'W'); q.hl(2, 13, 12, 'D');
  q.r(4, 4, 8, 8, 'd');
  // индикатор прочности
  const lamp = stage === 0 ? 'C' : stage === 1 ? 'Y' : 'R';
  q.r(7, 6, 2, 4, lamp); q.p(7, 6, 'w');
  if (stage >= 1) {
    for (const [x, y] of [[3, 3], [4, 5], [5, 6], [10, 4], [11, 6], [6, 11], [12, 10]]) q.p(x, y, 'K');
    q.vl(5, 3, 3, 'K'); q.hl(9, 12, 4, 'K');
  }
  if (stage >= 2) {
    for (const [x, y] of [[3, 8], [4, 9], [6, 3], [8, 12], [12, 3], [13, 7], [2, 12], [9, 9]]) q.p(x, y, 'K');
    q.vl(11, 4, 8, 'K'); q.hl(3, 7, 5, 'K'); q.vl(6, 8, 5, 'K');
  }
  return c;
}
// Донный вентилятор: гонит восходящий поток
function tileVent(frame, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(0, 0, 16, 16, 'M');
  q.hl(0, 0, 16, 'W'); q.hl(0, 1, 16, 'm'); q.hl(0, 15, 16, 'd');
  q.r(2, 2, 12, 12, 'K'); q.hl(2, 2, 12, 'D');
  for (let i = 0; i < 3; i++) {
    q.r(3 + i * 4, 3, 2, 10, 'd');
    q.vl(4 + i * 4, 3 + (frame ? 0 : 2), 9, frame ? 'C' : 'c');
  }
  q.hl(0, 2, 16, frame ? 'C' : 'c');
  q.p(1, 5, 'C'); q.p(14, 9, 'C');
  return c;
}
// Излучатель лазерного затвора (0 — выкл, 1 — предупреждение, 2 — вкл)
function tileGate(stage, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(1, 0, 14, 6, 'M'); q.hl(1, 0, 14, 'W'); q.hl(1, 5, 14, 'd');
  q.r(0, 1, 2, 4, 'm'); q.r(14, 1, 2, 4, 'm');
  q.r(4, 6, 8, 4, 'd'); q.hl(4, 6, 8, 'm');
  const col = stage === 2 ? 'R' : stage === 1 ? 'Y' : 'D';
  q.r(5, 9, 6, 3, col);
  q.r(6, 10, 4, 2, stage ? 'w' : 'K');
  q.p(2, 3, stage === 2 ? 'R' : 'K'); q.p(13, 3, stage === 2 ? 'R' : 'K');
  return c;
}
// Расплав: поверхность (2 кадра) и толща
function tileMeltTop(frame, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  for (let x = 0; x < 16; x++) {
    const y = 1 + Math.round(1.6 * (1 + Math.sin((x + frame * 3) / 2.4)));
    q.r(x, y, 1, 2, 'Y');                       // гребень
    q.r(x, y + 2, 1, 3, 'O');
    q.r(x, y + 5, 1, 4, 'o');
    q.r(x, y + 9, 1, 16 - y - 9, 'r');          // глубина
    if ((x + frame * 2) % 5 === 0) q.p(x, y, 'w');
  }
  return c;
}
function tileMeltBody(th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(0, 0, 16, 16, 'r');
  for (const [x, y, w] of [[1, 2, 5], [8, 4, 6], [3, 7, 4], [10, 9, 5], [5, 12, 6], [12, 13, 3]]) {
    q.r(x, y, w, 1, 'o'); q.p(x + 1, y + 1, 'o');   // тлеющие прожилки
  }
  q.hl(0, 0, 16, 'o');
  return c;
}

// --- новые тайлы ASHEN CITADEL ---

// Фазовая плита: группа 0 (золото) и 1 (азур) гаснут по очереди.
// stage: 0 — твёрдая, 1 — предупреждение, 2 — призрак (проходится насквозь)
function tilePhase(group, stage, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  const neon = group ? 'P' : 'C', dark = group ? 'p' : 'c';
  const rune = (col, faint) => {
    if (!group) {                                   // ромб
      for (let i = 0; i < 4; i++) { q.hl(7 - i, 4 + i, 2 + i * 2, col); q.hl(7 - i, 11 - i, 2 + i * 2, col); }
      if (!faint) { q.p(7, 5, 'w'); q.p(6, 6, 'w'); }
    } else {                                        // кольцо
      q.r(5, 4, 6, 2, col); q.r(5, 9, 6, 2, col); q.r(4, 5, 2, 5, col); q.r(10, 5, 2, 5, col);
      if (!faint) { q.p(5, 4, 'w'); q.p(10, 10, 'w'); }
    }
  };
  if (stage === 2) {                                // призрак: только разметка
    for (let i = 0; i < 16; i += 3) { q.p(i, 0, dark); q.p(i, 15, dark); q.p(0, i, dark); q.p(15, i, dark); }
    for (const [sx, sy] of [[0, 0], [14, 0], [0, 14], [14, 14]]) { q.r(sx, sy, 2, 1, dark); q.r(sx, sy, 1, 2, dark); }
    rune('D', true);
    return c;
  }
  q.r(0, 0, 16, 16, 'M');
  q.hl(0, 0, 16, 'W'); q.vl(0, 0, 16, 'm');
  q.hl(0, 15, 16, 'K'); q.vl(15, 0, 16, 'd');
  q.r(2, 2, 12, 12, 'D'); q.hl(2, 2, 12, 'K');
  rune(stage === 1 ? dark : neon, stage === 1);
  for (const [sx, sy] of [[1, 1], [13, 1], [1, 13], [13, 13]]) q.r(sx, sy, 2, 2, stage === 1 ? 'Y' : neon);
  return c;
}

// Конвейерная лента: твёрдый пол, тянущий игрока. dir = -1 / 1, 4 кадра
function tileConveyor(dir, frame, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(0, 0, 16, 16, 'M');
  q.hl(0, 0, 16, 'W');
  q.r(0, 1, 16, 6, 'K'); q.hl(0, 1, 16, 'd');
  for (let i = -1; i < 3; i++) {                    // стрелки бегут по ленте в сторону тяги
    const x = ((i * 8 + dir * frame * 2) % 16 + 16) % 16;
    const at = k => ((x + dir * k) % 16 + 16) % 16;
    for (let k = 0; k < 3; k++) { q.p(at(k), 3 + k, 'c'); q.p(at(k), 5 - k, 'c'); }
    for (let k = 0; k < 3; k++) { q.p(at(k), 2 + k, 'C'); q.p(at(k), 6 - k, 'C'); }
  }
  q.hl(0, 7, 16, 'm');
  q.r(0, 8, 16, 8, 'd'); q.hl(0, 15, 16, 'K');
  for (const rx of [3, 11]) {                       // ролики
    q.r(rx, 10, 4, 4, 'M'); q.hl(rx, 10, 4, 'm');
    q.p(rx + ((frame + rx) % 3), 12, 'K');
  }
  return c;
}

// Пресс: тяжёлая голова с зубьями и штанга-шахта над ней
function pressHead(hot, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(0, 0, 16, 11, 'M');
  q.hl(0, 0, 16, 'W'); q.hl(0, 1, 16, 'm');
  q.vl(0, 0, 11, 'm'); q.vl(15, 0, 11, 'd');
  q.r(2, 3, 12, 4, 'd'); q.hl(2, 3, 12, 'K');
  q.hl(3, 5, 10, hot ? 'R' : 'c');                  // индикатор готовности
  q.hl(0, 10, 16, 'K'); q.r(0, 11, 16, 2, 'd'); q.hl(0, 11, 16, 'm');
  for (let x = 1; x < 15; x += 3) {                 // зубья
    q.r(x, 13, 2, 1, 'W'); q.r(x, 14, 2, 1, 'm'); q.p(x, 15, 'w');
  }
  return c;
}
function pressShaft(th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(5, 0, 6, 16, 'M'); q.vl(5, 0, 16, 'W'); q.vl(7, 0, 16, 'm'); q.vl(10, 0, 16, 'd');
  q.r(4, 2, 8, 2, 'd'); q.hl(4, 2, 8, 'm');
  q.r(4, 10, 8, 2, 'd'); q.hl(4, 10, 8, 'm');
  return c;
}

// Разлом пустоты: поверхность (3 кадра) и толща (2 кадра). Вне тем — свой набор цветов.
function tileVoidTop(frame) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'));
  for (let x = 0; x < 16; x++) {
    const y = 2 + Math.round(1.4 * Math.sin((x + frame * 2.7) / 2.6));
    q.p(x, y, 'Z4');
    q.r(x, y + 1, 1, 2, 'Z3');
    q.r(x, y + 3, 1, 3, 'Z2');
    q.r(x, y + 6, 1, 16 - y - 6, 'Z1');
    if ((x * 3 + frame * 5) % 7 === 0) q.p(x, y + 5 + (frame % 3), 'Z3');
  }
  return c;
}
function tileVoidBody(frame) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'));
  q.r(0, 0, 16, 16, 'Z1');
  q.r(1, 2, 14, 12, 'Z0');
  for (let i = 0; i < 7; i++) {                     // искры в глубине
    const x = (i * 5 + frame * 3) % 16, y = (i * 7 + frame * 5) % 16;
    q.p(x, y, 'Z2'); q.p((x + 3) % 16, (y + 5) % 16, i % 3 ? 'Z2' : 'Z3');
  }
  return c;
}

// Портал выхода 32x32, 2 кадра
function portal(frame, th) {
  const c = makeCanvas(32, 32), q = px(c.getContext('2d'), th);
  // рама
  q.r(2, 0, 28, 32, 'D');
  q.r(4, 2, 24, 28, 'K');
  q.vl(2, 0, 32, 'M'); q.vl(29, 0, 32, 'M'); q.hl(2, 0, 28, 'W'); q.hl(2, 31, 28, 'd');
  q.r(0, 28, 32, 4, 'M'); q.hl(0, 28, 32, 'W');
  // энергия
  for (let y = 3; y < 29; y++) {
    const t = (y + frame * 3) % 6;
    const col = t < 2 ? 'B' : t < 4 ? 'C' : 'b';
    q.hl(6, y, 20, col);
    if (t === 2) q.hl(9, y, 14, 'w');
  }
  q.p(2, 14 + frame, 'C'); q.p(29, 16 - frame, 'C');
  return c;
}

// Движущаяся платформа 32x8
function movingPlatform(th) {
  const c = makeCanvas(32, 8), q = px(c.getContext('2d'), th);
  q.r(0, 0, 32, 6, 'M'); q.hl(0, 0, 32, 'W'); q.hl(0, 1, 32, 'm'); q.hl(0, 5, 32, 'd');
  q.hl(2, 6, 28, 'Y'); q.hl(3, 7, 26, 'o');
  q.vl(0, 0, 6, 'W'); q.vl(31, 0, 6, 'd');
  q.r(6, 2, 4, 2, 'd'); q.r(14, 2, 4, 2, 'd'); q.r(22, 2, 4, 2, 'd');
  return c;
}

// ------------------------------------------------------------
//  ФОНЫ — ORBITAL FOUNDRY (параллакс)
// ------------------------------------------------------------
function bgSky(w, h) {
  const c = makeCanvas(w, h), q = px(c.getContext('2d'));
  // полосатый градиент (как на 16-битках — ступенями)
  const bands = ['#120a2a', '#160d33', '#1a1040', '#1c1448', '#1a1a4e', '#161d50', '#111d4a', '#0e1a40', '#0b1536'];
  for (let i = 0; i < bands.length; i++) q.r(0, Math.floor(i * h / bands.length), w, Math.ceil(h / bands.length) + 1, bands[i]);
  const R = rng(7);
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(R() * w), y = Math.floor(R() * h * 0.75);
    q.p(x, y, R() < 0.2 ? 'w' : R() < 0.5 ? 'W' : 'm');
    if (R() < 0.15) { q.p(x + 1, y, 'M'); q.p(x - 1, y, 'M'); q.p(x, y + 1, 'M'); q.p(x, y - 1, 'M'); }
  }
  // планета с кольцом
  const cx = 230, cy = 60, rad = 26;
  for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
    const d = x * x + y * y;
    if (d > rad * rad) continue;
    const shade = (x + y * 0.5) / rad;
    q.p(cx + x, cy + y, shade < -0.6 ? 'P' : shade < -0.1 ? 'p' : shade < 0.4 ? 'V' : 'v');
  }
  // кольцо
  for (let x = -40; x <= 40; x++) {
    const y = Math.round(x * 0.22);
    if (Math.abs(x) < 20 && y < 0) continue; // за планетой
    q.p(cx + x, cy + y, 'W'); q.p(cx + x, cy + y + 1, 'm');
  }
  // туманность
  const R2 = rng(99);
  for (let i = 0; i < 400; i++) {
    const x = Math.floor(R2() * 140 + 20), y = Math.floor(R2() * 60 + 40);
    q.p(x, y, R2() < 0.5 ? 'v' : 'V');
  }
  return c;
}

function bgCity(w, h) {  // дальние башни мегаполиса
  const c = makeCanvas(w, h), q = px(c.getContext('2d'));
  const R = rng(3);
  let x = 0;
  while (x < w) {
    const bw = 10 + Math.floor(R() * 22), bh = 40 + Math.floor(R() * 110);
    const top = h - bh;
    q.r(x, top, bw, bh, 'D');
    q.vl(x, top, bh, 'd');
    if (R() < 0.5) { q.r(x + Math.floor(bw / 2) - 1, top - 6, 2, 6, 'D'); q.p(x + Math.floor(bw / 2) - 1, top - 7, 'R'); }
    for (let wy = top + 4; wy < h - 4; wy += 5) for (let wx = x + 2; wx < x + bw - 2; wx += 4)
      if (R() < 0.35) q.p(wx, wy, R() < 0.7 ? 'Y' : 'C');
    x += bw + Math.floor(R() * 4);
  }
  return c;
}

function bgStructures(w, h) { // ближний слой: балки, трубы, рекламные панели
  const c = makeCanvas(w, h), q = px(c.getContext('2d'));
  const R = rng(11);
  // горизонтальная магистраль
  q.r(0, 70, w, 6, 'd'); q.hl(0, 70, w, 'M'); q.hl(0, 75, w, 'K');
  for (let x = 0; x < w; x += 48) { q.r(x + 20, 76, 6, h - 76, 'd'); q.vl(x + 20, 76, h, 'M'); }
  // вертикальные трубы и панели
  let x = 8;
  while (x < w) {
    const kind = R();
    if (kind < 0.4) {
      const ph = 60 + Math.floor(R() * 100);
      q.r(x, h - ph, 6, ph, 'd'); q.vl(x, h - ph, ph, 'M'); q.vl(x + 5, h - ph, ph, 'K');
      q.r(x - 1, h - ph + 10, 8, 3, 'M');
    } else if (kind < 0.7) {
      const pw = 24, ph = 14, py = 90 + Math.floor(R() * 60);
      q.r(x, py, pw, ph, 'K'); q.r(x, py, pw, 1, 'M'); q.r(x, py + ph - 1, pw, 1, 'M');
      const col = ['P', 'C', 'Y', 'G'][Math.floor(R() * 4)];
      for (let i = 0; i < 4; i++) q.hl(x + 3 + i * 5, py + 4 + (i % 2) * 4, 3, col);
    } else {
      q.r(x, 110, 14, h - 110, 'D'); q.vl(x, 110, h, 'd');
      for (let y = 116; y < h; y += 8) q.hl(x + 3, y, 8, 'K');
    }
    x += 30 + Math.floor(R() * 40);
  }
  return c;
}

// ------------------------------------------------------------
//  ФОНЫ — VERDANT REACTOR (заросший реактор): та же схема из трёх слоёв
// ------------------------------------------------------------
function bgSporeSky(w, h) {
  const c = makeCanvas(w, h), q = px(c.getContext('2d'));
  const bands = ['#05110d', '#07170f', '#0a1d14', '#0d2419', '#102a1e', '#123021', '#16351f', '#1b3a22', '#20401f'];
  for (let i = 0; i < bands.length; i++) q.r(0, Math.floor(i * h / bands.length), w, Math.ceil(h / bands.length) + 1, bands[i]);
  const R = rng(23);
  // споровая взвесь вместо звёзд
  for (let i = 0; i < 150; i++) {
    const x = Math.floor(R() * w), y = Math.floor(R() * h * 0.8);
    q.p(x, y, R() < 0.25 ? 'x' : R() < 0.6 ? 'T' : 'q');
    if (R() < 0.12) { q.p(x + 1, y, 't'); q.p(x, y + 1, 't'); }
  }
  // двойная луна: большая фиолетовая + малый янтарный спутник
  const cx = 96, cy = 52, rad = 30;
  for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
    if (x * x + y * y > rad * rad) continue;
    const shade = (x * 0.8 + y * 0.6) / rad;
    q.p(cx + x, cy + y, shade < -0.5 ? 'U' : shade < 0 ? 'u' : shade < 0.5 ? 'y' : 'h');
  }
  // кратеры
  const R3 = rng(5);
  for (let i = 0; i < 14; i++) {
    const a = R3() * Math.PI * 2, d = R3() * rad * 0.8;
    const x = cx + Math.round(Math.cos(a) * d), y = cy + Math.round(Math.sin(a) * d), s = 1 + Math.floor(R3() * 3);
    q.r(x, y, s, s, 'u');
  }
  const mx = 236, my = 38, mr = 9;
  for (let y = -mr; y <= mr; y++) for (let x = -mr; x <= mr; x++) {
    if (x * x + y * y > mr * mr) continue;
    q.p(mx + x, my + y, (x + y * 0.5) / mr < -0.2 ? 'a' : 'i');
  }
  // дымка спор
  const R2 = rng(71);
  for (let i = 0; i < 420; i++) {
    const x = Math.floor(R2() * 180 + 60), y = Math.floor(R2() * 70 + 70);
    q.p(x, y, R2() < 0.5 ? 'j' : 'J');
  }
  return c;
}

function bgFungalTowers(w, h) { // дальний слой: грибные башни реактора
  const c = makeCanvas(w, h), q = px(c.getContext('2d'));
  const R = rng(17);
  let x = 0;
  while (x < w) {
    const bw = 14 + Math.floor(R() * 20), bh = 50 + Math.floor(R() * 100);
    const top = h - bh;
    // ствол
    const sw = Math.max(6, Math.floor(bw / 2));
    const sx = x + Math.floor((bw - sw) / 2);
    q.r(sx, top + 8, sw, bh - 8, 'f');
    q.vl(sx, top + 8, bh - 8, 'e');
    // шляпка
    for (let i = 0; i < 9; i++) {
      const ww = bw - Math.abs(i - 2) * 2 - (i > 2 ? (i - 2) * 2 : 0);
      if (ww <= 0) continue;
      q.r(x + Math.floor((bw - ww) / 2), top + i, ww, 1, i < 2 ? 'e' : 'f');
    }
    q.hl(x + 2, top, bw - 4, 'e');
    // светящиеся поры
    for (let wy = top + 14; wy < h - 6; wy += 7)
      for (let wx = sx + 1; wx < sx + sw - 1; wx += 3)
        if (R() < 0.35) q.p(wx, wy, R() < 0.6 ? 'L' : 'T');
    if (R() < 0.5) { q.r(x + 1, top + 3, 2, 2, 'U'); q.r(x + bw - 3, top + 4, 2, 2, 'U'); }
    x += bw + 2 + Math.floor(R() * 8);
  }
  return c;
}

function bgRoots(w, h) { // ближний слой: корни, трубопровод, споровые гроздья
  const c = makeCanvas(w, h), q = px(c.getContext('2d'));
  const R = rng(29);
  // магистраль реактора
  q.r(0, 64, w, 7, 'e'); q.hl(0, 64, w, 'N'); q.hl(0, 70, w, 'F');
  for (let x = 0; x < w; x += 56) {
    q.r(x + 16, 71, 7, h - 71, 'e'); q.vl(x + 16, 71, h, 'N');
    q.r(x + 13, 74, 13, 3, 'e'); q.hl(x + 13, 74, 13, 'N');
    q.p(x + 19, 67, 'L');
  }
  // свисающие корни
  let x = 4;
  while (x < w) {
    const kind = R();
    if (kind < 0.45) {
      const ph = 70 + Math.floor(R() * 110);
      q.r(x, 0, 5, ph, 'f'); q.vl(x, 0, ph, 'e'); q.vl(x + 4, 0, ph, 'F');
      // утолщения
      for (let y = 24; y < ph - 6; y += 26) { q.r(x - 1, y, 7, 4, 'e'); q.hl(x - 1, y, 7, 'N'); }
      q.r(x + 1, ph, 3, 4, 'f'); q.p(x + 2, ph + 4, 'e');
      if (R() < 0.6) { q.r(x - 1, ph - 12, 3, 3, 'T'); q.p(x - 2, ph - 11, 't'); }
    } else if (kind < 0.75) {
      const py = 92 + Math.floor(R() * 60);
      q.r(x, py, 20, 12, 'F'); q.hl(x, py, 20, 'N'); q.hl(x, py + 11, 20, 'N');
      const col = ['L', 'U', 'a', 'T'][Math.floor(R() * 4)];
      for (let i = 0; i < 4; i++) q.hl(x + 3 + i * 4, py + 3 + (i % 2) * 5, 3, col);
    } else {
      // гроздь споровых шаров на стойке
      const py = 100 + Math.floor(R() * 40);
      q.r(x + 5, py, 3, h - py, 'e');
      for (let i = 0; i < 3; i++) {
        const bx = x + i * 6, by = py + 6 + (i % 2) * 7;
        q.r(bx + 1, by, 5, 5, 't'); q.r(bx + 2, by + 1, 3, 3, 'T'); q.p(bx + 3, by + 1, 'x');
      }
    }
    x += 28 + Math.floor(R() * 44);
  }
  return c;
}

// ------------------------------------------------------------
//  ФОНЫ — ASHEN CITADEL (пепельная цитадель): те же три слоя
// ------------------------------------------------------------
function bgAshSky(w, h) {
  const c = makeCanvas(w, h), q = px(c.getContext('2d'));
  const bands = ['#160d1c', '#1c1122', '#221528', '#28192c', '#2e1d2f', '#352131', '#3c2631', '#432b30', '#4a312f'];
  for (let i = 0; i < bands.length; i++) q.r(0, Math.floor(i * h / bands.length), w, Math.ceil(h / bands.length) + 1, bands[i]);
  const R = rng(41);
  // пепел и угли в воздухе
  for (let i = 0; i < 170; i++) {
    const x = Math.floor(R() * w), y = Math.floor(R() * h * 0.85);
    q.p(x, y, R() < 0.18 ? 'C3' : R() < 0.5 ? 'W3' : 'M3');
    if (R() < 0.1) { q.p(x, y + 1, 'd3'); q.p(x + 1, y, 'd3'); }
  }
  // затмение: чёрный диск с золотой короной
  const cx = 214, cy = 58, rad = 27;
  for (let i = 0; i < 360; i += 3) {                 // лучи короны
    const a = i * Math.PI / 180, len = rad + 4 + (i % 27 === 0 ? 12 : i % 9 === 0 ? 7 : 3);
    for (let d = rad; d < len; d++) {
      const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
      q.p(x, y, d < rad + 3 ? 'Y3' : d < rad + 7 ? 'C3' : 'o3');
    }
  }
  for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
    const d = Math.hypot(x, y);
    if (d > rad) continue;
    q.p(cx + x, cy + y, d > rad - 1.6 ? 'C3' : d > rad - 3 ? 'o3' : 'K3');
  }
  // пепельная дымка у горизонта
  const R2 = rng(67);
  for (let i = 0; i < 460; i++) {
    const x = Math.floor(R2() * 200 + 10), y = Math.floor(R2() * 64 + 84);
    q.p(x, y, R2() < 0.5 ? 'V3' : 'v3');
  }
  return c;
}

function bgSpires(w, h) {  // дальний слой: шпили цитадели
  const c = makeCanvas(w, h), q = px(c.getContext('2d'));
  const R = rng(13);
  let x = 0;
  while (x < w) {
    const bw = 12 + Math.floor(R() * 18), bh = 60 + Math.floor(R() * 110);
    const top = h - bh;
    q.r(x, top, bw, bh, 'D3');
    q.vl(x, top, bh, 'd3'); q.vl(x + bw - 1, top, bh, 'K3');
    // шпиль
    const sw = Math.min(9, bw - 2), sx = x + Math.floor((bw - sw) / 2);
    for (let i = 0; i < 18; i++) {
      const ww = Math.max(1, sw - Math.round(i * sw / 18) * 2 + (i > 12 ? 1 : 0));
      q.r(sx + Math.floor((sw - ww) / 2), top - 18 + i, Math.max(1, ww), 1, 'D3');
    }
    q.r(sx, top - 6, sw, 2, 'D3'); q.hl(sx, top - 6, sw, 'd3');   // карниз шпиля
    q.p(sx + Math.floor(sw / 2), top - 20, 'C3'); q.p(sx + Math.floor(sw / 2), top - 19, 'c3');
    // стрельчатые окна
    for (let wy = top + 10; wy < h - 6; wy += 14)
      for (let wx = x + 3; wx < x + bw - 3; wx += 7)
        if (R() < 0.34) { q.r(wx, wy, 2, 4, R() < 0.82 ? 'c3' : 'C3'); q.p(wx, wy - 1, 'c3'); q.p(wx + 1, wy - 1, 'c3'); }
    // контрфорс
    if (R() < 0.45) { q.r(x - 3, h - 40, 3, 40, 'D3'); q.vl(x - 3, h - 40, 40, 'K3'); }
    x += bw + 3 + Math.floor(R() * 10);
  }
  return c;
}

function bgRamparts(w, h) {  // ближний слой: колоннада, знамёна, жаровни
  const c = makeCanvas(w, h), q = px(c.getContext('2d'));
  const g = c.getContext('2d');
  const R = rng(53);
  // верхняя галерея: сплошная стена, в которой прорезаны стрельчатые пролёты
  q.r(0, 52, w, 38, 'D3');
  q.hl(0, 52, w, 'd3'); q.hl(0, 53, w, 'D3'); q.hl(0, 89, w, 'K3');
  for (let x = 0; x < w; x += 38) {
    for (const ax of [x + 5, x + 23]) {
      for (let i = 0; i < 28; i++) {                 // тёмный обвод проёма
        const half = i < 9 ? Math.round(6 * Math.sin((i / 9) * Math.PI / 2)) : 6;
        q.r(ax + 6 - half, 57 + i, half * 2, 1, 'K3');
      }
      for (let i = 0; i < 26; i++) {                 // сам проём — насквозь
        const half = i < 8 ? Math.round(5 * Math.sin((i / 8) * Math.PI / 2)) : 5;
        g.clearRect(ax + 6 - half, 59 + i, half * 2, 1);
      }
    }
    q.vl(x + 17, 56, 33, 'd3'); q.vl(x + 18, 56, 33, 'D3');   // пилястра между пролётами
    q.r(x + 15, 54, 6, 2, 'd3'); q.hl(x + 15, 54, 6, 'M3');
    q.p(x + 17, 62, 'c3');
  }
  // колонны, знамёна и жаровни нижнего яруса
  let x = 6;
  while (x < w) {
    const kind = R();
    if (kind < 0.4) {                                // колонна
      const ph = 80 + Math.floor(R() * 90);
      q.r(x, h - ph, 8, ph, 'D3');
      q.vl(x, h - ph, ph, 'd3'); q.vl(x + 7, h - ph, ph, 'K3');
      q.r(x - 2, h - ph, 12, 4, 'D3'); q.hl(x - 2, h - ph, 12, 'd3');
      for (let y = h - ph + 10; y < h; y += 14) q.hl(x + 1, y, 6, 'K3');
    } else if (kind < 0.7) {                         // знамя с гербом
      const py = 92 + Math.floor(R() * 44), ph = 40 + Math.floor(R() * 26);
      q.r(x - 2, py - 3, 18, 3, 'D3'); q.hl(x - 2, py - 3, 18, 'd3');
      q.r(x, py, 14, ph, 'K3'); q.vl(x, py, ph, 'D3'); q.vl(x + 13, py, ph, 'D3');
      for (let i = 0; i < 3; i++) q.p(x + 5 + i * 2, py + ph, 'K3');
      const col = ['c3', 'p3', 'b3', 'g3'][Math.floor(R() * 4)];
      q.r(x + 5, py + 8, 4, 4, col); q.p(x + 6, py + 9, 'D3');
      q.hl(x + 3, py + 16, 8, col); q.hl(x + 4, py + 19, 6, col);
    } else {                                         // жаровня на стойке
      const py = 104 + Math.floor(R() * 40);
      q.r(x + 5, py, 4, h - py, 'D3'); q.vl(x + 5, py, h - py, 'd3');
      q.r(x + 1, py - 5, 12, 5, 'D3'); q.hl(x + 1, py - 5, 12, 'd3'); q.hl(x + 1, py - 1, 12, 'K3');
      q.r(x + 3, py - 8, 8, 3, 'o3'); q.r(x + 4, py - 10, 6, 3, 'O3');
      q.r(x + 5, py - 12, 4, 2, 'C3'); q.p(x + 6, py - 13, 'Y3');
    }
    x += 30 + Math.floor(R() * 40);
  }
  return c;
}

// ------------------------------------------------------------
//  Сборка
// ------------------------------------------------------------
function buildTheme(th) {
  const T = {};
  T.groundTop = tileGroundTop(th);
  T.groundFill = tileGroundFill(th);
  T.groundFillVar = tileGroundFillVar(th);
  T.groundLeft = tileGroundLeft(th);
  T.groundRight = tileGroundRight(th);
  T.platL = tilePlatform('l', th); T.platM = tilePlatform('m', th);
  T.platR = tilePlatform('r', th); T.platS = tilePlatform('s', th);
  T.oneWay = tileOneWay(th);
  T.spikes = [tileSpikes(0, th), tileSpikes(1, th)];
  T.pipeV = tilePipeV(th); T.pipeH = tilePipeH(th);
  T.crystal = [tileCrystal(0, th), tileCrystal(1, th)];
  T.wallLight = [tileWallLight(0, th), tileWallLight(1, th)];
  T.spring = [tileSpring(false, th), tileSpring(true, th)];
  T.console = [tileConsole(0, th), tileConsole(1, th)];
  T.crumble = [tileCrumble(0, th), tileCrumble(1, th), tileCrumble(2, th)];
  T.vent = [tileVent(0, th), tileVent(1, th)];
  T.gate = [tileGate(0, th), tileGate(1, th), tileGate(2, th)];
  T.meltTop = [tileMeltTop(0, th), tileMeltTop(1, th)];
  T.meltBody = tileMeltBody(th);
  T.phase = [0, 1].map(g => [tilePhase(g, 0, th), tilePhase(g, 1, th), tilePhase(g, 2, th)]);
  T.belt = [-1, 1].map(d => [0, 1, 2, 3].map(f => tileConveyor(d, f, th)));
  T.press = [pressHead(false, th), pressHead(true, th)];
  T.shaft = pressShaft(th);
  return T;
}

function buildAssets() {
  const A = { player: {}, cell: [], themes: [] };

  for (const k of Object.keys(PLAYER_LEGS)) {
    const rows = PLAYER_BODY.concat(PLAYER_LEGS[k]);
    A.player[k] = [spriteFromRows(rows, false), spriteFromRows(rows, true)];
  }
  A.cell = CELL.map(r => spriteFromRows(r));
  // разлом пустоты живёт вне тем — своя палитра Z*
  A.rift = { top: [tileVoidTop(0), tileVoidTop(1), tileVoidTop(2)], body: [tileVoidBody(0), tileVoidBody(1)] };

  A.boss = {
    dormant: bossSprite('closed', 'G', 'r', 'off'),
    hover: [bossSprite('closed', 'G', 'R', 'on0'), bossSprite('closed', 'G', 'R', 'on1')],
    aim: [bossSprite('closed', 'G', 'Y', 'on0'), bossSprite('closed', 'G', 'w', 'on1')],
    stun: [bossSprite('open', 'G', 'r', 'off'), bossSprite('open', 'Y', 'r', 'off')],
    flash: bossFlashSprite(),
  };
  A.boss2 = {
    dormant: [boss2Sprite(false, 'r', 0), boss2Sprite(false, 'd', 0)],
    walk: [boss2Sprite(false, 'R', 1), boss2Sprite(false, 'R', 2)],
    aim: [boss2Sprite(false, 'Y', 1), boss2Sprite(false, 'w', 2)],
    dash: [boss2Sprite(false, 'w', 1), boss2Sprite(false, 'Y', 2)],
    open: [boss2Sprite(true, 'r', 0), boss2Sprite(true, 'R', 0)],
    flash: boss2Sprite(false, 'w', 0, 'w'),
  };
  A.boss3 = {
    dormant: [boss3Sprite(false, 'r', 0), boss3Sprite(false, 'd', 0)],
    hover: [boss3Sprite(false, 'R', 1), boss3Sprite(false, 'R', 2)],
    aim: [boss3Sprite(false, 'Y', 1), boss3Sprite(false, 'w', 2)],
    cast: [boss3Sprite(false, 'w', 2), boss3Sprite(false, 'Y', 1)],
    open: [boss3Sprite(true, 'r', 0), boss3Sprite(true, 'R', 1)],
    flash: boss3Sprite(false, 'w', 0, 'w'),
  };

  // фоны собираются лениво — по одному набору на тему
  const BG = [
    () => ({ far: bgSky(320, 224), mid: bgCity(480, 224), near: bgStructures(640, 224) }),
    () => ({ far: bgSporeSky(320, 224), mid: bgFungalTowers(480, 224), near: bgRoots(640, 224) }),
    () => ({ far: bgAshSky(320, 224), mid: bgSpires(480, 224), near: bgRamparts(640, 224) }),
  ];

  // темы: тайлы + враги + фоны
  for (let i = 0; i < THEMES.length; i++) {
    const th = THEMES[i];
    A.themes.push({
      tiles: buildTheme(th),
      drone: DRONE.map(r => [spriteFromRows(r, false, th), spriteFromRows(r, true, th)]),
      crawler: CRAWLER.map(r => [spriteFromRows(r, false, th), spriteFromRows(r, true, th)]),
      turret: TURRET.map(r => [spriteFromRows(r, false, th), spriteFromRows(r, true, th)]),
      leaper: Object.fromEntries(Object.keys(LEAPER).map(k =>
        [k, [spriteFromRows(LEAPER[k], false, th), spriteFromRows(LEAPER[k], true, th)]])),
      seeker: SEEKER.map(r => [spriteFromRows(r, false, th), spriteFromRows(r, true, th)]),
      saw: [0, 1, 2, 3].map(f => sawSprite(f, th)),
      portal: [portal(0, th), portal(1, th)],
      moving: movingPlatform(th),
      bg: BG[i](),
    });
  }
  return A;
}
