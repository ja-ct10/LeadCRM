export const PASSWORD_MAX_AGE_DAYS = 90;

const PASSWORD_MAX_AGE_MS = PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
export const PASSWORD_EXPIRY_WARNING_DAYS = 1;
export function isPasswordExpiryWarningDue(changed: Date | null | undefined, now = new Date()): boolean {
  if (!changed) return false;
  const expiresAt = +changed + PASSWORD_MAX_AGE_MS;
  return +now >= expiresAt - PASSWORD_EXPIRY_WARNING_DAYS * 86400000 && +now < expiresAt;
}

export function isPasswordExpired(
  passwordChangedAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!passwordChangedAt) return false;
  return now.getTime() >= passwordChangedAt.getTime() + PASSWORD_MAX_AGE_MS;
}
