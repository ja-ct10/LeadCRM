import { AppError } from '../errors/app-error';
import { getSystemAccessToken, sendEmailWithToken } from '../../integrations/gmail/gmail.service';
import { Resend } from 'resend';

/**
 * Email service — multi-transport with fallback chain:
 *   1. Gmail OAuth2 (if GMAIL_SYSTEM_SENDER_USER_ID is set)
 *   2. Resend HTTP API (if RESEND_API_KEY is set — works on Render free tier)
 *   3. Console log (development only — never in production)
 *
 * At least one transport must be configured for production deployments.
 */

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Returns true when a system Gmail sender account is configured.
 */
function isGmailConfigured(): boolean {
  return !!process.env.GMAIL_SYSTEM_SENDER_USER_ID;
}

/**
 * Returns true when Resend API is configured.
 */
function isResendConfigured(): boolean {
  const key = process.env.RESEND_API_KEY;
  return !!key && !key.startsWith('re_your');
}

/**
 * Sends an email using the configured transport (Gmail → Resend → console fallback).
 */
export async function sendMail(options: SendMailOptions): Promise<void> {
  // ── 1. Try Gmail OAuth2 ─────────────────────────────────────────────
  if (isGmailConfigured()) {
    try {
      const accessToken = await getSystemAccessToken();
      if (accessToken) {
        await sendEmailWithToken(accessToken, options.to, options.subject, options.html);
        return;
      }
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      const message = err instanceof Error ? err.message : 'Unknown error';
      // eslint-disable-next-line no-console
      console.error('[EmailService] Gmail send failed, trying Resend fallback:', message);
    }
  }

  // ── 2. Try Resend HTTP API ──────────────────────────────────────────
  if (isResendConfigured()) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM || 'LeadCRM <onboarding@resend.dev>';
      await resend.emails.send({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      return;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      // eslint-disable-next-line no-console
      console.error('[EmailService] Resend send failed:', message);
      if (process.env.NODE_ENV === 'production') {
        throw new AppError(`Failed to send email via Resend: ${message}`, 502);
      }
    }
  }

  // ── 3. Development fallback — log to console ────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`\n[DEV] Email would be sent to: ${options.to}`);
    // eslint-disable-next-line no-console
    console.log(`[DEV] Subject: ${options.subject}`);
    // eslint-disable-next-line no-console
    console.log('');
    return;
  }

  // ── 4. Production with no transport configured — error ──────────────
  throw new AppError(
    'Email service is not configured. Set GMAIL_SYSTEM_SENDER_USER_ID or RESEND_API_KEY in your environment.',
    503,
  );
}

// ─── Shared email layout helpers ──────────────────────────────────────────────

/**
 * Shared CSS + Google Fonts import injected into every outbound email.
 * Uses Plus Jakarta Sans (enterprise SaaS design system) with a system-font
 * fallback chain so the email renders well even when fonts are blocked.
 */
const EMAIL_FONT_IMPORT = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap');
`;

/**
 * Wraps email body content in the shared LeadCRM branded outer shell.
 * Enhanced design with:
 * - Gradient background (slate-50 → blue-50/10) for professional depth
 * - Modern logo header with brand bar accent
 * - Max-width 600px card with enhanced shadow and border
 * - Refined footer with social links and modern layout
 * - Fully responsive mobile design
 */
function wrapEmailShell(bodyContent: string, footerNote?: string): string {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>LeadCRM</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    ${EMAIL_FONT_IMPORT}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      margin: 0;
      padding: 0;
    }
    .email-wrapper {
      background: linear-gradient(180deg, #f8fafc 0%, #eff6ff 100%);
      padding: 48px 20px;
      min-height: 100vh;
    }
    /* Enhanced Header with Logo */
    .email-header {
      text-align: center;
      padding-bottom: 32px;
    }
    .logo-container {
      display: inline-block;
      background: #ffffff;
      border-radius: 16px;
      padding: 18px 32px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(148,163,184,0.1);
      margin-bottom: 8px;
    }
    .brand-bar {
      width: 60px;
      height: 3px;
      background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);
      border-radius: 2px;
      margin: 12px auto 0;
    }
    /* Enhanced Card */
    .email-card {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 20px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    /* Body with better spacing */
    .email-body { 
      padding: 56px 48px; 
    }
    /* Enhanced Footer */
    .email-footer {
      background: linear-gradient(180deg, #fafbfc 0%, #f8fafc 100%);
      border-top: 1px solid #e2e8f0;
      padding: 32px 48px;
      text-align: center;
    }
    .footer-brand {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 16px;
      letter-spacing: 0.3px;
    }
    .footer-links { 
      margin-bottom: 16px; 
      padding: 0 20px;
    }
    .footer-links a {
      color: #475569;
      font-size: 13px;
      text-decoration: none;
      margin: 0 12px;
      font-weight: 600;
      transition: color 0.2s;
    }
    .footer-links a:hover {
      color: #2563eb;
    }
    .footer-divider {
      width: 40px;
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, #cbd5e1 50%, transparent 100%);
      margin: 20px auto;
    }
    .footer-legal {
      color: #94a3b8;
      font-size: 12px;
      line-height: 1.7;
      max-width: 440px;
      margin: 0 auto;
    }
    .footer-secure {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    .secure-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 20px;
      padding: 6px 14px;
      font-size: 11px;
      font-weight: 600;
      color: #166534;
    }
    /* Utility */
    .text-center { text-align: center; }
    @media only screen and (max-width: 640px) {
      .email-wrapper { padding: 32px 16px !important; }
      .email-body { padding: 40px 28px !important; }
      .email-footer { padding: 28px 24px !important; }
      .logo-container { padding: 12px 20px !important; }
      .logo-container img { height: 36px !important; }
      .footer-links { padding: 0 !important; }
      .footer-links a { 
        display: inline-block;
        margin: 4px 8px !important;
        font-size: 12px !important;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <!-- Enhanced Header with Logo -->
    <div class="email-header">
      <a href="${appUrl}" target="_blank" style="text-decoration: none;">
        <div class="logo-container">
          <!-- Inline SVG LeadCRM Logo -->
          <svg width="140" height="36" viewBox="0 0 140 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
            <!-- Icon -->
            <rect x="2" y="6" width="24" height="24" rx="6" fill="#2563eb" opacity="0.1"/>
            <path d="M14 10L8 13V18C8 20.76 10.34 23.37 14 24C17.66 23.37 20 20.76 20 18V13L14 10Z" fill="#2563eb"/>
            <path d="M11 17L13 19L17 15" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <!-- Text -->
            <text x="34" y="25" font-family="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill="#1e293b" letter-spacing="-0.5">LeadCRM</text>
          </svg>
        </div>
        <div class="brand-bar"></div>
      </a>
    </div>

    <div class="email-card">
      <!-- Body -->
      <div class="email-body">
        ${bodyContent}
      </div>

      <!-- Enhanced Footer -->
      <div class="email-footer">
        <div class="footer-brand">LeadCRM</div>
        <div class="footer-links">
          <a href="${appUrl}/privacy">Privacy Policy</a>
          <a href="${appUrl}/terms">Terms of Service</a>
          <a href="${appUrl}/help">Help Center</a>
        </div>
        <div class="footer-divider"></div>
        <p class="footer-legal">
          ${footerNote ?? 'This is an automated message from LeadCRM. Please do not reply to this email.'}
          <br /><br />
          &copy; ${new Date().getFullYear()} LeadCRM &middot; All rights reserved.
        </p>
        <div class="footer-secure">
          <span class="secure-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle;">
              <path d="M12 2L3 7V12C3 16.55 6.84 20.74 12 22C17.16 20.74 21 16.55 21 12V7L12 2Z" fill="#16a34a" opacity="0.15"/>
              <path d="M12 2L3 7V12C3 16.55 6.84 20.74 12 22C17.16 20.74 21 16.55 21 12V7L12 2Z" stroke="#16a34a" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M8.5 12L10.5 14L15.5 10" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Secure email delivered by LeadCRM
          </span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Email template builders ───────────────────────────────────────────────────

/**
 * Builds the HTML body for a registration email verification OTP.
 * Enhanced design: enterprise SaaS, modern blue gradient header, 
 * improved digit boxes with animation-ready styling, enhanced security notice.
 */
export function buildRegistrationOtpEmail(code: string): string {
  // Split code into individual digits for the digit-box display
  const digits = code.split('');

  const digitBoxStyle = [
    'display: inline-block',
    'width: 48px',
    'height: 60px',
    'line-height: 60px',
    'text-align: center',
    'font-size: 32px',
    'font-weight: 800',
    'color: #1e3a8a',
    'background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    'border: 2px solid #93c5fd',
    'border-radius: 12px',
    'margin: 0 4px',
    'font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
    'letter-spacing: 0',
    'box-shadow: 0 2px 8px rgba(37,99,235,0.12)',
  ].join('; ');

  const digitBoxes = digits
    .map(d => `<span style="${digitBoxStyle}">${d}</span>`)
    .join('');

  const bodyContent = `
    <!-- Hero Icon + Heading -->
    <div style="text-align: center; margin-bottom: 36px;">
      <div style="
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 80px; height: 80px;
        background: linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%);
        border: 2px solid #60a5fa;
        border-radius: 20px;
        margin-bottom: 24px;
        box-shadow: 0 8px 16px rgba(37,99,235,0.15);
      ">
        <!-- Enhanced Shield check icon -->
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 2L3 7V12C3 16.55 6.84 20.74 12 22C17.16 20.74 21 16.55 21 12V7L12 2Z" fill="#2563eb" opacity="0.2"/>
          <path d="M12 2L3 7V12C3 16.55 6.84 20.74 12 22C17.16 20.74 21 16.55 21 12V7L12 2Z" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/>
          <path d="M8.5 12L10.5 14L15.5 10" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h1 style="font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 12px; letter-spacing: -0.5px; line-height: 1.2;">
        Verify your email address
      </h1>
      <p style="color: #64748b; font-size: 16px; line-height: 1.6; max-width: 400px; margin: 0 auto;">
        Enter the 6-digit code below to confirm your email and activate your LeadCRM account.
      </p>
    </div>

    <!-- Enhanced OTP Digit Boxes -->
    <div style="text-align: center; margin-bottom: 16px;">
      <div style="
        display: inline-block;
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border: 1.5px solid #cbd5e1;
        border-radius: 16px;
        padding: 24px 28px;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.03);
      ">
        ${digitBoxes}
      </div>
    </div>

    <!-- Enhanced Expiry badge -->
    <div style="text-align: center; margin-bottom: 32px;">
      <span style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
        border: 1.5px solid #fde047;
        border-radius: 24px;
        padding: 8px 18px;
        font-size: 13px;
        font-weight: 700;
        color: #92400e;
        box-shadow: 0 2px 8px rgba(251,191,36,0.15);
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle;" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="#92400e" stroke-width="2"/>
          <path d="M12 7V12L15 14" stroke="#92400e" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Expires in 10 minutes
      </span>
    </div>

    <!-- Refined Divider -->
    <hr style="border: none; border-top: 1.5px solid #e2e8f0; margin: 0 0 28px 0;" />

    <!-- Enhanced Security notice -->
    <div style="
      display: flex;
      align-items: flex-start;
      gap: 14px;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1.5px solid #86efac;
      border-radius: 14px;
      padding: 18px 20px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(34,197,94,0.08);
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;margin-top:2px;" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="#86efac" stroke="#22c55e" stroke-width="2"/>
        <path d="M8.5 12L10.5 14L15.5 10" stroke="#166534" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div>
        <p style="font-size: 14px; font-weight: 700; color: #14532d; margin-bottom: 4px;">Keep your account secure</p>
        <p style="font-size: 13px; color: #166534; line-height: 1.6;">
          Never share this code with anyone. LeadCRM will never ask for this code via phone or chat.
          If you didn&rsquo;t request this, you can safely ignore this email.
        </p>
      </div>
    </div>

    <!-- Need help -->
    <p style="text-align: center; font-size: 13px; color: #94a3b8; line-height: 1.7;">
      Having trouble? Contact us at
      <a href="mailto:support@leadcrm.io" style="color: #2563eb; text-decoration: none; font-weight: 600;">support@leadcrm.io</a>
    </p>
  `;

  return wrapEmailShell(bodyContent, "You're receiving this email because a registration was started with your address.");
}

/**
 * Builds the HTML body for a password reset email.
 * Enhanced design: clear call-to-action with gradient button, 
 * improved security warning, modern badge styling, better visual hierarchy.
 */
export function buildPasswordResetEmail(resetUrl: string): string {
  const bodyContent = `
    <!-- Hero Icon + Heading -->
    <div style="text-align: center; margin-bottom: 36px;">
      <div style="
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 80px; height: 80px;
        background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);
        border: 2px solid #fb923c;
        border-radius: 20px;
        margin-bottom: 24px;
        box-shadow: 0 8px 16px rgba(234,88,12,0.15);
      ">
        <!-- Enhanced Lock icon -->
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" fill="#ea580c" opacity="0.2"/>
          <rect x="5" y="11" width="14" height="10" rx="2" stroke="#ea580c" stroke-width="2"/>
          <path d="M8 11V7C8 5.34315 9.34315 4 11 4H13C14.6569 4 16 5.34315 16 7V11" stroke="#ea580c" stroke-width="2" stroke-linecap="round"/>
          <circle cx="12" cy="16" r="1.5" fill="#ea580c"/>
        </svg>
      </div>
      <h1 style="font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 12px; letter-spacing: -0.5px; line-height: 1.2;">
        Reset your password
      </h1>
      <p style="color: #64748b; font-size: 16px; line-height: 1.6; max-width: 420px; margin: 0 auto;">
        We received a request to reset the password for your LeadCRM account. Click the button below to set a new one.
      </p>
    </div>

    <!-- Enhanced CTA Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${resetUrl}"
         style="
           display: inline-block;
           padding: 16px 42px;
           background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
           color: #ffffff;
           text-decoration: none;
           border-radius: 12px;
           font-size: 16px;
           font-weight: 700;
           letter-spacing: 0.2px;
           box-shadow: 0 6px 20px rgba(37,99,235,0.4), 0 2px 8px rgba(37,99,235,0.2);
           transition: all 0.3s ease;
         ">
        Reset Password
      </a>
    </div>

    <!-- Enhanced Expiry badge -->
    <div style="text-align: center; margin-bottom: 32px;">
      <span style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
        border: 1.5px solid #fde047;
        border-radius: 24px;
        padding: 8px 18px;
        font-size: 13px;
        font-weight: 700;
        color: #92400e;
        box-shadow: 0 2px 8px rgba(251,191,36,0.15);
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline;vertical-align:middle;" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="#92400e" stroke-width="2"/>
          <path d="M12 7V12L15 14" stroke="#92400e" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Link expires in 60 minutes
      </span>
    </div>

    <!-- Refined Divider -->
    <hr style="border: none; border-top: 1.5px solid #e2e8f0; margin: 0 0 24px 0;" />

    <!-- Enhanced Fallback URL (for clients that block buttons) -->
    <div style="
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1.5px solid #cbd5e1;
      border-radius: 14px;
      padding: 18px 20px;
      margin-bottom: 24px;
    ">
      <p style="font-size: 13px; color: #64748b; margin-bottom: 8px; font-weight: 600;">
        If the button above doesn&rsquo;t work, copy and paste this link into your browser:
      </p>
      <p style="font-size: 12px; color: #2563eb; word-break: break-all; font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace; background: #eff6ff; padding: 10px 12px; border-radius: 8px; border: 1px solid #bfdbfe;">
        ${resetUrl}
      </p>
    </div>

    <!-- Enhanced Security warning -->
    <div style="
      display: flex;
      align-items: flex-start;
      gap: 14px;
      background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
      border: 1.5px solid #fdba74;
      border-radius: 14px;
      padding: 18px 20px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(251,146,60,0.08);
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;margin-top:2px;" aria-hidden="true">
        <path d="M12 3L2 21H22L12 3Z" fill="#fed7aa" stroke="#f97316" stroke-width="2" stroke-linejoin="round"/>
        <path d="M12 10V14" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="12" cy="17" r="1.2" fill="#92400e"/>
      </svg>
      <div>
        <p style="font-size: 14px; font-weight: 700; color: #78350f; margin-bottom: 4px;">Didn&rsquo;t request this?</p>
        <p style="font-size: 13px; color: #92400e; line-height: 1.6;">
          If you didn&rsquo;t request a password reset, ignore this email — your password will remain unchanged.
          If you&rsquo;re concerned about account security, contact our support team immediately.
        </p>
      </div>
    </div>

    <!-- Need help -->
    <p style="text-align: center; font-size: 13px; color: #94a3b8; line-height: 1.7;">
      Need help? Reach us at
      <a href="mailto:support@leadcrm.io" style="color: #2563eb; text-decoration: none; font-weight: 600;">support@leadcrm.io</a>
    </p>
  `;

  return wrapEmailShell(bodyContent, "You're receiving this email because a password reset was requested for your account.");
}

