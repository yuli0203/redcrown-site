#!/usr/bin/env node
// Converts your signing certificate (.p12 / .pfx) once, on your computer, into
// what the Worker uses at runtime (see src/sign.js):
//   signing-key.b64   private key (PKCS#8, base64)  -> Worker secret SIGNING_KEY
//   signing-cert.json your certificate and chain     -> KV key "signing:cert"
//
//   read -rs P12_PASSWORD; export P12_PASSWORD
//   node tools/import-certificate.mjs ~/your-certificate.p12
//
// The files go to a fresh private temp folder, never into this (public)
// repository. The script checks that the key matches the certificate and
// prints the two upload commands; delete the folder afterwards.
//
// RSA certificates (the usual kind) are handled here. For an EC certificate,
// convert with OpenSSL instead (commands in pay/README.md).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import forge from 'node-forge';

const file = process.argv[2];
const password = process.env.P12_PASSWORD;
if (!file || password === undefined) {
  console.error('Usage: read -rs P12_PASSWORD; export P12_PASSWORD; node tools/import-certificate.mjs <certificate.p12>');
  process.exit(2);
}

const der = fs.readFileSync(file).toString('binary');
let p12;
try {
  p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), password);
} catch (e) {
  console.error('Could not open the certificate file (wrong password, or an EC certificate: see pay/README.md).', e.message);
  process.exit(1);
}
const bagsOf = type => Object.values(p12.getBags({ bagType: type })).flat();
const keyBag = [...bagsOf(forge.pki.oids.pkcs8ShroudedKeyBag), ...bagsOf(forge.pki.oids.keyBag)][0];
if (!keyBag?.key) {
  console.error('No RSA private key found in the file. For an EC certificate, see pay/README.md.');
  process.exit(1);
}
const keyDer = Buffer.from(forge.asn1.toDer(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(keyBag.key))).getBytes(), 'binary');
const certs = bagsOf(forge.pki.oids.certBag).map(b => Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(b.cert)).getBytes(), 'binary'));

// Put the certificate that matches the key first; the rest is its chain.
const privateKey = crypto.createPrivateKey({ key: keyDer, format: 'der', type: 'pkcs8' });
const probe = Buffer.from('red-crown-signing-check');
const sig = crypto.sign('sha256', probe, privateKey);
const own = certs.findIndex(c => crypto.verify('sha256', probe, new crypto.X509Certificate(c).publicKey, sig));
if (own < 0) {
  console.error('None of the certificates in the file matches its private key.');
  process.exit(1);
}
const ordered = [certs[own], ...certs.filter((_, i) => i !== own)];
const x509 = new crypto.X509Certificate(ordered[0]);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-signing-'));
fs.writeFileSync(path.join(dir, 'signing-key.b64'), keyDer.toString('base64'), { mode: 0o600 });
fs.writeFileSync(path.join(dir, 'signing-cert.json'), JSON.stringify({ alg: 'RSA', certs: ordered.map(c => c.toString('base64')) }));

console.log(`Certificate: ${x509.subject.replace(/\n/g, ', ')}`);
console.log(`Valid until: ${x509.validTo}`);
console.log(`\nIn workers/pay, run:\n`);
console.log(`  npx wrangler secret put SIGNING_KEY < ${path.join(dir, 'signing-key.b64')}`);
console.log(`  npx wrangler kv key put --binding PAYMENTS --remote "signing:cert" --path ${path.join(dir, 'signing-cert.json')}`);
console.log(`  rm -r ${dir}`);
