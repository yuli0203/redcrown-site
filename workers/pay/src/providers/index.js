// Provider connectors. Each exports:
//   createCheckout(session, env) -> https URL of the provider's hosted checkout,
//                                   or { url, providerRef } (the provider's order id)
//   verifyWebhook(request, rawBody, env, session) -> { ref, status, amountMinor, currency, transactionId } | null
//                                   (session: the checkout named in the notify URL, for
//                                   providers whose notifications are not signed)
//   checkoutHosts(env) -> hostnames the browser may be sent to
//   capture(session, env) -> same event shape (optional; for providers that
//                            need a server-side capture when the client returns)
// and optionally:
//   methods(env) -> payment methods offered (default: card, paypal)
//   currencies   -> currencies it can charge (default: any)
//   chargesOnPage -> the client is charged on the provider's page (no capture to hold back)
//   issuesReceipts, label -> the provider issues the receipts (we issue none)
import paypal from './paypal.js';
import payplus from './payplus.js';
import grow from './grow.js';
import mock from './mock.js';

export const providers = { grow, paypal, payplus, mock };
