# Payments, payment requests and receipts

Everything from "send the client a bill" to "receipt in both inboxes":

1. **You create a payment request** (חשבון עסקה) on your admin page
   (`https://<worker>/admin`): client details, line items, currency. The client
   gets an email with the PDF and a secure pay link; you get a copy.
2. **The client pays** on `redcrowninteractive.com/pay/` by card, Bit, Apple
   Pay or Google Pay, on Grow's secure payment page (card details are entered
   only there). A checkbox asks them to agree to the terms and to receive tax
   documents by email (required by law for emailed receipts).
3. **The payment is confirmed server to server**: Grow's notification is
   checked by asking Grow directly, and the amount must match. A second
   payment of the same request is recorded as a duplicate and you are
   alerted to refund it.
4. **Grow issues the receipt (קבלה)**, digitally signed by Grow, and emails it
   to the client. You get an email that the payment arrived; the admin page
   shows Grow's receipt number with the request.
5. **Money received directly** (bank transfer, cheque, cash): issue the
   receipt in Grow's dashboard, so all your receipts are one numbered series.

The earlier setup (PayPal, with receipts issued and signed here with your own
key) is still in the code: set `PROVIDER = "paypal"` in `wrangler.toml` to use
it (see [PayPal instead of Grow](#paypal-instead-of-grow)). It is also kept as
commit `9258cd1`.

**Not live yet**: `apiOrigin` in `pay/config.js` is empty, so the pay buttons
show "not enabled yet" and nothing is charged. See [Go-live](#go-live).

This repository is **public**. No secret ever goes in it: keys, your ID number
and the signing certificate live only in Cloudflare. `tools/check_no_secrets.mjs`
runs in CI and fails if one is committed.

## Legal: what the system does, and what you do

Written against הוראות מס הכנסה (ניהול פנקסי חשבונות), תשל"ג-1973. Not legal
advice: go over this list with your accountant once before the first real
receipt.

**Every receipt carries** (סעיף 5): a running number; your name and ID number;
the date; the payer's name and address; the amount; what it was for (the
payment request and its line items) with the payment method details
(transaction ID, or bank, branch, account, cheque number); and the signature.
It is marked **מקור** (the one original, for the payer), **העתק** (your copy)
or **העתק נאמן למקור** (any later reprint). Foreign-currency receipts also
show the ILS value at the Bank of Israel representative rate.

**Numbering and records**: numbers are allocated by one Durable Object, so they
are unique and gap-free. A receipt cannot be edited or deleted, and its stored
PDF is written once. Keep records for 7 years: export the CSV monthly
(admin page → Documents) and keep the copies that arrive by email.

**With Grow** (the default), Grow issues, numbers and digitally signs the
receipts in its registered system, and emails them. What stays with you: the
client's consent (the pay page requires it and records it with the payment),
and asking your accountant whether you still need to notify your פקיד שומה.
The rest of this section applies to the PayPal setup, where this system
issues the receipts itself.

**Emailed receipts** (סעיף 18ב) are legal only when all of these hold:

1. **Signed electronically by you.** A computerized document may carry a
   *secured* (חתימה אלקטרונית מאובטחת) or a *certified* (מאושרת) signature.
   - **Default: your own key (secured, free).** `tools/create-signing-key.mjs`
     creates a key and certificate naming you and your business number, on
     your computer; the key is kept only as a Worker secret, under your sole
     control, and any change to a signed receipt breaks the signature.
     **Confirm with your accountant** that a secured signature is acceptable
     for your receipts before relying on it: sources differ on whether some
     cases require a certified one, and one reading limits secured signatures
     to receipts for card, cheque and bank-transfer payments (which is what
     this system takes online).
   - **Alternative: a certified signature** from Comsign or Personal ID, as a
     file a server can use (.p12/.pfx), imported with
     `tools/import-certificate.mjs`. A smart card or USB token does not work
     for automatic signing: the key never leaves the device, so it would have
     to be plugged into a computer that is on whenever a client pays.
2. **Your פקיד שומה was notified** by registered mail before the first emailed
   receipt. Draft below.
3. **The client consented** before the first document. The pay page requires
   the checkbox (the Worker refuses a checkout without it) and records it with
   the receipt; for direct payments, tick the box on the admin form and note
   how they agreed.
4. The document says **מסמך ממוחשב**. Done automatically when signed.

Software you develop for your own use does not need Tax Authority
registration (only software sold or rented to others does), but it must
follow the computerized bookkeeping rules above.

**Until a signing key is installed** (or, for a direct payment, when the client did not consent): the
client gets a payment confirmation (not a tax document), and you get the
original receipt PDF by email. Print it, sign it, and hand or mail it to the
client. Everything else works the same.

### Draft notice to your פקיד שומה (registered mail)

> לכבוד פקיד השומה ________
>
> הנדון: הודעה על משלוח מסמכים ממוחשבים, לפי סעיף 18ב להוראות מס הכנסה
> (ניהול פנקסי חשבונות), תשל"ג-1973
>
> הריני להודיעך כי החל מיום ________ אשלח ללקוחותיי קבלות כמסמכים ממוחשבים,
> חתומים בחתימה אלקטרונית מאובטחת, באמצעות מערכת שפותחה לשימושי העצמי.
>
> שם: ________  ת"ז / מס' עוסק פטור: ________  כתובת: ________
>
> בכבוד רב, ________  תאריך: ________

## Costs

- **Cloudflare Workers Free: $0.** Receipts are filled into a prebuilt PDF
  template (`workers/pay/tools/build-pdf-template.mjs`: fonts and logo prepared
  once) and signed with the platform's native crypto, so a payment, with two
  signed receipts, takes about 5 ms of CPU; the free plan allows 10 ms per
  request. (Workers Paid, $5/month, is only needed if that ever grows.)
- **Grow:** a monthly plan plus a percentage per payment (published: ₪59–69 a
  month, 0.75% Israeli cards, 3.5% foreign cards, documents included). **Ask
  Grow whether API access is included in your plan**, and the price if not.
  Grow charges in shekels only, so payment requests are in ILS.
- **PayPal** (alternative): per-transaction fees only.
- **Resend** (email): free tier, 3,000 emails a month.
- **Signing:** included with Grow. With PayPal: ₪0 with your own key.

## Go-live

In order. Commands run in `workers/pay` after `npm ci`.

1. **Grow account**: sign up at grow.business and ask Grow support:
   - to enable the **Light API** (createPaymentProcess) with a **sandbox**, and
     for your sandbox `userId` and page codes (card, and Bit, Apple Pay, Google
     Pay if you want them);
   - whether API access is included in your plan, and its price;
   - that receipts are issued automatically for API payments, and whether they
     can be in English for clients abroad.
2. **Cloudflare** (the free plan is enough): create the KV namespace and
   paste its id into `wrangler.toml`:
   `npx wrangler kv namespace create PAYMENTS`
3. **Secrets** (`npx wrangler secret put <NAME>` for each; never paste them in
   a chat or an email):
   - `PAY_LINK_SECRET`, `ADMIN_TOKEN`: 32+ random characters each
     (`openssl rand -base64 48`). Keep `ADMIN_TOKEN` in your password manager.
   - `OWNER_NAME`, `BUSINESS_ID`, `BUSINESS_ADDRESS`: printed on your payment
     requests (the address is a secret because this repository is public)
   - `GROW_USER_ID`, `GROW_PAGE_CODE`, and `GROW_PAGE_CODE_BIT`,
     `GROW_PAGE_CODE_APPLEPAY`, `GROW_PAGE_CODE_GOOGLEPAY` for the methods Grow
     gave you page codes for
   - `RESEND_API_KEY` (step 5)
   Check `BUSINESS_PHONE` and the emails in `wrangler.toml`.
4. **Deploy:** `npx wrangler deploy`. Open `https://<worker>/admin` and unlock
   it with `ADMIN_TOKEN`. Optional but recommended: put Cloudflare Access
   (free) in front of `/admin*` for a real login.
5. **Email:** create a Resend account, add `redcrowninteractive.com`, add the
   DNS records it shows at Porkbun (DKIM and a `send` subdomain; Google
   Workspace mail is unaffected), set `RESEND_API_KEY`.
6. **Site:** set `apiOrigin` in `pay/config.js` to the Worker URL (and remove
   from `methods` any method Grow did not give you), add that origin to
   `connect-src` in the CSP of `pay/index.html` and `pay/success/index.html`,
   run `node tools/stamp_pay_assets.mjs`, push.
7. **Sandbox test:** create a request in ILS to yourself (add your Israeli
   mobile number), pay it with Grow's test card `4580458045804580`; check that
   the payment shows as paid, Grow's receipt arrives, your notice arrives, and
   paying again is refused. Bit, Apple Pay and Google Pay have no sandbox:
   they charge for real, so test them only after going live, with a small amount.
8. **Production review:** Grow checks the integration and the site before
   giving production identifiers. The site must show a phone number, the
   business address (on the site or in the terms), and terms that cover
   delivery, liability, minimum age (18), cancellation and privacy; the pay
   page's checkbox links to them. Then set `GROW_API_URL` to
   `https://secure.meshulam.co.il/api/light/server/1.0`, put the production
   identifiers in the secrets, redeploy, and make one small real payment.

### PayPal instead of Grow

Set `PROVIDER = "paypal"`, set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`,
and restore PayPal's buttons and hosts on the pay page (`pay/index.html`,
`pay/config.js` as of commit `9258cd1`). Receipts are then issued here:

1. **First receipt number:** admin page → Settings (the number after your
   last existing receipt).
2. **PayPal:** in your business account, Account Settings → Website payments →
   Website preferences → Update → turn on **PayPal account optional**. At
   developer.paypal.com create a REST app (sandbox first), add the webhook
   `https://<worker>/webhook/paypal` for `PAYMENT.CAPTURE.COMPLETED` and put its
   ID in `PAYPAL_WEBHOOK_ID`. Live: `PAYPAL_API_URL = "https://api-m.paypal.com"`.
3. **Signing key**, then the registered letter (draft above). Once your
   accountant has confirmed the secured signature, create your key on your
   own computer (nothing is written into the repository):
   ```
   node tools/create-signing-key.mjs --name "Julia Pavlov" --id <business number> \
        --email julia@redcrowninteractive.com
   # then run the two commands it prints, keep signing-cert.pem, delete the key file
   ```
   With a certified certificate instead, convert it once:
   ```
   read -rs P12_PASSWORD; export P12_PASSWORD
   node tools/import-certificate.mjs ~/your-certificate.p12
   ```

## Security

- **No card data on our pages, ever** (PCI DSS SAQ A scope). Card numbers are
  entered only on the provider's page.
- **The browser is untrusted.** Amounts come from payment requests via signed
  links; payment is confirmed only server to server, never by a redirect.
  Grow's notifications are not signed, so each one is checked by asking Grow
  (with the process token only we and Grow have), and the amount must match.
- **One payment per request**: a paid request cannot be checked out again.
  With PayPal, a second window is never captured; with Grow (which charges on
  its page) a second payment is recorded as a duplicate and you are alerted.
- **Payment pages load only our own files**, with a strict CSP; `pay.js`
  refuses to run inside a frame (GitHub Pages cannot send anti-framing
  headers; `_headers` adds them on Cloudflare Pages).
- **Admin**: bearer token (constant-time check), same-origin writes, strict
  CSP, no framing; add Cloudflare Access for a login.
- **Worker**: CORS locked to the site, request size limits, per-IP rate limit,
  the test provider refused in production.

## Files

- `workers/pay/src/index.js`: checkout, provider return and webhook, status
- `workers/pay/src/ledger.js`, `worker.js`: numbering, documents, payment claims (Durable Object)
- `workers/pay/src/documents.js`, `bidi.js`: the PDFs (Hebrew and English)
- `workers/pay/src/pdf.js`, `pdf-template.js`: a small PDF writer over a prebuilt
  template (generated by `tools/build-pdf-template.mjs`; do not edit)
- `workers/pay/src/sign.js`: digital signature (Web Crypto; the key is prepared
  once by `tools/import-certificate.mjs`)
- `workers/pay/src/receipts.js`, `mail.js`: receipt issuing and emails
- `workers/pay/src/admin.js`, `admin-ui.js`: the admin page and its API
- `workers/pay/src/providers/grow.js`: Grow's Light API (payment page, confirmation, receipts)
- `workers/pay/src/providers/paypal.js`: PayPal Orders v2 (`payplus.js` is an untested alternative)
- `workers/pay/assets/`: IBM Plex Sans Hebrew (SIL OFL) and the logo, built
  into the PDF template by `tools/build-pdf-template.mjs`

Brand marks in `pay/icons/` (card brands, PayPal, Apple Pay, Google Pay) come from Shopify's MIT-licensed
[payment_icons](https://github.com/activemerchant/payment_icons).

## Local development

```
cd workers/pay && npm ci
node --test test/pay.test.js                 # full flow with a test ledger
node tools/build-pdf-template.mjs            # after changing assets/
node ../../tools/stamp_pay_assets.mjs        # after editing pay CSS/JS (from the repo root)
```

To click through everything locally, create `workers/pay/.dev.vars` (git-ignored)
with test values (`PAY_LINK_SECRET`, `ADMIN_TOKEN`, `OWNER_NAME`, `BUSINESS_ID`, `BUSINESS_ADDRESS`,
`ENVIRONMENT=test`, `PROVIDER=mock`, `MOCK_WEBHOOK_SECRET`,
`SITE_URL=http://localhost:8000`, `ALLOWED_ORIGIN=http://localhost:8000`,
`BOI_RATES=off`), run `npx wrangler dev` and `python3 -m http.server 8000` in the
repo root, and open `http://localhost:8787/admin`.
