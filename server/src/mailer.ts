// Transactional email (parental consent now; receipts and refunds in step 4).
// Resend over plain HTTPS: set RESEND_API_KEY and MAIL_FROM (a sender on a
// domain verified in Resend). Without them nothing is sent and the caller is
// told, so a deploy can never silently pretend a parent was emailed.

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export function mailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(mail: Mail): Promise<boolean> {
  if (!mailConfigured()) {
    console.warn(`Mail not sent (RESEND_API_KEY / MAIL_FROM not set): "${mail.subject}"`);
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`Mail provider rejected message: ${res.status}`);
    return res.ok;
  } catch (error) {
    console.error('Mail send failed:', error);
    return false;
  }
}

export const appUrl = () => (process.env.APP_URL || 'https://hunters-system.vercel.app').replace(/\/$/, '');
