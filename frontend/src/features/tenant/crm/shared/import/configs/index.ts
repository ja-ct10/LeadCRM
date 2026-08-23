import type { ImportModuleConfig } from '../types/import.types';
import { leadImportConfig } from './lead-import.config';
import { accountImportConfig } from './account-import.config';
import { contactImportConfig } from './contact-import.config';

/**
 * Registry of all CRM import module configurations.
 * Add new modules here as they become import-capable.
 */
const IMPORT_CONFIGS: Record<string, ImportModuleConfig> = {
  leads: leadImportConfig,
  accounts: accountImportConfig,
  contacts: contactImportConfig,
};

/**
 * Retrieve the import configuration for a given module key.
 * Throws if the module is not registered.
 */
export function getImportConfig(moduleKey: string): ImportModuleConfig {
  const config = IMPORT_CONFIGS[moduleKey];
  if (!config) {
    throw new Error(`Import configuration not found for module: "${moduleKey}"`);
  }
  return config;
}

export { leadImportConfig, accountImportConfig, contactImportConfig };
export { IMPORT_CONFIGS };
