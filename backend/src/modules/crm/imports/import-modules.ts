import type { CrmImportModule } from '@leadcrm/shared';
import type { CrmImportModule as DbModule } from '@prisma/client';
import { ValidationError } from '../../../shared/errors/http-error';

/** Route names remain plural; persistence has one controlled discriminator. */
export const importModules: Record<CrmImportModule, DbModule> = {
  leads: 'LEAD', contacts: 'CONTACT', accounts: 'ACCOUNT',
};

export function databaseImportModule(module: CrmImportModule): DbModule {
  if (!Object.prototype.hasOwnProperty.call(importModules, module)) throw new ValidationError('Unsupported CRM import module.');
  return importModules[module];
}
