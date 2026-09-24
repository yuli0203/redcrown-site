#!/usr/bin/env node
// Creates your own signing key and certificate for receipts: a secured
// electronic signature (חתימה אלקטרונית מאובטחת) under the Electronic Signature
// Law, which סעיף 18ב of the bookkeeping regulations accepts for computerized
// documents alongside a certified one. The key is:
//   - unique to you and under your sole control: it is generated here, on your
//     computer, and stored only as a Worker secret (never in this repository);
//   - identifying: the certificate names you, your business and your business
//     number, and its fingerprint can be published so anyone can check it;
//   - tamper-evident: any change to a signed receipt breaks the signature.
//
//   node tools/create-signing-key.mjs --name "Julia Pavlov" --id 312811474 \
//        --email julia@redcrowninteractive.com
//
// Writes the same two files as tools/import-certificate.mjs, to a private temp
// folder, and prints the upload commands and the certificate fingerprint.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import forge from 'node-forge';

// Returns { key (PKCS#8 base64), certJson (for KV "signing:cert"), certPem, fingerprint }.
export function createSigningKey({ name, businessId, organization = 'Red Crown Interactive', email = '', locality = 'Haifa', country = 'IL', years = 5, bits = 3072 }) {
  if (!name || !businessId) throw new Error('name and business number are required');
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: bits });
  const keyDer = privateKey.export({ type: 'pkcs8', format: 'der' });
  const keys = forge.pki.privateKeyFromPem(privateKey.export({ type: 'pkcs8', format: 'pem' }));

  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.setRsaPublicKey(keys.n, keys.e);
  cert.serialNumber = '01' + crypto.randomBytes(15).toString('hex');   // positive, 16 bytes
  const now = new Date();
  cert.validity.notBefore = new Date(now.getTime() - 60_000);
  cert.validity.notAfter = new Date(now.getTime());
  cert.validity.notAfter.setFullYear(now.getFullYear() + years);
  const subject = [
    { name: 'commonName', value: name },
    { name: 'organizationName', value: organization },
    { shortName: 'L', value: locality },
    { name: 'countryName', value: country },
    { type: '2.5.4.5', value: String(businessId) },           // serialNumber: עוסק / ת.ז. number
    ...(email ? [{ name: 'emailAddress', value: email }] : []),
  ];
  cert.setSubject(subject);
  cert.setIssuer(subject);                                    // self-issued: no certifying authority
  cert.setExtensions([
    { name: 'basicConstraints', cA: false, critical: true },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true, critical: true },
    { name: 'extKeyUsage', emailProtection: true },
    { name: 'subjectKeyIdentifier' },
  ]);
  cert.sign(keys, forge.md.sha256.create());

  const certDer = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), 'binary');
  const fingerprint = crypto.createHash('sha256').update(certDer).digest('hex').toUpperCase().match(/../g).join(':');
  return {
    key: keyDer.toString('base64'),
    certJson: JSON.stringify({ alg: 'RSA', certs: [certDer.toString('base64')] }),
    certPem: forge.pki.certificateToPem(cert),
    fingerprint,
  };
}

// ---- Command line
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = flag => {
    const i = process.argv.indexOf('--' + flag);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const name = arg('name'), businessId = arg('id');
  if (!name || !businessId) {
    console.error('Usage: node tools/create-signing-key.mjs --name "Your Name" --id <business number> [--email you@example.com] [--org "Business name"] [--years 5]');
    process.exit(2);
  }
  const out = createSigningKey({ name, businessId, email: arg('email') || '', organization: arg('org') || undefined, years: Number(arg('years')) || 5 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-signing-'));
  fs.writeFileSync(path.join(dir, 'signing-key.b64'), out.key, { mode: 0o600 });
  fs.writeFileSync(path.join(dir, 'signing-cert.json'), out.certJson);
  fs.writeFileSync(path.join(dir, 'signing-cert.pem'), out.certPem);
  console.log(`Signing key created for ${name} (${businessId}).`);
  console.log(`Certificate fingerprint (SHA-256):\n  ${out.fingerprint}`);
  console.log(`\nIn workers/pay, run:\n`);
  console.log(`  npx wrangler secret put SIGNING_KEY < ${path.join(dir, 'signing-key.b64')}`);
  console.log(`  npx wrangler kv key put --binding PAYMENTS --remote "signing:cert" --path ${path.join(dir, 'signing-cert.json')}`);
  console.log(`\nKeep ${path.join(dir, 'signing-cert.pem')} (public: it lets anyone verify your receipts),`);
  console.log(`then delete the key file:  rm ${path.join(dir, 'signing-key.b64')}`);
}
