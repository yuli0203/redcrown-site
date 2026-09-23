// Invoice payment page. Not connected to a payment provider yet: PROVIDER is null,
// so a valid submission shows a notice and nothing is sent anywhere.
//
// Security model (see pay/README.md):
// - Card data never enters this page. The provider collects it in its own hosted
//   fields or hosted checkout, which keeps card numbers out of our code.
// - Everything here is client-side and therefore untrusted. The amount shown is a
//   convenience; the backend must look the invoice up and charge ITS amount, never
//   a number sent from the browser.
'use strict';

(() => {
  // Wire a provider here later. Expected shape:
  //   { start: async ({ invoice, amountMinor, currency, name, email }) => void }
  // `start` should ask our backend to create a checkout session for the invoice and
  // then redirect to / mount the provider's hosted checkout.
  const PROVIDER = null;

  const CURRENCIES = { ILS: 'he-IL', USD: 'en-US', EUR: 'de-DE' };
  const INVOICE_RE = /^[A-Za-z0-9][A-Za-z0-9-]{2,31}$/;
  const AMOUNT_RE = /^\d{1,7}(?:\.\d{1,2})?$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const MIN_AMOUNT = 1;
  const MAX_AMOUNT = 1000000;

  const $ = id => document.getElementById(id);
  const form = $('pay-form');
  if (!form) return;
  const fields = {
    invoice: $('invoice'), amount: $('amount'), currency: $('currency'),
    name: $('name'), email: $('email'), terms: $('terms'),
  };
  const btn = $('pay-btn');
  const btnLabel = $('pay-btn-label');
  const status = $('form-status');

  // "1,234.50" or "1234,5" -> 1234.5; anything else -> NaN.
  const parseAmount = raw => {
    let s = String(raw).trim().replace(/[\s ]/g, '');
    if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) s = s.replace(/,/g, '');
    else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
    return AMOUNT_RE.test(s) ? Number(s) : NaN;
  };

  const format = (amount, currency) =>
    new Intl.NumberFormat(CURRENCIES[currency] || 'en-US', { style: 'currency', currency }).format(amount);

  const validators = {
    invoice: v => INVOICE_RE.test(v.trim()) ? '' : 'Enter the invoice number exactly as shown (letters, digits and dashes).',
    amount: v => {
      const n = parseAmount(v);
      if (Number.isNaN(n)) return 'Enter an amount like 1250 or 1250.50.';
      if (n < MIN_AMOUNT) return 'The amount must be at least 1.';
      if (n > MAX_AMOUNT) return 'For amounts this large, please pay by bank transfer. Email us for details.';
      return '';
    },
    name: v => v.trim().length >= 2 ? '' : 'Enter the name or company on the invoice.',
    email: v => EMAIL_RE.test(v.trim()) ? '' : 'Enter a valid email address.',
    terms: (_, el) => el.checked ? '' : 'Please confirm to continue.',
  };

  const check = key => {
    const el = fields[key];
    const msg = validators[key](el.value, el);
    $(key + '-err').textContent = msg;
    if (msg) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
    return !msg;
  };

  const updateSummary = () => {
    const inv = fields.invoice.value.trim();
    $('sum-invoice').textContent = INVOICE_RE.test(inv) ? inv.toUpperCase() : '—';
    const n = parseAmount(fields.amount.value);
    $('sum-total').textContent = Number.isNaN(n) ? '—' : format(n, fields.currency.value);
  };

  // Prefill from an invoice link, e.g. /pay/?invoice=RC-2026-014&amount=1250&currency=USD.
  // Values are validated and only ever written to .value / .textContent.
  try {
    const q = new URLSearchParams(location.search);
    const inv = q.get('invoice');
    if (inv && INVOICE_RE.test(inv)) fields.invoice.value = inv.toUpperCase();
    const amt = q.get('amount');
    if (amt && !Number.isNaN(parseAmount(amt))) fields.amount.value = amt;
    const cur = (q.get('currency') || '').toUpperCase();
    if (Object.hasOwn(CURRENCIES, cur)) fields.currency.value = cur;
    // Drop the query so invoice details don't linger in history or get shared by copy-paste.
    if (location.search) history.replaceState(null, '', location.pathname);
  } catch {}
  updateSummary();

  Object.keys(validators).forEach(key => {
    const el = fields[key];
    el.addEventListener('blur', () => { if (el.value || key === 'terms') check(key); });
    el.addEventListener('input', () => { if (el.getAttribute('aria-invalid')) check(key); });
  });
  ['invoice', 'amount', 'currency'].forEach(key => fields[key].addEventListener('input', updateSummary));
  fields.currency.addEventListener('change', updateSummary);

  let busy = false;
  const setBusy = on => {
    busy = on;
    btn.disabled = on;
    btnLabel.textContent = on ? 'Processing…' : 'Continue to secure payment';
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    status.textContent = '';
    status.classList.remove('is-notice');

    const results = Object.keys(validators).map(check);
    if (results.includes(false)) {
      const firstBad = Object.keys(validators).find((key, i) => !results[i]);
      fields[firstBad].focus();
      return;
    }

    const payment = {
      invoice: fields.invoice.value.trim().toUpperCase(),
      // Integer minor units (agorot / cents) avoid floating-point rounding.
      amountMinor: Math.round(parseAmount(fields.amount.value) * 100),
      currency: fields.currency.value,
      name: fields.name.value.trim(),
      email: fields.email.value.trim(),
    };

    if (!PROVIDER) {
      status.classList.add('is-notice');
      status.textContent = 'Online card payments are not enabled yet, so nothing has been charged. ' +
        'To pay invoice ' + payment.invoice + ' now, email hello@redcrowninteractive.com for bank transfer details.';
      return;
    }

    setBusy(true);
    try {
      await PROVIDER.start(payment);
    } catch {
      status.textContent = 'The payment could not be started. You have not been charged. Please try again.';
      setBusy(false);
    }
  });

  // Returning via the back button from a hosted checkout restores a page with a
  // disabled button; re-enable it.
  window.addEventListener('pageshow', e => { if (e.persisted) setBusy(false); });
})();
