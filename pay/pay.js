// Invoice payment page. Hands off to the payment API (workers/pay), which
// verifies the signed link and returns PayPal's checkout URL.
//
// Security model (see pay/README.md):
// - Card data never enters this page. Clients pay in PayPal's own checkout,
//   by PayPal or as a guest by card.
// - Everything here is client-side and therefore untrusted. The Worker checks
//   the link's signature, so an edited amount is rejected, and only PayPal's
//   server-side confirmation marks an invoice paid.
'use strict';

(() => {
  // Settings live in config.js. With no API origin, every button shows a
  // "not enabled yet" notice and nothing is sent.
  const { apiOrigin: API_ORIGIN, checkoutHosts: CHECKOUT_HOSTS } = self.RC_PAY_CONFIG || {};

  const CURRENCIES = { ILS: 'he-IL', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
  const INVOICE_RE = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

  const $ = id => document.getElementById(id);
  const grid = $('pay-grid');
  if (!grid) return;

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
    grid.hidden = true;
    $('no-invoice-title').textContent = title;
    $('no-invoice-text').textContent = text;
    $('no-invoice').hidden = false;
  };
  const link = readLink();
  if (!link) return showProblem('Use the payment link from your invoice',
    'This page opens with your invoice details already filled in. Please use the payment link in the invoice email we sent you.');
  if (Number(link.x) * 1000 < Date.now()) return showProblem('This payment link has expired',
    'For your security, payment links are valid for a limited time. Email us and we will send you a new one.');

  const total = new Intl.NumberFormat(CURRENCIES[link.c], { style: 'currency', currency: link.c }).format(Number(link.a) / 100);
  $('sum-invoice').textContent = link.i;
  $('sum-total').textContent = total;

  const buttons = [...document.querySelectorAll('.py-wallet')];
  const status = $('form-status');
  let busy = false;
  const setBusy = on => {
    busy = on;
    buttons.forEach(b => { b.disabled = on; });
    grid.setAttribute('aria-busy', String(on));
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

  const start = async method => {
    if (busy) return;
    status.textContent = '';
    status.classList.remove('is-notice');
    if (!API_ORIGIN) {
      notice('Online payments are not enabled yet, so nothing has been charged. ' +
        'To pay invoice ' + link.i + ' now, email hello@redcrowninteractive.com for bank transfer details.');
      return;
    }
    setBusy(true);
    status.textContent = 'Opening PayPal secure checkout…';
    try {
      const res = await fetch(API_ORIGIN + '/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link, method }),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error('checkout failed'), { status: res.status });
      const target = new URL(data.url);
      if (target.protocol !== 'https:' || !CHECKOUT_HOSTS.includes(target.hostname)) throw new Error('unexpected checkout host');
      location.assign(target.href);
    } catch (e) {
      notice(ERRORS[e.status] || 'The payment could not be started. You have not been charged. Please try again.');
      setBusy(false);
    }
  };

  // One click starts checkout: PayPal login, or PayPal's guest card form.
  buttons.forEach(b => b.addEventListener('click', () => start(b.dataset.wallet)));

  // Returning via the back button from PayPal restores a page with disabled
  // buttons; re-enable them.
  window.addEventListener('pageshow', e => {
    if (e.persisted) {
      setBusy(false);
      status.textContent = '';
    }
  });
})();
