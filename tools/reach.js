// Проверка проходимости карты симуляцией физики движка: BFS по клеткам,
// где игрок может стоять (с учётом направления тяги), с перебором планов ввода.
'use strict';
const { boot } = require('./harness');

const T = 16, LIMIT = 120;
const lv = +(process.argv[2] || 5);
const g = boot('#lv=' + lv);

const key = (c, r, d) => c + ',' + r + ',' + d;
const nodeOf = st => {
  if (!st.grounded) return null;
  const c = Math.floor((st.x + 5) / T);
  const r = st.gdir > 0 ? Math.round((st.y + 20) / T) : Math.round(st.y / T) - 1;
  return { c, r, d: st.gdir };
};

// план: разбег r кадров, потом прыжок с удержанием h, дальше — тот же ход
const PLANS = [];
for (const d of [-1, 0, 1])
  for (const r of [0, 8, 18, 30])
    for (const h of [0, 5, 12, 22]) {
      if (d === 0 && r > 8) continue;
      PLANS.push({ d, r, h, down: false });
    }
PLANS.push({ d: 0, r: 0, h: 0, down: true });
PLANS.push({ d: 1, r: 0, h: 0, down: true });
PLANS.push({ d: -1, r: 0, h: 0, down: true });

function place(n) {
  const x = n.c * T + 3, y = n.d > 0 ? n.r * T - 20 : (n.r + 1) * T;
  g.win.__place(x, y, n.d);
  g.setKeys([]);
  g.step(1);
}

function runPlan(n, p, seen, add) {
  place(n);
  const dir = p.d > 0 ? 'ArrowRight' : p.d < 0 ? 'ArrowLeft' : null;
  for (let f = 0; f < LIMIT; f++) {
    const keys = [];
    if (dir) keys.push(dir);
    if (p.down && f < 3) keys.push('ArrowDown');
    if (!p.down && f >= p.r && f < p.r + p.h) keys.push('KeyZ');
    g.setKeys(keys);
    g.step(1);
    const st = g.dbg();
    if (st.state !== 'play') return;
    const nd = nodeOf(st);
    if (nd) {
      const k = key(nd.c, nd.r, nd.d);
      if (!seen.has(k)) { seen.add(k); add(nd); }
    }
  }
}

const start = { c: 4, r: 11, d: 1 };
const seen = new Set([key(start.c, start.r, start.d)]);
const queue = [start];
const parent = new Map();
let head = 0, best = 0;
const t0 = Date.now();
while (head < queue.length) {
  const n = queue[head++];
  for (const p of PLANS) {
    runPlan(n, p, seen, nd => { queue.push(nd); parent.set(key(nd.c, nd.r, nd.d), n); });
  }
  if (n.c > best) best = n.c;
  if (head % 40 === 0) process.stderr.write(`  ...${head}/${queue.length} узлов, правее всего ${best}\n`);
}
console.log('узлов достижимо:', seen.size, 'за', ((Date.now() - t0) / 1000).toFixed(1), 'с');
const cols = {};
for (const k of seen) { const [c, r, d] = k.split(',').map(Number); (cols[c] = cols[c] || []).push(r + (d < 0 ? 'u' : '')); }
const list = Object.keys(cols).map(Number).sort((a, b) => a - b);
console.log('колонки:', list[0], '..', list[list.length - 1]);
const miss = [];
for (let c = 0; c < 240; c++) if (!cols[c]) miss.push(c);
console.log('недостижимые колонки:', miss.length ? miss.join(',') : 'нет');
