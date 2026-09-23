// Provider connectors. Each exports:
//   createCheckout(session, env) -> https URL of the provider's hosted checkout
//   verifyWebhook(request, rawBody, env) -> { ref, status, amountMinor, currency, transactionId } | null
//   checkoutHosts(env) -> hostnames the browser may be sent to
import payplus from './payplus.js';
import mock from './mock.js';

export const providers = { payplus, mock };
