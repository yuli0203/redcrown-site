// PDF documents: payment requests (חשבון עסקה) and receipts (קבלה).
//
// One bilingual layout, Hebrew first and right-aligned, every label also in
// English, so the same document serves Israeli and foreign clients.
//
// A receipt carries what סעיף 5 of הוראות מס הכנסה (ניהול פנקסי חשבונות)
// requires: running number; the taxpayer's name and ID number; date; payer's
// name and address; amount; what the payment was for, with the payment method
// details; and the signature (digital when signed, a signature line on a paper
// original). It is marked מקור (original, to the payer), העתק (copy, kept) or
// העתק נאמן למקור (a later reprint). A digitally signed one is marked מסמך
// ממוחשב (סעיף 18ב).
import { PDFDocument, PDFName, PDFString, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { fontRegular, fontBold, logoPng } from './assets.js';
import { visual, hasHebrew } from './bidi.js';

const A4 = [595.28, 841.89];
const M = 48;                       // page margin
const RIGHT = A4[0] - M;
const WIDTH = A4[0] - 2 * M;
const INK = rgb(0.1, 0.09, 0.09);
const DIM = rgb(0.42, 0.4, 0.4);
const LINE = rgb(0.85, 0.83, 0.83);
const BRAND = rgb(0.784, 0.063, 0.18);   // #C8102E
const TZ = 'Asia/Jerusalem';

const fromB64 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

// fontkit (inside pdf-lib) picks a direction for each string from its first
// letter and reverses the glyphs of right-to-left strings. Our lines are
// already in visual order, so each line is drawn in chunks that start at a
// letter change: a chunk whose letters are Hebrew is passed reversed (fontkit
// turns it back), any other chunk as is.
const HEB = /[\u0590-\u05FF\uFB1D-\uFB4F]/;
const isLetter = c => /\p{L}/u.test(c);
export function glyphChunks(v) {
  const chunks = [];
  let cur = null;
  for (const c of v) {
    const kind = isLetter(c) ? (HEB.test(c) ? 'H' : 'L') : null;
    if (!cur || (kind && cur.kind && kind !== cur.kind)) { cur = { kind, text: '' }; chunks.push(cur); }
    if (kind && !cur.kind) cur.kind = kind;
    cur.text += c;
  }
  return chunks.map(ch => (ch.kind === 'H' ? [...ch.text].reverse().join('') : ch.text));
}

export const METHODS = {
  paypal: 'PayPal',
  card: 'כרטיס אשראי / Credit card',
  bank_transfer: 'העברה בנקאית / Bank transfer',
  cheque: 'המחאה / Cheque',
  cash: 'מזומן / Cash',
  other: 'אחר / Other',
};

// "₪1,250.00", "$1,250.00": symbol first, always left-to-right.
export const money = (minor, currency) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);

export const date = (value, withTime = false) => {
  const d = value instanceof Date ? value : new Date(value);
  const opts = { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' };
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit', hour12: false });
  return new Intl.DateTimeFormat('en-GB', opts).format(d).replace(',', '');
};

// Text details of a payment method, one line each.
export function methodLines(method, d = {}) {
  const lines = [METHODS[method] || METHODS.other];
  const add = (he, en, v) => { if (v) lines.push(`${he} / ${en}: ${v}`); };
  if (method === 'paypal' || method === 'card') {
    add('דרך', 'Via', method === 'card' ? 'PayPal' : '');
    add('מזהה עסקה', 'Transaction ID', d.transactionId);
    add('משלם', 'Payer', d.payerEmail);
    add('כרטיס', 'Card', d.cardBrand && d.cardLast4 ? `${d.cardBrand} ****${d.cardLast4}` : '');
  } else if (method === 'bank_transfer') {
    add('בנק', 'Bank', d.bank);
    add('סניף', 'Branch', d.branch);
    add('חשבון', 'Account', d.account);
    add('אסמכתא', 'Reference', d.reference);
  } else if (method === 'cheque') {
    add('מס׳ המחאה', 'Cheque no.', d.chequeNumber);
    add('בנק', 'Bank', d.bank);
    add('סניף', 'Branch', d.branch);
    add('חשבון', 'Account', d.account);
    add('תאריך פירעון', 'Due date', d.dueDate);
  } else {
    add('פרטים', 'Details', d.reference);
  }
  return lines;
}

class Layout {
  static async create(title) {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    doc.setTitle(title);
    doc.setAuthor('Red Crown Interactive');
    doc.setCreator('Red Crown Interactive payments');
    doc.setProducer('Red Crown Interactive payments');
    const l = new Layout();
    l.doc = doc;
    l.regular = await doc.embedFont(fromB64(fontRegular), { subset: true });
    l.bold = await doc.embedFont(fromB64(fontBold), { subset: true });
    l.logo = await doc.embedPng(fromB64(logoPng));
    l.pages = [];
    l.newPage();
    return l;
  }

  newPage() {
    this.page = this.doc.addPage(A4);
    this.pages.push(this.page);
    this.y = A4[1] - M;
  }

  ensure(height) {
    if (this.y - height < M + 40) this.newPage();
  }

  width(text, size, bold) {
    const font = bold ? this.bold : this.regular;
    return glyphChunks(visual(text)).reduce((w, ch) => w + font.widthOfTextAtSize(ch, size), 0);
  }

  // Draws one line. align: 'right' (x is the right edge), 'left' or 'center'.
  text(str, { x = RIGHT, y = this.y, size = 10, bold = false, color = INK, align = 'right' } = {}) {
    const s = String(str ?? '');
    if (!s) return;
    const font = bold ? this.bold : this.regular;
    const chunks = glyphChunks(visual(s, hasHebrew(s) ? 'rtl' : 'ltr'));
    const widths = chunks.map(ch => font.widthOfTextAtSize(ch, size));
    const w = widths.reduce((a, b) => a + b, 0);
    let left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    chunks.forEach((ch, i) => { this.page.drawText(ch, { x: left, y, size, font, color }); left += widths[i]; });
  }

  // Splits logical text into lines no wider than maxWidth.
  wrap(str, maxWidth, size, bold) {
    const out = [];
    for (const para of String(str ?? '').split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? line + ' ' + word : word;
        if (line && this.width(next, size, bold) > maxWidth) { out.push(line); line = word; } else line = next;
        // A single word wider than the column (a long URL) is cut into pieces.
        while (this.width(line, size, bold) > maxWidth && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && this.width(line.slice(0, cut), size, bold) > maxWidth) cut--;
          out.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      }
      out.push(line);
    }
    return out;
  }

  // Wrapped paragraph at the cursor; returns its height.
  para(str, { x = RIGHT, width = WIDTH, size = 10, bold = false, color = INK, align = 'right', gap = 4 } = {}) {
    const lines = this.wrap(str, width, size, bold);
    for (const line of lines) {
      this.ensure(size + gap);
      this.text(line, { x, size, bold, color, align });
      this.y -= size + gap;
    }
  }

  rule(y = this.y, color = LINE, thickness = 0.7) {
    this.page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness, color });
  }

  link(url, x, y, w, h) {
    const annot = this.doc.context.obj({
      Type: 'Annot', Subtype: 'Link', Rect: [x, y, x + w, y + h], Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
    });
    const ref = this.doc.context.register(annot);
    const annots = this.page.node.lookup(PDFName.of('Annots'));
    if (annots) annots.push(ref); else this.page.node.set(PDFName.of('Annots'), this.doc.context.obj([ref]));
  }

  footer(line) {
    this.pages.forEach((p, i) => {
      const page = this.page;
      this.page = p;
      this.rule(M + 18);
      this.text(line, { x: M, y: M + 4, size: 7.5, color: DIM, align: 'left' });
      this.text(`${i + 1}/${this.pages.length}`, { x: RIGHT, y: M + 4, size: 7.5, color: DIM });
      this.page = page;
    });
  }
}

// Header: logo and issuer on the left, document title and number on the right.
function header(l, business, { title, number, mark, lines }) {
  const top = l.y;
  l.page.drawImage(l.logo, { x: M, y: top - 46, width: 46, height: 46 });
  l.text(business.tradingName, { x: M + 56, y: top - 14, size: 12, bold: true, align: 'left' });
  const issuer = [
    business.ownerName,
    `עוסק פטור / Exempt dealer: ${business.businessId}`,
    business.address,
    [business.email, business.phone].filter(Boolean).join(' · '),
  ].filter(Boolean);
  issuer.forEach((s, i) => l.text(s, { x: M + 56, y: top - 28 - i * 12, size: 8.5, color: DIM, align: 'left' }));

  l.text(title, { y: top - 16, size: 17, bold: true, color: BRAND });
  l.text(number, { y: top - 34, size: 11, bold: true });
  lines.forEach((s, i) => l.text(s, { y: top - 50 - i * 13, size: 9, color: DIM }));
  if (mark) l.text(mark, { y: top - 50 - lines.length * 13, size: 9, bold: true });
  l.y = top - Math.max(28 + issuer.length * 12, 58 + lines.length * 13) - 14;
  l.rule();
  l.y -= 22;
}

function party(l, heading, client) {
  l.text(heading, { size: 9, bold: true, color: DIM });
  l.y -= 14;
  const rows = [
    client.name,
    client.company,
    client.taxId && `ח.פ. / ע.מ. / Tax ID: ${client.taxId}`,
    client.address,
    client.email,
  ].filter(Boolean);
  rows.forEach((s, i) => { l.text(s, { size: i === 0 ? 11 : 9.5, bold: i === 0 }); l.y -= i === 0 ? 15 : 13; });
  l.y -= 10;
}

// Table: first column (description) right-aligned on the right; numeric
// columns left of it. cols: [{ label, width }], rows: [[cells]].
function table(l, cols, rows, { totalLabel, total } = {}) {
  const numericWidth = cols.slice(1).reduce((a, c) => a + c.width, 0);
  const descWidth = WIDTH - numericWidth - 10;
  const colX = [];  // right edge of each column
  let x = RIGHT;
  colX.push(x);
  x -= descWidth + 10;
  for (const c of cols.slice(1)) { colX.push(x); x -= c.width; }

  const head = () => {
    l.ensure(24);
    l.page.drawRectangle({ x: M, y: l.y - 6, width: WIDTH, height: 18, color: rgb(0.96, 0.95, 0.95) });
    cols.forEach((c, i) => l.text(c.label, { x: colX[i] - 4, y: l.y, size: 8, bold: true, color: DIM }));
    l.y -= 20;
  };
  head();
  for (const row of rows) {
    const descLines = l.wrap(row[0], descWidth - 8, 9.5);
    const h = descLines.length * 13 + 6;
    if (l.y - h < M + 40) { l.newPage(); head(); }
    descLines.forEach((s, i) => l.text(s, { x: colX[0] - 4, y: l.y - i * 13, size: 9.5 }));
    row.slice(1).forEach((cell, i) => l.text(cell, { x: colX[i + 1] - 4, y: l.y, size: 9.5 }));
    l.y -= h;
    l.rule(l.y + 8);
  }
  if (totalLabel) {
    l.ensure(26);
    l.y -= 6;
    l.text(totalLabel, { x: colX[0] - 4, size: 11, bold: true });
    l.text(total, { x: colX[cols.length - 1] - 4, size: 11, bold: true });
    l.y -= 24;
  }
}

const markText = { original: 'מקור / Original', copy: 'העתק / Copy', true_copy: 'העתק נאמן למקור / True copy of the original' };

// ---- Payment request (חשבון עסקה). Not a receipt and not a tax invoice.
export async function buildRequestPdf({ business, request, payUrl }) {
  const l = await Layout.create(`Payment request ${request.number}`);
  header(l, business, {
    title: 'חשבון עסקה / Payment Request',
    number: `מס׳ / No. ${request.number}`,
    lines: [`תאריך / Date: ${date(request.created)}`, `בתוקף עד / Valid until: ${date(request.expires * 1000)}`],
  });
  party(l, 'לכבוד / Bill to', request.client);

  const rows = request.items.map(it => [it.description, String(it.quantity), money(it.unitMinor, request.currency), money(it.totalMinor ?? Math.round(it.unitMinor * it.quantity), request.currency)]);
  table(l, [
    { label: 'תיאור / Description' }, { label: 'כמות / Qty', width: 60 },
    { label: 'מחיר / Price', width: 90 }, { label: 'סכום / Amount', width: 95 },
  ], rows, { totalLabel: 'סה״כ לתשלום / Total due', total: money(request.amountMinor, request.currency) });

  if (request.notes) { l.para(request.notes, { size: 9.5 }); l.y -= 6; }

  if (payUrl) {
    l.ensure(90);
    const boxTop = l.y + 12;
    l.text('לתשלום מאובטח בכרטיס אשראי או PayPal / Pay securely by card or PayPal:', { size: 10, bold: true });
    l.y -= 16;
    const lines = l.wrap(payUrl, WIDTH - 20, 8.5);
    const linkTop = l.y + 10;
    lines.forEach(s => { l.text(s, { x: M + 10, size: 8.5, color: BRAND, align: 'left' }); l.y -= 12; });
    l.link(payUrl, M, l.y + 6, WIDTH, linkTop - l.y - 4);
    l.text(`להעברה בנקאית / For bank transfer details: ${business.email}`, { size: 8.5, color: DIM });
    l.y -= 10;
    l.page.drawRectangle({ x: M - 6, y: l.y, width: WIDTH + 12, height: boxTop - l.y, borderColor: LINE, borderWidth: 0.8 });
    l.y -= 22;
  }
  l.para('מסמך זה אינו קבלה ואינו חשבונית מס. קבלה תישלח לאחר קבלת התשלום.', { size: 8.5, color: DIM });
  l.para('This document is not a receipt or a tax invoice. A receipt is issued once payment is received.', { size: 8.5, color: DIM });
  l.footer(`${business.tradingName} · ${business.website || 'redcrowninteractive.com'}`);
  return l.doc.save();
}

// ---- Receipt (קבלה).
// signature: { name, reason, location, contactInfo } adds a digital signature
// placeholder (sign.js fills it); without it the original gets a signature line.
export async function buildReceiptPdf({ business, receipt, mark = 'original', signature = null }) {
  const l = await Layout.create(`Receipt ${receipt.number}`);
  header(l, business, {
    title: 'קבלה / Receipt',
    number: `מס׳ / No. ${receipt.number}`,
    mark: markText[mark],
    lines: [`תאריך / Date: ${date(receipt.created)}`, ...(receipt.requestNumber ? [`עבור חשבון עסקה / For payment request: ${receipt.requestNumber}`] : [])],
  });
  party(l, 'התקבל מאת / Received from', receipt.client);

  table(l, [{ label: 'עבור / For' }, { label: 'סכום / Amount', width: 110 }],
    [[receipt.description, money(receipt.amountMinor, receipt.currency)]]);
  l.y -= 6;

  table(l, [{ label: 'אמצעי תשלום / Payment method' }, { label: 'תאריך / Date', width: 80 }, { label: 'סכום / Amount', width: 110 }],
    [[methodLines(receipt.method, receipt.methodDetails).join('\n'), receipt.paidOn, money(receipt.amountMinor, receipt.currency)]],
    { totalLabel: 'סה״כ התקבל / Total received', total: money(receipt.amountMinor, receipt.currency) });

  if (receipt.ils && receipt.currency !== 'ILS') {
    l.para(`שווי בש״ח לפי השער היציג של בנק ישראל (${receipt.ils.rate} ליום ${receipt.ils.date}): ${money(receipt.ils.amountMinor, 'ILS')}`, { size: 8.5, color: DIM });
    l.para(`ILS value at the Bank of Israel representative rate (${receipt.ils.rate}, ${receipt.ils.date}): ${money(receipt.ils.amountMinor, 'ILS')}`, { size: 8.5, color: DIM });
    l.y -= 4;
  }

  l.ensure(70);
  l.y -= 10;
  if (signature) {
    l.text('מסמך ממוחשב / Computerized document', { size: 9.5, bold: true });
    l.y -= 13;
    l.text('חתום בחתימה אלקטרונית / Digitally signed', { size: 8.5, color: DIM });
    l.y -= 20;
  } else {
    l.text(`חתימה / Signature: ____________________   ${business.ownerName}`, { size: 9.5 });
    l.y -= 22;
  }
  l.footer(`${business.tradingName} · ${business.website || 'redcrowninteractive.com'}`);

  if (signature) {
    const { pdflibAddPlaceholder } = await import('@signpdf/placeholder-pdf-lib');
    pdflibAddPlaceholder({
      pdfDoc: l.doc, pdfPage: l.pages[0], reason: signature.reason, contactInfo: signature.contactInfo,
      name: signature.name, location: signature.location, signatureLength: 16384,
    });
    return l.doc.save({ useObjectStreams: false });
  }
  return l.doc.save();
}
