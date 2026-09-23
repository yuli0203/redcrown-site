#!/usr/bin/env node
// Fails if a tracked file looks like it contains a payment secret or private key.
// The repository is public: secrets belong in Worker secrets (wrangler secret put)
// or a git-ignored .dev.vars, never in git.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const NAMES = 'PAY_LINK_SECRET|PAYPLUS_API_KEY|PAYPLUS_SECRET_KEY|MOCK_WEBHOOK_SECRET|STRIPE_SECRET_KEY|PAYPAL_CLIENT_SECRET';
const PATTERNS = [
  // NAME = "long literal" / NAME: 'long literal'
  new RegExp(`(?:${NAMES})\\s*[=:]\\s*["'\`]?[A-Za-z0-9_+/=-]{20,}`),
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk_live_[A-Za-z0-9]{16,}/,
];
const ALLOW = new Set(['tools/check_no_secrets.mjs']);

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const hits = [];
for (const f of files) {
  if (ALLOW.has(f) || /\.(png|jpe?g|webp|gif|ico|pdf|woff2?|glb|gltf|mp4|webm|zip)$/i.test(f)) continue;
  let text;
  try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
  text.split('\n').forEach((line, i) => {
    if (PATTERNS.some(re => re.test(line))) hits.push(`${f}:${i + 1}`);
  });
}
for (const f of ['.dev.vars', '.env']) {
  if (files.some(t => t === f || t.endsWith('/' + f))) hits.push(`${f} is tracked`);
}
if (hits.length) {
  console.error('Possible secrets committed:\n  ' + hits.join('\n  '));
  process.exit(1);
}
console.log(`No secrets found in ${files.length} tracked files.`);
