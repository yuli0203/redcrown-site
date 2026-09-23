#!/usr/bin/env node
// Stamps the payment pages' CSS/JS URLs with a content hash (?v=<sha256:12>) so
// a browser can never mix a new page with a cached old stylesheet or script.
//   node tools/stamp_pay_assets.mjs          rewrite the stamps
//   node tools/stamp_pay_assets.mjs --check  fail if any stamp is stale (CI)
import { createHash } from 'node:crypto';
import fs from 'node:fs';

const PAGES = ['pay/index.html', 'pay/success/index.html'];
const ASSETS = ['/site.css', '/pay/pay.css', '/pay/config.js', '/pay/pay.js', '/pay/success/success.js'];
const check = process.argv.includes('--check');

const hash = file => createHash('sha256').update(fs.readFileSync('.' + file)).digest('hex').slice(0, 12);
const stamps = Object.fromEntries(ASSETS.map(a => [a, hash(a)]));

let stale = [];
for (const page of PAGES) {
  const before = fs.readFileSync(page, 'utf8');
  const after = before.replace(/(href|src)="(\/[^"?]+\.(?:css|js))(?:\?v=[^"]*)?"/g,
    (m, attr, url) => stamps[url] ? `${attr}="${url}?v=${stamps[url]}"` : m);
  if (after !== before) {
    if (check) stale.push(page);
    else fs.writeFileSync(page, after);
  }
}
if (stale.length) {
  console.error('Stale asset stamps in: ' + stale.join(', ') + '\nRun: node tools/stamp_pay_assets.mjs');
  process.exit(1);
}
console.log(check ? 'Payment asset stamps are current.' : 'Stamped payment assets.');
