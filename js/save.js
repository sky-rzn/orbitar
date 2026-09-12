// ============================================================
//  ORBITAR — прогресс и настройки (localStorage)
// ============================================================
// Хранит пройденные уровни, лучший результат по каждому и настройки картинки.
// Звук держит свои переключатели сам (ключ `orbitar.audio` в js/audio.js).
'use strict';

const SAVE = (() => {
const KEY = 'orbitar.save';
const VERSION = 1;
const DEFAULTS = { scanlines: false };

const blank = () => ({ v: VERSION, cleared: [], best: [], settings: Object.assign({}, DEFAULTS) });
let data = blank();

// Чужой или старый формат не ломает игру: берём только то, что узнали.
try {
  const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (raw && raw.v === VERSION) {
    if (Array.isArray(raw.cleared)) data.cleared = raw.cleared.map(Boolean);
    if (Array.isArray(raw.best)) data.best = raw.best.map(b =>
      b && typeof b === 'object' ? { cells: b.cells | 0, time: b.time | 0 } : null);
    if (raw.settings) for (const k in DEFAULTS)
      if (typeof raw.settings[k] === typeof DEFAULTS[k]) data.settings[k] = raw.settings[k];
  }
} catch (e) { /* нет хранилища или мусор — начинаем с чистого листа */ }

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* приватный режим */ }
}

const cleared = i => !!data.cleared[i];
// первый уровень открыт всегда, дальше — по цепочке пройденных
const unlocked = i => i === 0 || cleared(i - 1);
const best = i => data.best[i] || null;

// Уровень пройден. Рекорды по ячейкам и по времени держим порознь:
// собрать всё и пробежать быстро — две разные задачи.
function clearLevel(i, cells, time) {
  const prev = data.best[i];
  const rec = !prev || cells > prev.cells || time < prev.time;
  data.cleared[i] = true;
  data.best[i] = prev ? { cells: Math.max(prev.cells, cells), time: Math.min(prev.time, time) }
                      : { cells, time };
  save();
  return rec;
}

return {
  cleared, unlocked, best, clearLevel,
  count: () => data.cleared.filter(Boolean).length,
  get: name => data.settings[name],
  set(name, v) { data.settings[name] = v; save(); },
  wipe() { data = blank(); save(); },
};
})();
