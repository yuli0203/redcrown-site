// Email through Resend's HTTP API (RESEND_API_KEY secret). NOTIFY_FROM must be
// an address on a domain verified in Resend; NOTIFY_TO is you.
//
// Without a key nothing is sent and every message is logged instead, so the
// flow still works end to end while email is being set up.

const toB64 = bytes => {
  let s = '';
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Plain text -> simple HTML email; lines starting with http become links.
export const htmlOf = (text, dir = 'ltr') => `<div dir="${dir}" style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#1a1717">` +
  text.split('\n').map(line => /^https:\/\/\S+$/.test(line.trim())
    ? `<p><a href="${escapeHtml(line.trim())}" style="color:#C8102E">${escapeHtml(line.trim())}</a></p>`
    : `<p style="margin:0 0 6px">${escapeHtml(line) || '&nbsp;'}</p>`).join('') + '</div>';

// message: { to: [..], subject, text, dir?, attachments?: [{ filename, content: Uint8Array }], bcc?: [..] }
export async function send(env, message) {
  const summary = { to: message.to, bcc: message.bcc, subject: message.subject, attachments: (message.attachments || []).map(a => a.filename) };
  if (!env.RESEND_API_KEY || !env.NOTIFY_FROM) {
    console.log('email (not sent: email not configured)', JSON.stringify(summary));
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.NOTIFY_FROM,
        to: message.to,
        ...(message.bcc?.length ? { bcc: message.bcc } : {}),
        reply_to: env.BUSINESS_EMAIL || undefined,
        subject: message.subject,
        text: message.text,
        html: htmlOf(message.text, message.dir),
        attachments: (message.attachments || []).map(a => ({ filename: a.filename, content: toB64(a.content) })),
      }),
    });
    if (!res.ok) console.error('email failed', res.status, JSON.stringify(summary));
    else console.log('email sent', JSON.stringify(summary));
    return res.ok;
  } catch (e) {
    console.error('email failed', e.message, JSON.stringify(summary));
    return false;
  }
}
