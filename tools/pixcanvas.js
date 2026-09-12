// Мини-канвас на пиксельном буфере: хватает и генератору спрайтов assets.js,
// и отрисовке кадра из game.js (fillRect, drawImage, трансформ, globalAlpha).
'use strict';
const hex = s => {
  if (typeof s !== 'string') return [0, 0, 0, 255];
  if (s[0] === '#') {
    const n = s.length === 4
      ? [s[1] + s[1], s[2] + s[2], s[3] + s[3]] : [s.slice(1, 3), s.slice(3, 5), s.slice(5, 7)];
    return [parseInt(n[0], 16), parseInt(n[1], 16), parseInt(n[2], 16), 255];
  }
  const m = /rgba?\(([^)]+)\)/.exec(s);
  if (m) { const p = m[1].split(',').map(Number); return [p[0] | 0, p[1] | 0, p[2] | 0, Math.round((p[3] ?? 1) * 255)]; }
  return [255, 0, 255, 255];
};

function makeCanvas(w, h) {
  const px = new Uint8Array(w * h * 4);          // RGBA
  const c = { width: w, height: h, _px: px, _w: w, _h: h };
  const st = { tx: 0, ty: 0, sx: 1, sy: 1 };
  const stack = [];
  const put = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= w || y >= h || !a) return;
    const i = (y * w + x) * 4;
    if (a >= 255) { px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; return; }
    const k = a / 255;
    px[i] += (r - px[i]) * k; px[i + 1] += (g - px[i + 1]) * k; px[i + 2] += (b - px[i + 2]) * k;
    px[i + 3] = Math.max(px[i + 3], a);
  };
  const map = (x, y) => [Math.round(x * st.sx + st.tx), Math.round(y * st.sy + st.ty)];
  const ctx = {
    canvas: c, imageSmoothingEnabled: false, fillStyle: '#000', globalAlpha: 1,
    save() { stack.push({ ...st }); },
    restore() { if (stack.length) Object.assign(st, stack.pop()); },
    translate(x, y) { st.tx += x * st.sx; st.ty += y * st.sy; },
    scale(x, y) { st.sx *= x; st.sy *= y; },
    setTransform(a, b2, cc, d, e, f) { st.sx = a; st.sy = d; st.tx = e; st.ty = f; },
    clearRect() {},
    fillRect(x, y, rw, rh) {
      const [r, g, b, a0] = hex(ctx.fillStyle);
      const a = Math.round(a0 * ctx.globalAlpha);
      for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) {
        const [ax, ay] = map(x + i, y + j);
        put(st.sy < 0 ? ax : ax, st.sy < 0 ? ay - 1 : ay, r, g, b, a);
      }
    },
    drawImage(img, a1, b1, cw, chh, dx, dy, dw, dh) {
      let sx = 0, sy = 0, sw = img._w, sh = img._h, ox = a1, oy = b1;
      if (arguments.length >= 8) { sx = a1; sy = b1; sw = cw; sh = chh; ox = dx; oy = dy; }
      const scaleX = arguments.length >= 9 ? dw / sw : 1, scaleY = arguments.length >= 9 ? dh / sh : 1;
      const ga = ctx.globalAlpha;
      for (let j = 0; j < sh * scaleY; j++) for (let i = 0; i < sw * scaleX; i++) {
        const si = Math.floor(i / scaleX), sj = Math.floor(j / scaleY);
        const p = ((sy + sj) * img._w + (sx + si)) * 4;
        const a = img._px[p + 3];
        if (!a) continue;
        const [ax, ay] = map(ox + i, oy + j);
        put(ax, st.sy < 0 ? ay - 1 : ay, img._px[p], img._px[p + 1], img._px[p + 2], Math.round(a * ga));
      }
    },
  };
  c.getContext = () => ctx;
  return c;
}

// PNG без потерь: одна IDAT со zlib-сжатием, фильтр 0 на каждую строку
function png(canvas) {
  const zlib = require('zlib');
  const { width: w, height: h, _px: px } = canvas;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(px.buffer, px.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const crcT = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcT[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// увеличение целым множителем — мелкие пиксели иначе не рассмотреть
function zoom(canvas, k) {
  const out = makeCanvas(canvas.width * k, canvas.height * k);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const p = (y * canvas.width + x) * 4;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
      const q = ((y * k + j) * out.width + x * k + i) * 4;
      out._px[q] = canvas._px[p]; out._px[q + 1] = canvas._px[p + 1];
      out._px[q + 2] = canvas._px[p + 2]; out._px[q + 3] = 255;
    }
  }
  return out;
}
module.exports = { makeCanvas, png, zoom };
