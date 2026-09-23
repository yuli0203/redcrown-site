// A small PDF writer for our own documents, built on the prebuilt template in
// pdf-template.js (fonts and logo prepared ahead of time by
// tools/build-pdf-template.mjs). It only writes text, lines, rectangles, the
// logo, links and, when asked, a signature placeholder, so a document costs
// about a millisecond of CPU instead of the ~100 ms a general PDF library
// spends parsing fonts.
//
// Text is drawn with Type0 / Identity-H fonts: each character becomes its
// glyph id from the template's map, in the order given. Callers pass text
// already in visual order (bidi.js), so Hebrew needs no shaping here.
import template from './pdf-template.js';

const enc = new TextEncoder();
const fromB64 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

// Decoded template bytes, once per isolate.
let bytesCache = null;
const templateBytes = () => (bytesCache ??= {
  regular: { file: fromB64(template.regular.file), toUnicode: fromB64(template.regular.toUnicode) },
  bold: { file: fromB64(template.bold.file), toUnicode: fromB64(template.bold.toUnicode) },
  logo: { rgb: fromB64(template.logo.rgb), alpha: fromB64(template.logo.alpha) },
});

export const rgb = (r, g, b) => [r, g, b];
const n = v => (Math.round(v * 1000) / 1000).toString();
const colorOp = (c, op) => `${n(c[0])} ${n(c[1])} ${n(c[2])} ${op}`;
const hex4 = v => v.toString(16).padStart(4, '0');

// PDF text string: plain ASCII in parentheses, anything else as UTF-16BE hex.
export function pdfString(s) {
  s = String(s ?? '');
  if (/^[\x20-\x7E]*$/.test(s)) return `(${s.replace(/[\\()]/g, c => '\\' + c)})`;
  let h = 'FEFF';
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    h += cp > 0xFFFF ? hex4(0xD800 + ((cp - 0x10000) >> 10)) + hex4(0xDC00 + ((cp - 0x10000) & 0x3FF)) : hex4(cp);
  }
  return `<${h.toUpperCase()}>`;
}

export class Font {
  constructor(key, data) { this.key = key; this.data = data; }
  gid(ch) { return this.data.cmap[ch.codePointAt(0)] ?? this.data.fallback; }
  widthOfTextAtSize(text, size) {
    let w = 0;
    for (const ch of text) w += this.data.widths[this.gid(ch)] || 0;
    return (w * size) / 1000;
  }
  encode(text) {
    let h = '';
    for (const ch of text) h += hex4(this.gid(ch));
    return h;
  }
}

class Page {
  constructor(width, height) { this.width = width; this.height = height; this.ops = []; this.links = []; }
  drawText(text, { x, y, size, font, color }) {
    if (!text) return;
    this.ops.push(`BT /${font.key} ${n(size)} Tf ${colorOp(color, 'rg')} ${n(x)} ${n(y)} Td <${font.encode(text)}> Tj ET`);
  }
  drawLine({ start, end, thickness = 1, color }) {
    this.ops.push(`q ${colorOp(color, 'RG')} ${n(thickness)} w ${n(start.x)} ${n(start.y)} m ${n(end.x)} ${n(end.y)} l S Q`);
  }
  drawRectangle({ x, y, width, height, color, borderColor, borderWidth = 1 }) {
    const r = `${n(x)} ${n(y)} ${n(width)} ${n(height)} re`;
    if (color) this.ops.push(`q ${colorOp(color, 'rg')} ${r} f Q`);
    if (borderColor) this.ops.push(`q ${colorOp(borderColor, 'RG')} ${n(borderWidth)} w ${r} S Q`);
  }
  drawLogo({ x, y, width, height }) {
    this.ops.push(`q ${n(width)} 0 0 ${n(height)} ${n(x)} ${n(y)} cm /Im1 Do Q`);
  }
  addLink(url, [x1, y1, x2, y2]) { this.links.push({ url, rect: [x1, y1, x2, y2] }); }
}

export class Pdf {
  constructor({ title, author, creator }) {
    this.info = { title, author, creator };
    this.pages = [];
    this.regular = new Font('F1', template.regular);
    this.bold = new Font('F2', template.bold);
  }

  addPage([w, h]) {
    const p = new Page(w, h);
    this.pages.push(p);
    return p;
  }

  // Serializes the document. With `signature`, adds an invisible signature
  // field and a /Contents placeholder of `signature.size` bytes, and returns
  // where the placeholder is so sign.js can fill it in.
  save({ signature = null } = {}) {
    const objs = [];                      // index = object number - 1
    const add = body => { objs.push(body); return objs.length; };
    const reserve = () => add(null);
    const stream = (dict, bytes) => ({ dict: `<< ${dict} /Length ${bytes.length} >>`, bytes });
    const t = templateBytes();

    const catalog = reserve();
    const pagesRef = reserve();

    const fontObj = (font, bytes) => {
      const d = font.data.descriptor;
      const file = add(stream(`/Filter /FlateDecode /Length1 ${font.data.fileLength}`, bytes.file));
      const desc = add(`<< /Type /FontDescriptor /FontName /${font.data.name} /Flags 32 /FontBBox [${d.bbox.join(' ')}] ` +
        `/ItalicAngle ${d.italicAngle} /Ascent ${d.ascent} /Descent ${d.descent} /CapHeight ${d.capHeight} /StemV 80 /FontFile2 ${file} 0 R >>`);
      const cid = add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${font.data.name} ` +
        `/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /CIDToGIDMap /Identity /DW 1000 /W [${font.data.W}] >>`);
      const toUni = add(stream('/Filter /FlateDecode', bytes.toUnicode));
      return add(`<< /Type /Font /Subtype /Type0 /BaseFont /${font.data.name} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${toUni} 0 R >>`);
    };
    const f1 = fontObj(this.regular, t.regular);
    const f2 = fontObj(this.bold, t.bold);
    const L = template.logo;
    const smask = add(stream(`/Type /XObject /Subtype /Image /Width ${L.width} /Height ${L.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, t.logo.alpha));
    const logo = add(stream(`/Type /XObject /Subtype /Image /Width ${L.width} /Height ${L.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask ${smask} 0 R`, t.logo.rgb));
    const resources = `<< /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> /XObject << /Im1 ${logo} 0 R >> /ProcSet [/PDF /Text /ImageB /ImageC] >>`;

    let sig = null;
    const pageRefs = [];
    this.pages.forEach((p, i) => {
      const pageRef = reserve();
      pageRefs.push(pageRef);
      const content = add(stream('', enc.encode(p.ops.join('\n'))));
      const annots = p.links.map(l => add(`<< /Type /Annot /Subtype /Link /Rect [${l.rect.map(n).join(' ')}] /Border [0 0 0] /A << /Type /Action /S /URI /URI ${pdfString(l.url)} >> >>`));
      if (signature && i === 0) {
        const v = reserve();
        const widget = add(`<< /Type /Annot /Subtype /Widget /FT /Sig /Rect [0 0 0 0] /V ${v} 0 R /T (Signature1) /F 132 /P ${pageRef} 0 R >>`);
        annots.push(widget);
        sig = { v, widget };
      }
      const annotsEntry = annots.length ? ` /Annots [${annots.map(a => `${a} 0 R`).join(' ')}]` : '';
      objs[pageRef - 1] = `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${n(p.width)} ${n(p.height)}] /Resources ${resources} /Contents ${content} 0 R${annotsEntry} >>`;
    });
    objs[pagesRef - 1] = `<< /Type /Pages /Kids [${pageRefs.map(r => `${r} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`;

    const now = new Date();
    const pdfDate = `D:${now.toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z`;
    let sigPrefix = '', sigSuffix = '';
    if (sig) {
      const s = signature;
      sigPrefix = `<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /ByteRange [0 ********** ********** **********] /Contents <`;
      sigSuffix = `> /M (${pdfDate}) /Name ${pdfString(s.name)} /Reason ${pdfString(s.reason)} /Location ${pdfString(s.location)} /ContactInfo ${pdfString(s.contactInfo)} >>`;
      objs[sig.v - 1] = { sig: true };
    }
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesRef} 0 R${sig ? ` /AcroForm << /Fields [${sig.widget} 0 R] /SigFlags 3 >>` : ''} >>`;
    const info = add(`<< /Title ${pdfString(this.info.title)} /Author ${pdfString(this.info.author)} /Creator ${pdfString(this.info.creator)} /Producer ${pdfString(this.info.creator)} /CreationDate (${pdfDate}) >>`);

    // Serialize.
    const parts = [];
    let offset = 0;
    const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); offset += b.length; };
    // Header; the second line's high bytes mark the file as binary.
    push(Uint8Array.of(...enc.encode('%PDF-1.7\n%'), 0xE2, 0xE3, 0xCF, 0xD3, 0x0A));
    const xref = [];
    let placeholder = null;
    objs.forEach((o, i) => {
      xref.push(offset);
      push(`${i + 1} 0 obj\n`);
      if (typeof o === 'string') push(o);
      else if (o.sig) {
        const start = offset;
        push(sigPrefix);
        const contentsAt = offset;
        push('0'.repeat(signature.size * 2));
        push(sigSuffix);
        placeholder = { byteRangeAt: start + sigPrefix.indexOf('[0 '), contentsAt: contentsAt - 1, contentsEnd: contentsAt + signature.size * 2 + 1 };
      } else { push(o.dict + '\nstream\n'); push(o.bytes); push('\nendstream'); }
      push('\nendobj\n');
    });
    const xrefAt = offset;
    const id = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
    push(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${xref.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}` +
      `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R /ID [<${id}> <${id}>] >>\nstartxref\n${xrefAt}\n%%EOF\n`);

    const out = new Uint8Array(offset);
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return placeholder ? { bytes: out, placeholder } : out;
  }
}
