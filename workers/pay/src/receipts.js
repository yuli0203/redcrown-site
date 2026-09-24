// Issuing receipts and the emails around payments.
//
// Who gets what:
// - Client: with a signing certificate AND the client's consent to digital
//   documents (סעיף 18ב), the signed original receipt (מקור, מסמך ממוחשב).
//   Otherwise a payment confirmation, which is not a tax document; the legal
//   receipt then reaches them on paper, from the original emailed to you.
// - You: every receipt as a copy (העתק) for your books, plus fee, net and
//   payer details; and, when the client could not get it digitally, the
//   original to print, sign and hand over.
import { buildReceiptPdf, buildRequestPdf, money, date } from './documents.js';
import { loadSigner, signPdf } from './sign.js';
import { send } from './mail.js';
import { business, ledger, bytes, payUrl } from './business.js';

const today = () => date(Date.now());

// Bank of Israel representative rate for the payment day (best effort: the
// receipt is issued without it if the API does not answer in time).
export async function ilsValue(env, currency, amountMinor) {
  if (currency === 'ILS' || env.BOI_RATES === 'off') return null;
  try {
    const res = await fetch(`https://boi.org.il/PublicApi/GetExchangeRate?key=${currency}`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    const rate = Number(data.currentExchangeRate) / (Number(data.unit) || 1);
    if (!res.ok || !Number.isFinite(rate) || rate <= 0) return null;
    return { rate: rate.toFixed(4), date: date(data.lastUpdate || Date.now()), amountMinor: Math.round(amountMinor * rate) };
  } catch {
    return null;
  }
}

const signatureInfo = b => ({
  name: b.ownerName, reason: 'קבלה / Receipt', location: 'Israel', contactInfo: b.email,
});

// Issues (numbers and stores) a receipt, then emails it.
// input: { requestNumber?, lang, client, description, currency, amountMinor,
//          paidOn, method, methodDetails, consent, payment? (fee/net/payer) }
export async function issueReceipt(env, input, { notify = true } = {}) {
  const b = business(env);
  const l = ledger(env);
  const ils = await ilsValue(env, input.currency, input.amountMinor);
  const { number, existing } = await l.issueReceipt({ ...input, ils }, Number(env.RECEIPT_START) || 1);
  if (existing) return { number, existing: true };
  const receipt = await l.getReceipt(number);

  const signer = await loadSigner(env);
  const signOf = async mark => {
    if (!signer) return buildReceiptPdf({ business: b, receipt, mark });
    return signPdf(await buildReceiptPdf({ business: b, receipt, mark, signature: signatureInfo(b) }), signer);
  };
  const copy = await signOf('copy');
  await l.attachReceiptPdf(number, copy, !!signer);
  if (!notify) return { number, existing: false, signed: !!signer };

  const digital = !!signer && !!input.consent?.given && !!receipt.client.email;
  const original = await signOf('original');
  const file = mark => `receipt-${number}${mark === 'copy' ? '-copy' : ''}.pdf`;
  const amount = money(receipt.amountMinor, receipt.currency);

  if (receipt.client.email) {
    await send(env, digital ? clientReceiptEmail(b, receipt, amount, { filename: file('original'), content: original })
      : clientConfirmationEmail(b, receipt, amount));
  }
  await send(env, ownerReceiptEmail(env, b, receipt, amount, { digital, signed: !!signer, input,
    attachments: [
      ...(digital ? [] : [{ filename: file('original'), content: original }]),
      { filename: file('copy'), content: copy },
    ] }));
  return { number, existing: false, signed: !!signer, digital };
}

const he = r => r.lang === 'he';

function clientReceiptEmail(b, r, amount, attachment) {
  return he(r) ? {
    to: [r.client.email], dir: 'rtl', attachments: [attachment],
    subject: `קבלה מס׳ ${r.number} מ-${b.tradingName}`,
    text: `שלום ${r.client.name},\n\nתודה, התשלום התקבל: ${amount}.\nמצורפת קבלה מס׳ ${r.number} (מסמך ממוחשב חתום דיגיטלית).\n\n${b.tradingName}\n${b.email}`,
  } : {
    to: [r.client.email], attachments: [attachment],
    subject: `Receipt ${r.number} from ${b.tradingName}`,
    text: `Hello ${r.client.name},\n\nThank you, your payment of ${amount} was received.\nReceipt no. ${r.number} is attached (digitally signed).\n\n${b.tradingName}\n${b.email}`,
  };
}

function clientConfirmationEmail(b, r, amount) {
  return he(r) ? {
    to: [r.client.email], dir: 'rtl',
    subject: `אישור תשלום: ${amount} ל-${b.tradingName}`,
    text: `שלום ${r.client.name},\n\nתודה, התשלום התקבל: ${amount}${r.requestNumber ? ` (חשבון עסקה ${r.requestNumber})` : ''}.\nהודעה זו היא אישור תשלום ואינה קבלה. קבלה מס׳ ${r.number} תימסר לך בנפרד.\n\n${b.tradingName}\n${b.email}`,
  } : {
    to: [r.client.email],
    subject: `Payment confirmation: ${amount} to ${b.tradingName}`,
    text: `Hello ${r.client.name},\n\nThank you, your payment of ${amount} was received${r.requestNumber ? ` (payment request ${r.requestNumber})` : ''}.\nThis email confirms the payment; it is not a receipt. Receipt no. ${r.number} will be delivered to you separately.\n\n${b.tradingName}\n${b.email}`,
  };
}

function ownerReceiptEmail(env, b, r, amount, { digital, signed, input, attachments }) {
  const p = input.payment || {};
  const lines = [
    `Receipt ${r.number} issued${r.requestNumber ? ` for payment request ${r.requestNumber}` : ''}.`,
    '',
    `Client: ${r.client.name}${r.client.company ? `, ${r.client.company}` : ''}${r.client.email ? ` <${r.client.email}>` : ''}`,
    `Amount: ${amount}`,
    p.feeMinor != null ? `PayPal fee: ${money(p.feeMinor, r.currency)}` : '',
    p.netMinor != null ? `Net to you: ${money(p.netMinor, r.currency)}` : '',
    r.ils ? `ILS value (BOI rate ${r.ils.rate}, ${r.ils.date}): ${money(r.ils.amountMinor, 'ILS')}` : '',
    p.payerName || p.payerEmail ? `PayPal payer: ${[p.payerName, p.payerEmail].filter(Boolean).join(', ')}` : '',
    r.methodDetails?.transactionId ? `Transaction: ${r.methodDetails.transactionId}` : '',
    '',
    digital
      ? 'The client received the digitally signed original by email. The attached copy is for your books.'
      : !signed
        ? 'ACTION: no signing certificate is configured, so the client got a payment confirmation, not the receipt. Print the attached original, sign it and give or mail it to the client. The copy is for your books.'
        : 'ACTION: the client has not agreed to digital documents (or has no email), so they got a payment confirmation. Print the attached original, sign it and give or mail it to the client. The copy is for your books.',
  ].filter(l => l !== '');
  return {
    to: [env.NOTIFY_TO || b.email], attachments,
    subject: `${digital ? '' : 'ACTION: '}Payment received: receipt ${r.number}, ${amount}, ${r.client.name}`,
    text: lines.join('\n'),
  };
}

export async function duplicateAlert(env, invoice, ref, data, label = 'PayPal') {
  const amount = data.amountMinor != null ? money(data.amountMinor, data.currency) : '';
  const how = label === 'PayPal' ? 'Refund it in PayPal: Activity > the transaction > Issue a refund. No receipt was issued for it.'
    : `Refund it in ${label}'s dashboard (the transaction > refund); ${label} issues the matching credit document.`;
  await send(env, {
    to: [env.NOTIFY_TO || env.BUSINESS_EMAIL],
    subject: `ACTION: duplicate payment for ${invoice}, refund it`,
    text: `Payment request ${invoice} was already paid, and a second payment went through (${amount}, transaction ${data.transactionId || 'unknown'}, checkout ${ref}).\n${how}`,
  });
}

// A payment whose receipt the provider issues (Grow): the owner's notice.
export async function paymentNotice(env, invoice, payment, label) {
  const pr = await ledger(env).getRequest(invoice);
  const amount = money(payment.amountMinor, payment.currency);
  const c = pr?.client || {};
  await send(env, {
    to: [env.NOTIFY_TO || env.BUSINESS_EMAIL],
    subject: `Payment received: ${invoice}, ${amount}, ${c.name || payment.payerName || ''}`.trim(),
    text: [
      `Payment request ${invoice} was paid.`,
      '',
      `Client: ${c.name || ''}${c.company ? `, ${c.company}` : ''}${c.email ? ` <${c.email}>` : ''}`,
      `Amount: ${amount}`,
      `Paid with: ${payment.method}${payment.cardSuffix ? ` (card ending ${payment.cardSuffix})` : ''}`,
      payment.payerName || payment.payerEmail ? `Payer: ${[payment.payerName, payment.payerEmail].filter(Boolean).join(', ')}` : '',
      payment.transactionId ? `Transaction: ${payment.transactionId}${payment.asmachta ? `, approval ${payment.asmachta}` : ''}` : '',
      '',
      `${label} issues the receipt and emails it to the client; it is in ${label}'s dashboard with your other documents.`,
    ].filter(l => l !== '').join('\n'),
  });
}

export async function receiptFailedAlert(env, invoice, error) {
  await send(env, {
    to: [env.NOTIFY_TO || env.BUSINESS_EMAIL],
    subject: `ACTION: payment received for ${invoice}, but the receipt was not issued`,
    text: `The payment for ${invoice} is recorded, but issuing the receipt failed: ${error}.\nOpen the admin page, fix the cause, and issue the receipt from the payment request.`,
  });
}

// ---- Payment requests.
export async function requestDocument(env, request) {
  const url = await payUrl(env, request);
  const pdf = await buildRequestPdf({ business: business(env), request, payUrl: url });
  return { url, pdf };
}

export function requestEmail(env, b, request, url, pdf) {
  const amount = money(request.amountMinor, request.currency);
  const until = date(request.expires * 1000);
  const attachments = [{ filename: `payment-request-${request.number}.pdf`, content: pdf }];
  const bcc = [env.NOTIFY_TO || b.email];
  return he(request) ? {
    to: [request.client.email], bcc, dir: 'rtl', attachments,
    subject: `חשבון עסקה ${request.number} מ-${b.tradingName}: ${amount}`,
    text: `שלום ${request.client.name},\n\nמצורף חשבון עסקה ${request.number} על סך ${amount}.\nלתשלום מאובטח אונליין (בתוקף עד ${until}):\n${url}\n\nלהעברה בנקאית, השיבו למייל זה.\n\n${b.tradingName}\n${b.email}`,
  } : {
    to: [request.client.email], bcc, attachments,
    subject: `Payment request ${request.number} from ${b.tradingName}: ${amount}`,
    text: `Hello ${request.client.name},\n\nAttached is payment request ${request.number} for ${amount}.\nPay securely online (link valid until ${until}):\n${url}\n\nFor bank transfer, reply to this email.\n\n${b.tradingName}\n${b.email}`,
  };
}

export { today, bytes };
