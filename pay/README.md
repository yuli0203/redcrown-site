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
2. **The client opens it.** The page shows the invoice read-only and PayPal's
   standard buttons: **PayPal** and **Debit or Credit Card**.
3. **They click one.** The page calls the Worker (`workers/pay`), which verifies
   the signature and expiry, refuses already-paid invoices, and creates a PayPal
   order for exactly the signed amount. The browser goes to PayPal: to log in,
   or straight to PayPal's guest card form.
4. **PayPal sends them back to the Worker,** which captures the payment with our
   API credentials and records it only if amount and currency match
   (idempotent, so repeats change nothing). A verified PayPal webhook does the
   same if the client closes the window before returning.
5. **The client lands on `/pay/success/`**, which shows "Payment received" once
   the Worker has recorded it.
6. **You get an email** with invoice, amount, PayPal fee, net, payer name and
   email, and transaction ID: everything the receipt (קבלה) needs. PayPal's own
   "you've got money" email arrives too.

The site footer links "Pay an Invoice" to `/pay/`. Without a link it shows
"use the payment link from your invoice" and the email for bank transfer.

## One payment per invoice

- Checkout refuses an invoice that is already paid.
- If the client opened the link twice and pays in the second window after the
  first one paid, the Worker **does not capture** the second PayPal order. An
  approved but uncaptured order is never collected, so they are not charged;
  the success page says the invoice was already paid.
- If two captures still race (Cloudflare KV has no locking), the second is
  stored as `duplicate:<ref>`, the client is told it will be refunded, and you
  get an email titled **ACTION: duplicate payment … refund it**. Refund it in
  PayPal. Making this impossible rather than rare needs a Durable Object lock;
  not worth it at invoice volumes.

## Receipts and records

As עוסק פטור you issue a קבלה for every payment; PayPal's receipt does not
replace it. Use the payment email. The Worker also keeps a record per invoice:

```
cd workers/pay
npx wrangler kv key list --binding PAYMENTS --remote --prefix paid:
npx wrangler kv key get  --binding PAYMENTS --remote "paid:RC-2026-014"
npx wrangler kv key list --binding PAYMENTS --remote --prefix duplicate:
```

Every payment is also in Workers Logs (Cloudflare dashboard → the Worker →
Logs). Payments count toward the עוסק פטור yearly turnover ceiling at the
amount received, before PayPal fees.

## Security design

- **No card data on our pages, ever.** Card numbers are entered only at PayPal
  (PCI DSS SAQ A scope).
- **The browser is untrusted.** Amounts come from signed links; payment is
  confirmed only server-to-server (our capture call, or a verified webhook),
  never by a redirect.
- **Payment pages load only our own files.** No analytics, ad or other
  third-party scripts; strict CSP in each page. On Cloudflare Pages, `_headers`
  adds anti-framing, HSTS, no-store and no-referrer.
- **Framing:** GitHub Pages cannot send anti-framing headers, so `pay.js`
  refuses to activate the buttons inside a frame (clickjacking guard) and
  offers a link to open the page directly. `_headers` adds the real headers
  once the site is on Cloudflare Pages.
- **Worker:** CORS locked to the site origin, JSON only, 4 KB body limit,
  per-IP rate limit, test provider refused in production.

## Provider: PayPal

No monthly fee; PayPal charges per transaction (check PayPal Israel's current
rates, including cross-border and currency conversion). Clients pay with a
PayPal account or, via guest checkout, by card without one. PayPal decides per
buyer whether the guest card form is offered (location, risk, history), so a
few buyers may be asked to log in or create an account. The page says so and
offers bank transfer instead of promising card-without-account. No Apple Pay or Google
Pay. `workers/pay/src/providers/payplus.js` remains as an alternative (PayPlus:
Israeli processor with Apple Pay and Google Pay, monthly fees); it is untested
and its `VERIFY` lines must be checked before use.

Brand marks in `icons/` come from Shopify's MIT-licensed
[payment_icons](https://github.com/activemerchant/payment_icons)
(`icons/LICENSE-payment_icons.txt`); `paypal-monogram.svg` is cropped from them.

## Go-live checklist

1. **PayPal business account (Israel):** confirm your email, then Account
   Settings → Website payments → Website preferences → Update, and turn on
   **PayPal account optional** (guest checkout by card; PayPal Israel supports
   it, but offers it per buyer).
2. **PayPal app:** at developer.paypal.com create a REST app; note the sandbox
   client ID and secret. Create sandbox business and personal test accounts.
3. **Worker:** in `workers/pay`:
   ```
   npx wrangler kv namespace create PAYMENTS      # paste the id into wrangler.toml
   npx wrangler secret put PAY_LINK_SECRET         # 32+ random characters, e.g. `openssl rand -base64 48`
   npx wrangler secret put PAYPAL_CLIENT_ID
   npx wrangler secret put PAYPAL_CLIENT_SECRET
   npx wrangler deploy
   ```
4. **Payment emails:** create a free account at resend.com, add the domain
   `redcrowninteractive.com`, and add the DNS records it shows at Porkbun
   (DKIM and a `send` subdomain; your Google Workspace mail is not affected).
   Then `npx wrangler secret put RESEND_API_KEY` and redeploy. Without the key
   payments are only logged, not emailed. `NOTIFY_TO` / `NOTIFY_FROM` are in
   `wrangler.toml`.
5. **Webhook:** in the PayPal app add `https://<worker>/webhook/paypal` for
   `PAYMENT.CAPTURE.COMPLETED`; put its webhook ID in `PAYPAL_WEBHOOK_ID` in
   `wrangler.toml` and redeploy.
6. **Site:** set `apiOrigin` in `pay/config.js` to the Worker URL, add that
   origin to `connect-src` in the CSP of `pay/index.html` and
   `pay/success/index.html`, then run `node tools/stamp_pay_assets.mjs`.
7. **Sandbox test:** create a link; pay with a sandbox PayPal account and with a
   test card via Debit or Credit Card; confirm "Payment received", the payment
   email (with fee and payer), that a tampered link is refused, and that
   opening the link in two windows and paying in both charges only once.
8. **Live:** set `PAYPAL_API_URL` to `https://api-m.paypal.com`, put the live
   client ID/secret and live webhook ID in place, redeploy, make one small real
   payment and refund it.
9. **Privacy policy:** done. The live English, Hebrew and Russian pages under
   `legal/`, `he/legal/` and `ru/legal/` name PayPal, Cloudflare and the email
   provider. (Do not run `tools/build-legal.cjs` for this: it generates a
   different, unreleased legal design and rewrites the homepage footer.)

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
node tools/stamp_pay_assets.mjs            # after editing pay CSS/JS: refresh ?v= stamps
python3 -m http.server 8000
# Local preview link (a throwaway random secret is fine for viewing; only the
# Worker checks signatures):
PAY_LINK_SECRET=$(openssl rand -hex 32) \
PAY_BASE_URL=http://localhost:8000/pay/ node tools/pay-link.mjs RC-2026-014 1250 USD 365
```
