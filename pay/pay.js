// Invoice payment page. Not connected to a payment provider yet: PROVIDER is null,
// so starting any payment shows a notice and nothing is sent anywhere.
//
// Security model (see pay/README.md):
// - Card data never enters this page. The provider collects it in its own hosted
//   fields or hosted checkout, which keeps card numbers out of our code.
// - Everything here is client-side and therefore untrusted. Anyone can edit the
//   link's amount, so the backend must look the invoice up and charge ITS amount,
//   never a number sent from the browser.
'use strict';

(() => {
  // Wire a provider here later. Expected shape:
  //   { start: async ({ method, invoice, amountMinor, currency, name?, email? }) => void }
  // `method` is card | paypal | googlepay | applepay. Wallets supply the payer's
  // name and email themselves. For card, the provider mounts its hosted fields
  // into #card-fields. Apple Pay and Google Pay must open their payment sheet
  // directly inside the click handler (a user gesture), so keep `start` free of
  // awaits before that point.
  const PROVIDER = null;

  const CURRENCIES = { ILS: 'he-IL', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
  const INVOICE_RE = /^[A-Za-z0-9][A-Za-z0-9-]{2,31}$/;
  const AMOUNT_RE = /^\d{1,7}(?:\.\d{1,2})?$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const MIN_AMOUNT = 1;
  const MAX_AMOUNT = 1000000;

  const $ = id => document.getElementById(id);
  const form = $('pay-form');
  if (!form) return;

  // The invoice comes only from the payment link we send, e.g.
  // /pay/?invoice=RC-2026-014&amount=1250&currency=USD. Clients can't edit it.
  // Values are validated and only ever written with .textContent.
  const readInvoice = () => {
    try {
      const q = new URLSearchParams(location.search);
      const invoice = (q.get('invoice') || '').toUpperCase();
      const amount = q.get('amount') || '';
      const currency = (q.get('currency') || '').toUpperCase();
      if (!INVOICE_RE.test(invoice) || !AMOUNT_RE.test(amount) || !Object.hasOwn(CURRENCIES, currency)) return null;
      const value = Number(amount);
      if (value < MIN_AMOUNT || value > MAX_AMOUNT) return null;
      return { invoice, amount: value, currency };
    } catch {
      return null;
    }
  };
  const invoice = readInvoice();
  if (!invoice) {
    $('pay-grid').hidden = true;
    $('no-invoice').hidden = false;
    return;
  }
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

  const start = async payment => {
    if (busy) return;
    status.textContent = '';
    status.classList.remove('is-notice');
    if (!PROVIDER) {
      status.classList.add('is-notice');
      status.textContent = 'Online payments are not enabled yet, so nothing has been charged. ' +
        'To pay invoice ' + invoice.invoice + ' now, email hello@redcrowninteractive.com for bank transfer details.';
      return;
    }
    setBusy(true);
    try {
      await PROVIDER.start({
        ...payment,
        invoice: invoice.invoice,
        // Integer minor units (agorot / cents) avoid floating-point rounding.
        amountMinor: Math.round(invoice.amount * 100),
        currency: invoice.currency,
      });
    } catch {
      status.textContent = 'The payment could not be started. You have not been charged. Please try again.';
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
