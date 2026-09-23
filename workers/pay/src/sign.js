// Digital signature for receipts (סעיף 18ב: a receipt sent by email must carry
// a secured or certified electronic signature made with the business owner's
// own key).
//
// The certificate is a PKCS#12 (.p12 / .pfx) file issued to you by a licensed
// certifying authority (Comsign or Personal ID). It is stored in the PAYMENTS
// KV namespace under "signing:p12" (base64), and its password in the
// SIGNING_P12_PASSWORD secret; see pay/README.md. Without both, receipts are
// issued unsigned and are not emailed to clients as legal documents.
//
// If your certificate lives on the authority's signing server instead of in a
// file, this module is the one place to connect its API.

const fromB64 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

export async function loadSigner(env) {
  if (!env.SIGNING_P12_PASSWORD || !env.PAYMENTS) return null;
  const b64 = await env.PAYMENTS.get('signing:p12');
  if (!b64) return null;
  return { p12: fromB64(b64.trim()), password: env.SIGNING_P12_PASSWORD };
}

// Signs a PDF that already has a signature placeholder (documents.js).
export async function signPdf(pdfBytes, signer) {
  const [{ SignPdf }, { P12Signer }] = await Promise.all([import('@signpdf/signpdf'), import('@signpdf/signer-p12')]);
  const p12 = new P12Signer(Buffer.from(signer.p12), { passphrase: signer.password });
  const signed = await new SignPdf().sign(Buffer.from(pdfBytes), p12);
  return new Uint8Array(signed);
}
