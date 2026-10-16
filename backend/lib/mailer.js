import nodemailer from 'nodemailer';
import { getEmailTemplate } from './emailTemplate.js';

export const isSmtpConfigured = () => {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_PASS;
  return Boolean(user && pass);
};

let transporter = null;

export const getTransporter = async () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_PASS;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });
    return transporter;
  }

  if (user && pass && (!host || host.includes('gmail'))) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
    return transporter;
  }

  // Fallback: test ethereal account for non-production environments
  if (process.env.NODE_ENV !== 'production') {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      return transporter;
    } catch {
      // json transport fallback
      transporter = nodemailer.createTransport({ jsonTransport: true });
      return transporter;
    }
  }

  transporter = nodemailer.createTransport({ jsonTransport: true });
  return transporter;
};

export const sendVerificationMail = async ({ to, name, verificationUrl }) => {
  if (!to || !to.includes('@')) {
    throw new Error('Alamat email tujuan tidak valid.');
  }

  const { subject, html, text } = getEmailTemplate({ name, verificationUrl });
  const mailer = await getTransporter();

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || '"Pocketplan Support" <no-reply@pocketplan.my.id>';

  const info = await mailer.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
    text
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;
  return {
    success: true,
    messageId: info.messageId,
    previewUrl,
    envelope: info.envelope
  };
};

export const sendTestEmail = async (to = 'test@example.com') => {
  const sampleUrl = 'https://pocketplan.my.id/verification?mode=verifyEmail&oobCode=demo-code-xyz';
  return sendVerificationMail({
    to,
    name: 'Pengguna Uji',
    verificationUrl: sampleUrl
  });
};
