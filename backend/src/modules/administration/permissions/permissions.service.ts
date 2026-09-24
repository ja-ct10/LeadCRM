import { PERMISSION_MODULES } from '@leadcrm/shared';

/** The role builder and persistence validation use the same module/flag registry. */
export function getAllPermissions() {
  return PERMISSION_MODULES;
}
