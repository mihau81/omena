import nodemailer from 'nodemailer';

// ─── Transporter (lazy singleton) ───────────────────────────────────────────

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (_transporter) return _transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // SMTP not configured — email sending disabled
    return null;
  }

  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? parseInt(SMTP_PORT, 10) : 587,
    secure: SMTP_PORT === '465',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return _transporter;
}

// ─── Core Send ───────────────────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`[email] SMTP not configured — skipping email to ${to}: "${subject}"`);
    return false;
  }

  const from = process.env.EMAIL_FROM || 'noreply@omena.pl';

  try {
    await transporter.sendMail({ from, to, subject, html });
    return true;
  } catch (error) {
    console.error(`[email] Failed to send to ${to}:`, error);
    return false;
  }
}
