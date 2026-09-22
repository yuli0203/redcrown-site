# Price quotations

One JSON file per quotation, two renderers:

| Output | Command | Use it for |
|---|---|---|
| PDF | `python3 tools/quotation/generate.py <config.json>` | the copy you send |
| DOCX | `node tools/quotation/generate_docx.js <config.json>` | the copy someone wants to edit before signing |

Both read the **same** config, so a quotation cannot drift between its PDF and
its Word version. Add `-o <path>` to either to choose the output file.

```bash
python3 tools/quotation/generate.py  quotations/acme.json -o out/acme.pdf
node    tools/quotation/generate_docx.js quotations/acme.json -o out/acme.docx
```

## Setup

* PDF: `pip install fpdf2`
* DOCX: `npm install docx` (the script resolves it from `node_modules`; set
  `NODE_PATH` if you install it outside the repo)

`assets/redcrown-mark.png` is the logo both renderers place in the header.

## Where quotations live

`quotations/` and `out/` are gitignored on purpose. **This repository is served
as the public website** — anything committed under `tools/` is fetchable at
`redcrowninteractive.com/tools/...`, so real client names, rates and terms do
not belong in it. Keep the JSON for a live quotation outside the repo, or in
the ignored `quotations/` directory. `examples/` holds placeholder configs
only.

## Config schema

Only `quotation_no`, `date`, `valid_for`, `supplier`, `client`, `title` and
`headline` are required; every section below them is optional and is skipped
when absent.

```jsonc
{
  "quotation_no": "RCI-Q-2026-0922-ZA",
  "date": "22 Sep 2026",
  "valid_for": "30 days",

  "supplier": { "company": "...", "tagline": "...", "contact": "..." },
  "client":   { "name": "...", "subtitle": "..." },

  "title": "Hourly Rate Engagement",
  "subtitle": "One line under the title.",

  "scope": {
    "heading": "Included in the Rate",
    "amount_header": "Estimated Hours",   // omit for a list with no numbers
    "items": [
      { "name": "...", "amount": "7", "note": "..." }   // amount optional
    ],
    "total": { "label": "Total estimated effort", "value": "43 hours" }
  },

  "headline":    { "label": "Hourly Rate", "value": "300 NIS / hour",
                   "note": "right-aligned caveat" },
  "info_boxes":  [ { "label": "...", "value": "...", "note": "..." } ],  // max 2
  "addons":      [ { "label": "Optional add-on", "description": "...",
                     "price": "2,000 NIS" } ],

  // A box the client fills in by hand: blanks with a rule to write on.
  "order": {
    "label": "Hours Bank Ordered",
    "note": "Fill in the number of hours being purchased.",
    "fields": [ { "label": "Number of hours ordered", "suffix": "hours" } ]
  },

  // One panel per party. A field named "Name" is pre-filled from `name`;
  // the rest are left blank to write on.
  "signatures": {
    "label": "Agreed by both parties",
    "note": "...",
    "blocks": [
      { "party": "Client",   "name": "...", "fields": ["Name", "Signature", "Date"] },
      { "party": "Supplier", "name": "...", "fields": ["Name", "Signature", "Date"] }
    ]
  },
  "notes":       [ { "term": "Scope changes", "text": "..." } ],

  "footer": "overrides the default contact line"
}
```

Labels on `headline`, `info_boxes`, `addons` and `signatures` are uppercased on
render, so write them in ordinary case.

**The PDF renderer uses the core PDF fonts, which are Latin-1 only** — no
Hebrew. A Hebrew quotation needs a Unicode TTF registered in `generate.py`
(`add_font`) plus right-to-left shaping, which neither renderer does today.

## Checking a change

There is no golden-file test; render both examples and look at them.

```bash
python3 tools/quotation/generate.py tools/quotation/examples/fixed-price.json -o /tmp/q.pdf
node tools/quotation/generate_docx.js tools/quotation/examples/hourly-rate.json -o /tmp/q.docx
soffice --headless --convert-to pdf --outdir /tmp /tmp/q.docx   # then view it
```

`examples/fixed-price.json` exercises the scope table with an amount column, a
total row and an add-on; `examples/hourly-rate.json` exercises the list with no
amount column, the order box and the two-party signing block. Between them they
cover every optional section.
