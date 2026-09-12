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
  // ---- сдвиг палитры (GLACIAL DESCENT — ледяной спуск) ----
  //  тот же язык «неон по тёмному металлу», но металл — стылая сталь в инее,
  //  неон — роза, подсветка антиграва — мята, кристаллы — ледяные друзы,
  //  опасность — криовзвесь вместо ям, расплава и разлома.
  K4: '#050d16', // почти чёрный (ледяной)
  D4: '#0e1e2e', // сумрак
  d4: '#193245', // тёмный металл
  M4: '#2f5e77', // металл (стылая сталь)
  m4: '#5a97ad', // светлый металл
  W4: '#a5d8e2', // блик металла (иней)
  w4: '#f0ffff', // белый
  C4: '#ff6b9d', // неон-роза
  c4: '#8f2b54', // тёмная роза
  P4: '#6bffd6', // мята
  p4: '#12856f', // тёмная мята
  Y4: '#ffd76b', // тёплое золото (телеграф)
  O4: '#ff9a5c', // оранжевый
  o4: '#a8502a',
  G4: '#9bf0ff', // ледяные друзы
  g4: '#2a7f9e',
  B4: '#6b8cff', // энергия портала
  b4: '#2a3a8a',
  V4: '#14293d', // фон-синь
  v4: '#2d5a7a',
  // ---- сдвиг палитры (INVERTED ORBIT — флот в открытом космосе) ----
  //  тот же язык «неон по тёмному металлу», но металл — обшивка из потемневшей
  //  бронзы, неон — аквамариновая патина, подсветка антиграва — фиалка-электрик,
  //  кристаллы — розовый кварц, опасность — метеорный поток вместо ям и расплава.
  K5: '#08060e', // почти чёрный (космос)
  D5: '#191024', // сумрак
  d5: '#33231f', // тёмная бронза
  M5: '#6b4630', // бронза (обшивка)
  m5: '#a3743f', // светлая латунь
  W5: '#e3b071', // блик латуни
  w5: '#fff3e2', // белый (тёплый)
  C5: '#2ef0c4', // неон-аквамарин
  c5: '#0b7a6a', // тёмный аквамарин
  P5: '#8f7dff', // фиалка-электрик
  p5: '#3b2f8a', // тёмная фиалка
  Y5: '#ffd166', // тёплое золото (телеграф)
  O5: '#ff8a3c', // оранжевый
  o5: '#a8471a',
  G5: '#ff7bd5', // розовый кварц
  g5: '#8a2a70', // тёмный кварц
  B5: '#7a6bff', // энергия портала
  b5: '#2a2470',
  V5: '#1b1430', // фон-фиолет
  v5: '#3a2b5c',
  // метеорный поток (только пятый уровень, без подмены по теме)
  S0: '#140a06', // сердцевина камня
  S1: '#2b1509', // толща потока
  S2: '#8a3c14', // раскалённый след
  S3: '#ff8a3c', // край
  S4: '#ffe0a8', // искры
  // криовзвесь (только четвёртый уровень, без подмены по теме)
  Q0: '#040e18', // сердцевина
  Q1: '#09202f', // толща
  Q2: '#1d6f88', // свечение
  Q3: '#7fe9f5', // край
  Q4: '#eaffff', // игольчатые искры
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
// Ледяной спуск: металл выцветает в стылую сталь, неон уходит в розу,
// а подсветка антиграва — в мяту; красный по-прежнему значит только опасность.
const TH_GLACIAL = {
  K: 'K4', D: 'D4', d: 'd4', M: 'M4', m: 'm4', W: 'W4', w: 'w4',
  C: 'C4', c: 'c4',   // неоновая кромка грунта — роза
  P: 'P4', p: 'p4',   // подсветка антиграв-платформ — мята
  Y: 'Y4', O: 'O4', o: 'o4',
  G: 'G4', g: 'g4',   // кристаллы → ледяные друзы
  B: 'B4', b: 'b4', V: 'V4', v: 'v4',
};
// Флот в открытом космосе: обшивка выгорает в потемневшую бронзу, неон уходит
// в аквамариновую патину, подсветка антиграва — в фиалку; красный по-прежнему
// значит только опасность.
const TH_ARMADA = {
  K: 'K5', D: 'D5', d: 'd5', M: 'M5', m: 'm5', W: 'W5', w: 'w5',
  C: 'C5', c: 'c5',   // неоновая кромка грунта — аквамарин
  P: 'P5', p: 'p5',   // подсветка антиграв-платформ — фиалка
  Y: 'Y5', O: 'O5', o: 'o5',
  G: 'G5', g: 'g5',   // кристаллы → друзы розового кварца
  B: 'B5', b: 'b5', V: 'V5', v: 'v5',
};
const THEMES = [TH_FOUNDRY, TH_REACTOR, TH_CITADEL, TH_GLACIAL, TH_ARMADA];

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
//  ДРЕЙФЕР «DRIFTER» 12x12, 2 кадра — ледяная медуза, ходит по вертикали
// ------------------------------------------------------------
const DRIFTER = [
  [
    '....MMMM....',
    '..MMWWWWMM..',
    '.MWGGGGGGWM.',
    'MWGGwwwwGGWM',
    'MWGRwGGwRGWM',
    'MWGGGGGGGGWM',
    '.MWGGGGGGWM.',
    '..MWWWWWWM..',
    '...M.MM.M...',
    '...C.MM.C...',
    '....C..C....',
    '.....CC.....',
  ],
  [
    '....MMMM....',
    '..MMWWWWMM..',
    '.MWGGGGGGWM.',
    'MWGGGGGGGGWM',
    'MWGRwwwwRGWM',
    'MWGGwwwwGGWM',
    '.MWGGGGGGWM.',
    '..MWWWWWWM..',
    '...M.MM.M...',
    '..C..MM..C..',
    '..C...C..C..',
    '...C..C.....',
  ],
];

// ------------------------------------------------------------
//  КОНЬКОБЕЖЕЦ «SKATER» 16x12, 2 кадра — разгоняется по наледи, гибнет от прыжка сверху
// ------------------------------------------------------------
const SKATER = [
  [
    '................',
    '................',
    '......MMMMM.....',
    '....MMWWWWWMM...',
    '..MMWWKKKKKWWM..',
    '.MWWKKRRKKKKWM..',
    '.MWKKKKKKKKKWM..',
    '.MWWmmmmmmmWWM..',
    '..MMMMMMMMMMM...',
    '...WWWWWWWWWW...',
    '..wwwwwwwwwwww..',
    '................',
  ],
  [
    '................',
    '................',
    '......MMMMM.....',
    '....MMWWWWWMM...',
    '..MMWWKKKKKWWM..',
    '.MWWKKwRKKKKWM..',
    '.MWKKKKKKKKKWM..',
    '.MWWmmmmmmmWWM..',
    '..MMMMMMMMMMM...',
    'w..WWWWWWWWWW...',
    '.wwwwwwwwwwwww..',
    'w...............',
  ],
];

// ------------------------------------------------------------
//  ВЫЛЬ «HOWLER» 16x14, 2 кадра (покой / заряд) — висит на потолке,
//  роняет криобомбы прямо вниз. Топтать нечего — только уйти с линии.
// ------------------------------------------------------------
const HOWLER = [
  [
    'MMMMMMMMMMMMMMMM',
    'MddddddddddddddM',
    '.MMMWWWWWWWWMMM.',
    '...MWWKKKKWWM...',
    '..MWWKKRRKKWWM..',
    '..MWKKRRRRKKWM..',
    '..MWKKKKKKKKWM..',
    '..MWWKKKKKKWWM..',
    '...MWWmmmmWWM...',
    '....MWWWWWWM....',
    '.....MMGGMM.....',
    '......MGGM......',
    '.......GG.......',
    '................',
  ],
  [
    'MMMMMMMMMMMMMMMM',
    'MddddddddddddddM',
    '.MMMWWWWWWWWMMM.',
    '...MWWKKKKWWM...',
    '..MWWKKYYKKWWM..',
    '..MWKKYYYYKKWM..',
    '..MWKKYwwYKKWM..',
    '..MWWKKYYKKWWM..',
    '...MWWmmmmWWM...',
    '....MWWWWWWM....',
    '....MMGGGGMM....',
    '....MGGwwGGM....',
    '.....MGGGGM.....',
    '......MGGM......',
  ],
];

// ------------------------------------------------------------
//  ОРБИТЕР «ORBITER» 12x12, 2 кадра — спутник-дрон: ходит по кругу
//  вокруг своего якоря, гибнет от прыжка «ногами вперёд»
// ------------------------------------------------------------
const ORBITER = [
  [
    '....MMMM....',
    '...MWWWWM...',
    '..MWKKKKWM..',
    'dCMWKCCKWMCd',
    'dCMWKCRKWMCd',
    'dCMWKCCKWMCd',
    '..MWKKKKWM..',
    '...MWWWWM...',
    '....MMMM....',
    '.....dd.....',
    '....C..C....',
    '...C....C...',
  ],
  [
    '....MMMM....',
    '...MWWWWM...',
    '..MWKKKKWM..',
    'dCMWKCCKWMCd',
    'dCMWKRCKWMCd',
    'dCMWKCCKWMCd',
    '..MWKKKKWM..',
    '...MWWWWM...',
    '....MMMM....',
    '.....dd.....',
    '...C....C...',
    '..C......C..',
  ],
];

// ------------------------------------------------------------
//  ДРЕЙФ-МИНА «MINE» 12x12, 4 кадра — два покоя и два взведённых.
//  Плывёт к игроку, вблизи мигает и лопается веером осколков;
//  успеешь приземлиться сверху — расколешь до взрыва.
// ------------------------------------------------------------
const MINE = [
  [
    '.....MM.....',
    '.M...WW...M.',
    '.MM.MMMM.MM.',
    '..MMWWWWMM..',
    'MWWWKKKKWWWM',
    'MWWKCcccKWWM',
    'MWWKcCCcKWWM',
    'MWWWKKKKWWWM',
    '..MMWWWWMM..',
    '.MM.MMMM.MM.',
    '.M...WW...M.',
    '.....MM.....',
  ],
  [
    '.....MM.....',
    '.M...WW...M.',
    '.MM.MMMM.MM.',
    '..MMWWWWMM..',
    'MWWWKKKKWWWM',
    'MWWKcCCcKWWM',
    'MWWKCcccKWWM',
    'MWWWKKKKWWWM',
    '..MMWWWWMM..',
    '.MM.MMMM.MM.',
    '.M...WW...M.',
    '.....MM.....',
  ],
  [
    '.....YY.....',
    '.Y...YY...Y.',
    '.YM.MMMM.MY.',
    '..MMWWWWMM..',
    'MWWWKKKKWWWM',
    'MWWKRRRRKWWM',
    'MWWKRwwRKWWM',
    'MWWWKKKKWWWM',
    '..MMWWWWMM..',
    '.YM.MMMM.MY.',
    '.Y...YY...Y.',
    '.....YY.....',
  ],
  [
    '.....ww.....',
    '.w...ww...w.',
    '.wM.MMMM.Mw.',
    '..MMWWWWMM..',
    'MWWWKKKKWWWM',
    'MWWKwwwwKWWM',
    'MWWKwRRwKWWM',
    'MWWWKKKKWWWM',
    '..MMWWWWMM..',
    '.wM.MMMM.Mw.',
    '.w...ww...w.',
    '.....ww.....',
  ],
];

// ------------------------------------------------------------
//  ДЕЛЕНЕЦ «SPLITTER» 14x14, 2 кадра — кристалл в раме: прыжок сверху
//  не убивает его, а раскалывает на два осколка
// ------------------------------------------------------------
const SPLITTER = [
  [
    '.....MMMM.....',
    '....MWWWWM....',
    '...MWGGGGWM...',
    '..MWGGwwGGWM..',
    '.MWGGwGGwGGWM.',
    'MWGGwGGGGwGGWM',
    'MWGGGGRRGGGGWM',
    'MWGGGGRRGGGGWM',
    'MWGGwGGGGwGGWM',
    '.MWGGwGGwGGWM.',
    '..MWGGwwGGWM..',
    '...MWGGGGWM...',
    '....MWWWWM....',
    '.....MMMM.....',
  ],
  [
    '.....MMMM.....',
    '....MWWWWM....',
    '...MWGGGGWM...',
    '..MWGGGGGGWM..',
    '.MWGGGwwGGGWM.',
    'MWGGGwGGwGGGWM',
    'MWGGGGRRGGGGWM',
    'MWGGGGRRGGGGWM',
    'MWGGGwGGwGGGWM',
    '.MWGGGwwGGGWM.',
    '..MWGGGGGGWM..',
    '...MWGGGGWM...',
    '....MWWWWM....',
    '.....MMMM.....',
  ],
];

// ------------------------------------------------------------
//  ОСКОЛОК ДЕЛЕНЦА «SHARD» 8x8, 2 кадра
// ------------------------------------------------------------
const SHARD = [
  [
    '..MMMM..',
    '.MWGGWM.',
    'MWGGGGWM',
    'MWGRRGWM',
    'MWGGGGWM',
    '.MWGGWM.',
    '..MMMM..',
    '........',
  ],
  [
    '..MMMM..',
    '.MWGGWM.',
    'MWGwwGWM',
    'MWGRRGWM',
    'MWGwwGWM',
    '.MWGGWM.',
    '..MMMM..',
    '........',
  ],
];

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
//  БОСС «SOVEREIGN» 44x40 — корона-разлом ASHEN CITADEL (процедурно).
//  Не корпус с визором, как у двух прошлых боссов, а разомкнутое кольцо
//  короны с осколком пустоты внутри: зрачок-щель, золотые руны по ободу,
//  пять шипов сверху и ленты снизу. eye — цвет зрачка, spin — поворот рун.
// ------------------------------------------------------------
const SOV_R_IN = 10.5, SOV_R_OUT = 15.5;       // радиусы обода
const SOV_CX = 22, SOV_CY = 17;                // центр кольца в спрайте
function boss3Sprite(eye, spin, mono) {
  const c = makeCanvas(44, 40), q = px(c.getContext('2d'), TH_CITADEL, mono);
  const TAU = Math.PI * 2;
  // угловое расстояние между направлениями, с учётом перехода через ±π
  const adist = (a, b) => Math.abs(((a - b + Math.PI * 3) % TAU) - Math.PI);
  const runes = [];                             // руны обода — вращаются с spin
  for (let i = 0; i < 8; i++) runes.push(i * TAU / 8 + spin * TAU / 32);
  const spikes = [-150, -120, -90, -60, -30].map(d => d * Math.PI / 180);

  for (let y = 0; y < 34; y++) for (let x = 0; x < 44; x++) {
    const dx = x + 0.5 - SOV_CX, dy = y + 0.5 - SOV_CY;
    const d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (d < SOV_R_IN) {                                        // ---- осколок пустоты внутри
      const k = d > SOV_R_IN - 1.4 ? 'Z3' : d > SOV_R_IN - 3.5 ? 'Z2' : d > 4 ? 'Z1' : 'Z0';
      q.p(x, y, mono ? 'w' : k);
      continue;
    }
    const gap = adist(a, Math.PI / 2) < 0.34;                  // разрыв короны снизу
    if (d <= SOV_R_OUT) {                                      // ---- обод
      if (gap) continue;
      let k = d > SOV_R_OUT - 1 ? 'd' : d < SOV_R_IN + 1.2 ? 'W' : 'M';
      if (d > SOV_R_IN + 1 && d < SOV_R_OUT - 1)
        for (const ra of runes) if (adist(a, ra) < 0.1) { k = dy < 0 ? 'C' : 'c'; break; }
      q.p(x, y, k);
    } else if (d <= SOV_R_OUT + 5) {                           // ---- шипы короны
      const reach = (1 - (d - SOV_R_OUT) / 5) * 0.17 + 0.02;
      for (const sa of spikes) if (adist(a, sa) < reach) {
        q.p(x, y, d > SOV_R_OUT + 3.4 ? 'C' : d > SOV_R_OUT + 1.8 ? 'W' : 'M');
        break;
      }
    }
  }
  // искры в глубине разлома — своя россыпь на каждый кадр поворота
  if (!mono) for (let i = 0; i < 5; i++) {
    const a = (i * 2.399 + spin * 0.7), rr = 4.5 + ((i * 3 + spin) % 5);
    q.p(Math.round(SOV_CX + Math.cos(a) * rr), Math.round(SOV_CY + Math.sin(a) * rr), i % 2 ? 'Z4' : 'Z3');
  }
  // ---- зрачок-щель ----
  const lens = [2, 2, 4, 4, 6, 6, 6, 6, 6, 4, 4, 2, 2];
  for (let i = 0; i < lens.length; i++) {
    const w = lens[i];
    q.r(SOV_CX - w / 2, 11 + i, w, 1, eye);
  }
  q.vl(SOV_CX - 1, 13, 9, mono ? 'w' : 'K'); q.vl(SOV_CX, 13, 9, mono ? 'w' : 'K');
  q.p(SOV_CX - 1, 15, eye === 'w' ? 'C' : 'w');
  // ---- ленты под разомкнутой короной ----
  for (const s of [-1, 0, 1]) {
    const bx = SOV_CX - 1 + s * 7, len = 6 - Math.abs(s) * 2 + (spin % 2);
    q.vl(bx, 31 + Math.abs(s), len, 'M'); q.vl(bx + 1, 31 + Math.abs(s), len, 'd');
    q.p(bx, 31 + Math.abs(s) + len, 'C');
  }
  return c;
}

// ------------------------------------------------------------
//  БОСС «HOARFROST» 48x36 — ледяной колосс GLACIAL DESCENT (процедурно).
//  Не корпус на двигателях и не кольцо: колосс стоит в криовзвеси по пояс,
//  наружу торчат плечи в ледяных шипах и визор-щель. Слабое место — корона
//  на макушке: выдохшись после столба, колосс раскрывает её, и ядро топчется.
// ------------------------------------------------------------
//  полуширина корпуса по строкам 8..35 — плечи широкие, подол сходит в взвесь
const HOAR_HALF = [6, 8, 10, 12, 15, 18, 20, 21, 21, 21, 20, 20, 19, 18,
                   18, 17, 17, 17, 17, 17, 17, 17, 16, 16, 15, 14, 12, 9];
function boss4Sprite(eye, open, frame, mono) {
  const c = makeCanvas(48, 36), q = px(c.getContext('2d'), TH_GLACIAL, mono);
  const cx = 24;
  for (let i = 0; i < HOAR_HALF.length; i++) {
    const y = 8 + i, hw = HOAR_HALF[i], prev = i ? HOAR_HALF[i - 1] : 0;
    for (let dx = -hw; dx < hw; dx++) {
      const ax = Math.abs(dx + 0.5);
      let k = i < 4 ? 'm' : 'M';
      if (ax > hw - 1) k = 'K';
      else if (ax > hw - 2.5) k = 'd';
      else if (ax > prev - 0.5) k = 'W';               // свежий иней на уступах
      q.p(cx + dx, y, k);
    }
  }
  // ледяные шипы на плечах: растут из ската брони вверх и наружу
  for (const s of [-1, 1]) for (const [ox, len] of [[11, 7], [15, 5], [18, 4]]) {
    let base = 0;
    while (base < HOAR_HALF.length && HOAR_HALF[base] < ox) base++;
    for (let i = 0; i < len; i++) {
      const off = ox + (i >> 1);
      q.p(s < 0 ? cx - off : cx + off - 1, 8 + base - 1 - i, i < 1 ? 'w' : i < 3 ? 'W' : 'm');
    }
  }
  // визор-щель с двумя огнями
  q.r(cx - 15, 17, 30, 6, 'K');
  q.hl(cx - 15, 16, 30, 'd'); q.hl(cx - 15, 23, 30, 'd');
  for (const s of [-1, 1]) {
    const ex = s < 0 ? cx - 12 : cx + 6;
    q.r(ex, 19, 6, 3, eye);
    q.r(ex + 1, 20, 4, 1, eye === 'w' ? 'C' : 'w');
  }
  // морозные потёки по корпусу
  for (const [x, y, h] of [[-11, 25, 6], [-4, 26, 8], [3, 25, 7], [9, 27, 5]]) {
    q.vl(cx + x, y, h, 'W'); q.vl(cx + x + 1, y + 1, h - 2, 'm');
  }
  q.r(cx - 5, 26, 10, 4, 'd'); q.hl(cx - 5, 26, 10, 'm');   // нагрудная пластина
  q.hl(cx - 3, 28, 6, open ? 'C' : 'c');

  if (open) {                                              // корона раскрыта — ядро наружу
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++)    // половинки колпака отъехали
      q.vl(cx + s * (9 + i), 4 + i, 5 - (i >> 1), i < 2 ? 'W' : 'm');
    const half = [1, 2, 3, 4, 5, 6, 6, 6, 5, 4, 3, 2];
    for (let y = 0; y < half.length; y++) {
      const hw = half[y];
      for (let dx = -hw; dx < hw; dx++) {
        const ax = Math.abs(dx + 0.5);
        q.p(cx + dx, y, ax > hw - 1 ? 'g' : ax > hw - 2 ? 'G' : (y + frame) % 4 < 2 ? 'w' : 'G');
      }
    }
    q.r(cx - 2, 4, 4, 4, frame % 2 ? 'w' : 'Y');           // сердцевина пульсирует
  } else {                                                 // глухой ледяной колпак
    for (let y = 2; y <= 8; y++) {
      const hw = Math.round(2 + (y - 2) * 0.9);
      for (let dx = -hw; dx < hw; dx++) {
        const ax = Math.abs(dx + 0.5);
        q.p(cx + dx, y, ax > hw - 1 ? 'd' : y < 4 ? 'w' : ax > hw - 2.5 ? 'm' : 'W');
      }
    }
    q.p(cx - 4, 5, 'C'); q.p(cx + 3, 5, 'C'); q.r(cx - 1, 3, 2, 2, 'c');
  }
  return c;
}

// ------------------------------------------------------------
//  БОСС «PULSAR» 40x40 — нейтронное ядро INVERTED ORBIT (процедурно).
//  Не корпус, не кольцо и не колосс: вокруг сердцевины крутится
//  кольцо-статор, а саму сердцевину закрывают лепестки брони.
//  Выдохшись после плоскостного луча, PULSAR разводит лепестки —
//  и тогда на ядро падают «ногами вперёд» хоть с пола, хоть с потолка.
// ------------------------------------------------------------
function boss5Sprite(eye, open, frame, mono) {
  const c = makeCanvas(40, 40), q = px(c.getContext('2d'), TH_ARMADA, mono);
  const cx = 19.5, cy = 19.5, a0 = frame * Math.PI / 8;
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {      // кольцо-статор
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    if (d > 19.4 || d < 14.2) continue;
    const seg = Math.floor((Math.atan2(dy, dx) + a0) / Math.PI * 4 + 16) % 8;
    q.p(x, y, d > 18.3 || d < 15.1 ? 'd' : seg % 2 ? 'M' : 'm');
  }
  for (let i = 0; i < 8; i++) {                                    // огни по ободу
    const a = a0 + i * Math.PI / 4;
    q.p(Math.round(cx + Math.cos(a) * 16.7), Math.round(cy + Math.sin(a) * 16.7), i % 2 ? 'C' : 'c');
  }
  for (let i = 0; i < 4; i++) {                                    // спицы к сердцевине
    const a = a0 * 1.7 + i * Math.PI / 2;
    const ox = Math.abs(Math.cos(a)) > 0.5 ? 0 : 1, oy = ox ? 0 : 1;
    for (let r = open ? 11 : 7; r < 15; r++) {                     // при разведённых лепестках
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
      q.p(x, y, r === 10 ? 'W' : r > 12 ? 'M' : 'm');              // видна только внешняя часть
      q.p(x + ox, y + oy, r > 12 ? 'd' : 'M');
    }
  }
  if (open) {                                                      // лепестки разведены
    for (let i = 0; i < 6; i++) {
      const a = -a0 + i * Math.PI / 3;
      for (let r = 9; r < 13; r++)
        q.p(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), r < 11 ? 'W' : 'm');
    }
    for (let y = 11; y < 29; y++) for (let x = 11; x < 29; x++) {   // сердцевина наружу
      const d = Math.hypot(x - cx, y - cy);
      if (d > 8.4) continue;
      q.p(x, y, d > 7.4 ? 'g' : d > 5 ? 'G' : (x + y + frame) % 4 < 2 ? 'w' : 'G');
    }
    q.r(17, 17, 6, 6, frame % 2 ? 'w' : 'Y');
  } else {                                                         // броня сомкнута
    for (let y = 6; y < 34; y++) for (let x = 6; x < 34; x++) {
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      if (d > 12.4) continue;
      const seg = Math.floor((Math.atan2(dy, dx) - a0 * 0.7) / Math.PI * 3 + 18) % 6;
      q.p(x, y, d > 11.3 ? 'd' : seg % 2 ? 'M' : 'm');
    }
    for (const ox of [-9, 3]) {                                    // визор с двумя огнями
      q.r(19 + ox, 18, 6, 3, eye);
      q.r(20 + ox, 19, 4, 1, eye === 'w' ? 'C' : 'w');
    }
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

// --- новые тайлы GLACIAL DESCENT ---

// Наледь: твёрдый пол без неоновой кромки — по ней почти не тормозишь
function tileIce(th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(0, 0, 16, 16, 'M');
  q.hl(0, 0, 16, 'w'); q.hl(0, 1, 16, 'W'); q.hl(0, 2, 16, 'm');
  for (const [x, y, h] of [[2, 4, 7], [5, 6, 5], [9, 4, 8], [12, 7, 6]]) {   // гранёные сколы
    q.vl(x, y, h, 'm'); q.vl(x + 1, y + 1, h - 2, 'W');
  }
  q.vl(0, 3, 13, 'm'); q.vl(15, 3, 13, 'd');
  q.hl(0, 15, 16, 'd');
  q.p(3, 12, 'w'); q.p(11, 13, 'w'); q.p(7, 9, 'w');
  return c;
}

// Цепкая стена: за иней и крючья можно держаться — сползать и отталкиваться.
// face: 'l' — открыта левая грань, 'r' — правая, 'b' — обе.
function tileGrip(face, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.r(0, 0, 16, 16, 'd');
  q.hl(0, 0, 16, 'D'); q.hl(0, 15, 16, 'K');
  q.r(2, 1, 12, 14, 'M'); q.hl(2, 1, 12, 'm');
  q.r(6, 1, 4, 14, 'D');                                  // вертикальный жёлоб
  for (let y = 2; y < 15; y += 4) { q.hl(6, y, 4, 'd'); q.p(7, y, 'm'); }
  for (const s of face === 'b' ? [0, 1] : face === 'l' ? [0] : [1]) {
    const edge = s ? 15 : 0, in1 = s ? 14 : 1, in2 = s ? 13 : 2;
    for (let y = 0; y < 16; y += 2) { q.p(edge, y, 'W'); q.p(in1, y + 1, 'w'); }
    for (let y = 1; y < 16; y += 5) { q.p(in1, y, 'C'); q.p(in2, y, 'c'); }   // крючья
  }
  return c;
}

// Сталактит: 0 — висит, 1 — трещит (телеграф), 2 — сорвался и летит
function tileIcicle(stage, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  if (stage < 2) { q.r(3, 0, 10, 2, 'd'); q.hl(3, 0, 10, 'M'); }
  const y0 = stage === 2 ? 0 : 2, tip = stage === 2 ? 15 : 13;
  for (let y = y0; y <= tip; y++) {
    const hw = Math.max(1, Math.round((1 - (y - y0) / (tip - y0 + 1)) * 4));
    for (let dx = -hw; dx < hw; dx++) {
      const ax = Math.abs(dx + 0.5);
      q.p(8 + dx, y, ax > hw - 1 ? 'm' : ax > hw - 2 ? 'W' : 'w');
    }
  }
  if (stage === 1) {                                      // трещины у основания
    q.r(6, 2, 4, 1, 'Y');
    for (const [x, y] of [[5, 3], [10, 4], [7, 5], [9, 6], [6, 7]]) q.p(x, y, 'K');
  }
  return c;
}

// Раструб пурги в стене: 0 — покой, 1 — предупреждение, 2 — дует.
// dir — куда бьёт струя (1 — вправо, -1 — влево).
function tileBlower(dir, stage, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  const X = x => (dir > 0 ? x : 15 - x);
  const p = (x, y, k) => q.p(X(x), y, k);
  const row = (x, y, w, k) => { for (let i = 0; i < w; i++) p(x + i, y, k); };
  for (let y = 0; y < 16; y++) row(0, y, 16, 'M');
  row(0, 0, 16, 'W'); row(0, 15, 16, 'K');
  for (let y = 1; y < 15; y++) p(0, y, 'm');
  for (let y = 2; y < 14; y++) {                          // конус раструба
    const deep = Math.round(11 - Math.abs(y - 7.5) * 1.6);
    for (let i = 0; i < deep; i++) p(15 - i, y, i < 1 ? 'd' : 'K');
  }
  const glow = stage === 2 ? 'C' : stage === 1 ? 'Y' : 'c';
  for (let i = 0; i < 4; i++) row(6, 3 + i * 3, 3, i % 2 ? glow : 'd');
  for (let y = 2; y < 14; y += 2) p(15, y, 'm');          // решётка на срезе
  p(15, 7, stage ? 'w' : 'm'); p(15, 8, stage ? 'w' : 'm');
  return c;
}

// Криовзвесь: поверхность (3 кадра) и толща (2 кадра). Вне тем — свой набор Q*.
function tileCryoTop(frame) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'));
  const surf = x => 3 + Math.round(1.5 * Math.sin((x + frame * 2.4) / 2.8));
  for (let x = 0; x < 16; x++) {
    const y = surf(x);
    q.p(x, y, 'Q4');
    q.r(x, y + 1, 1, 2, 'Q3');
    q.r(x, y + 3, 1, 3, 'Q2');
    q.r(x, y + 6, 1, 16 - y - 6, 'Q1');
  }
  for (let i = 0; i < 4; i++) {                           // игольчатый иней на поверхности
    const x = (i * 5 + frame * 3) % 16, y = surf(x);
    q.vl(x, y - 2, 2, 'Q4'); q.p(x, y - 3, 'Q3');
  }
  return c;
}
function tileCryoBody(frame) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'));
  q.r(0, 0, 16, 16, 'Q1');
  q.r(1, 2, 14, 12, 'Q0');
  for (let i = 0; i < 6; i++) {                           // взвесь кристаллов в глубине
    const x = (i * 5 + frame * 4) % 16, y = (i * 7 + frame * 3) % 16;
    q.p(x, y, 'Q2'); q.p((x + 4) % 16, (y + 6) % 16, i % 3 ? 'Q2' : 'Q3');
  }
  return c;
}

// Нижняя кромка нависающей палубы: прозрачный оверлей с неоном по «потолку».
// Нужен там, где ходят по изнанке перекрытия.
function tileGroundUnder(th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  q.hl(0, 15, 16, 'W');
  q.hl(0, 14, 16, 'm');
  q.hl(0, 13, 16, 'C');          // неоновая кромка
  q.hl(0, 12, 16, 'c');
  for (const x of [3, 12]) { q.p(x, 10, 'W'); q.p(x + 1, 10, 'd'); }
  return c;
}
// Вертикальное зеркало готового тайла — шипы под перекрытием
function flipV(img) {
  const c = makeCanvas(img.width, img.height), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.translate(0, img.height); x.scale(1, -1); x.drawImage(img, 0, 0);
  return c;
}

// --- новые тайлы INVERTED ORBIT ---

// Гравитационный маяк: кольцо-статор с пульсирующим ядром и шевронами
// в обе стороны — он не «тянет вверх», а переворачивает тягу.
// stage: 0/1 — покой (два кадра), 2 — только что сработал.
function tileBeacon(stage, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  const hot = stage === 2;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {   // обод
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d > 7.4 || d < 4.4) continue;
    q.p(x, y, d > 6.6 ? 'd' : d > 5.4 ? 'M' : 'm');
  }
  for (const [x, y] of [[1, 7], [14, 7], [7, 1], [8, 1], [7, 14], [8, 14]]) q.p(x, y, 'W');
  const ch = hot ? 'w' : stage ? 'C' : 'c';                     // шевроны вверх и вниз
  for (let i = 0; i < 3; i++) {
    q.p(7 - i, 3 + i, ch); q.p(8 + i, 3 + i, ch);
    q.p(7 - i, 12 - i, ch); q.p(8 + i, 12 - i, ch);
  }
  q.r(7, 6, 2, 4, hot ? 'w' : 'C');                             // ядро-крест
  q.r(6, 7, 4, 2, hot ? 'w' : 'C');
  q.r(7, 7, 2, 2, hot ? 'C' : 'w');
  return c;
}

// Ускорительное кольцо: «на ребро», шевроны бегут в сторону броска.
// dir — куда бросает (1 — вправо, -1 — влево).
function tileRing(dir, frame, th) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'), th);
  const X = x => (dir > 0 ? x : 15 - x);
  const p = (x, y, k) => q.p(X(x), y, k);
  for (let y = 2; y < 14; y++) { p(2, y, 'W'); p(3, y, 'M'); p(12, y, 'M'); p(13, y, 'd'); }
  for (const [y, x0, x1] of [[1, 3, 12], [0, 5, 10], [14, 3, 12], [15, 5, 10]])
    for (let x = x0; x <= x1; x++) p(x, y, y < 8 ? 'W' : 'M');
  for (let y = 3; y < 14; y += 3) { p(2, y, 'C'); p(3, y, 'c'); p(13, y, 'C'); p(12, y, 'c'); }   // катушки
  for (let i = 0; i < 2; i++) {                                      // шевроны разгона
    const x = 4 + ((i * 3 + frame * 2) % 6), k = i === frame % 2 ? 'w' : 'C';
    p(x, 5, k); p(x + 1, 6, k); p(x + 2, 7, k); p(x + 1, 8, k); p(x, 9, k);
  }
  return c;
}

// Метеорный поток: поверхность (3 кадра) и толща (2 кадра). Вне тем — свой набор S*.
function tileMeteorTop(frame) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'));
  const surf = x => 3 + Math.round(2 * Math.sin((x + frame * 3) / 2.2));
  for (let x = 0; x < 16; x++) {
    const y = surf(x);
    q.p(x, y, 'S4');
    q.r(x, y + 1, 1, 2, 'S3');
    q.r(x, y + 3, 1, 3, 'S2');
    q.r(x, y + 6, 1, 16 - y - 6, 'S1');
  }
  for (let i = 0; i < 5; i++) {                           // искры срываются с гребня
    const x = (i * 7 + frame * 5) % 16, y = surf(x);
    q.p(x, y - 2, 'S4'); q.p((x + 3) % 16, y - 4, 'S3');
  }
  return c;
}
function tileMeteorBody(frame) {
  const c = makeCanvas(TILE, TILE), q = px(c.getContext('2d'));
  q.r(0, 0, 16, 16, 'S1');
  q.r(1, 2, 14, 12, 'S0');
  for (let i = 0; i < 4; i++) {                           // кувыркающиеся обломки
    const x = (i * 5 + frame * 4) % 14, y = (i * 7 + frame * 3) % 13;
    q.r(x, y, 2, 2, i % 2 ? 'S2' : 'S1');
    q.p(x, y, 'S3');
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
//  ФОНЫ — GLACIAL DESCENT (ледяной спуск): те же три слоя, но они
//  стыкуются сами с собой по вертикали — уровень прокручивается вниз.
// ------------------------------------------------------------
function bgFrostSky(w, h) {
  const c = makeCanvas(w, h), q = px(c.getContext('2d'));
  // свет в шахте меняется по глубине косинусом: темнее всего у стыка кадра,
  // светлее в середине — при вертикальном повторе шва не видно
  const ramp = ['#050d16', '#071220', '#0a1929', '#0d2134', '#10283f', '#133049', '#163a56'];
  const lit = y => ramp[Math.min(ramp.length - 1, Math.floor((0.5 - 0.5 * Math.cos(y / h * Math.PI * 2)) * ramp.length))];
  for (let y = 0; y < h; y++) q.r(0, y, w, 1, lit(y));
  const R = rng(29);
  // дальние ледопады — сплошные вертикальные натёки во всю высоту
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(R() * w), bw = 4 + Math.floor(R() * 10);
    q.r(x, 0, bw, h, 'V4');
    q.vl(x, 0, h, 'v4'); q.vl(x + bw - 1, 0, h, 'K4');
    for (let y = Math.floor(R() * 12); y < h; y += 9 + Math.floor(R() * 8))
      q.hl(x + 1, y, Math.max(1, bw - 3), 'v4');
  }
  // ледяная взвесь в воздухе
  for (let i = 0; i < 130; i++) {
    const x = Math.floor(R() * w), y = Math.floor(R() * h), t = R();
    q.p(x, y, t < 0.18 ? 'w4' : t < 0.55 ? 'W4' : 'M4');
    if (t < 0.08) q.p(x, y + 1, 'M4');
  }
  return c;
}

function bgIceColumns(w, h) {  // дальний слой: колонны намёрзшего льда
  const c = makeCanvas(w, h), q = px(c.getContext('2d'));
  const R = rng(17);
  let x = 0;
  while (x < w) {
    const bw = 14 + Math.floor(R() * 22);
    q.r(x, 0, bw, h, 'D4');
    q.vl(x, 0, h, 'd4'); q.vl(x + bw - 1, 0, h, 'K4');
    // грани льда — тоже во всю высоту, иначе на стыке кадра будет шов
    for (let i = 0; i < 2; i++) {
      const fx = x + 2 + Math.floor(R() * (bw - 4));
      q.vl(fx, 0, h, 'd4');
      if (R() < 0.5) q.vl(fx + 1, 0, h, 'K4');
    }
    // намёрзшие пояса: шаг 56 делит высоту нацело, поэтому повтор сходится
    for (let y = 6 + Math.floor(R() * 10); y < h; y += 56) {
      q.r(x + 1, y, bw - 2, 3, 'K4');
      q.hl(x + 1, y, bw - 2, 'd4');
    }
    x += bw + 2 + Math.floor(R() * 8);
  }
  return c;
}

function bgFrostRibs(w, h) {  // ближний слой: мёрзлые трубы, хомуты и сосульки
  const c = makeCanvas(w, h), q = px(c.getContext('2d'));
  const R = rng(71);
  const STEP = 56;                       // шаг хомутов делит высоту — повтор бесшовный
  let x = 4;
  while (x < w) {
    const kind = R();
    if (kind < 0.55) {                   // мёрзлая труба во всю высоту
      const bw = 6 + Math.floor(R() * 6);
      q.r(x, 0, bw, h, 'K4');
      q.vl(x, 0, h, 'D4'); q.vl(x + bw - 1, 0, h, 'K4');
      for (let y = 10 + Math.floor(R() * 20); y < h; y += STEP) {   // хомут
        q.r(x - 2, y, bw + 4, 5, 'D4'); q.hl(x - 2, y, bw + 4, 'd4'); q.hl(x - 2, y + 4, bw + 4, 'K4');
        q.p(x + 1, y + 2, 'c4');
        for (let i = 0; i < bw; i += 4) {                           // сосульки под хомутом
          const len = 3 + Math.floor(R() * 6);
          q.vl(x + i, y + 5, len, 'd4'); q.p(x + i, y + 5 + len, 'M4');
        }
      }
    } else {                             // трос в инее
      q.vl(x, 0, h, 'D4'); q.vl(x + 1, 0, h, 'K4');
      for (let y = 24 + Math.floor(R() * 20); y < h; y += STEP) {
        q.r(x - 1, y, 4, 3, 'D4'); q.hl(x - 1, y, 4, 'd4');
        q.vl(x, y + 3, 4 + Math.floor(R() * 5), 'd4');
      }
    }
    x += 30 + Math.floor(R() * 54);
  }
  return c;
}

// ------------------------------------------------------------
//  ФОНЫ — INVERTED ORBIT (открытый космос): вместо неба и земли —
//  звёздное поле, за ним мёртвый флот, а вблизи его обломки.
// ------------------------------------------------------------
function bgStarfield(w, h) {
  const c = makeCanvas(w, h), q = px(c.getContext('2d'));
  // «неба» здесь нет: только чуть неровная чернота, чтобы поле не выглядело плоским
  for (let y = 0; y < h; y++) {
    const t = 0.5 - 0.5 * Math.cos(y / h * Math.PI * 2);
    q.r(0, y, w, 1, ['#08060e', '#0b0814', '#0e0a1a', '#120c22'][Math.min(3, Math.floor(t * 4))]);
  }
  // туманность: рваные пятна фиалки, край уходит дизером
  for (const [bx, by, br, col] of [[58, 72, 48, 'V5'], [92, 98, 30, 'v5'],
                                   [230, 152, 54, 'V5'], [256, 134, 26, 'v5']]) {
    for (let y = Math.max(0, by - br); y < Math.min(h, by + br); y++)
      for (let x = bx - br; x < bx + br; x++) {
        if (x < 0 || x >= w) continue;
        const d = Math.hypot(x - bx, (y - by) * 1.4) / br;
        if (d > 1 || (d > 0.5 && (x + y * 2 + Math.floor(d * 9)) % 3)) continue;
        q.p(x, y, col);
      }
  }
  const R = rng(91);
  for (let i = 0; i < 430; i++) {                       // звёздная пыль в три яркости
    const x = Math.floor(R() * w), y = Math.floor(R() * h), t = R();
    q.p(x, y, t < 0.12 ? 'w5' : t < 0.4 ? 'W5' : t < 0.7 ? 'C5' : 'm5');
  }
  for (let i = 0; i < 13; i++) {                        // крупные звёзды с лучами
    const x = 3 + Math.floor(R() * (w - 6)), y = 3 + Math.floor(R() * (h - 6));
    q.p(x, y, 'w5');
    q.p(x - 1, y, 'W5'); q.p(x + 1, y, 'W5'); q.p(x, y - 1, 'W5'); q.p(x, y + 1, 'W5');
    q.p(x - 2, y, 'm5'); q.p(x + 2, y, 'm5');
  }
  const sx = 268, sy = 50;                              // далёкая нова: диск и корона дизером
  for (let y = sy - 25; y <= sy + 25; y++) for (let x = sx - 25; x <= sx + 25; x++) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const d = Math.hypot(x - sx, y - sy);
    if (d > 25) continue;
    if (d <= 9) q.p(x, y, d > 7.5 ? 'C5' : d > 5 ? 'W5' : 'w5');
    else if ((x * 3 + y * 5 + Math.floor(d) * 7) % Math.max(2, Math.floor(d) - 6) === 0)
      q.p(x, y, d > 17 ? 'c5' : 'C5');
  }
  return c;
}

function bgHulks(w, h) {  // дальний слой: мёртвый флот — переломленные корпуса
  const c = makeCanvas(w, h), q = px(c.getContext('2d'));
  const R = rng(53);
  let x = 4;
  while (x < w) {
    const bw = 44 + Math.floor(R() * 60), bh = 13 + Math.floor(R() * 15);
    const by = 30 + Math.floor(R() * (h - 96)), gap = 0.3 + R() * 0.3;   // где корпус переломлен
    for (let i = 0; i < bw; i++) {
      const t = i / (bw - 1);
      if (Math.abs(t - gap) < 0.035) continue;                           // разлом
      const half = Math.max(1, Math.round(bh / 2 * Math.min(1, (1 - Math.abs(t - 0.66) * 1.6) * 1.7)));
      const skew = Math.round((t - gap) * (t > gap ? 4 : -2));           // корма отошла от носа
      for (let dy = -half; dy <= half; dy++) {
        const y = by + dy + (t > gap ? skew : 0);
        if (y < 0 || y >= h) continue;
        q.p(x + i, y, dy === -half ? 'd5' : dy === half ? 'K5' : dy < 0 ? 'D5' : 'K5');
      }
      if (i % 8 === 3 && R() < 0.5)                                      // редкие живые огни
        q.p(x + i, by - 1 + (t > gap ? skew : 0), R() < 0.6 ? 'c5' : 'o5');
    }
    for (let k = 0; k < 3; k++) {                                        // мачты и антенны
      const mx = x + 6 + Math.floor(R() * (bw - 12)), mh = 6 + Math.floor(R() * 14);
      const top = by - Math.round(bh / 2) - mh;        // дробный y размазал бы пиксель
      q.vl(mx, top, mh, 'D5');
      q.p(mx, top, 'c5');
    }
    x += bw + 22 + Math.floor(R() * 38);
  }
  for (let i = 0; i < 70; i++) {                                         // обломки на орбите
    const dx = Math.floor(R() * w), dy = Math.floor(R() * h), s = 1 + Math.floor(R() * 3);
    q.r(dx, dy, s, s, R() < 0.7 ? 'D5' : 'd5');
  }
  return c;
}

function bgWreckage(w, h) {  // ближний слой: фермы, солнечные паруса, антенны
  const c = makeCanvas(w, h), q = px(c.getContext('2d'));
  const R = rng(37);
  let x = 6;
  while (x < w) {
    const kind = R();
    if (kind < 0.4) {                        // ферма: пояс и раскосы
      const fy = 26 + Math.floor(R() * (h - 80)), fw = 40 + Math.floor(R() * 60);
      q.hl(x, fy, fw, 'd5'); q.hl(x, fy + 1, fw, 'K5');
      q.hl(x, fy + 11, fw, 'd5'); q.hl(x, fy + 12, fw, 'K5');
      for (let i = 0; i < fw - 6; i += 7) {
        for (let k = 0; k < 10; k++) q.p(x + i + (i / 7 % 2 ? k : 9 - k), fy + 2 + k, 'K5');
        q.vl(x + i, fy, 13, 'd5');
      }
      if (R() < 0.6) { q.r(x + fw - 6, fy - 4, 6, 20, 'D5'); q.p(x + fw - 3, fy + 4, 'c5'); }
      x += fw + 16 + Math.floor(R() * 36);
    } else if (kind < 0.72) {                // солнечный парус: рама с ячейками
      const py = 20 + Math.floor(R() * (h - 90)), pw = 26, ph = 38 + Math.floor(R() * 26);
      q.vl(x + pw / 2, py - 8, 8, 'd5');
      q.r(x, py, pw, ph, 'K5');
      q.hl(x, py, pw, 'd5'); q.hl(x, py + ph - 1, pw, 'd5');
      q.vl(x, py, ph, 'd5'); q.vl(x + pw - 1, py, ph, 'd5');
      for (let cy = py + 2; cy < py + ph - 2; cy += 6) for (let cx2 = x + 2; cx2 < x + pw - 3; cx2 += 6) {
        q.r(cx2, cy, 4, 4, R() < 0.12 ? 'K5' : 'p5');
        q.p(cx2, cy, 'P5');
      }
      x += pw + 26 + Math.floor(R() * 40);
    } else {                                 // мачта с тарелкой и растяжками
      const my = 14 + Math.floor(R() * 40), mh = 70 + Math.floor(R() * 90);
      q.r(x, my, 5, mh, 'D5'); q.vl(x, my, mh, 'd5'); q.vl(x + 4, my, mh, 'K5');
      for (let y = my + 10; y < my + mh; y += 18) { q.r(x - 2, y, 9, 2, 'd5'); q.p(x + 6, y, 'K5'); }
      const dr = 7 + Math.floor(R() * 4);
      for (let dy = -dr; dy <= dr; dy++) for (let dx = -dr; dx <= 1; dx++) {
        if (dx * dx * 2 + dy * dy > dr * dr) continue;
        q.p(x - 6 + dx + dr, my + 18 + dy, dx > -2 ? 'd5' : dx < -dr + 2 ? 'K5' : 'D5');
      }
      q.p(x - 5 + dr, my + 18, 'c5');
      x += 34 + Math.floor(R() * 46);
    }
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
  T.ice = tileIce(th);
  T.grip = { l: tileGrip('l', th), r: tileGrip('r', th), b: tileGrip('b', th) };
  T.icicle = [tileIcicle(0, th), tileIcicle(1, th), tileIcicle(2, th)];
  T.blower = [-1, 1].map(d => [0, 1, 2].map(st => tileBlower(d, st, th)));
  T.groundUnder = tileGroundUnder(th);
  T.spikesDown = T.spikes.map(flipV);
  T.beacon = [tileBeacon(0, th), tileBeacon(1, th), tileBeacon(2, th)];
  T.ring = [-1, 1].map(d => [0, 1, 2, 3].map(f => tileRing(d, f, th)));
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
  // криовзвесь — тоже вне тем, своя палитра Q*
  A.cryo = { top: [tileCryoTop(0), tileCryoTop(1), tileCryoTop(2)], body: [tileCryoBody(0), tileCryoBody(1)] };
  // метеорный поток — палитра S*
  A.meteor = { top: [tileMeteorTop(0), tileMeteorTop(1), tileMeteorTop(2)],
               body: [tileMeteorBody(0), tileMeteorBody(1)] };

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
  // корона-разлом: по четыре кадра поворота на каждое состояние зрачка
  const sovSpin = eye => [0, 1, 2, 3].map(s => boss3Sprite(eye, s));
  A.boss3 = {
    dim: sovSpin('r'),                 // спит / оглушена
    live: sovSpin('R'),                // царствует
    tell: sovSpin('Y'),                // встала на трон — телеграф
    hot: sovSpin('w'),                 // осколок на привязи / гнев
    flash: boss3Sprite('w', 0, 'w'),
  };
  // ледяной колосс: корона закрыта, пока он не выдохся
  const hoar = (eye, open) => [0, 1, 2, 3].map(f => boss4Sprite(eye, open, f));
  A.boss4 = {
    dormant: hoar('r', false),         // вмёрз в взвесь
    live: hoar('R', false),            // бродит по взвеси
    tell: hoar('Y', false),            // телеграф столба
    hot: hoar('w', false),             // бьёт столбом
    open: hoar('Y', true),             // выдохся — корона раскрыта
    flash: boss4Sprite('w', true, 0, 'w'),
  };
  // нейтронное ядро: лепестки брони разводятся, только когда оно выдохлось
  const puls = (eye, open) => [0, 1, 2, 3].map(f => boss5Sprite(eye, open, f));
  A.boss5 = {
    dormant: puls('r', false),         // спит на приколе
    live: puls('R', false),            // раскручен
    tell: puls('Y', false),            // разметил плоскость
    hot: puls('w', false),             // бьёт лучом вдоль плоскости
    open: puls('Y', true),             // выдохся — сердцевина наружу
    flash: boss5Sprite('w', true, 0, 'w'),
  };

  // фоны собираются лениво — по одному набору на тему
  const BG = [
    () => ({ far: bgSky(320, 224), mid: bgCity(480, 224), near: bgStructures(640, 224) }),
    () => ({ far: bgSporeSky(320, 224), mid: bgFungalTowers(480, 224), near: bgRoots(640, 224) }),
    () => ({ far: bgAshSky(320, 224), mid: bgSpires(480, 224), near: bgRamparts(640, 224) }),
    // вертикальный уровень: слои стыкуются сами с собой и по высоте
    () => ({ far: bgFrostSky(320, 224), mid: bgIceColumns(320, 224), near: bgFrostRibs(320, 224) }),
    () => ({ far: bgStarfield(320, 224), mid: bgHulks(480, 224), near: bgWreckage(640, 224) }),
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
      drifter: DRIFTER.map(r => [spriteFromRows(r, false, th), spriteFromRows(r, true, th)]),
      skater: SKATER.map(r => [spriteFromRows(r, false, th), spriteFromRows(r, true, th)]),
      howler: HOWLER.map(r => [spriteFromRows(r, false, th), spriteFromRows(r, true, th)]),
      orbiter: ORBITER.map(r => [spriteFromRows(r, false, th), spriteFromRows(r, true, th)]),
      mine: MINE.map(r => [spriteFromRows(r, false, th), spriteFromRows(r, true, th)]),
      splitter: SPLITTER.map(r => [spriteFromRows(r, false, th), spriteFromRows(r, true, th)]),
      shard: SHARD.map(r => [spriteFromRows(r, false, th), spriteFromRows(r, true, th)]),
      saw: [0, 1, 2, 3].map(f => sawSprite(f, th)),
      portal: [portal(0, th), portal(1, th)],
      moving: movingPlatform(th),
      bg: BG[i](),
    });
  }
  return A;
}
