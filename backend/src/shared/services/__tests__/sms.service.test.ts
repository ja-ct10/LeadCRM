import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendSmsFooter } from '@leadcrm/shared';
import { tenantContext } from '../../../core/tenant/tenant-context';
vi.mock('../../../config/database.config', () => ({ default: { tenant: { findUnique: vi.fn() } } }));
import prisma from '../../../config/database.config';
import { isSmsConfigured, normalizeSmsPhone, sendSms } from '../sms.service';
const send = (content = 'Hello') => tenantContext.run({ tenantId: 'test-tenant' }, () => sendSms('+639171234567', content));
beforeEach(() => {
  vi.stubEnv('UNISMS_API_SECRET_KEY', 'test-only'); vi.stubEnv('UNISMS_SENDER_ID', 'Camxian');
  vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ email: 'info@example.test' } as never);
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('UniSMS transport', () => {
  it('reuses PH local normalization and rejects invalid numbers', () => {
    for (const input of ['+63 (917) 123-4567', '09171234567', '9171234567']) expect(normalizeSmsPhone(input)).toBe('+639171234567');
    for (const input of ['0917123456', '+631234567890', 'letters', '']) expect(() => normalizeSmsPhone(input)).toThrow();
  });
  it('requires configuration before making a request', async () => {
    vi.stubEnv('UNISMS_API_SECRET_KEY', ''); expect(isSmsConfigured()).toBe(false);
    await expect(send()).rejects.toThrow(/Configure/); expect(fetch).not.toHaveBeenCalled();
  });
  it('submits exactly once with Basic auth, registered sender, safe metadata and organization footer', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ message: { reference_id: 'msg-test', status: 'pending' } }), { status: 201 }));
    const metadata = { campaign_id: 'campaign', campaign_recipient_id: 'recipient' };
    expect(await tenantContext.run({ tenantId: 'test-tenant' }, () => sendSms('09171234567', 'Hello', { metadata }))).toEqual({ submitted: true, messageId: 'msg-test', status: 'pending' });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://unismsapi.com/api/sms');
    expect(init?.headers).toMatchObject({ Authorization: 'Basic ' + Buffer.from('test-only:').toString('base64') });
    expect(JSON.parse(String(init?.body))).toEqual({ recipient: '+639171234567', sender_id: 'Camxian', content: appendSmsFooter('Hello', 'info@example.test'), metadata });
  });
  it('blocks missing organization email and final messages above 670 before HTTP', async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({ email: null } as never);
    await expect(send()).rejects.toThrow('Configure the organization email in Settings → General');
    await expect(send('a'.repeat(600))).rejects.toThrow('670-character'); expect(fetch).not.toHaveBeenCalled();
  });
  it('does not duplicate an existing generated footer', () => {
    const once = appendSmsFooter('Hello', 'info@example.test'); expect(appendSmsFooter(once, 'info@example.test')).toBe(once);
  });
  it.each([400, 401, 422, 429])('reports HTTP %s without leaking response data or retrying', async status => {
    vi.mocked(fetch).mockResolvedValue(new Response('private provider body', { status }));
    await expect(send()).rejects.toMatchObject({ outcome: 'rejected', httpStatus: status }); expect(fetch).toHaveBeenCalledOnce();
  });
  it('marks malformed receipts, server errors and network ambiguity unconfirmed without retry', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 201 })).mockResolvedValueOnce(new Response('private', { status: 500 })).mockRejectedValueOnce(new Error('private secret'));
    for (let i = 0; i < 3; i++) await expect(send()).rejects.toMatchObject({ outcome: 'unconfirmed', message: 'SMS submission could not be confirmed. Review the provider history before sending again.' });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
