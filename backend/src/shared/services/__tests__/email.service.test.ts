import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMail, buildVerificationEmail, buildRegistrationOtpEmail, buildPasswordResetEmail, buildWelcomeEmail, buildInvitationEmail } from '../email.service';
import { sanitizeCampaignHtml } from '../../../modules/marketing/campaigns/campaign-content';
import { verifyWebhookAuthorization, BrevoEventSchema } from '../../../modules/marketing/campaigns/brevo-webhook';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('BREVO_API_KEY', 'xkeysib-test-secret-123456789');
  vi.stubEnv('BREVO_FROM_EMAIL', 'sender@example.com'); vi.stubEnv('BREVO_FROM_NAME', 'Test Sender');
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ messageId: '<message-1>' }) });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('existing Brevo transport', () => {
  it('posts the configured sender, recipient, subject and sanitized body and returns messageId', async () => {
    const html = sanitizeCampaignHtml('<p onclick="bad()">Hello</p><script>bad()</script>');
    await expect(sendMail({ to: 'customer@example.com', subject: 'Hello', html })).resolves.toEqual({ messageId: '<message-1>', submitted: true });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(options.method).toBe('POST');
    expect(options.headers['api-key']).toBe(process.env.BREVO_API_KEY);
    expect(JSON.parse(options.body)).toEqual({ sender: { email: 'sender@example.com', name: 'Test Sender' }, to: [{ email: 'customer@example.com' }], subject: 'Hello', htmlContent: '<p>Hello</p>' });
  });
  it('does not expose or log provider response secrets', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue({ ok: false, status: 429, text: async () => process.env.BREVO_API_KEY });
    await expect(sendMail({ to: 'customer@example.com', subject: 'Hello', html: 'Hi' })).rejects.toMatchObject({ statusCode: 502 });
    expect(JSON.stringify(log.mock.calls)).not.toContain(process.env.BREVO_API_KEY);
  });
  it('requires campaign configuration and reports no fake submission in development', async () => {
    vi.stubEnv('BREVO_API_KEY', ''); vi.stubEnv('NODE_ENV', 'development');
    await expect(sendMail({ to: 'a@example.com', subject: 'Hi', html: 'Hi', requireDelivery: true })).rejects.toMatchObject({ statusCode: 503 });
    await expect(sendMail({ to: 'a@example.com', subject: 'Hi', html: 'Hi' })).resolves.toEqual({ messageId: null, submitted: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    ['registration verification', () => buildVerificationEmail('https://example.com/verify', '123456')],
    ['registration OTP', () => buildRegistrationOtpEmail('123456')],
    ['password reset', () => buildPasswordResetEmail('https://example.com/reset')],
    ['welcome', () => buildWelcomeEmail('Juan', 'Workspace')],
    ['team invitation', () => buildInvitationEmail('Admin', 'Workspace', 'https://example.com/invite', 'Sales')],
    ['administrative reset', () => buildPasswordResetEmail('https://example.com/reset?token=admin')],
  ])('preserves the %s builder and transport contract', async (_name, build) => {
    const html = build();
    expect(html).toContain('<html');
    await sendMail({ to: 'staff@camxian.com', subject: 'Account email', html });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).htmlContent).toBe(html);
  });
  it('authenticates webhooks and rejects unexpected event types', () => {
    vi.stubEnv('BREVO_WEBHOOK_TOKEN', 'test-token-with-at-least-32-characters');
    expect(() => verifyWebhookAuthorization('Bearer wrong')).toThrow();
    expect(() => verifyWebhookAuthorization(`Bearer ${process.env.BREVO_WEBHOOK_TOKEN}`)).not.toThrow();
    expect(BrevoEventSchema.safeParse({ event: 'delete-user', email: 'a@example.com', 'message-id': '1' }).success).toBe(false);
  });
});
