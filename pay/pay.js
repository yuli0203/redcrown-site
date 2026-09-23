// Payment request page. Hands off to the payment API (workers/pay), which
// verifies the signed link and returns PayPal's checkout URL.
//
// Security model (see pay/README.md):
// - Card data never enters this page. Clients pay in PayPal's own checkout,
//   by PayPal or as a guest by card.
// - Everything here is client-side and therefore untrusted. The Worker checks
//   the link's signature, so an edited amount is rejected, and only PayPal's
//   server-side confirmation marks a request paid.
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

  // Clickjacking guard. GitHub Pages cannot send X-Frame-Options or a
  // frame-ancestors header, so if another site frames this page the buttons are
  // never activated and the client is sent to open the page directly.
  let framed = true;
  try { framed = window.top !== window.self; } catch { /* cross-origin parent */ }
  if (framed) {
    grid.hidden = true;
    $('no-invoice-title').textContent = 'Open this page directly';
    $('no-invoice-text').textContent = 'For your security, payments only work on redcrowninteractive.com itself, not inside another site.';
    const open = document.createElement('a');
    open.href = location.href;
    open.target = '_top';
    open.rel = 'noopener';
    open.textContent = 'Open the secure payment page';
    $('no-invoice-text').append(document.createElement('br'), open);
    $('no-invoice').hidden = false;
    return;
  }

  // The payment request comes only from the signed link we send (the admin
  // page creates it), e.g. /pay/?i=PR-0001&a=125000&c=USD&x=<expiry>&s=<sig>.
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
  if (!link) return showProblem('Use the link from your payment request',
    'This page opens with your payment details already filled in. Please use the link in the payment request we emailed you.');
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
    409: 'This payment request has already been paid. Thank you!',
    410: 'This payment link has expired or was cancelled. Email us and we will send a new one.',
    429: 'Too many attempts. Please wait a minute and try again.',
  };

  const start = async method => {
    if (busy) return;
    status.textContent = '';
    status.classList.remove('is-notice');
    if (!API_ORIGIN) {
      notice('Online payments are not enabled yet, so nothing has been charged. ' +
        'To pay ' + link.i + ' now, email hello@redcrowninteractive.com for bank transfer details.');
      return;
    }
    setBusy(true);
    status.textContent = 'Opening PayPal secure checkout…';
    try {
      const res = await fetch(API_ORIGIN + '/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link, method, consent: $('consent').checked }),
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
