export const PASSWORD_MAX_AGE_DAYS = 90;

const PASSWORD_MAX_AGE_MS = PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

export function isPasswordExpired(
  passwordChangedAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!passwordChangedAt) return false;
  return now.getTime() >= passwordChangedAt.getTime() + PASSWORD_MAX_AGE_MS;
}
