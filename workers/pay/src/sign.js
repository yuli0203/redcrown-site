// Digital signature for receipts (סעיף 18ב: a receipt sent by email must carry
// a secured or certified electronic signature made with the business owner's
// own key).
//
// The certificate comes from a licensed certifying authority (Comsign or
// Personal ID) as a .p12/.pfx file. It is converted once, on your computer, by
// tools/import-certificate.mjs into:
//   - SIGNING_KEY (Worker secret): the private key, PKCS#8, base64
//   - "signing:cert" (KV, public data): { alg, namedCurve?, certs: [base64 DER] },
//     your certificate first, then its chain
// so the Worker never unpacks a .p12 (slow in JavaScript). Signing uses the
// platform's Web Crypto: one native RSA or ECDSA operation per receipt.
//
// The signature is a detached CMS SignedData (adbe.pkcs7.detached), with the
// content-type, signing-time, message-digest and signing-certificate-v2
// attributes, written into the placeholder documents.js leaves in the PDF.
//
// If your certificate lives on the authority's signing server instead of in a
// file, this module is the one place to connect its API.

const fromB64 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const fromHex = h => Uint8Array.from(h.match(/../g), x => parseInt(x, 16));
const toHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const concat = parts => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

// ---- DER
const derLen = n => (n < 0x80 ? Uint8Array.of(n)
  : n < 0x100 ? Uint8Array.of(0x81, n)
  : n < 0x10000 ? Uint8Array.of(0x82, n >> 8, n & 255)
  : Uint8Array.of(0x83, n >> 16, (n >> 8) & 255, n & 255));
const tlv = (tag, ...contents) => { const body = concat(contents); return concat([Uint8Array.of(tag), derLen(body.length), body]); };
const seq = (...c) => tlv(0x30, ...c);
const set = (...c) => tlv(0x31, ...c);
const octets = b => tlv(0x04, b);
const oid = hex => tlv(0x06, fromHex(hex));
const NULL = Uint8Array.of(0x05, 0x00);
const int = bytes => {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0 && !(bytes[i + 1] & 0x80)) i++;
  const b = bytes.subarray(i);
  return tlv(0x02, b[0] & 0x80 ? concat([Uint8Array.of(0), b]) : b);
};
const utcTime = d => tlv(0x17, new TextEncoder().encode(d.toISOString().replace(/[-:T]/g, '').slice(2, 14) + 'Z'));

const OID = {
  sha256: '608648016503040201',
  rsaEncryption: '2a864886f70d010101',
  ecdsaWithSHA256: '2a8648ce3d040302',
  data: '2a864886f70d010701',
  signedData: '2a864886f70d010702',
  contentType: '2a864886f70d010903',
  messageDigest: '2a864886f70d010904',
  signingTime: '2a864886f70d010905',
  signingCertificateV2: '2a864886f70d010910022f',
};

// Reads one TLV at `pos`: returns its full bytes and the content range.
function readTlv(bytes, pos) {
  let len = bytes[pos + 1], hdr = 2;
  if (len & 0x80) {
    const k = len & 0x7F;
    len = 0;
    for (let i = 0; i < k; i++) len = len * 256 + bytes[pos + 2 + i];
    hdr += k;
  }
  return { tag: bytes[pos], start: pos + hdr, end: pos + hdr + len, raw: bytes.subarray(pos, pos + hdr + len) };
}

// Certificate -> DER of its issuer Name and serial number INTEGER.
function issuerAndSerial(cert) {
  const tbs = readTlv(cert, readTlv(cert, 0).start);
  let p = tbs.start;
  let t = readTlv(cert, p);
  if (t.tag === 0xA0) { p = t.end; t = readTlv(cert, p); }  // explicit version
  const serial = t.raw;
  const sigAlg = readTlv(cert, t.end);
  const issuer = readTlv(cert, sigAlg.end).raw;
  return seq(issuer, serial);
}

// ECDSA from Web Crypto is r||s; CMS wants SEQUENCE { INTEGER r, INTEGER s }.
const ecdsaDer = raw => seq(int(raw.subarray(0, raw.length / 2)), int(raw.subarray(raw.length / 2)));

// ---- Loading the key (once per isolate)
let cached = null;

export async function loadSigner(env) {
  if (!env.SIGNING_KEY || !env.PAYMENTS) return null;
  const certJson = await env.PAYMENTS.get('signing:cert');
  if (!certJson) return null;
  const cacheKey = env.SIGNING_KEY + '\n' + certJson;
  if (cached?.cacheKey === cacheKey) return cached.signer;

  const { alg, namedCurve, certs } = JSON.parse(certJson);
  const algorithm = alg === 'EC' ? { name: 'ECDSA', namedCurve } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  const key = await crypto.subtle.importKey('pkcs8', fromB64(env.SIGNING_KEY.trim()), algorithm, false, ['sign']);
  const chain = certs.map(fromB64);
  const signer = {
    alg,
    key,
    chain,
    sid: issuerAndSerial(chain[0]),
    certHash: new Uint8Array(await crypto.subtle.digest('SHA-256', chain[0])),
  };
  cached = { cacheKey, signer };
  return signer;
}

// Signs a PDF built with a signature placeholder: { bytes, placeholder } from
// documents.js. Returns the signed PDF bytes.
export async function signPdf({ bytes, placeholder }, signer) {
  const { byteRangeAt, contentsAt, contentsEnd } = placeholder;
  const enc = new TextEncoder();

  // 1. ByteRange: everything except the <...> hex of /Contents.
  const range = `[0 ${contentsAt} ${contentsEnd} ${bytes.length - contentsEnd}]`;
  const slot = '[0 ********** ********** **********]';
  bytes.set(enc.encode(range.padEnd(slot.length, ' ')), byteRangeAt);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',
    concat([bytes.subarray(0, contentsAt), bytes.subarray(contentsEnd)])));

  // 2. Signed attributes (DER SET OF: sorted by encoding).
  const attr = (type, value) => seq(oid(type), set(value));
  const attrs = [
    attr(OID.contentType, oid(OID.data)),
    attr(OID.signingTime, utcTime(new Date())),
    attr(OID.messageDigest, octets(digest)),
    attr(OID.signingCertificateV2, seq(seq(seq(octets(signer.certHash))))),
  ].sort((a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; });
  const signedAttrs = set(...attrs);

  // 3. One native signature over the attributes.
  const ec = signer.alg === 'EC';
  const raw = new Uint8Array(await crypto.subtle.sign(ec ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' }, signer.key, signedAttrs));
  const signature = ec ? ecdsaDer(raw) : raw;

  // 4. CMS SignedData, detached.
  const sha256 = seq(oid(OID.sha256), NULL);
  const signerInfo = seq(
    int(Uint8Array.of(1)),
    signer.sid,
    sha256,
    tlv(0xA0, signedAttrs.subarray(readTlv(signedAttrs, 0).start)),   // [0] IMPLICIT
    ec ? seq(oid(OID.ecdsaWithSHA256)) : seq(oid(OID.rsaEncryption), NULL),
    octets(signature),
  );
  const signedData = seq(
    int(Uint8Array.of(1)),
    set(sha256),
    seq(oid(OID.data)),
    tlv(0xA0, ...signer.chain),                                         // certificates
    set(signerInfo),
  );
  const cms = seq(oid(OID.signedData), tlv(0xA0, signedData));

  const room = contentsEnd - contentsAt - 2;
  const hex = toHex(cms);
  if (hex.length > room) throw new Error('signature does not fit its placeholder');
  bytes.set(enc.encode(hex), contentsAt + 1);
  return bytes;
}
