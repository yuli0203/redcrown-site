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

  const money = minor => new Intl.NumberFormat(CURRENCIES[link.c], { style: 'currency', currency: link.c }).format(minor / 100);
  $('sum-invoice').textContent = link.i;
  $('sum-total').textContent = money(Number(link.a));
  $('sum-valid').textContent = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jerusalem' }).format(new Date(Number(link.x) * 1000));
  $('sum-valid-row').hidden = false;

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
    422: 'Please tick the box to agree to receive your receipt by email, then try again.',
    429: 'Too many attempts. Please wait a minute and try again.',
  };

  const consentBox = $('consent');
  consentBox.addEventListener('change', () => consentBox.closest('.py-consent').classList.remove('is-missing'));

  const start = async method => {
    if (busy) return;
    status.textContent = '';
    status.classList.remove('is-notice');
    // Receipts are emailed as signed documents, which needs the client's agreement.
    if (!consentBox.checked) {
      consentBox.closest('.py-consent').classList.add('is-missing');
      notice('Please tick the box above to agree to receive your receipt by email, then choose how to pay. ' +
        'If you need a paper receipt, email julia@redcrowninteractive.com to pay by bank transfer instead.');
      consentBox.focus();
      return;
    }
    if (!API_ORIGIN) {
      notice('Online payments are not enabled yet, so nothing has been charged. ' +
        'To pay ' + link.i + ' now, email julia@redcrowninteractive.com for bank transfer details.');
      return;
    }
    setBusy(true);
    status.textContent = 'Opening PayPal secure checkout…';
    try {
      const res = await fetch(API_ORIGIN + '/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link, method, consent: consentBox.checked }),
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

  // The request's details (who it is for, line items, notes, the PDF) come
  // from the payment API for this signed link. Everything is written with
  // .textContent; a failure leaves the basic summary above.
  const query = new URLSearchParams(link).toString();
  const showPaid = () => {
    const section = grid.querySelector('section.py-card');
    section.replaceChildren();
    const box = document.createElement('div');
    box.className = 'py-paid';
    box.setAttribute('role', 'status');
    const title = document.createElement('b');
    title.textContent = 'This payment request has been paid';
    const text = document.createElement('span');
    text.textContent = 'Thank you! Your receipt was sent when the payment was received. Questions? julia@redcrowninteractive.com';
    box.append(title, text);
    section.append(box);
  };
  const loadDetails = async () => {
    if (!API_ORIGIN) return;
    try {
      const res = await fetch(`${API_ORIGIN}/request?${query}`, { credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (res.status === 400) return showProblem('This payment link is not valid', 'Please use the link from the payment request we emailed you, or email julia@redcrowninteractive.com.');
      if (!res.ok) return;
      const d = await res.json();
      if (d.status === 'paid') showPaid();
      else if (d.status === 'cancelled') return showProblem('This payment request was cancelled', 'Email julia@redcrowninteractive.com if you think this is a mistake.');
      else if (d.status === 'expired') return showProblem('This payment link has expired', 'For your security, payment links are valid for a limited time. Email us and we will send you a new one.');

      $('sum-billto').textContent = [d.client?.name, d.client?.company].filter(Boolean).join(', ');
      $('sum-billto-row').hidden = !$('sum-billto').textContent;
      const list = $('sum-items');
      list.replaceChildren(...(d.items || []).map(it => {
        const li = document.createElement('li');
        const desc = document.createElement('span');
        desc.className = 'py-item-desc';
        desc.dir = 'auto';
        desc.textContent = it.description;
        const amt = document.createElement('span');
        amt.className = 'py-item-amt';
        amt.textContent = money(it.totalMinor);
        li.append(desc, amt);
        if (Number(it.quantity) !== 1) {
          const qty = document.createElement('span');
          qty.className = 'py-item-qty';
          qty.textContent = `${it.quantity} × ${money(it.unitMinor)}`;
          li.append(qty);
        }
        return li;
      }));
      $('sum-notes').textContent = d.notes || '';
      $('sum-notes').hidden = !d.notes;
      $('sum-details').hidden = !(d.items || []).length && !d.notes;
      if (d.pdf) {
        $('sum-pdf').href = `${API_ORIGIN}/request.pdf?${query}`;
        $('sum-pdf').hidden = false;
      }
    } catch { /* keep the basic summary */ }
  };
  loadDetails();

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
