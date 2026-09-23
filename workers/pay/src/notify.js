// Payment notifications to the studio.
//
// Every payment and every duplicate is logged (Workers Logs / `wrangler tail`).
// When RESEND_API_KEY is set (wrangler secret put RESEND_API_KEY), an email also
// goes to NOTIFY_TO through Resend's HTTP API. PayPal's own "you've got money"
// email still arrives separately; this one carries what a receipt (קבלה) needs.
//
// Vars: NOTIFY_TO, NOTIFY_FROM (an address on a domain verified in Resend).

const money = (minor, currency) =>
  Number.isFinite(minor) ? `${(minor / 100).toFixed(2)} ${currency}` : '';

// Plain-text body: one "Label: value" line per known field.
export const describe = record => {
  const lines = [
    ['Invoice', record.invoice],
    ['Amount', money(record.amountMinor, record.currency)],
    ['PayPal fee', money(record.feeMinor, record.currency)],
    ['Net to you', money(record.netMinor, record.currency)],
    ['Payer', record.payerName],
    ['Payer email', record.payerEmail],
    ['Transaction', record.transactionId],
    ['Checkout ref', record.ref],
    ['Paid at', record.paidAt && new Date(record.paidAt).toISOString()],
  ];
  return lines.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
};

export const messageFor = (kind, record, extra = {}) => {
  if (kind === 'duplicate') {
    return {
      subject: `ACTION: duplicate payment for invoice ${record.invoice}, refund it`,
      text: `Invoice ${record.invoice} was already paid (transaction ${extra.firstTransactionId || 'unknown'}), ` +
        'and a second payment went through. Refund this one in PayPal (Activity > the transaction > Issue a refund).\n\n' +
        describe(record),
    };
  }
  return {
    subject: `Payment received: invoice ${record.invoice}, ${money(record.amountMinor, record.currency)}`,
    text: 'Issue a receipt (קבלה) for this payment.\n\n' + describe(record),
  };
};

export async function notify(env, kind, record, extra) {
  const msg = messageFor(kind, record, extra);
  console.log(`payment ${kind}`, JSON.stringify({ subject: msg.subject, invoice: record.invoice, ref: record.ref, transactionId: record.transactionId }));
  if (!env.RESEND_API_KEY || !env.NOTIFY_TO || !env.NOTIFY_FROM) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.NOTIFY_FROM, to: [env.NOTIFY_TO], subject: msg.subject, text: msg.text }),
    });
    if (!res.ok) console.error('notify failed', res.status);
    return res.ok;
  } catch (e) {
    console.error('notify failed', e.message);
    return false;
  }
}
