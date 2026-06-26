import { mailConfig } from '../../config/mail.config';
import { GmailMessage } from './gmail.types';

/**
 * Gmail Integration Service
 * Handles outgoing email via Gmail API OAuth2.
 * Credentials are sourced from environment variables — never hardcoded.
 */
export async function sendEmail(message: GmailMessage): Promise<void> {
  // TODO: implement OAuth2 token refresh + Gmail API send
  // Required env vars: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI
  const { clientId } = mailConfig.gmail;
  if (!clientId) {
    throw new Error('Gmail integration is not configured. Set GMAIL_CLIENT_ID in environment.');
  }

  // Placeholder — wire google-auth-library + googleapis in Phase 2
  console.log(`[Gmail] Would send email to ${Array.isArray(message.to) ? message.to.join(', ') : message.to}`);
}
