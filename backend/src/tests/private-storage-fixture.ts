import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function createPrivateStorageFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'leadcrm-private-fixture-'));
  const keys = ['STORAGE_ROOT', 'AVATAR_STORAGE_BUCKET', 'RECORD_FILES_STORAGE_BUCKET'] as const;
  const before = keys.map(key => process.env[key]);
  process.env.STORAGE_ROOT = root;
  process.env.AVATAR_STORAGE_BUCKET = 'avatars';
  process.env.RECORD_FILES_STORAGE_BUCKET = 'files';
  return {
    root,
    async countAvatars() {
      return (await readdir(path.join(root, 'avatars'), { recursive: true }).catch(() => []))
        .filter(name => name.endsWith('.webp')).length;
    },
    async cleanup() {
      keys.forEach((key, index) => { if (before[index] === undefined) delete process.env[key]; else process.env[key] = before[index]; });
      await rm(root, { recursive: true, force: true });
    },
  };
}
