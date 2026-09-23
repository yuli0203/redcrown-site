// Provider connectors. Each exports:
//   createCheckout(session, env) -> https URL of the provider's hosted checkout,
//                                   or { url, providerRef } (the provider's order id)
//   verifyWebhook(request, rawBody, env) -> { ref, status, amountMinor, currency, transactionId } | null
//   checkoutHosts(env) -> hostnames the browser may be sent to
//   capture(session, env) -> same event shape (optional; for providers that
//                            need a server-side capture when the client returns)
import paypal from './paypal.js';
import payplus from './payplus.js';
import mock from './mock.js';

export const providers = { paypal, payplus, mock };
