// Outgoing email. Resend (free: 100 a day, 3 000 a month; needs a verified domain) is used
// when RESEND_API_KEY is set; Brevo (needs only a verified sender address) when
// BREVO_API_KEY is set. Without either, there is no provider and callers fall back to the
// local development mailbox. MAIL_FROM is the verified sender address.
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

export const emailHtml = ({ text, url, button }) => `<!doctype html>
<html><body style="margin:0;background:#f4f8fa;font-family:Inter,Arial,sans-serif;color:#111827">
<div style="max-width:520px;margin:24px auto;background:#fff;border:1px solid #d7dce0;border-radius:12px;padding:28px">
<p style="margin:0 0 18px;font-weight:700;font-size:18px;color:#087658">MotoDoc</p>
${escapeHtml(text)
  .split('\n')
  .map((line) => `<p style="margin:0 0 12px;line-height:1.5">${line}</p>`)
  .join('')}
${
  url
    ? `<p style="margin:20px 0 4px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#087658;color:#fff;text-decoration:none;padding:11px 20px;border-radius:999px;font-weight:600">${escapeHtml(button || 'Open MotoDoc')}</a></p>`
    : ''
}
<p style="margin:24px 0 0;font-size:12px;color:#626a72">You get this email because you have a MotoDoc account. Change which emails you get in Account settings.</p>
</div></body></html>`;

export function emailProvider(env = process.env, fetchImpl = globalThis.fetch) {
  const from = env.MAIL_FROM;
  const name = env.MAIL_FROM_NAME || 'MotoDoc';
  if (!from) return null;
  if (env.RESEND_API_KEY)
    return async ({ to, subject, text, url, button }) => {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: `${name} <${from}>`,
          to: [to],
          subject,
          text: url ? `${text}\n\n${url}` : text,
          html: emailHtml({ text, url, button }),
        }),
      });
      if (!response.ok) console.error('Email not sent (Resend):', response.status);
      return response.ok;
    };
  if (env.BREVO_API_KEY)
    return async ({ to, subject, text, url, button }) => {
      const response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': env.BREVO_API_KEY,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: from, name },
          to: [{ email: to }],
          subject,
          textContent: url ? `${text}\n\n${url}` : text,
          htmlContent: emailHtml({ text, url, button }),
        }),
      });
      if (!response.ok) console.error('Email not sent (Brevo):', response.status);
      return response.ok;
    };
  return null;
}
