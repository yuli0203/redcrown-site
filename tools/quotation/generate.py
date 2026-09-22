#!/usr/bin/env python3
"""
Red Crown Interactive price quotations, generated from JSON.

WHY THIS EXISTS
The first quotations were laid out by hand, one absolute coordinate at a time,
which meant every new client started from a copy of the last PDF and the layout
drifted a little further each round. The house style is DATA below -- colours,
type scale, the eight-point red rule at the top of the page -- and each
quotation is a small JSON file. Change the style once, every quotation follows.

The layout flows top to bottom from a single cursor, so a quotation with three
scope rows and one with ten both come out balanced; nothing is pinned to a
hard-coded y.

USAGE
    python3 tools/quotation/generate.py <config.json> [-o output.pdf]

The config schema is documented in README.md next to this file, and
examples/hourly-rate.json is a working reference config.

Core PDF fonts are Latin-1 only, so config text must be Latin-1 (no Hebrew).
"""

import argparse
import json
import sys
from pathlib import Path

from fpdf import FPDF

HERE = Path(__file__).resolve().parent

# ---------------------------------------------------------------------------
# House style. Everything visual lives here.
# ---------------------------------------------------------------------------

PAGE_W = 595.2756           # A4 in points
PAGE_H = 841.8898
LEFT = 34.0                 # content box
RIGHT = PAGE_W - LEFT
MID_GAP = 10.0              # gutter between the two half-width boxes
HALF_W = (RIGHT - LEFT - MID_GAP) / 2
COL2 = LEFT + HALF_W + MID_GAP
PAD = 12.0                  # text inset inside a card

INK = (27, 27, 29)          # headings
INK2 = (53, 53, 57)         # body inside the highlight box
MUTED = (109, 109, 115)     # labels and small print
RED = (211, 11, 52)         # brand
LINE = (222, 222, 227)      # hairlines and card borders
SOFT = (245, 245, 247)      # neutral card fill
BLUSH = (255, 243, 246)     # headline price card fill

TOP_BAR_H = 8.0
LOGO_SIZE = 54.0

FOOTER = ("julia@redcrowninteractive.com  |  +972-58-576-0550  |  "
          "redcrowninteractive.com")


class Quotation(FPDF):
    """An A4 quotation page. All drawing helpers take baseline/top coordinates
    in points, matching the numbers in the house style above."""

    def __init__(self, logo: Path):
        super().__init__(orientation="P", unit="pt", format="A4")
        self.logo = logo
        self.set_auto_page_break(False)
        self.set_margins(LEFT, LEFT, LEFT)

    # -- primitives ---------------------------------------------------------

    def _font(self, bold: bool, size: float):
        self.set_font("Helvetica", "B" if bold else "", size)

    def label(self, x, y, txt, *, size, bold=False, color=INK):
        """Draw a single line with its baseline at y."""
        self._font(bold, size)
        self.set_text_color(*color)
        self.text(x, y, txt)

    def label_right(self, x_right, y, txt, *, size, bold=False, color=INK):
        self._font(bold, size)
        self.set_text_color(*color)
        self.text(x_right - self.get_string_width(txt), y, txt)

    def wrap(self, txt, width, *, size, bold=False):
        """Greedy wrap to `width` points at the given font. Returns lines."""
        self._font(bold, size)
        words, lines, cur = txt.split(), [], ""
        for word in words:
            trial = f"{cur} {word}".strip()
            if cur and self.get_string_width(trial) > width:
                lines.append(cur)
                cur = word
            else:
                cur = trial
        if cur:
            lines.append(cur)
        return lines

    def paragraph(self, x, y, txt, width, *, size, bold=False, color=MUTED,
                  leading=None):
        """Draw wrapped text, first baseline at y. Returns the next baseline."""
        leading = leading or size * 1.2
        for line in self.wrap(txt, width, size=size, bold=bold):
            self.label(x, y, line, size=size, bold=bold, color=color)
            y += leading
        return y - leading

    def card(self, x, y, w, h, *, fill=SOFT, border=None, radius=8.0):
        self.set_fill_color(*fill)
        if border:
            self.set_draw_color(*border)
            self.set_line_width(0.6)
            style = "DF"
        else:
            style = "F"
        self.rect(x, y, w, h, style=style, round_corners=True,
                  corner_radius=radius)

    def hairline(self, y, *, x0=LEFT, x1=RIGHT, color=LINE, width=0.4):
        self.set_draw_color(*color)
        self.set_line_width(width)
        self.line(x0, y, x1, y)

    def bullet(self, x, y, *, radius=2.2, color=RED):
        self.set_fill_color(*color)
        self.circle(x, y, radius, style="F")


# ---------------------------------------------------------------------------
# Sections. Each takes the cursor y and returns the next free y.
# ---------------------------------------------------------------------------

def draw_header(pdf, cfg):
    pdf.set_fill_color(*RED)
    pdf.rect(0, 0, PAGE_W, TOP_BAR_H, style="F")

    if pdf.logo.exists():
        pdf.image(str(pdf.logo), LEFT, 21, LOGO_SIZE, LOGO_SIZE)

    text_x = LEFT + LOGO_SIZE + 16
    pdf.label(text_x, 40, cfg["supplier"]["company"].upper(), size=15,
              bold=True, color=INK)
    pdf.label(text_x, 57, cfg["supplier"]["tagline"].upper(), size=7.5,
              color=MUTED)

    pdf.label_right(RIGHT, 40, "PRICE QUOTATION", size=10, bold=True,
                    color=RED)
    meta = [f"Quotation No. {cfg['quotation_no']}",
            f"Date: {cfg['date']}",
            f"Valid for: {cfg['valid_for']}"]
    y = 56
    for line in meta:
        pdf.label_right(RIGHT, y, line, size=7.2, color=MUTED)
        y += 12
    return 123.0


def draw_parties(pdf, cfg, y):
    """Supplier and client side by side in one card."""
    sup, cli = cfg["supplier"], cfg["client"]
    body_w = HALF_W - PAD
    sup_lines = pdf.wrap(sup["contact"], body_w, size=7)
    cli_lines = pdf.wrap(cli["subtitle"], body_w, size=7)
    h = max(52.0, 43.6 + 8.4 * max(len(sup_lines), len(cli_lines)))

    pdf.card(LEFT, y, RIGHT - LEFT, h)
    for x, label, name, lines in (
        (LEFT + PAD, "SUPPLIER", sup["company"], sup_lines),
        (COL2, "CLIENT", cli["name"], cli_lines),
    ):
        pdf.label(x, y + 16, label, size=6.7, bold=True, color=MUTED)
        pdf.label(x, y + 30, name, size=8.4, bold=True, color=INK)
        ly = y + 42
        for line in lines:
            pdf.label(x, ly, line, size=7, color=MUTED)
            ly += 8.4
    return y + h


def draw_title(pdf, cfg, y):
    y += 27
    pdf.label(LEFT, y, cfg["title"], size=19.5, bold=True, color=INK)
    if cfg.get("subtitle"):
        y = pdf.paragraph(LEFT, y + 18, cfg["subtitle"], RIGHT - LEFT,
                          size=8.3, color=MUTED, leading=10)
    return y + 27


def draw_scope(pdf, cfg, y):
    """The itemised scope list. The right-hand column (hours, prices) is
    optional -- an hourly engagement has nothing to put there."""
    scope = cfg.get("scope")
    if not scope:
        return y

    col_label = scope.get("amount_header")
    pdf.label(LEFT, y, scope["heading"], size=11.2, bold=True, color=INK)
    if col_label:
        pdf.label_right(RIGHT, y, col_label, size=11.2, bold=True, color=INK)

    # A short red rule the width of each column heading.
    pdf.set_draw_color(*RED)
    pdf.set_line_width(1.4)
    pdf._font(True, 11.2)
    pdf.line(LEFT, y + 6, LEFT + pdf.get_string_width(scope["heading"]), y + 6)
    if col_label:
        pdf.line(RIGHT - pdf.get_string_width(col_label), y + 6, RIGHT, y + 6)

    y += 22
    text_x = LEFT + 13
    amount_w = 70 if col_label else 0
    body_w = RIGHT - text_x - amount_w - 10

    for i, item in enumerate(scope["items"]):
        if i:
            pdf.hairline(y - 7.8)
        pdf.bullet(text_x - 10, y - 2.4)
        pdf.label(text_x, y, item["name"], size=8, bold=True, color=INK)
        if item.get("amount"):
            pdf.label_right(RIGHT, y, str(item["amount"]), size=8.2,
                            bold=True, color=INK)
        y = pdf.paragraph(text_x, y + 9.3, item["note"], body_w, size=6.65,
                          color=MUTED, leading=7.6) + 18

    total = scope.get("total")
    if total:
        pdf.hairline(y - 10)
        pdf.label(LEFT, y - 2.2, total["label"].upper(), size=7.9, bold=True,
                  color=INK)
        pdf.label_right(RIGHT, y - 2.2, total["value"], size=8.9, bold=True,
                        color=RED)
        return y + 6.8
    return y + 9


def draw_headline(pdf, cfg, y):
    """The one number the client is looking for."""
    head = cfg["headline"]
    pdf.card(LEFT, y, RIGHT - LEFT, 47, fill=BLUSH, radius=9)
    pdf.label(LEFT + 14, y + 19, head["label"].upper(), size=7.3, bold=True,
              color=MUTED)
    pdf.label(LEFT + 14, y + 38, head["value"], size=18.5, bold=True,
              color=RED)
    if head.get("note"):
        pdf.label_right(RIGHT - 14, y + 30, head["note"], size=7.8, bold=True,
                        color=INK2)
    return y + 47 + 12


def draw_info_boxes(pdf, cfg, y):
    boxes = cfg.get("info_boxes") or []
    if not boxes:
        return y

    body_w = HALF_W - PAD * 2
    h = 0
    for box in boxes:
        lines = pdf.wrap(box["note"], body_w, size=6.6)
        h = max(h, 41 + 7.1 * len(lines))

    for i, box in enumerate(boxes[:2]):
        x = LEFT if i == 0 else COL2
        pdf.card(x, y, HALF_W, h)
        pdf.label(x + PAD, y + 16, box["label"].upper(), size=6.8, bold=True,
                  color=MUTED)
        pdf.label(x + PAD, y + 31, box["value"], size=8.6, bold=True,
                  color=INK)
        pdf.paragraph(x + PAD, y + 44, box["note"], body_w, size=6.6,
                      color=MUTED, leading=7.1)
    return y + h + 12


def draw_addons(pdf, cfg, y):
    for addon in cfg.get("addons") or []:
        pdf.card(LEFT, y, RIGHT - LEFT, 41, fill=(255, 255, 255), border=LINE)
        pdf.label(LEFT + PAD, y + 16, addon["label"].upper(), size=6.8,
                  bold=True, color=MUTED)
        pdf.label(LEFT + PAD, y + 31, addon["description"], size=8.2,
                  bold=True, color=INK)
        pdf.label_right(RIGHT - PAD, y + 31, addon["price"], size=9.4,
                        bold=True, color=RED)
        y += 41 + 10
    return y


RULE = (160, 160, 168)          # the line you write or sign on


def draw_order(pdf, cfg, y):
    """A box the client fills in: how many hours they are ordering. Without
    it the quotation states a rate but nothing anyone can act on."""
    order = cfg.get("order")
    if not order:
        return y

    fields = order["fields"]
    body_w = RIGHT - LEFT - PAD * 2
    note_lines = (pdf.wrap(order["note"], body_w, size=6.6)
                  if order.get("note") else [])
    first_field = 28 + 7.6 * len(note_lines) + 14
    h = first_field + 20 * (len(fields) - 1) + 10

    pdf.card(LEFT, y, RIGHT - LEFT, h, fill=(255, 255, 255), border=LINE)
    pdf.label(LEFT + PAD, y + 16, order["label"].upper(), size=6.8, bold=True,
              color=MUTED)

    ly = y + 28
    for note in note_lines:
        pdf.label(LEFT + PAD, ly, note, size=6.6, color=MUTED)
        ly += 7.6

    pdf._font(True, 7.6)
    label_w = max(pdf.get_string_width(f["label"]) for f in fields) + 14
    ly = y + first_field
    for field in fields:
        pdf.label(LEFT + PAD, ly, field["label"], size=7.6, bold=True,
                  color=INK)
        x0 = LEFT + PAD + label_w
        x1 = x0 + 150
        pdf.hairline(ly + 2, x0=x0, x1=x1, color=RULE, width=0.6)
        if field.get("suffix"):
            pdf.label(x1 + 6, ly, field["suffix"], size=7, color=MUTED)
        ly += 20

    return y + h + 12


def draw_signatures(pdf, cfg, y):
    """Both parties sign the same page, so the signed copy carries the rate,
    the hours ordered and the terms together."""
    sign = cfg.get("signatures")
    if not sign:
        return y

    y += 18
    pdf.label(LEFT, y, sign["label"].upper(), size=7.3, bold=True, color=MUTED)
    if sign.get("note"):
        y = pdf.paragraph(LEFT, y + 13, sign["note"], RIGHT - LEFT, size=6.6,
                          color=MUTED, leading=7.6)

    blocks = sign["blocks"][:2]
    rows = max(len(b["fields"]) for b in blocks)
    pdf._font(False, 6.8)
    label_w = max(pdf.get_string_width(f) for b in blocks for f in b["fields"])
    label_w += 10

    y += 26
    for i, block in enumerate(blocks):
        x = LEFT if i == 0 else COL2
        by = y
        pdf.label(x, by, block["party"].upper(), size=6.6, bold=True,
                  color=RED)
        by += 20
        for field in block["fields"]:
            pdf.label(x, by, field, size=6.8, color=MUTED)
            fx = x + label_w
            pdf.hairline(by + 2, x0=fx, x1=x + HALF_W, color=RULE, width=0.6)
            # The party's own name is already known; only the signature and
            # the date are left blank.
            if field.lower() == "name" and block.get("name"):
                pdf.label(fx + 5, by, block["name"], size=7, color=INK)
            by += 22

    return y + 20 + 22 * rows


def draw_notes(pdf, cfg, y):
    """Small print, pinned above the footer so the page always closes the
    same way however tall the body came out."""
    notes = cfg.get("notes") or []
    if not notes:
        return

    pdf.set_font("Helvetica", "B", 6.6)
    term_w = max(pdf.get_string_width(f"{n['term']}:") for n in notes) + 6
    body_w = RIGHT - LEFT - term_w

    blocks = [(n, pdf.wrap(n["text"], body_w, size=6.1)) for n in notes]
    total_h = sum(7.0 * len(lines) + 7.0 for _, lines in blocks) - 7.0
    y = max(y, PAGE_H - 40 - total_h)

    for note, lines in blocks:
        pdf.label(LEFT, y, f"{note['term']}:", size=6.6, bold=True,
                  color=MUTED)
        for line in lines:
            pdf.label(LEFT + term_w, y, line, size=6.1, color=MUTED)
            y += 7.0
        y += 7.0


def build(cfg, logo: Path) -> Quotation:
    pdf = Quotation(logo)
    pdf.set_title(f"{cfg['title']} - {cfg['client']['name']}")
    pdf.set_author(cfg["supplier"]["company"])
    pdf.set_creator("tools/quotation/generate.py")
    pdf.add_page()

    y = draw_header(pdf, cfg)
    y = draw_parties(pdf, cfg, y)
    y = draw_title(pdf, cfg, y)
    y = draw_scope(pdf, cfg, y)
    y = draw_headline(pdf, cfg, y)
    y = draw_info_boxes(pdf, cfg, y)
    y = draw_addons(pdf, cfg, y)
    y = draw_order(pdf, cfg, y)
    y = draw_signatures(pdf, cfg, y)
    draw_notes(pdf, cfg, y)

    pdf.label(LEFT, PAGE_H - 20, cfg.get("footer", FOOTER), size=6.7,
              color=MUTED)
    pdf.label_right(RIGHT, PAGE_H - 20, cfg["supplier"]["company"], size=6.7,
                    bold=True, color=INK)
    return pdf


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("config", type=Path, help="quotation JSON")
    ap.add_argument("-o", "--output", type=Path,
                    help="output PDF (default: <config>.pdf beside the JSON)")
    ap.add_argument("--logo", type=Path,
                    default=HERE / "assets" / "redcrown-mark.png")
    args = ap.parse_args(argv)

    cfg = json.loads(args.config.read_text(encoding="utf-8"))
    out = args.output or args.config.with_suffix(".pdf")
    out.parent.mkdir(parents=True, exist_ok=True)
    build(cfg, args.logo).output(str(out))
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
