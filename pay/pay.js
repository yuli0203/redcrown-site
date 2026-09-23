// Invoice payment page. Hands off to the payment API (workers/pay), which
// verifies the signed link and returns the provider's hosted checkout URL.
//
// Security model (see pay/README.md):
// - Card data never enters this page. The provider collects it in its own hosted
//   fields or hosted checkout, which keeps card numbers out of our code.
// - Everything here is client-side and therefore untrusted. The Worker checks
//   the link's signature, so an edited amount is rejected, and only the
//   provider's signed webhook marks an invoice paid.
'use strict';

(() => {
  // Settings live in config.js. With no API origin, every button shows a
  // "not enabled yet" notice and nothing is sent.
  const { apiOrigin: API_ORIGIN, checkoutHosts: CHECKOUT_HOSTS } = self.RC_PAY_CONFIG || {};

  const CURRENCIES = { ILS: 'he-IL', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
  const INVOICE_RE = /^[A-Z0-9][A-Z0-9-]{2,31}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const $ = id => document.getElementById(id);
  const form = $('pay-form');
  if (!form) return;

  // The invoice comes only from the signed payment link we send
  // (tools/pay-link.mjs), e.g. /pay/?i=RC-2026-014&a=125000&c=USD&x=<expiry>&s=<sig>.
  // The page can't check the signature (only the Worker holds the secret), so it
  // checks the format here and the Worker rejects anything altered.
  // Values are only ever written with .textContent.
  const readLink = () => {
    try {
      const q = new URLSearchParams(location.search);
      const link = { i: (q.get('i') || '').toUpperCase(), a: q.get('a') || '', c: (q.get('c') || '').toUpperCase(), x: q.get('x') || '', s: q.get('s') || '' };
      if (!INVOICE_RE.test(link.i) || !/^\d{3,9}$/.test(link.a) || !Object.hasOwn(CURRENCIES, link.c) ||
          !/^\d{1,12}$/.test(link.x) || !/^[A-Za-z0-9_-]{43}$/.test(link.s)) return null;
      return link;
    } catch {
      return null;
    }
  };
  const showProblem = (title, text) => {
    $('pay-grid').hidden = true;
    $('no-invoice-title').textContent = title;
    $('no-invoice-text').textContent = text;
    $('no-invoice').hidden = false;
  };
  const link = readLink();
  if (!link) return showProblem('Use the payment link from your invoice',
    'This page opens with your invoice details already filled in. Please use the payment link in the invoice email we sent you.');
  if (Number(link.x) * 1000 < Date.now()) return showProblem('This payment link has expired',
    'For your security, payment links are valid for a limited time. Email us and we will send you a new one.');
  const invoice = { invoice: link.i, amount: Number(link.a) / 100, currency: link.c };
  const total = new Intl.NumberFormat(CURRENCIES[invoice.currency], { style: 'currency', currency: invoice.currency }).format(invoice.amount);
  $('sum-invoice').textContent = invoice.invoice;
  $('sum-total').textContent = total;
  $('pay-btn-label').textContent = 'Pay ' + total;

  const fields = { email: $('email'), name: $('name') };
  const btn = $('pay-btn');
  const wallets = [...document.querySelectorAll('.py-wallet')];
  const status = $('form-status');

  // Apple's guidelines: show Apple Pay only where the device can use it.
  try {
    if (window.ApplePaySession && ApplePaySession.canMakePayments()) {
      document.querySelector('[data-wallet=applepay]').hidden = false;
    }
  } catch {}

  const validators = {
    email: v => EMAIL_RE.test(v.trim()) ? '' : 'Enter a valid email address for your receipt.',
    name: v => v.trim().length >= 2 ? '' : 'Enter the name on the card.',
  };
  const check = key => {
    const el = fields[key];
    const msg = validators[key](el.value);
    $(key + '-err').textContent = msg;
    if (msg) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
    return !msg;
  };
  Object.keys(validators).forEach(key => {
    const el = fields[key];
    el.addEventListener('blur', () => { if (el.value) check(key); });
    el.addEventListener('input', () => { if (el.getAttribute('aria-invalid')) check(key); });
  });

  let busy = false;
  const setBusy = on => {
    busy = on;
    btn.disabled = on;
    wallets.forEach(w => { w.disabled = on; });
    $('pay-btn-label').textContent = on ? 'Processing…' : 'Pay ' + total;
  };

  const notice = text => {
    status.classList.add('is-notice');
    status.textContent = text;
  };
  const ERRORS = {
    400: 'This payment link is not valid. Please use the link from your invoice email.',
    409: 'This invoice has already been paid. Thank you!',
    410: 'This payment link has expired. Email us and we will send a new one.',
    429: 'Too many attempts. Please wait a minute and try again.',
  };

  const start = async payment => {
    if (busy) return;
    status.textContent = '';
    status.classList.remove('is-notice');
    if (!API_ORIGIN) {
      notice('Online payments are not enabled yet, so nothing has been charged. ' +
        'To pay invoice ' + invoice.invoice + ' now, email hello@redcrowninteractive.com for bank transfer details.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(API_ORIGIN + '/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link, ...payment }),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error('checkout failed'), { status: res.status });
      const target = new URL(data.url);
      if (target.protocol !== 'https:' || !CHECKOUT_HOSTS.includes(target.hostname)) throw new Error('unexpected checkout host');
      location.assign(target.href);
    } catch (e) {
      notice((ERRORS[e.status] || 'The payment could not be started. You have not been charged. Please try again.'));
      setBusy(false);
    }
  };

  // Express checkout: one click starts the wallet's own payment flow.
  wallets.forEach(w => w.addEventListener('click', () => start({ method: w.dataset.wallet })));

  form.addEventListener('submit', event => {
    event.preventDefault();
    const results = Object.keys(validators).map(check);
    if (results.includes(false)) {
      fields[Object.keys(validators)[results.indexOf(false)]].focus();
      return;
    }
    start({ method: 'card', email: fields.email.value.trim(), name: fields.name.value.trim() });
  });

  // Returning via the back button from a hosted checkout restores a page with
  // disabled buttons; re-enable them.
  window.addEventListener('pageshow', e => { if (e.persisted) setBusy(false); });
})();
