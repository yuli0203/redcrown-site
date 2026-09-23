// The admin page, served by the Worker at /admin (no build step, no framework).
// All values from the server are written with textContent, never as HTML.

export const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>Documents | Red Crown Interactive</title>
<link rel="stylesheet" href="/admin/app.css">
<script src="/admin/app.js" defer></script>
</head>
<body>
<header class="top"><b>Red Crown Interactive</b><span>Payment requests &amp; receipts</span><button type="button" id="logout" hidden>Lock</button></header>
<main id="app">
  <section id="login" class="card narrow" hidden>
    <h1>Unlock</h1>
    <p>Enter the admin token (the ADMIN_TOKEN Worker secret). It stays in this browser tab only.</p>
    <form id="login-form"><input id="token" type="password" autocomplete="current-password" required minlength="32" aria-label="Admin token"><button>Unlock</button></form>
    <p id="login-error" class="error" role="alert"></p>
  </section>
  <div id="main" hidden>
    <div id="status" class="status"></div>
    <nav class="tabs" role="tablist">
      <button type="button" role="tab" data-tab="request" aria-selected="true">New payment request</button>
      <button type="button" role="tab" data-tab="receipt">Record a payment</button>
      <button type="button" role="tab" data-tab="docs">Documents</button>
      <button type="button" role="tab" data-tab="settings">Settings</button>
    </nav>

    <section class="card" data-panel="request">
      <h2>New payment request <small>חשבון עסקה</small></h2>
      <p class="hint">The client gets the PDF and a secure pay link (card or PayPal). A receipt is issued automatically when they pay.</p>
      <form id="request-form">
        <fieldset class="client"><legend>Client</legend></fieldset>
        <div class="row">
          <label>Document language <select name="lang"><option value="he">Hebrew</option><option value="en">English</option></select></label>
          <label>Currency <select name="currency"><option>ILS</option><option>USD</option><option>EUR</option><option>GBP</option></select></label>
          <label>Link valid (days) <input name="validDays" type="number" min="1" max="365" value="30"></label>
        </div>
        <fieldset><legend>Line items</legend>
          <table class="items"><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Line total</th><th></th></tr></thead><tbody></tbody></table>
          <button type="button" class="secondary" id="add-item">Add line</button>
          <p class="total">Total: <b id="request-total">0.00</b></p>
        </fieldset>
        <label>Notes (printed on the request) <textarea name="notes" rows="2" maxlength="1000"></textarea></label>
        <div class="actions">
          <button type="button" class="secondary" data-preview>Preview PDF</button>
          <button type="submit" data-send="false" class="secondary">Create without emailing</button>
          <button type="submit" data-send="true">Create &amp; email to client</button>
        </div>
        <p class="result" role="status"></p>
      </form>
    </section>

    <section class="card" data-panel="receipt" hidden>
      <h2>Record a payment <small>קבלה</small></h2>
      <p class="hint">For money received directly: bank transfer, cheque, cash. Online payments get their receipt automatically. A receipt cannot be edited or deleted after it is issued.</p>
      <form id="receipt-form">
        <label>For payment request (optional) <select name="requestNumber"><option value="">None</option></select></label>
        <fieldset class="client"><legend>Received from</legend></fieldset>
        <div class="row">
          <label>Document language <select name="lang"><option value="he">Hebrew</option><option value="en">English</option></select></label>
          <label>Currency <select name="currency"><option>ILS</option><option>USD</option><option>EUR</option><option>GBP</option></select></label>
          <label>Amount <input name="amount" inputmode="decimal" required placeholder="1250.00"></label>
          <label>Payment date <input name="paidOn" required placeholder="23/09/2026" pattern="\\d{2}/\\d{2}/\\d{4}"></label>
        </div>
        <label>For (description) <input name="description" required maxlength="300"></label>
        <div class="row">
          <label>Method <select name="method">
            <option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="cash">Cash</option>
            <option value="card">Credit card</option><option value="paypal">PayPal</option><option value="other">Other</option></select></label>
        </div>
        <div class="row method-fields">
          <label data-for="bank_transfer cheque">Bank <input name="bank" maxlength="80"></label>
          <label data-for="bank_transfer cheque">Branch <input name="branch" maxlength="80"></label>
          <label data-for="bank_transfer cheque">Account <input name="account" maxlength="80"></label>
          <label data-for="cheque">Cheque no. <input name="chequeNumber" maxlength="80"></label>
          <label data-for="cheque">Due date <input name="dueDate" maxlength="80" placeholder="dd/mm/yyyy"></label>
          <label data-for="card paypal">Transaction ID <input name="transactionId" maxlength="80"></label>
          <label data-for="bank_transfer other">Reference <input name="reference" maxlength="80"></label>
        </div>
        <label class="check"><input type="checkbox" name="consent"> The client agreed to receive tax documents digitally by email</label>
        <label>How they agreed (kept with the receipt) <input name="consentVia" maxlength="200" placeholder="e.g. email of 20/09/2026"></label>
        <div class="actions">
          <button type="button" class="secondary" data-preview>Preview PDF</button>
          <button type="submit">Issue receipt</button>
        </div>
        <p class="result" role="status"></p>
      </form>
    </section>

    <section class="card" data-panel="docs" hidden>
      <div class="split"><h2>Documents</h2><button type="button" class="secondary" id="export">Export receipts (CSV)</button></div>
      <div id="duplicates"></div>
      <h3>Payment requests</h3>
      <div class="scroll"><table id="requests"><thead><tr><th>No.</th><th>Date</th><th>Client</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody></tbody></table></div>
      <h3>Receipts</h3>
      <div class="scroll"><table id="receipts"><thead><tr><th>No.</th><th>Date</th><th>Client</th><th>Amount</th><th>Method</th><th>Signed</th><th></th></tr></thead><tbody></tbody></table></div>
    </section>

    <section class="card" data-panel="settings" hidden>
      <h2>Settings</h2>
      <form id="settings-form">
        <label>First receipt number <input name="receiptStart" type="number" min="1" required></label>
        <p class="hint">Continue your existing receipt series: enter the number after your last paper or software receipt. It can only be set before the first receipt is issued here.</p>
        <button>Save</button>
        <p class="result" role="status"></p>
      </form>
    </section>
  </div>
</main>
</body>
</html>`;

export const STYLE = `
:root{--ink:#1a1717;--dim:#6b6565;--line:#e4dfdf;--bg:#f7f5f5;--brand:#C8102E;--ok:#1f8a4c;--warn:#a15c00}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
.top{display:flex;gap:12px;align-items:center;padding:14px 20px;background:#fff;border-bottom:1px solid var(--line)}
.top span{color:var(--dim)}
.top button{margin-inline-start:auto}
main{max-width:1000px;margin:0 auto;padding:20px 16px 60px}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px;margin-top:14px}
.narrow{max-width:460px;margin:40px auto}
h1,h2{margin:0 0 8px;font-size:1.25rem}h2 small{color:var(--dim);font-weight:400}
h3{margin:22px 0 8px;font-size:1rem}
.hint{color:var(--dim);font-size:.88rem;margin:0 0 14px}
label{display:flex;flex-direction:column;gap:4px;font-size:.85rem;color:var(--dim);margin-bottom:12px;flex:1;min-width:160px}
label.check{flex-direction:row;align-items:center;gap:8px;color:var(--ink)}
input,select,textarea{font:inherit;color:var(--ink);padding:8px 10px;border:1px solid #cfc8c8;border-radius:8px;background:#fff;width:100%}
input[type=checkbox]{width:auto}
textarea{resize:vertical}
fieldset{border:1px solid var(--line);border-radius:10px;padding:12px 14px 2px;margin:0 0 14px}
legend{font-weight:600;padding:0 6px}
.row{display:flex;flex-wrap:wrap;gap:12px}
button{font:inherit;font-weight:600;border:0;border-radius:8px;padding:9px 16px;background:var(--brand);color:#fff;cursor:pointer}
button.secondary{background:#fff;color:var(--ink);border:1px solid #cfc8c8}
button.link{background:none;color:var(--brand);padding:2px 6px;font-weight:500}
button:disabled{opacity:.55;cursor:wait}
.actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;margin-top:6px}
.tabs{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.tabs button{background:#fff;color:var(--ink);border:1px solid var(--line)}
.tabs button[aria-selected=true]{background:var(--ink);color:#fff}
table{width:100%;border-collapse:collapse;font-size:.88rem}
th,td{text-align:start;padding:7px 6px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--dim);font-weight:600}
.items input{min-width:0}.items td:nth-child(2){width:80px}.items td:nth-child(3){width:120px}.items td:nth-child(4){width:110px;white-space:nowrap;padding-top:14px}
.total{text-align:end;font-size:1rem}
.scroll{overflow-x:auto}
.split{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.status{display:flex;flex-wrap:wrap;gap:8px}
.pill{font-size:.8rem;padding:4px 10px;border-radius:99px;background:#fff;border:1px solid var(--line)}
.pill.ok{color:var(--ok);border-color:#b8dcc6}.pill.warn{color:var(--warn);border-color:#ecd2a8}
.result{margin:10px 0 0;font-size:.9rem;word-break:break-all}
.error{color:var(--brand)}
.alert{border:1px solid var(--brand);border-radius:10px;padding:10px 12px;margin-bottom:10px;color:var(--brand)}
@media(max-width:600px){.card{padding:14px}label{min-width:100%}}
`;

export const SCRIPT = `'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  let token = '';
  try { token = sessionStorage.getItem('rc-admin') || ''; } catch {}
  let state = null;

  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
    return el;
  };
  const money = (minor, cur) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(minor / 100);
  const day = ms => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem' }).format(new Date(ms));

  async function api(path, { method = 'GET', body, raw = false } = {}) {
    const res = await fetch('/admin/api/' + path, {
      method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) { lock('Wrong or expired token.'); throw new Error('unauthorized'); }
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || ('Error ' + res.status)); }
    return raw ? res.blob() : res.json();
  }
  const openPdf = blob => { const u = URL.createObjectURL(blob); window.open(u, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(u), 60000); };

  function lock(msg) {
    token = ''; try { sessionStorage.removeItem('rc-admin'); } catch {}
    $('#main').hidden = true; $('#logout').hidden = true; $('#login').hidden = false;
    $('#login-error').textContent = msg || '';
  }
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault(); token = $('#token').value.trim();
    try { await load(); try { sessionStorage.setItem('rc-admin', token); } catch {} } catch (err) { if (err.message !== 'unauthorized') $('#login-error').textContent = err.message; }
  });
  $('#logout').addEventListener('click', () => lock());

  // Tabs
  $$('.tabs button').forEach(b => b.addEventListener('click', () => {
    $$('.tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    $$('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== b.dataset.tab; });
  }));

  // Client fields, shared by both forms.
  const clientFields = [['name', 'Name *', true], ['company', 'Company'], ['taxId', 'Tax ID (ח.פ. / ע.מ.)'], ['address', 'Address *', true], ['email', 'Email']];
  $$('fieldset.client').forEach(fs => fs.append(h('div', { class: 'row' }, clientFields.map(([n, label, req]) =>
    h('label', {}, label, h('input', { name: 'client.' + n, maxlength: n === 'address' ? 240 : 160, required: !!req, type: n === 'email' ? 'email' : 'text' }))))));
  const readClient = form => Object.fromEntries(clientFields.map(([n]) => [n, form.elements['client.' + n].value]));

  // ---- Payment request form
  const rf = $('#request-form');
  const itemsBody = rf.querySelector('.items tbody');
  const addItem = () => {
    const tr = h('tr', {},
      h('td', {}, h('input', { name: 'desc', required: true, maxlength: 300, 'aria-label': 'Description' })),
      h('td', {}, h('input', { name: 'qty', value: '1', inputmode: 'decimal', required: true, 'aria-label': 'Quantity' })),
      h('td', {}, h('input', { name: 'price', inputmode: 'decimal', required: true, placeholder: '0.00', 'aria-label': 'Unit price' })),
      h('td', { class: 'line' }, '0.00'),
      h('td', {}, h('button', { type: 'button', class: 'link', 'aria-label': 'Remove line', on: { click: () => { tr.remove(); if (!itemsBody.children.length) addItem(); recalc(); } } }, '✕')));
    itemsBody.append(tr); recalc();
  };
  const num = v => Number(String(v).replace(/,/g, ''));
  function recalc() {
    let total = 0;
    for (const tr of itemsBody.children) {
      const q = num(tr.querySelector('[name=qty]').value), p = num(tr.querySelector('[name=price]').value);
      const line = Number.isFinite(q * p) ? Math.round(q * p * 100) : 0;
      tr.querySelector('.line').textContent = (line / 100).toFixed(2); total += line;
    }
    $('#request-total').textContent = money(total, rf.elements.currency.value);
  }
  itemsBody.addEventListener('input', recalc);
  rf.elements.currency.addEventListener('change', recalc);
  $('#add-item').addEventListener('click', addItem);
  addItem();

  const requestBody = send => ({
    lang: rf.elements.lang.value, currency: rf.elements.currency.value, validDays: rf.elements.validDays.value,
    notes: rf.elements.notes.value, send, client: readClient(rf),
    items: [...itemsBody.children].map(tr => ({ description: tr.querySelector('[name=desc]').value, quantity: tr.querySelector('[name=qty]').value, unitPrice: tr.querySelector('[name=price]').value })),
  });
  const busy = (form, on) => form.querySelectorAll('button').forEach(b => { b.disabled = on; });
  const result = (form, text, error) => { const r = form.querySelector('.result'); r.textContent = text; r.classList.toggle('error', !!error); };

  rf.querySelector('[data-preview]').addEventListener('click', async () => {
    busy(rf, true); result(rf, '');
    try { openPdf(await api('requests?preview=1', { method: 'POST', body: requestBody(false), raw: true })); } catch (e) { result(rf, e.message, true); }
    busy(rf, false);
  });
  let sendFlag = true;
  rf.querySelectorAll('[type=submit]').forEach(b => b.addEventListener('click', () => { sendFlag = b.dataset.send === 'true'; }));
  rf.addEventListener('submit', async e => {
    e.preventDefault(); busy(rf, true); result(rf, '');
    try {
      const out = await api('requests', { method: 'POST', body: requestBody(sendFlag) });
      result(rf, out.number + ' created' + (out.emailed ? ' and emailed.' : sendFlag ? ' (email not sent: check email settings).' : '.') + ' Pay link: ' + out.payUrl);
      rf.reset(); itemsBody.textContent = ''; addItem(); await load();
    } catch (err) { result(rf, err.message, true); }
    busy(rf, false);
  });

  // ---- Manual receipt form
  const pf = $('#receipt-form');
  const todayStr = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem' }).format(new Date());
  pf.elements.paidOn.value = todayStr();
  const showMethodFields = () => $$('.method-fields label').forEach(l => { l.hidden = !l.dataset.for.split(' ').includes(pf.elements.method.value); });
  pf.elements.method.addEventListener('change', showMethodFields); showMethodFields();
  pf.elements.requestNumber.addEventListener('change', () => {
    const pr = state && state.requests.find(r => r.number === pf.elements.requestNumber.value);
    if (!pr) return;
    for (const [n] of clientFields) pf.elements['client.' + n].value = pr.client[n] || '';
    pf.elements.lang.value = pr.lang; pf.elements.currency.value = pr.currency;
    pf.elements.amount.value = (pr.amountMinor / 100).toFixed(2);
    pf.elements.description.value = pr.lang === 'he' ? 'תשלום עבור חשבון עסקה ' + pr.number : 'Payment for payment request ' + pr.number;
  });
  const receiptBody = () => {
    const f = pf.elements;
    return {
      requestNumber: f.requestNumber.value || null, lang: f.lang.value, client: readClient(pf), currency: f.currency.value,
      amount: f.amount.value, paidOn: f.paidOn.value, description: f.description.value, method: f.method.value,
      methodDetails: Object.fromEntries(['bank', 'branch', 'account', 'chequeNumber', 'dueDate', 'transactionId', 'reference']
        .filter(n => !f[n].closest('label').hidden).map(n => [n, f[n].value])),
      consent: f.consent.checked, consentVia: f.consentVia.value,
    };
  };
  pf.querySelector('[data-preview]').addEventListener('click', async () => {
    busy(pf, true); result(pf, '');
    try { openPdf(await api('receipts?preview=1', { method: 'POST', body: receiptBody(), raw: true })); } catch (e) { result(pf, e.message, true); }
    busy(pf, false);
  });
  pf.addEventListener('submit', async e => {
    e.preventDefault();
    if (!confirm('Issue this receipt? It gets the next number and cannot be edited or deleted.')) return;
    busy(pf, true); result(pf, '');
    try {
      const out = await api('receipts', { method: 'POST', body: receiptBody() });
      result(pf, 'Receipt ' + out.number + ' issued. ' + (out.digital ? 'The client received the signed receipt by email.' : 'You received the original to print, sign and hand over.'));
      pf.reset(); pf.elements.paidOn.value = todayStr(); showMethodFields(); await load();
    } catch (err) { result(pf, err.message, true); }
    busy(pf, false);
  });

  // ---- Settings
  const sf = $('#settings-form');
  sf.addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('settings', { method: 'POST', body: { receiptStart: sf.elements.receiptStart.value } }); result(sf, 'Saved.'); await load(); }
    catch (err) { result(sf, err.message, true); }
  });

  $('#export').addEventListener('click', async () => {
    const blob = await api('export.csv', { raw: true });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'receipts.csv' }); document.body.append(a); a.click(); a.remove();
  });

  // ---- Lists
  const action = (label, fn) => h('button', { type: 'button', class: 'link', on: { click: async ev => {
    ev.target.disabled = true;
    try { await fn(); } catch (e) { alert(e.message); }
    ev.target.disabled = false;
  } } }, label);

  function render() {
    const s = state;
    const pills = [
      [s.configured, s.configured ? 'Business details set' : 'Business details missing: ' + s.configError],
      [s.email, s.email ? 'Email on' : 'Email off (RESEND_API_KEY)'],
      [s.signing, s.signing ? 'Digital signature on' : 'No signing certificate: clients get payment confirmations, you deliver receipts on paper'],
    ];
    $('#status').replaceChildren(...pills.map(([ok, t]) => h('span', { class: 'pill ' + (ok ? 'ok' : 'warn') }, t)));

    $('#duplicates').replaceChildren(...s.duplicates.map(d => h('p', { class: 'alert' },
      'Duplicate payment for ' + d.invoice + ' (' + money(d.amountMinor, d.currency) + ', transaction ' + (d.transactionId || '?') + '): refund it in PayPal.')));

    $('#requests tbody').replaceChildren(...s.requests.map(r => h('tr', {},
      h('td', {}, r.number), h('td', {}, day(r.created)), h('td', {}, r.client.name), h('td', {}, money(r.amountMinor, r.currency)),
      h('td', {}, r.status + (r.receiptNumber ? ' · receipt ' + r.receiptNumber : '')),
      h('td', {},
        action('PDF', async () => openPdf(await api('requests/' + r.number + '/pdf', { raw: true }))),
        r.status === 'open' && action('Resend', async () => { const o = await api('requests/' + r.number + '/resend', { method: 'POST' }); alert(o.emailed ? 'Sent.' : 'Not sent: check email settings.'); }),
        r.status === 'open' && action('Cancel', async () => { if (confirm('Cancel ' + r.number + '? Its pay link stops working.')) { await api('requests/' + r.number + '/cancel', { method: 'POST' }); await load(); } }),
        r.status === 'paid' && !r.receiptNumber && action('Issue receipt', async () => { await api('requests/' + r.number + '/receipt', { method: 'POST' }); await load(); })))));

    $('#receipts tbody').replaceChildren(...s.receipts.map(r => h('tr', {},
      h('td', {}, String(r.number)), h('td', {}, day(r.created)), h('td', {}, r.client.name), h('td', {}, money(r.amountMinor, r.currency)),
      h('td', {}, (s.methods[r.method] || r.method).split(' / ').pop()), h('td', {}, r.signed ? 'yes' : 'no'),
      h('td', {},
        action('Copy', async () => openPdf(await api('receipts/' + r.number + '/pdf', { raw: true }))),
        action('True copy', async () => openPdf(await api('receipts/' + r.number + '/pdf?mark=true_copy', { raw: true }))),
        r.signed && r.consent?.given && r.client.email && action('Email copy', async () => { await api('receipts/' + r.number + '/resend', { method: 'POST' }); alert('Sent.'); })))));

    const open = s.requests.filter(r => r.status === 'open' && !r.receiptNumber);
    const sel = pf.elements.requestNumber, cur = sel.value;
    sel.replaceChildren(h('option', { value: '' }, 'None'), ...open.map(r => h('option', { value: r.number }, r.number + ' · ' + r.client.name + ' · ' + money(r.amountMinor, r.currency))));
    sel.value = open.some(r => r.number === cur) ? cur : '';

    sf.elements.receiptStart.value = s.config.nextReceipt ?? s.receiptStart;
    sf.elements.receiptStart.disabled = s.receipts.length > 0;
    sf.querySelector('button').disabled = s.receipts.length > 0;
  }

  async function load() {
    state = await api('list');
    $('#login').hidden = true; $('#main').hidden = false; $('#logout').hidden = false;
    render();
  }

  if (token) load().catch(() => lock()); else lock();
})();
`;
