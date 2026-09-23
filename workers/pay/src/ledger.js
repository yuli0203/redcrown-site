// The ledger: payment requests, receipts, running numbers and payment claims.
//
// Runs inside one Durable Object (worker.js), whose SQLite storage executes
// every method below to completion before the next call starts. That is what
// makes receipt numbers gap-free and unique, and what makes "one payment per
// request" a hard guarantee instead of a best effort. Methods are synchronous
// on purpose: no await means no interleaving.
//
// `db` is a tiny adapter: all(sql, ...params) -> rows, run(sql, ...params).
// In the Worker it wraps ctx.storage.sql; in tests, node:sqlite.
//
// Legal notes (הוראות מס הכנסה (ניהול פנקסי חשבונות), סעיף 5): a receipt is
// issued for every payment, carries a running number, and is never deleted or
// edited once issued. There is deliberately no method that updates a receipt's
// content or removes one; a receipt's PDF can only be attached once.

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS counters (kind TEXT PRIMARY KEY, next INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS requests (
     number TEXT PRIMARY KEY, created INTEGER NOT NULL, lang TEXT NOT NULL,
     client TEXT NOT NULL, items TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
     currency TEXT NOT NULL, amount_minor INTEGER NOT NULL, expires INTEGER NOT NULL,
     status TEXT NOT NULL DEFAULT 'open', paid_ref TEXT, receipt_number INTEGER, pdf BLOB)`,
  `CREATE TABLE IF NOT EXISTS receipts (
     number INTEGER PRIMARY KEY, created INTEGER NOT NULL, lang TEXT NOT NULL,
     request_number TEXT, client TEXT NOT NULL, description TEXT NOT NULL,
     currency TEXT NOT NULL, amount_minor INTEGER NOT NULL, paid_on TEXT NOT NULL,
     method TEXT NOT NULL, method_details TEXT NOT NULL, ils TEXT,
     consent TEXT, payment TEXT, signed INTEGER NOT NULL DEFAULT 0, pdf BLOB)`,
  `CREATE TABLE IF NOT EXISTS claims (invoice TEXT PRIMARY KEY, ref TEXT NOT NULL, created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS payments (ref TEXT PRIMARY KEY, invoice TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL)`,
];

const REQUEST_PREFIX = 'PR-';
const json = v => JSON.stringify(v ?? null);
const parse = v => (v == null ? null : JSON.parse(v));

const requestRow = r => r && {
  number: r.number, created: r.created, lang: r.lang, client: parse(r.client), items: parse(r.items),
  notes: r.notes, currency: r.currency, amountMinor: r.amount_minor, expires: r.expires,
  status: r.status, paidRef: r.paid_ref, receiptNumber: r.receipt_number, hasPdf: !!r.has_pdf,
};
const receiptRow = r => r && {
  number: r.number, created: r.created, lang: r.lang, requestNumber: r.request_number,
  client: parse(r.client), description: r.description, currency: r.currency, amountMinor: r.amount_minor,
  paidOn: r.paid_on, method: r.method, methodDetails: parse(r.method_details), ils: parse(r.ils),
  consent: parse(r.consent), payment: parse(r.payment), signed: !!r.signed, hasPdf: !!r.has_pdf,
};

export class LedgerCore {
  constructor(db, options = {}) {
    this.db = db;
    this.now = options.now || (() => Date.now());
    for (const sql of SCHEMA) db.run(sql);
  }

  // Next number of a series. Receipts start at RECEIPT_START (continue your
  // existing receipt book); the first call fixes the series.
  #next(kind, start = 1) {
    const row = this.db.all('SELECT next FROM counters WHERE kind = ?', kind)[0];
    const n = row ? row.next : start;
    this.db.run('INSERT INTO counters (kind, next) VALUES (?, ?) ON CONFLICT(kind) DO UPDATE SET next = excluded.next', kind, n + 1);
    return n;
  }

  config() {
    const counters = Object.fromEntries(this.db.all('SELECT kind, next FROM counters').map(r => [r.kind, r.next]));
    return { nextReceipt: counters.receipt ?? null, nextRequest: counters.request ?? 1 };
  }

  // Sets where receipt numbering starts. Allowed only before the first receipt.
  setReceiptStart(n) {
    if (!Number.isSafeInteger(n) || n < 1) throw new Error('invalid start number');
    if (this.db.all('SELECT 1 FROM receipts LIMIT 1').length) throw new Error('receipts already issued; numbering is fixed');
    this.db.run('INSERT INTO counters (kind, next) VALUES (?, ?) ON CONFLICT(kind) DO UPDATE SET next = excluded.next', 'receipt', n);
    return this.config();
  }

  // ---- Payment requests (חשבון עסקה): not tax documents, so they may be cancelled.

  createRequest({ lang, client, items, notes = '', currency, amountMinor, expires }) {
    const number = REQUEST_PREFIX + String(this.#next('request')).padStart(4, '0');
    this.db.run(`INSERT INTO requests (number, created, lang, client, items, notes, currency, amount_minor, expires)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, number, this.now(), lang, json(client), json(items), notes, currency, amountMinor, expires);
    return this.getRequest(number);
  }

  attachRequestPdf(number, pdf) {
    this.db.run('UPDATE requests SET pdf = ? WHERE number = ?', pdf, number);
  }

  getRequest(number) {
    return requestRow(this.db.all('SELECT *, pdf IS NOT NULL AS has_pdf FROM requests WHERE number = ?', number)[0]);
  }

  requestPdf(number) {
    return this.db.all('SELECT pdf FROM requests WHERE number = ?', number)[0]?.pdf ?? null;
  }

  cancelRequest(number) {
    const r = this.getRequest(number);
    if (!r) throw new Error('not found');
    if (r.status !== 'open') throw new Error(`request is ${r.status}`);
    if (this.db.all('SELECT 1 FROM claims WHERE invoice = ?', number).length) throw new Error('a payment is in progress');
    this.db.run(`UPDATE requests SET status = 'cancelled' WHERE number = ?`, number);
    return this.getRequest(number);
  }

  // ---- Payments: at most one per request.

  // Called before capturing. Only one checkout reference can ever hold a request.
  claim(invoice, ref) {
    const r = this.getRequest(invoice);
    if (!r) return { ok: false, reason: 'unknown' };
    const held = this.db.all('SELECT ref FROM claims WHERE invoice = ?', invoice)[0];
    if (held) return held.ref === ref ? { ok: true } : { ok: false, reason: 'paid' };
    if (r.status !== 'open') return { ok: false, reason: r.status };
    this.db.run('INSERT INTO claims (invoice, ref, created) VALUES (?, ?, ?)', invoice, ref, this.now());
    return { ok: true };
  }

  // Releases a claim when the capture did not go through.
  release(invoice, ref) {
    if (this.db.all('SELECT 1 FROM payments WHERE ref = ?', ref).length) return;
    this.db.run('DELETE FROM claims WHERE invoice = ? AND ref = ?', invoice, ref);
  }

  // Records a provider-confirmed payment. Returns { status, first } where first
  // is true only the first time this ref is recorded (idempotent for retries).
  recordPayment(invoice, ref, data) {
    const existing = this.db.all('SELECT status FROM payments WHERE ref = ?', ref)[0];
    if (existing) return { status: existing.status, first: false };
    const held = this.db.all('SELECT ref FROM claims WHERE invoice = ?', invoice)[0];
    // Held by another checkout: money was taken twice. Should not happen, since
    // captures only follow a successful claim; kept as a safety net.
    const status = held && held.ref !== ref ? 'duplicate' : 'paid';
    if (!held) this.db.run('INSERT INTO claims (invoice, ref, created) VALUES (?, ?, ?)', invoice, ref, this.now());
    this.db.run('INSERT INTO payments (ref, invoice, status, data, created) VALUES (?, ?, ?, ?, ?)', ref, invoice, status, json(data), this.now());
    if (status === 'paid') this.db.run(`UPDATE requests SET status = 'paid', paid_ref = ? WHERE number = ?`, ref, invoice);
    return { status, first: true };
  }

  paymentStatus(ref) {
    const p = this.db.all('SELECT invoice, status FROM payments WHERE ref = ?', ref)[0];
    return p ? p.status : null;
  }

  payment(ref) {
    const p = this.db.all('SELECT invoice, status, data FROM payments WHERE ref = ?', ref)[0];
    return p ? { invoice: p.invoice, status: p.status, ...parse(p.data) } : null;
  }

  invoiceHolder(invoice) {
    return this.db.all('SELECT ref FROM claims WHERE invoice = ?', invoice)[0]?.ref ?? null;
  }

  // ---- Receipts (קבלה): numbered, permanent.

  // Allocates the next receipt number and stores the receipt's content.
  // receiptStart: first number if the series has not started yet.
  issueReceipt(r, receiptStart = 1) {
    if (r.requestNumber) {
      const req = this.getRequest(r.requestNumber);
      if (!req) throw new Error('unknown payment request');
      if (req.receiptNumber) return { number: req.receiptNumber, existing: true };
    }
    const number = this.#next('receipt', receiptStart);
    this.db.run(`INSERT INTO receipts (number, created, lang, request_number, client, description, currency,
        amount_minor, paid_on, method, method_details, ils, consent, payment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      number, this.now(), r.lang, r.requestNumber ?? null, json(r.client), r.description, r.currency,
      r.amountMinor, r.paidOn, r.method, json(r.methodDetails), json(r.ils), json(r.consent), json(r.payment));
    if (r.requestNumber) {
      this.db.run(`UPDATE requests SET receipt_number = ?, status = 'paid' WHERE number = ?`, number, r.requestNumber);
    }
    return { number, existing: false };
  }

  // A receipt's stored PDF is written once and never replaced.
  attachReceiptPdf(number, pdf, signed) {
    const row = this.db.all('SELECT pdf IS NOT NULL AS has_pdf FROM receipts WHERE number = ?', number)[0];
    if (!row) throw new Error('not found');
    if (row.has_pdf) return false;
    this.db.run('UPDATE receipts SET pdf = ?, signed = ? WHERE number = ?', pdf, signed ? 1 : 0, number);
    return true;
  }

  getReceipt(number) {
    return receiptRow(this.db.all('SELECT *, pdf IS NOT NULL AS has_pdf FROM receipts WHERE number = ?', number)[0]);
  }

  receiptPdf(number) {
    return this.db.all('SELECT pdf FROM receipts WHERE number = ?', number)[0]?.pdf ?? null;
  }

  list(limit = 200) {
    const requests = this.db.all('SELECT *, pdf IS NOT NULL AS has_pdf FROM requests ORDER BY created DESC LIMIT ?', limit).map(requestRow);
    const receipts = this.db.all('SELECT *, pdf IS NOT NULL AS has_pdf FROM receipts ORDER BY number DESC LIMIT ?', limit).map(receiptRow);
    const duplicates = this.db.all(`SELECT ref, invoice, data, created FROM payments WHERE status = 'duplicate' ORDER BY created DESC`)
      .map(d => ({ ref: d.ref, invoice: d.invoice, created: d.created, ...parse(d.data) }));
    return { requests, receipts, duplicates, config: this.config() };
  }

  // Every receipt, oldest first, for the accountant (no PDFs).
  exportReceipts() {
    return this.db.all('SELECT *, pdf IS NOT NULL AS has_pdf FROM receipts ORDER BY number ASC').map(receiptRow);
  }
}

// Adapter for a Durable Object's SQLite storage.
export const durableSql = sql => ({
  all: (query, ...params) => sql.exec(query, ...params).toArray(),
  run: (query, ...params) => { sql.exec(query, ...params); },
});
