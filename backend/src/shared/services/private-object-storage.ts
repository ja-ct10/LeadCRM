import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, link, unlink } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../errors/app-error';

const maxObjectBytes = 10 * 1024 * 1024;

/** Private bytes live outside replaceable application containers. HTTP services
 * remain responsible for tenant, record and session authorization. */
export function privateObjectStorage(bucket: string) {
  const root = process.env.STORAGE_ROOT;
  if (!root || !path.isAbsolute(root) || !/^[a-zA-Z0-9_-]+$/.test(bucket)) {
    throw new AppError('Private file storage is not configured. Contact your administrator.', 503);
  }

  async function objectPath(key: string, create: boolean) {
    const parts = key.split('/');
    if (!parts.length || parts.some(part => !/^[a-zA-Z0-9_%.-]+$/.test(part) || part === '.' || part === '..')) {
      throw new AppError('Invalid storage object key.', 400);
    }
    // The root must already exist as a mounted directory. Never silently create
    // ephemeral storage when the production mount is missing.
    const rootStat = await lstat(root!).catch(() => { throw new AppError('Private storage mount is unavailable.', 503); });
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new AppError('Private storage mount is unavailable.', 503);
    let directory = root!;
    for (const component of [bucket, ...parts.slice(0, -1)]) {
      directory = path.join(directory, component);
      if (create) await mkdir(directory, { mode: 0o700 }).catch(error => {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      });
      const stat = await lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Invalid storage directory');
    }
    return path.join(directory, parts[parts.length - 1]);
  }

  function storageError(error: unknown): never {
    if (error instanceof AppError) throw error;
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new AppError('File not found.', 404);
    throw new AppError('Unable to access private file storage. Please try again.', 502);
  }

  return {
    async put(key: string, bytes: Buffer) {
      if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > maxObjectBytes) throw new AppError('Invalid file size.', 400);
      let temporary: string | undefined;
      try {
        const target = await objectPath(key, true);
        temporary = path.join(path.dirname(target), `.upload-${randomUUID()}`);
        const file = await open(temporary, 'wx', 0o600);
        try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
        // Publish complete bytes atomically, and never replace an existing object.
        await link(temporary, target);
      } catch (error) { storageError(error); }
      finally { if (temporary) await unlink(temporary).catch(() => undefined); }
    },
    async read(key: string) {
      try {
        const target = await objectPath(key, false);
        const file = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
        try {
          const stat = await file.stat();
          if (!stat.isFile() || stat.size > maxObjectBytes) throw new Error('Invalid storage object');
          return await file.readFile();
        } finally { await file.close(); }
      } catch (error) { return storageError(error); }
    },
    async remove(keys: string[]) {
      for (const key of keys) {
        try { await unlink(await objectPath(key, false)); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') storageError(error); }
      }
    },
  };
}
