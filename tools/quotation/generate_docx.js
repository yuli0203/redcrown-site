#!/usr/bin/env node
/*
 * Red Crown Interactive price quotations, as an editable Word document.
 *
 * WHY THIS EXISTS
 * generate.py renders the same JSON to a fixed-layout PDF. A PDF is the right
 * thing to send; it is the wrong thing to hand someone who wants to change a
 * line before signing. This produces the same quotation as a .docx that opens
 * and edits cleanly in Word, Google Docs and Pages.
 *
 * Both generators read ONE config file, so a quotation cannot drift between
 * its PDF and its Word version -- see README.md for the schema.
 *
 * USAGE
 *     node tools/quotation/generate_docx.js <config.json> [-o output.docx]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, ImageRun,
  Packer, PageOrientation, Paragraph, ShadingType, Table, TableCell, TableRow,
  TextRun, VerticalAlign, WidthType,
} = require('docx');

// --- house style -----------------------------------------------------------

const FONT = 'Arial';           // metric twin of the Helvetica the PDF uses

const INK = '1B1B1D';
const INK2 = '353539';
const MUTED = '6D6D73';
const RED = 'D30B34';
const LINE = 'DEDEE3';
const SOFT = 'F5F5F7';
const BLUSH = 'FFF3F6';

// A4 at 1440 dxa/inch, with the same half-inch side margins as the PDF.
const PAGE_W = 11906;
const MARGIN = 720;
const CONTENT_W = PAGE_W - MARGIN * 2;
const GUTTER = 200;
const HALF_W = Math.floor((CONTENT_W - GUTTER) / 2);

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = {
  top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
  insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
};

// --- small builders --------------------------------------------------------

/** One line of text. `size` is in points; docx wants half-points. */
function line(text, opts = {}) {
  const {
    size = 9, bold = false, color = INK, align, before = 0, after = 0,
    spacingLine, shading, borders, indent, allCaps = false, characterSpacing,
  } = opts;
  return new Paragraph({
    alignment: align,
    spacing: { before, after, ...(spacingLine ? { line: spacingLine } : {}) },
    ...(shading ? { shading: { type: ShadingType.CLEAR, fill: shading } } : {}),
    ...(borders ? { border: borders } : {}),
    ...(indent ? { indent } : {}),
    children: [new TextRun({
      text, bold, color, font: FONT, size: Math.round(size * 2),
      allCaps, characterSpacing,
    })],
  });
}

/** A label like SUPPLIER or HOURLY RATE: small, spaced-out, muted. */
function eyebrow(text) {
  return line(text, {
    size: 6.8, bold: true, color: MUTED, allCaps: true, characterSpacing: 12,
    after: 60,
  });
}

function cell(children, opts = {}) {
  const {
    width, shading, borders = NO_BORDERS, margins, columnSpan,
    valign = VerticalAlign.CENTER,
  } = opts;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    ...(columnSpan ? { columnSpan } : {}),
    ...(shading ? { shading: { type: ShadingType.CLEAR, fill: shading } } : {}),
    borders,
    margins: margins || { top: 160, bottom: 160, left: 180, right: 180 },
    verticalAlign: valign,
    children,
  });
}

function layoutTable(rows, columnWidths) {
  return new Table({
    columnWidths,
    width: { size: columnWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    borders: NO_BORDERS,
    rows,
  });
}

/** Two equal-width panels with a gutter between them. */
function twoUp(leftChildren, rightChildren, shading) {
  return layoutTable([
    new TableRow({
      children: [
        cell(leftChildren, { width: HALF_W, shading }),
        cell([line('', { size: 1 })], {
          width: GUTTER, margins: { top: 0, bottom: 0, left: 0, right: 0 },
        }),
        cell(rightChildren, { width: HALF_W, shading }),
      ],
    }),
  ], [HALF_W, GUTTER, HALF_W]);
}

function spacer(points) {
  return line('', { size: points, spacingLine: points * 20 });
}

// --- sections --------------------------------------------------------------

function header(cfg, logoPath) {
  const logoCell = fs.existsSync(logoPath)
    ? cell([new Paragraph({
        children: [new ImageRun({
          type: 'png',
          data: fs.readFileSync(logoPath),
          transformation: { width: 68, height: 68 },
        })],
      })], { width: 1100, margins: { top: 0, bottom: 0, left: 0, right: 160 } })
    : cell([line('', { size: 1 })], { width: 1100 });

  const identity = cell([
    line(cfg.supplier.company, {
      size: 15, bold: true, color: INK, allCaps: true, after: 60,
    }),
    line(cfg.supplier.tagline, {
      size: 7.5, color: MUTED, allCaps: true, characterSpacing: 8,
    }),
  ], { width: 4400, margins: { top: 60, bottom: 0, left: 0, right: 0 } });

  const meta = cell([
    line('Price Quotation', {
      size: 10, bold: true, color: RED, allCaps: true,
      align: AlignmentType.RIGHT, after: 80,
    }),
    line(`Quotation No. ${cfg.quotation_no}`, {
      size: 7.2, color: MUTED, align: AlignmentType.RIGHT, after: 40,
    }),
    line(`Date: ${cfg.date}`, {
      size: 7.2, color: MUTED, align: AlignmentType.RIGHT, after: 40,
    }),
    line(`Valid for: ${cfg.valid_for}`, {
      size: 7.2, color: MUTED, align: AlignmentType.RIGHT,
    }),
  ], {
    width: CONTENT_W - 1100 - 4400,
    margins: { top: 60, bottom: 0, left: 0, right: 0 },
  });

  return [
    // The brand rule across the top of the page.
    line('', {
      size: 4, spacingLine: 90, shading: RED, after: 260,
    }),
    layoutTable(
      [new TableRow({ children: [logoCell, identity, meta] })],
      [1100, 4400, CONTENT_W - 1100 - 4400],
    ),
    spacer(10),
  ];
}

function parties(cfg) {
  const panel = (label, name, subtitle) => [
    eyebrow(label),
    line(name, { size: 8.4, bold: true, color: INK, after: 60 }),
    line(subtitle, { size: 7, color: MUTED }),
  ];
  return [
    twoUp(
      panel('Supplier', cfg.supplier.company, cfg.supplier.contact),
      panel('Client', cfg.client.name, cfg.client.subtitle),
      SOFT,
    ),
    spacer(12),
  ];
}

function title(cfg) {
  const out = [new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 0, after: 100 },
    children: [new TextRun({
      text: cfg.title, bold: true, color: INK, font: FONT, size: 39,
    })],
  })];
  if (cfg.subtitle) {
    out.push(line(cfg.subtitle, { size: 8.3, color: MUTED, after: 320 }));
  }
  return out;
}

/** Rough DXA width of a string at `points`, for underlining a heading. */
function textWidth(text, points) {
  return Math.round(text.length * points * 0.58 * 20) + 60;
}

function scope(cfg) {
  if (!cfg.scope) return [];
  const { heading, amount_header: amountHeader, items, total } = cfg.scope;

  // The heading sits on a short red rule, as it does in the PDF.
  const redRule = {
    bottom: { style: BorderStyle.SINGLE, size: 12, color: RED, space: 3 },
  };
  const flush = { top: 0, bottom: 0, left: 0, right: 0 };
  const headW = textWidth(heading, 11.2);
  const amountW2 = amountHeader ? textWidth(amountHeader, 11.2) : 0;
  const headingWidths = amountHeader
    ? [headW, CONTENT_W - headW - amountW2, amountW2]
    : [headW, CONTENT_W - headW];
  const headingRow = new TableRow({
    children: [
      cell([line(heading, {
        size: 11.2, bold: true, color: INK, borders: redRule,
      })], { width: headW, margins: flush }),
      cell([line('', { size: 1 })], {
        width: headingWidths[1], margins: flush,
      }),
      ...(amountHeader ? [cell([line(amountHeader, {
        size: 11.2, bold: true, color: INK, align: AlignmentType.RIGHT,
        borders: redRule,
      })], { width: amountW2, margins: flush })] : []),
    ],
  });

  const hairline = {
    bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 6 },
  };
  const bulletW = 260;
  const amountW = amountHeader ? 1200 : 0;
  const bodyW = CONTENT_W - bulletW - amountW;

  const rows = items.map((item, i) => {
    const last = i === items.length - 1;
    const margins = { top: 100, bottom: 100, left: 0, right: 0 };
    const borders = last ? NO_BORDERS : {
      ...NO_BORDERS,
      bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
    };
    return new TableRow({
      children: [
        cell([line('●', { size: 6.5, color: RED })],
          { width: bulletW, borders, margins, valign: VerticalAlign.TOP }),
        cell([
          line(item.name, { size: 8, bold: true, color: INK, after: 50 }),
          line(item.note, { size: 6.65, color: MUTED, spacingLine: 170 }),
        ], { width: bodyW, borders, margins, valign: VerticalAlign.TOP }),
        ...(amountHeader ? [cell(
          [line(String(item.amount ?? ''), {
            size: 8.2, bold: true, color: INK, align: AlignmentType.RIGHT,
          })],
          { width: amountW, borders, margins, valign: VerticalAlign.TOP },
        )] : []),
      ],
    });
  });

  const out = [
    layoutTable([headingRow], headingWidths),
    spacer(4),
    layoutTable(rows, amountHeader
      ? [bulletW, bodyW, amountW]
      : [bulletW, bodyW]),
  ];

  if (total) {
    out.push(layoutTable([new TableRow({
      children: [
        cell([line(total.label, {
          size: 7.9, bold: true, color: INK, allCaps: true,
        })], {
          width: CONTENT_W - 2600,
          borders: { ...NO_BORDERS, top: { style: BorderStyle.SINGLE, size: 4, color: LINE } },
          margins: { top: 120, bottom: 60, left: 0, right: 0 },
        }),
        cell([line(total.value, {
          size: 8.9, bold: true, color: RED, align: AlignmentType.RIGHT,
        })], {
          width: 2600,
          borders: { ...NO_BORDERS, top: { style: BorderStyle.SINGLE, size: 4, color: LINE } },
          margins: { top: 120, bottom: 60, left: 0, right: 0 },
        }),
      ],
    })], [CONTENT_W - 2600, 2600]));
  }

  out.push(spacer(12));
  return out;
}

function headline(cfg) {
  const head = cfg.headline;
  const noteW = 4200;
  return [
    layoutTable([new TableRow({
      children: [
        cell([
          eyebrow(head.label),
          line(head.value, { size: 18.5, bold: true, color: RED }),
        ], { width: CONTENT_W - noteW, shading: BLUSH,
             margins: { top: 200, bottom: 200, left: 240, right: 0 } }),
        cell([line(head.note || '', {
          size: 7.8, bold: true, color: INK2, align: AlignmentType.RIGHT,
        })], { width: noteW, shading: BLUSH,
               margins: { top: 200, bottom: 200, left: 0, right: 240 } }),
      ],
    })], [CONTENT_W - noteW, noteW]),
    spacer(12),
  ];
}

function infoBoxes(cfg) {
  const boxes = cfg.info_boxes || [];
  if (!boxes.length) return [];
  const panel = (box) => [
    eyebrow(box.label),
    line(box.value, { size: 8.6, bold: true, color: INK, after: 70 }),
    line(box.note, { size: 6.6, color: MUTED, spacingLine: 170 }),
  ];
  return [
    twoUp(panel(boxes[0]), boxes[1] ? panel(boxes[1]) : [line('', { size: 1 })], SOFT),
    spacer(12),
  ];
}

function addons(cfg) {
  const out = [];
  for (const addon of cfg.addons || []) {
    const priceW = 3000;
    const bordered = {
      top: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      left: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      right: { style: BorderStyle.SINGLE, size: 4, color: LINE },
    };
    out.push(layoutTable([new TableRow({
      children: [
        cell([
          eyebrow(addon.label),
          line(addon.description, { size: 8.2, bold: true, color: INK }),
        ], { width: CONTENT_W - priceW,
             borders: { ...bordered, right: NO_BORDER } }),
        cell([line(addon.price, {
          size: 9.4, bold: true, color: RED, align: AlignmentType.RIGHT,
        })], { width: priceW, borders: { ...bordered, left: NO_BORDER } }),
      ],
    })], [CONTENT_W - priceW, priceW]));
    out.push(spacer(10));
  }
  return out;
}

function signatures(cfg) {
  const sign = cfg.signatures;
  if (!sign) return [];
  const panel = (block) => [
    // An empty paragraph whose bottom border is the line you sign on.
    line('', {
      size: 9, spacingLine: 520,
      borders: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'A0A0A8', space: 2 } },
      after: 80,
    }),
    line(block.caption, { size: 6.4, color: MUTED }),
  ];
  return [
    spacer(8),
    eyebrow(sign.label),
    ...(sign.note ? [line(sign.note, { size: 6.6, color: MUTED, after: 160 })] : []),
    twoUp(panel(sign.blocks[0]), panel(sign.blocks[1] || { caption: '' })),
    spacer(12),
  ];
}

function notes(cfg) {
  const items = cfg.notes || [];
  if (!items.length) return [];
  const termW = 1800;
  const rows = items.map((note) => new TableRow({
    children: [
      cell([line(`${note.term}:`, { size: 6.6, bold: true, color: MUTED })],
        { width: termW, margins: { top: 60, bottom: 60, left: 0, right: 120 } }),
      cell([line(note.text, { size: 6.1, color: MUTED, spacingLine: 160 })],
        { width: CONTENT_W - termW,
          margins: { top: 60, bottom: 60, left: 0, right: 0 } }),
    ],
  }));
  return [spacer(8), layoutTable(rows, [termW, CONTENT_W - termW])];
}

// --- document --------------------------------------------------------------

const DEFAULT_FOOTER =
  'julia@redcrowninteractive.com  |  +972-58-576-0550  |  redcrowninteractive.com';

function build(cfg, logoPath) {
  const footerW = 3400;
  const pageFooter = new Footer({
    children: [layoutTable([new TableRow({
      children: [
        cell([line(cfg.footer || DEFAULT_FOOTER, { size: 6.7, color: MUTED })],
          { width: CONTENT_W - footerW,
            margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
        cell([line(cfg.supplier.company, {
          size: 6.7, bold: true, color: INK, align: AlignmentType.RIGHT,
        })], { width: footerW,
               margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
      ],
    })], [CONTENT_W - footerW, footerW])],
  });

  return new Document({
    creator: cfg.supplier.company,
    title: `${cfg.title} - ${cfg.client.name}`,
    description: `Price quotation ${cfg.quotation_no}`,
    styles: {
      default: {
        document: { run: { font: FONT, size: 18, color: INK } },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.PORTRAIT },
          margin: { top: 560, bottom: 560, left: MARGIN, right: MARGIN,
                    footer: 360 },
        },
      },
      footers: { default: pageFooter },
      children: [
        ...header(cfg, logoPath),
        ...parties(cfg),
        ...title(cfg),
        ...scope(cfg),
        ...headline(cfg),
        ...infoBoxes(cfg),
        ...addons(cfg),
        ...signatures(cfg),
        ...notes(cfg),
      ],
    }],
  });
}

function main(argv) {
  const args = argv.slice(2);
  if (!args.length) {
    console.error('usage: generate_docx.js <config.json> [-o output.docx]');
    return 1;
  }
  const configPath = args[0];
  const outFlag = args.indexOf('-o');
  const out = outFlag !== -1 && args[outFlag + 1]
    ? args[outFlag + 1]
    : configPath.replace(/\.json$/, '') + '.docx';
  const logoPath = path.join(__dirname, 'assets', 'redcrown-mark.png');

  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });

  return Packer.toBuffer(build(cfg, logoPath)).then((buf) => {
    fs.writeFileSync(out, buf);
    console.log(`wrote ${out}`);
    return 0;
  });
}

if (require.main === module) {
  Promise.resolve(main(process.argv))
    .then((code) => process.exit(code || 0))
    .catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { build };
