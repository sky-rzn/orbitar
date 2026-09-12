'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { makeCanvas } = require('./pixcanvas');
const ctxObj = {
  document: { createElement: () => makeCanvas(1, 1), getElementById: () => null },
  Math, console,
};
ctxObj.window = ctxObj;
const sandbox = vm.createContext(ctxObj);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/assets.js'), 'utf8'), sandbox, { filename: 'assets.js' });
// подменяем createElement так, чтобы makeCanvas из assets.js получал наш буфер
vm.runInContext('document.createElement = () => null;', sandbox);
ctxObj.document.createElement = () => {
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
};

function show(name, img) {
  const pal = new Map(); const chars = ' .:-=+*#%@ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = name + '  ' + img.width + 'x' + img.height + '\n';
  for (let y = 0; y < img.height; y++) {
    let line = '';
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (!img._px[i + 3]) { line += ' '; continue; }
      const c = '#' + [0, 1, 2].map(k => img._px[i + k].toString(16).padStart(2, '0')).join('');
      if (!pal.has(c)) pal.set(c, chars[Math.min(chars.length - 1, pal.size + 1)]);
      line += pal.get(c);
    }
    out += line + '\n';
  }
  out += [...pal.entries()].map(([c, ch]) => ch + '=' + c).join(' ') + '\n';
  return out;
}
module.exports = { sandbox, vm, show };
if (require.main === module) {
  const expr = process.argv[2];
  const img = vm.runInContext(expr, sandbox);
  console.log(show(expr, img));
}
