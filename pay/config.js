// Payment page settings, shared by /pay/ and /pay/success/.
// apiOrigin is empty until the payment Worker (workers/pay) is deployed; while
// it is empty nothing is sent anywhere. When you set it, add the same origin to
// connect-src in the CSP of pay/index.html and pay/success/index.html.
'use strict';
self.RC_PAY_CONFIG = Object.freeze({
  apiOrigin: '',
  // The only hosts the browser may be sent to: the provider's hosted checkout.
  checkoutHosts: Object.freeze(['payments.payplus.co.il', 'paymentsdev.payplus.co.il']),
});
