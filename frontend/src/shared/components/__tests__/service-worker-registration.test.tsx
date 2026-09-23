import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { ServiceWorkerRegistration } from '../service-worker-registration';
import { toast } from 'sonner';

vi.mock('sonner', () => ({ toast: { info: vi.fn() } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('bypasses the worker HTTP cache, checks when returning, and offers a safe refresh on updates', async () => {
  const serviceWorker = new EventTarget();
  const update = vi.fn().mockResolvedValue(undefined);
  const register = vi.fn().mockResolvedValue({ update });
  Object.assign(serviceWorker, { register, controller: {} });
  vi.stubGlobal('navigator', { serviceWorker });
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const { unmount } = render(<ServiceWorkerRegistration />);
  await waitFor(() => expect(update).toHaveBeenCalledOnce());
  expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(update).toHaveBeenCalledTimes(2);
  serviceWorker.dispatchEvent(new Event('controllerchange'));
  expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('Save your work'), expect.objectContaining({
    action: { label: 'Refresh', onClick: expect.any(Function) },
  }));
  unmount();
  document.dispatchEvent(new Event('visibilitychange'));
  expect(update).toHaveBeenCalledTimes(2);
});
