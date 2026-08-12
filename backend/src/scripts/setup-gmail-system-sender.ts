/**
 * One-time setup script: seeds the system Gmail sender EmailAccount.
 *
 * Required env vars (set temporarily, remove after running):
 *   GMAIL_SYSTEM_SENDER_GMAIL_EMAIL   — the Gmail address (e.g. tironjulieann10@gmail.com)
 *   GMAIL_SYSTEM_SENDER_ACCESS_TOKEN  — access token from OAuth Playground (starts with ya29.)
 *   GMAIL_SYSTEM_SENDER_REFRESH_TOKEN — refresh token from OAuth Playground (starts with 1//)
 *
 * Optional:
 *   GMAIL_SYSTEM_SENDER_EXPIRES_IN    — seconds until access token expires (default: 3599)
 *                                       copy the "expires_in" value from OAuth Playground response
 *
 * After running, set GMAIL_SYSTEM_SENDER_USER_ID=system in your .env
 * and remove the 3 token vars above.
 *
 * Usage:
 *   npm --prefix backend run gmail:setup-system-sender
 */

import 'dotenv/config';
import prisma from '../config/database.config';
import { encryptToken } from '../core/encryption/crypto.service';

async function main(): Promise<void> {
  const gmailEmail  = process.env.GMAIL_SYSTEM_SENDER_GMAIL_EMAIL;
  const accessToken = process.env.GMAIL_SYSTEM_SENDER_ACCESS_TOKEN;
  const refreshToken = process.env.GMAIL_SYSTEM_SENDER_REFRESH_TOKEN;

  if (!gmailEmail || !accessToken || !refreshToken) {
    console.error(
      '[setup-gmail-system-sender] Missing required env vars.\n' +
      'Required:\n' +
      '  GMAIL_SYSTEM_SENDER_GMAIL_EMAIL   = tironjulieann10@gmail.com\n' +
      '  GMAIL_SYSTEM_SENDER_ACCESS_TOKEN  = ya29.xxxx  (from OAuth Playground)\n' +
      '  GMAIL_SYSTEM_SENDER_REFRESH_TOKEN = 1//xxxx    (from OAuth Playground)',
    );
    process.exit(1);
  }

  // Calculate token expiry from expires_in (seconds). Default to 3599 (1 hour) if not provided.
  const expiresIn = parseInt(process.env.GMAIL_SYSTEM_SENDER_EXPIRES_IN ?? '3599', 10);
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

  const encryptedAccessToken  = encryptToken(accessToken);
  const encryptedRefreshToken = encryptToken(refreshToken);

  await prisma.emailAccount.upsert({
    where: {
      tenantId_userId_provider: {
        tenantId: 'system',
        userId:   'system',
        provider: 'gmail',
      },
    },
    update: {
      email:          gmailEmail,
      accessToken:    encryptedAccessToken,
      refreshToken:   encryptedRefreshToken,
      tokenExpiresAt,
      isActive:       true,
    },
    create: {
      tenantId:       'system',
      userId:         'system',
      provider:       'gmail',
      email:          gmailEmail,
      accessToken:    encryptedAccessToken,
      refreshToken:   encryptedRefreshToken,
      tokenExpiresAt,
      isActive:       true,
      scopes: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    },
  });

  console.log(`\n✓ System Gmail sender seeded for: ${gmailEmail}`);
  console.log(`✓ Token expires at: ${tokenExpiresAt.toISOString()} (auto-refreshes after that)`);
  console.log('\nNext steps:');
  console.log('  1. Add to backend/.env:  GMAIL_SYSTEM_SENDER_USER_ID=system');
  console.log('  2. Remove from backend/.env:');
  console.log('       GMAIL_SYSTEM_SENDER_GMAIL_EMAIL');
  console.log('       GMAIL_SYSTEM_SENDER_ACCESS_TOKEN');
  console.log('       GMAIL_SYSTEM_SENDER_REFRESH_TOKEN');
  console.log('       GMAIL_SYSTEM_SENDER_EXPIRES_IN');
  console.log('  3. Restart the backend server\n');
}

main()
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[setup-gmail-system-sender] Failed:', message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
