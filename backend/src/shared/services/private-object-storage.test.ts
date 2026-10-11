import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { privateObjectStorage } from './private-object-storage';

describe('persistent private objects', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'leadcrm-storage-'));
    vi.stubEnv('STORAGE_ROOT', root);
  });
  afterEach(async () => { vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); });

  it('persists complete bytes across storage instances and refuses overwrites', async () => {
    const storage = privateObjectStorage('avatars');
    await storage.put('tenant/user/avatar.webp', Buffer.from('original'));
    await expect(storage.put('tenant/user/avatar.webp', Buffer.from('replacement'))).rejects.toMatchObject({ statusCode: 502 });
    expect(await privateObjectStorage('avatars').read('tenant/user/avatar.webp')).toEqual(Buffer.from('original'));
    if (process.platform !== 'win32') expect((await stat(path.join(root, 'avatars/tenant/user/avatar.webp'))).mode & 0o777).toBe(0o600);
    await storage.remove(['tenant/user/avatar.webp', 'tenant/user/missing.webp']);
    await expect(storage.read('tenant/user/avatar.webp')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects traversal, invalid keys and missing mount configuration', async () => {
    const storage = privateObjectStorage('files');
    for (const key of ['../outside', 'tenant/../../outside', '/absolute', 'tenant\\outside', 'tenant//file']) {
      await expect(storage.put(key, Buffer.from('bytes'))).rejects.toMatchObject({ statusCode: 400 });
    }
    await expect(storage.put('tenant/file', Buffer.alloc(10 * 1024 * 1024 + 1))).rejects.toMatchObject({ statusCode: 400 });
    vi.stubEnv('STORAGE_ROOT', path.join(root, 'missing-mount'));
    await expect(privateObjectStorage('files').put('tenant/file', Buffer.from('bytes'))).rejects.toMatchObject({ statusCode: 503 });
    vi.stubEnv('STORAGE_ROOT', '');
    expect(() => privateObjectStorage('files')).toThrow('not configured');
  });

  it.skipIf(process.platform === 'win32')('refuses symlink directories and objects without touching outside files', async () => {
    const outside = await mkdtemp(path.join(tmpdir(), 'leadcrm-outside-'));
    try {
      await writeFile(path.join(outside, 'secret'), 'private');
      await symlink(outside, path.join(root, 'files'));
      const storage = privateObjectStorage('files');
      await expect(storage.read('secret')).rejects.toMatchObject({ statusCode: 502 });
      await expect(storage.put('secret', Buffer.from('overwrite'))).rejects.toMatchObject({ statusCode: 502 });
      expect(await readFile(path.join(outside, 'secret'), 'utf8')).toBe('private');
      await rm(path.join(root, 'files'));
      await storage.put('tenant/regular', Buffer.from('ok'));
      await symlink(path.join(outside, 'secret'), path.join(root, 'files/tenant/link'));
      await expect(storage.read('tenant/link')).rejects.toMatchObject({ statusCode: 502 });
    } finally { await rm(outside, { recursive: true, force: true }); }
  });
});
