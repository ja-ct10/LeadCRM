import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { beginEnvironmentSwitch, endEnvironmentSwitch, setTransportEnvironment } from './environment-transport';
beforeEach(() => { vi.restoreAllMocks(); endEnvironmentSwitch(); setTransportEnvironment('SANDBOX'); });
it('rejects a late response from the previous environment', async () => {
  let resolve!: (value: unknown) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise(r => { resolve = r; })));
  const request = apiClient.get('/crm/leads');
  setTransportEnvironment('PRODUCTION');
  resolve({ ok: true, json: async () => ({ data: ['old'] }) });
  await expect(request).rejects.toMatchObject({ name: 'AbortError' });
});
it('blocks CRM mutations during the transition', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  await beginEnvironmentSwitch();
  await expect(apiClient.post('/crm/leads', {})).rejects.toThrow('Switching environment');
  expect(fetchMock).not.toHaveBeenCalled();
  endEnvironmentSwitch();
});
