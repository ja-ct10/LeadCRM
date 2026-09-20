import { expect, it } from 'vitest';
import { GET, POST } from '../route';
it('does not expose Google authentication or provider sessions', () => { expect(GET().status).toBe(404); expect(POST().status).toBe(404); });
