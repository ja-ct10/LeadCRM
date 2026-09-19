import { expect, it, vi } from 'vitest';
import { GET } from '../route';
it('rejects retired magic links without contacting the backend', () => { const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); expect(GET().status).toBe(404); expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });
