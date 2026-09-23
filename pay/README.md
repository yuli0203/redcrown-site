# Payments (`/pay/`)

Invoice payment page, payment API and link tool. **Not live yet**:
`apiOrigin` in `pay/config.js` is empty, so every button shows a "not enabled
yet" notice and nothing is sent or charged.

This repository is **public**. No secret ever goes in it: the link secret and
provider keys live only in Cloudflare (`wrangler secret put`) and on the machine
that creates links. `tools/check_no_secrets.mjs` runs in CI and fails if one is
committed.

## How it works

1. **You create a signed link** for an invoice:
   `PAY_LINK_SECRET=... node tools/pay-link.mjs RC-2026-014 1250 USD 30`
   → `https://redcrowninteractive.com/pay/?i=RC-2026-014&a=125000&c=USD&x=…&s=…`
   The signature (HMAC-SHA256) covers invoice, amount, currency and expiry, so
   changing any of them makes the link invalid. Links expire (30 days by default).
2. **The client opens it.** The page shows the invoice read-only: express
   checkout (Apple Pay, Google Pay, PayPal) and "or pay with card".
3. **They click a method.** The page calls the Worker (`workers/pay`), which
   verifies the signature and expiry, refuses already-paid invoices, and asks
   the provider for a hosted checkout for exactly the signed amount. The browser
   is sent only to the provider's own hosts.
4. **The provider notifies the Worker** with a signed webhook. Only then, and
   only if amount and currency match, is the invoice marked paid (idempotent,
   so retries change nothing).
5. **The client lands on `/pay/success/`**, which asks the Worker for the
   status and shows "Payment received" once the webhook has confirmed it.

## Security design

- **No card data on our pages, ever.** Card numbers are entered only in the
  provider's hosted page or fields (PCI DSS SAQ A scope).
- **The browser is untrusted.** Amounts come from signed links; payment is
  confirmed only by the provider's signed webhook, never by a redirect.
- **Payment pages load only our own files.** No analytics, ad or other
  third-party scripts; strict CSP in each page. On Cloudflare Pages, `_headers`
  adds anti-framing, HSTS, no-store and no-referrer.
- **Worker:** CORS locked to the site origin, JSON only, 4 KB body limit,
  per-IP rate limit, test provider refused in production.

## Provider: PayPlus

Chosen because it accepts Israeli businesses and covers cards (including
international), Apple Pay, Google Pay and PayPal in one integration, verifies
callbacks with a signature, and can issue Israeli tax invoices automatically.
`workers/pay/src/providers/payplus.js` was written from PayPlus's public API
reference without access to their docs site; **every line marked `VERIFY` must be
checked against docs.payplus.co.il and tested in their sandbox before going live.**

With PayPlus, card details are entered on PayPlus's secure page (redirect or
embedded iframe). Before launch, replace the placeholder card boxes in
`pay/index.html` with PayPlus's embedded page, or turn the card section into
"email, name, Continue to card payment".

Brand marks in `icons/` come from Shopify's MIT-licensed
[payment_icons](https://github.com/activemerchant/payment_icons)
(`icons/LICENSE-payment_icons.txt`); the `*-logo.svg` / `paypal-monogram.svg`
files are cropped from those.

## Go-live checklist

1. **PayPlus account:** sign up, get sandbox API key, secret key and payment
   page UID; ask PayPlus support to enable Apple Pay, Google Pay and PayPal on
   the page, and to verify the domain for Apple Pay.
2. **Worker:** in `workers/pay`:
   ```
   npx wrangler kv namespace create PAYMENTS      # paste the id into wrangler.toml
   npx wrangler secret put PAY_LINK_SECRET         # 32+ random characters, e.g. `openssl rand -base64 48`
   npx wrangler secret put PAYPLUS_API_KEY
   npx wrangler secret put PAYPLUS_SECRET_KEY
   # set PAYPLUS_PAYMENT_PAGE_UID in wrangler.toml
   npx wrangler deploy
   ```
3. **Site:** set `apiOrigin` in `pay/config.js` to the Worker URL and add that
   origin to `connect-src` in the CSP of `pay/index.html` and
   `pay/success/index.html`. Set `checkoutHosts` to PayPlus's confirmed hosts.
4. **Sandbox test:** create a link, pay with PayPlus test cards and each wallet,
   confirm the webhook marks it paid, a tampered link is refused, and a second
   payment is refused.
5. **Production:** switch `PAYPLUS_API_URL` to production, update secrets,
   redeploy, make one small real payment and refund it.
6. **Privacy policy:** add PayPlus to the third-party services list in
   `tools/legal-content.cjs` and rebuild the legal pages.

## Moving hosting to Cloudflare Pages

GitHub Pages cannot send response headers. On Cloudflare Pages, `_headers` and
`_redirects` take effect:

1. Cloudflare dashboard → Workers & Pages → Create → Pages → connect
   `yuli0203/redcrown-site`, production branch `main`, no build command, output
   directory `/`.
2. Check the `*.pages.dev` preview, including `/pay/` response headers.
3. Custom domains → add `redcrowninteractive.com` and `www`; Cloudflare updates
   DNS if the domain is on Cloudflare, otherwise follow its DNS instructions.
4. After it serves correctly, disable GitHub Pages for the repository.

## Local development

```
node --test workers/pay/test/pay.test.js   # Worker tests
node tools/check_no_secrets.mjs            # secret scan
python3 -m http.server 8000                # then open a link made with PAY_BASE_URL=http://localhost:8000/pay/
```
