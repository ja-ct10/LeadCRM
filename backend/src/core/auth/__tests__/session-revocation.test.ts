import { beforeEach, expect, it, vi } from 'vitest';
const { updateMany } = vi.hoisted(() => ({ updateMany: vi.fn() }));
vi.mock('../../../config/database.config', () => ({
  default: { session: { updateMany } },
}));
import { hashToken, revokeSession } from '../session.service';
beforeEach(() => vi.resetAllMocks());

it('revokes a session by its hash without persisting a raw token', async () => {
  updateMany.mockResolvedValue({ count: 1 });
  await revokeSession('secret');
  expect(updateMany).toHaveBeenCalledWith({
    where: { tokenHash: hashToken('secret'), revokedAt: null },
    data: { revokedAt: expect.any(Date) },
  });
});
it('treats an already missing session as a successful logout', async () => {
  updateMany.mockResolvedValue({ count: 0 });
  await expect(revokeSession('missing')).resolves.toBeUndefined();
});
it('reports database failure instead of falsely claiming server logout', async () => {
  updateMany.mockRejectedValue(new Error('database unavailable'));
  await expect(revokeSession('secret')).rejects.toThrow('database unavailable');
});
