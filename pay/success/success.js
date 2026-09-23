// Payment result page. The provider redirects here with ?ref=<checkout reference>;
// the page asks the payment API whether the provider's signed webhook has
// confirmed the payment, retrying for a short while because webhooks can lag
// the redirect.
'use strict';

(() => {
  const { apiOrigin } = self.RC_PAY_CONFIG || {};
  const CURRENCIES = { ILS: 'he-IL', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
  const $ = id => document.getElementById(id);

  const show = (state, title, text, details) => {
    $('result-icon').className = 'py-result-icon is-' + state;
    $('result-title').textContent = title;
    $('result-text').textContent = text;
    if (details) {
      $('result-invoice').textContent = details.invoice;
      $('result-amount').textContent = new Intl.NumberFormat(CURRENCIES[details.currency] || 'en-US',
        { style: 'currency', currency: details.currency }).format(details.amountMinor / 100);
      $('result-details').hidden = false;
    }
  };

  const ref = new URLSearchParams(location.search).get('ref') || '';
  if (!apiOrigin || !/^[0-9a-f-]{36}$/.test(ref)) {
    show('unknown', 'We couldn’t find this payment',
      'If you completed a payment, your receipt will arrive by email. Otherwise, please use the payment link from your invoice.');
    return;
  }

  const DELAYS = [0, 1500, 2500, 4000, 6000, 8000];
  const poll = async attempt => {
    try {
      const res = await fetch(`${apiOrigin}/status?ref=${encodeURIComponent(ref)}`, { credentials: 'omit', referrerPolicy: 'no-referrer' });
      const data = await res.json();
      if (data.status === 'paid') {
        show('paid', 'Payment received', 'Thank you! A receipt is on its way to your email.', data);
        return;
      }
      if (data.status === 'already_paid') {
        show('paid', 'This invoice is already paid',
          'It was paid in another window or with an earlier link, so this payment was not taken. You have not been charged again.', data);
        return;
      }
      if (data.status === 'duplicate') {
        show('pending-final', 'This invoice was already paid',
          'Your payment went through, but the invoice had already been paid, so we will refund this second payment in full. You don’t need to do anything.', data);
        return;
      }
      if (data.status === 'pending' && attempt + 1 < DELAYS.length) {
        setTimeout(() => poll(attempt + 1), DELAYS[attempt + 1]);
        return;
      }
      if (data.status === 'pending') {
        show('pending-final', 'Payment is being confirmed',
          'Your payment provider hasn’t confirmed it yet. You’ll get a receipt by email as soon as it does; there’s no need to pay again.', data);
        return;
      }
    } catch {}
    show('unknown', 'We couldn’t check this payment',
      'If you completed a payment, your receipt will arrive by email. Please don’t pay again; email us if you have any doubt.');
  };
  poll(0);
})();
