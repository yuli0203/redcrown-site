#!/usr/bin/env node
// Create a signed payment link for an invoice.
//
//   PAY_LINK_SECRET=... node tools/pay-link.mjs RC-2026-014 1250 USD [days=30]
//
// The secret must be the same value stored in the Worker with
// `npx wrangler secret put PAY_LINK_SECRET`. Keep it in a password manager or a
// local, git-ignored .env file. Never commit it: this repository is public.
import { sign, toQuery } from '../workers/pay/src/links.js';

const [invoice, amount, currency, days = '30'] = process.argv.slice(2);
const secret = process.env.PAY_LINK_SECRET;
const base = process.env.PAY_BASE_URL || 'https://redcrowninteractive.com/pay/';

if (!invoice || !amount || !currency) {
  console.error('Usage: PAY_LINK_SECRET=... node tools/pay-link.mjs <invoice> <amount> <ILS|USD|EUR|GBP> [valid-days]');
  process.exit(2);
}
if (!secret) {
  console.error('PAY_LINK_SECRET is not set.');
  process.exit(2);
}
if (!/^\d{1,7}(\.\d{1,2})?$/.test(amount)) {
  console.error('Amount must look like 1250 or 1250.50.');
  process.exit(2);
}
// Parse "1250.5" as 125050 minor units without floating-point rounding.
const [whole, frac = ''] = amount.split('.');
const amountMinor = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
const expires = Math.floor(Date.now() / 1000) + Math.round(Number(days) * 86400);

try {
  const signed = await sign({ invoice, amountMinor, currency, expires }, secret);
  console.log(base + '?' + toQuery(signed));
  console.error(`Valid until ${new Date(expires * 1000).toISOString().slice(0, 10)}.`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
