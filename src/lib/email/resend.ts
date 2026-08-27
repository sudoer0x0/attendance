import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.ALERT_EMAIL_FROM ?? "security@attend.local";

async function send(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    // Dev fallback — no crash, no silent no-op either. See HANDOFF.md.
    console.warn(`[email:skipped, no RESEND_API_KEY] to=${to} subject="${subject}"`);
    return;
  }
  await resend.emails.send({ from: FROM, to, subject, html });
}

/** Whether real email delivery is configured — callers use this to decide
 *  whether to also return a temp password in an API response (dev-only
 *  fallback) or omit it now that it's actually been emailed. */
export function emailSendingEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendTemporaryPasswordEmail(to: string, name: string, temporaryPassword: string) {
  await send(
    to,
    "Your Attend account credentials",
    `<p>Hi ${name},</p>
     <p>An account was created (or reset) for you on Attend.</p>
     <p><strong>Temporary password:</strong> <code>${temporaryPassword}</code></p>
     <p>Sign in and you'll be asked to set a new password and enroll two-factor authentication.
     This temporary password is single-use — you'll be forced to replace it on first sign-in.</p>
     <p>If you didn't expect this, contact your administrator immediately.</p>`
  );
}

export async function sendNewDeviceLoginAlert(to: string, name: string, ip: string, when: Date) {
  await send(
    to,
    "New sign-in to your Attend account",
    `<p>Hi ${name},</p>
     <p>A new sign-in to your account was detected from an unrecognized device/browser.</p>
     <p>Time: ${when.toUTCString()}<br/>IP: ${ip}</p>
     <p>If this wasn't you, contact your administrator immediately to have your credentials reset.</p>`
  );
}
