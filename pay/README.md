# Payment page (`/pay/`)

Invoice payment page. **Not connected to any payment provider yet**: `PROVIDER` in
`pay.js` is `null`, so a valid submission only shows a notice. Nothing is sent or
charged.

Invoice links can prefill the form:
`/pay/?invoice=RC-2026-014&amount=1250&currency=USD` (ILS, USD, EUR). The query is
validated, then removed from the address bar.

## Security design

- **No card data on this page, ever.** Do not add card number, expiry or CVC
  inputs. Use a PCI DSS Level 1 provider's hosted checkout or hosted fields
  (e.g. Stripe Checkout / Payment Element, or an Israeli processor's hosted page).
  That keeps the site in the lightest PCI scope (SAQ A).
- **The browser is untrusted.** The amount on the form is a convenience. The
  backend that creates the checkout session must look up the invoice and charge
  the invoice's amount, and confirm payment from the provider's signed webhook,
  not from a redirect back to this page.
- **Strict CSP, no inline code.** The page loads only same-origin files. It
  deliberately omits the Google tag and every other third-party script that the
  rest of the site loads — third-party JS on a payment page can read the form.
- `noindex`, `no-referrer`, and not listed in `sitemap.xml`.

## Connecting a provider (later)

1. Build a small backend endpoint (GitHub Pages cannot run one; e.g. a
   Cloudflare Worker) that validates the invoice and creates a checkout session
   with the provider's **secret** key. Secret keys never go in this repository.
2. Set `PROVIDER.start` in `pay.js` to call that endpoint and redirect to the
   returned checkout URL (or mount the provider's hosted fields in
   `#provider-slot`).
3. Add only the provider's and the endpoint's origins to the CSP in
   `index.html` (`script-src`, `frame-src`, `connect-src`, `form-action` as the
   provider documents).
4. Add a success/cancel page and handle the provider webhook to mark invoices paid.
5. Add the provider to the privacy policy's third-party services list.

GitHub Pages cannot send HTTP security headers, so `frame-ancestors` /
clickjacking protection is not available from a `<meta>` CSP. If the site moves
to Cloudflare Pages, add `X-Frame-Options: DENY` and the CSP as real headers for
`/pay/*`.
