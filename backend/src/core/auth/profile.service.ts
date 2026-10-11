import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES, UpdateSelfProfileSchema, type UpdateSelfProfile } from '@leadcrm/shared';
import prisma from '../../config/database.config';
import { AppError } from '../../shared/errors/app-error';
import { readAuthUser } from './auth-user';
import { privateObjectStorage } from '../../shared/services/private-object-storage';

export async function updateSelfProfile(userId: string, tenantId: string, input: UpdateSelfProfile) {
  const data = UpdateSelfProfileSchema.parse(input);
  return saveProfile(userId, tenantId, data);
}

async function saveProfile(userId: string, tenantId: string, data: UpdateSelfProfile | { avatarUrl: string }) {
  return prisma.$transaction(async tx => {
    const before = await tx.user.findFirst({ where: { id: userId, tenantId, status: 'ACTIVE' } });
    if (!before) throw new AppError('Authentication required', 401);
    await tx.user.update({ where: { id: userId, tenantId }, data });
    await tx.auditLog.create({ data: {
      tenantId, userId, action: 'profile.updated', entityType: 'User', entityId: userId, category: 'auth',
      changeset: { fields: Object.keys(data) },
    } });
    return readAuthUser(userId, tenantId, tx);
  });
}

function storageConfig() {
  return privateObjectStorage(process.env.AVATAR_STORAGE_BUCKET || 'avatars');
}

function objectKey(tenantId: string, userId: string, id: string) {
  return `${encodeURIComponent(tenantId)}/${encodeURIComponent(userId)}/${id}.webp`;
}
const avatarPrefix = '/api/proxy/auth/profile/avatar/';
function storedAvatarId(reference: string | null | undefined) {
  const id = reference?.startsWith(avatarPrefix) ? reference.slice(avatarPrefix.length) : '';
  return /^[a-f0-9-]{36}$/.test(id) ? id : null;
}

export async function uploadSelfAvatar(userId: string, tenantId: string, bytes: Buffer, mime: string) {
  if (!AVATAR_MIME_TYPES.includes(mime as typeof AVATAR_MIME_TYPES[number])) throw new AppError('Choose a JPEG, PNG, or WebP image.', 400);
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > AVATAR_MAX_BYTES) throw new AppError('Image must be no larger than 5 MB.', 400);
  const previous = await readAuthUser(userId, tenantId);
  const storage = storageConfig();
  let optimized: Buffer;
  try {
    const image = sharp(bytes, { limitInputPixels: 25_000_000, animated: false });
    const metadata = await image.metadata();
    const formats: Record<string, string> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
    if (metadata.format !== formats[mime] || (metadata.pages ?? 1) > 1) throw new Error('Invalid image');
    optimized = await image.rotate().resize(512, 512, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
  } catch { throw new AppError('The selected file is not a valid supported image.', 400); }
  const id = randomUUID();
  const key = objectKey(tenantId, userId, id);
  await storage.put(key, optimized);
  const remove = (avatarId: string) => storage.remove([objectKey(tenantId, userId, avatarId)]);
  let user;
  try { user = await saveProfile(userId, tenantId, { avatarUrl: `${avatarPrefix}${id}` }); }
  catch (error) { await remove(id).catch(() => console.warn('Unable to clean up uncommitted avatar')); throw error; }
  const previousId = storedAvatarId(previous.avatarUrl);
  if (previousId) await remove(previousId).catch(() => console.warn('Unable to clean up replaced avatar'));
  return user;
}

export async function readSelfAvatar(userId: string, tenantId: string, id: string) {
  const user = await readAuthUser(userId, tenantId);
  if (!id || storedAvatarId(user.avatarUrl) !== id) throw new AppError('Profile image not found', 404);
  const storage = storageConfig();
  return storage.read(objectKey(tenantId, userId, id));
}
