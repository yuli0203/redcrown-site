// Payment page settings, shared by /pay/ and /pay/success/.
// apiOrigin is empty until the payment Worker (workers/pay) is deployed; while
// it is empty nothing is sent anywhere. When you set it, add the same origin to
// connect-src in the CSP of pay/index.html and pay/success/index.html.
'use strict';
self.RC_PAY_CONFIG = Object.freeze({
  apiOrigin: '',
  // Payment buttons shown (each also needs its Grow page code on the Worker).
  methods: Object.freeze(['card', 'bit', 'applepay', 'googlepay']),
  // The only hosts the browser may be sent to: Grow's payment pages (sandbox, live).
  checkoutHosts: Object.freeze(['sandbox.meshulam.co.il', 'secure.meshulam.co.il', 'meshulam.co.il']),
});
