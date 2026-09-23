#!/usr/bin/env node
// Builds the PDF template (src/pdf-template.js) once, ahead of time, so the
// Worker never parses a font or an image at payment time:
//
//   - each font: the whole TrueType file, deflated and ready to embed as a PDF
//     stream; a code point -> glyph id map and glyph widths for layout; the /W
//     widths array and the ToUnicode CMap (so text can be copied and searched).
//   - the logo: PNG decoded to raw RGB and alpha, each deflated, ready to embed
//     as an image XObject and its soft mask.
//
// At runtime documents.js only writes text operators and copies these bytes,
// which keeps a receipt to about a millisecond of CPU.
//
//   node tools/build-pdf-template.mjs          write src/pdf-template.js
//   node tools/build-pdf-template.mjs --check  fail if it is out of date
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import fontkit from '@pdf-lib/fontkit';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file));
const deflate = buf => zlib.deflateSync(buf, { level: 9 });
const b64 = buf => Buffer.from(buf).toString('base64');

// Rewrites a TrueType file keeping only the tables a PDF viewer uses to draw
// glyphs (layout tables like GPOS/GSUB are for shaping engines, and we lay out
// ourselves), which makes the embedded font about a quarter smaller.
const KEEP = ['cmap', 'cvt ', 'fpgm', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'OS/2', 'prep'];
function stripFont(buf) {
  const count = buf.readUInt16BE(4);
  const tables = [];
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16, tag = buf.toString('latin1', at, at + 4);
    if (KEEP.includes(tag)) tables.push({ tag, data: buf.subarray(buf.readUInt32BE(at + 8), buf.readUInt32BE(at + 8) + buf.readUInt32BE(at + 12)) });
  }
  tables.sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const pad = n => (n + 3) & ~3;
  const headerLen = 12 + tables.length * 16;
  const out = Buffer.alloc(headerLen + tables.reduce((s, t) => s + pad(t.data.length), 0));
  const log2 = Math.floor(Math.log2(tables.length));
  out.writeUInt32BE(0x00010000, 0);
  out.writeUInt16BE(tables.length, 4);
  out.writeUInt16BE(16 * 2 ** log2, 6);
  out.writeUInt16BE(log2, 8);
  out.writeUInt16BE(tables.length * 16 - 16 * 2 ** log2, 10);
  const checksum = (b, from, len) => { let s = 0; for (let i = 0; i < pad(len); i += 4) s = (s + (from + i + 3 < b.length ? b.readUInt32BE(from + i) : 0)) >>> 0; return s; };
  let offset = headerLen, headAt = 0;
  tables.forEach((t, i) => {
    t.data.copy(out, offset);
    if (t.tag === 'head') { headAt = offset; out.writeUInt32BE(0, offset + 8); }   // checkSumAdjustment
    const at = 12 + i * 16;
    out.write(t.tag, at, 'latin1');
    out.writeUInt32BE(checksum(out, offset, t.data.length), at + 4);
    out.writeUInt32BE(offset, at + 8);
    out.writeUInt32BE(t.data.length, at + 12);
    offset += pad(t.data.length);
  });
  out.writeUInt32BE((0xB1B0AFBA - checksum(out, 0, out.length)) >>> 0, headAt + 8);
  return out;
}

function buildFont(file, name) {
  const original = read(file);
  const font = fontkit.create(original);
  const bytes = stripFont(original);
  fontkit.create(bytes);                 // the stripped file still parses
  const scale = 1000 / font.unitsPerEm;
  const cmap = {};                       // code point -> glyph id
  const widths = new Map();              // glyph id -> advance (1/1000 em)
  for (const cp of font.characterSet) {
    const g = font.glyphForCodePoint(cp);
    if (!g || g.id === 0) continue;
    cmap[cp] = g.id;
    widths.set(g.id, Math.round(g.advanceWidth * scale));
  }
  const gids = [...widths.keys()].sort((a, b) => a - b);
  // /W as runs of consecutive glyph ids: [first [w w w] first [w] ...]
  let W = '';
  for (let i = 0; i < gids.length;) {
    let j = i;
    while (j + 1 < gids.length && gids[j + 1] === gids[j] + 1) j++;
    W += `${gids[i]} [${gids.slice(i, j + 1).map(g => widths.get(g)).join(' ')}] `;
    i = j + 1;
  }
  // ToUnicode: glyph id -> code point (first code point wins for shared glyphs).
  const toUni = new Map();
  for (const [cp, gid] of Object.entries(cmap)) if (!toUni.has(gid)) toUni.set(gid, Number(cp));
  const hex4 = n => n.toString(16).padStart(4, '0').toUpperCase();
  const utf16 = cp => (cp > 0xFFFF
    ? hex4(0xD800 + ((cp - 0x10000) >> 10)) + hex4(0xDC00 + ((cp - 0x10000) & 0x3FF))
    : hex4(cp));
  const pairs = [...toUni.entries()].sort((a, b) => a[0] - b[0]);
  let bf = '';
  for (let i = 0; i < pairs.length; i += 100) {
    const chunk = pairs.slice(i, i + 100);
    bf += `${chunk.length} beginbfchar\n${chunk.map(([g, cp]) => `<${hex4(g)}> <${utf16(cp)}>`).join('\n')}\nendbfchar\n`;
  }
  const toUnicode = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n' +
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n' +
    '/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n' +
    '1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n' + bf +
    'endcmap\nCMapName currentdict /CMapResource defineresource pop\nend\nend\n';

  const bbox = font.bbox;
  return {
    name,
    cmap,
    widths: Object.fromEntries(widths),
    fallback: cmap[0x3F],                // '?' for characters the font lacks
    W: W.trim(),
    descriptor: {
      ascent: Math.round(font.ascent * scale),
      descent: Math.round(font.descent * scale),
      capHeight: Math.round((font.capHeight || font.ascent) * scale),
      bbox: [bbox.minX, bbox.minY, bbox.maxX, bbox.maxY].map(v => Math.round(v * scale)),
      italicAngle: font.italicAngle || 0,
    },
    file: b64(deflate(bytes)),
    fileLength: bytes.length,
    toUnicode: b64(deflate(Buffer.from(toUnicode))),
  };
}

// Minimal PNG decoder: 8-bit RGBA (color type 6) or RGB (2), not interlaced.
function decodePng(buf) {
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const depth = buf[24], type = buf[25], interlace = buf[28];
  if (depth !== 8 || ![2, 6].includes(type) || interlace) throw new Error('logo must be 8-bit RGB/RGBA, not interlaced');
  const bpp = type === 6 ? 4 : 3;
  const idat = [];
  for (let o = 8; o < buf.length;) {
    const len = buf.readUInt32BE(o), kind = buf.toString('ascii', o + 4, o + 8);
    if (kind === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp, out = Buffer.alloc(h * stride);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - stride + x] : 0, c = x >= bpp && y ? out[dst - stride + x - bpp] : 0;
      const v = raw[src + x];
      out[dst + x] = (f === 0 ? v : f === 1 ? v + a : f === 2 ? v + b : f === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c)) & 255;
    }
  }
  const rgb = Buffer.alloc(w * h * 3), alpha = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    rgb[i * 3] = out[i * bpp]; rgb[i * 3 + 1] = out[i * bpp + 1]; rgb[i * 3 + 2] = out[i * bpp + 2];
    alpha[i] = bpp === 4 ? out[i * 4 + 3] : 255;
  }
  return { width: w, height: h, rgb: b64(deflate(rgb)), alpha: b64(deflate(alpha)) };
}

const template = {
  regular: buildFont('assets/IBMPlexSansHebrew-Regular.ttf', 'IBMPlexSansHebrew'),
  bold: buildFont('assets/IBMPlexSansHebrew-SemiBold.ttf', 'IBMPlexSansHebrew-SemiBold'),
  logo: decodePng(read('assets/logo.png')),
};

const out = '// Generated by tools/build-pdf-template.mjs from workers/pay/assets. Do not edit.\n' +
  '// IBM Plex Sans Hebrew: SIL Open Font License 1.1 (assets/LICENSE-IBM-Plex.txt).\n' +
  `export default ${JSON.stringify(template)};\n`;

const target = path.join(root, 'src/pdf-template.js');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== out) {
    console.error('src/pdf-template.js is stale: run node workers/pay/tools/build-pdf-template.mjs');
    process.exit(1);
  }
  console.log('PDF template is current.');
} else {
  fs.writeFileSync(target, out);
  console.log(`Wrote src/pdf-template.js (${Math.round(out.length / 1024)} KB)`);
}
