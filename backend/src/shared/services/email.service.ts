import nodemailer from 'nodemailer';
import { AppError } from '../errors/app-error';

/**
 * Sends transactional email via Gmail SMTP (or any SMTP provider).
 *
 * Required env vars:
 *   SMTP_HOST  — e.g. smtp.gmail.com
 *   SMTP_PORT  — e.g. 587
 *   SMTP_USER  — Gmail address
 *   SMTP_PASS  — Gmail App Password (16 chars, no spaces)
 *   SMTP_FROM  — display name + address, e.g. "LeadCRM <you@gmail.com>"
 *
 * In development without credentials, logs the reset URL to console instead.
 */

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

function isSmtpConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

function createTransporter() {
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);

  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port,
    secure: port === 465, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendMail(options: SendMailOptions): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new AppError(
      'Email service is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in your .env file.',
      503
    );
  }

  const transporter = createTransporter();
  const from = process.env.SMTP_FROM ?? `LeadCRM <${process.env.SMTP_USER}>`;

  await transporter.sendMail({
    from,
    to:      options.to,
    subject: options.subject,
    html:    options.html,
  });
}

/**
 * Builds the HTML body for a password reset email.
 */
export function buildPasswordResetEmail(resetUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family: Inter, Arial, sans-serif; background: #f8fafc; padding: 40px 0;">
      <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px;
                  border: 1px solid #e5e7eb; padding: 40px;">
        <h1 style="font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">
          Reset your password
        </h1>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          We received a request to reset the password for your LeadCRM account.
          Click the button below to choose a new password. This link expires in
          <strong>60 minutes</strong>.
        </p>
        <a href="${resetUrl}"
           style="display: inline-block; padding: 12px 28px; background: #2563eb;
                  color: #ffffff; text-decoration: none; border-radius: 8px;
                  font-size: 14px; font-weight: 600;">
          Reset Password
        </a>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 32px; line-height: 1.6;">
          If you did not request a password reset, you can safely ignore this email.
          Your password will not change until you click the link above.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #cbd5e1; font-size: 11px;">LeadCRM · Automated notification</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Builds the HTML body for a login OTP email.
 */
export function buildLoginOtpEmail(code: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family: Inter, Arial, sans-serif; background: #f8fafc; padding: 40px 0;">
      <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px;
                  border: 1px solid #e5e7eb; padding: 40px; text-align: center;">
        <h1 style="font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">
          Your login code
        </h1>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 28px;">
          Use the code below to complete your sign-in. It expires in <strong>10 minutes</strong>.
        </p>
        <div style="display: inline-block; background: #f1f5f9; border-radius: 12px;
                    padding: 20px 40px; margin-bottom: 28px;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px;
                       color: #0f172a; font-family: monospace;">${code}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px; line-height: 1.6;">
          If you didn't try to sign in, you can safely ignore this email.
          Someone may have entered your email address by mistake.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #cbd5e1; font-size: 11px;">LeadCRM · Automated notification</p>
      </div>
    </body>
    </html>
  `;
}


/**
 * Builds the HTML body for a registration verification OTP email.
 */
export function buildRegistrationOtpEmail(code: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family: Inter, Arial, sans-serif; background: #f8fafc; padding: 40px 0;">
      <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px;
                  border: 1px solid #e5e7eb; padding: 40px; text-align: center;">
        <h1 style="font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">
          Verify your email
        </h1>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 28px;">
          Use the code below to complete your registration. It expires in <strong>10 minutes</strong>.
        </p>
        <div style="display: inline-block; background: #f1f5f9; border-radius: 12px;
                    padding: 20px 40px; margin-bottom: 28px;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px;
                       color: #0f172a; font-family: monospace;">${code}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px; line-height: 1.6;">
          If you didn't try to register, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #cbd5e1; font-size: 11px;">LeadCRM · Automated notification</p>
      </div>
    </body>
    </html>
  `;
}
