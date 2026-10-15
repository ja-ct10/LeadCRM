import type { ImportModuleConfig } from '../types/import.types';

/**
 * Import configuration for the Accounts module.
 *
 * Required fields: name
 * Optional fields: industry, website, address, size
 */
export const accountImportConfig: ImportModuleConfig = {
  moduleKey: 'accounts',
  moduleLabel: 'Accounts',
  moduleSingular: 'Account',
  backRoute: '/crm/accounts',
  importApiPath: '/crm/accounts/imports',
  detailsRoute: (importId: string) => `/crm/accounts/imports/${importId}`,
  templateFileName: 'account-import-template.csv',
  permission: 'accounts.import',
  duplicateCheckField: 'name',

  requiredFields: [
    {
      key: 'name',
      label: 'Company Name',
      required: true,
      type: 'text',
      autoMapPatterns: [
        'company name', 'company', 'company_name', 'name', 'organization',
        'organisation', 'org', 'account name', 'account_name', 'business name',
      ],
    },
  ],

  optionalFields: [
    {
      key: 'industry',
      label: 'Industry',
      required: false,
      type: 'text',
      autoMapPatterns: ['industry', 'sector', 'business type', 'business_type', 'vertical'],
    },
    {
      key: 'website',
      label: 'Website',
      required: false,
      type: 'url',
      autoMapPatterns: ['website', 'web', 'url', 'site', 'homepage', 'web_site'],
    },
    {
      key: 'address',
      label: 'Full Address',
      required: false,
      type: 'text',
      autoMapPatterns: ['address', 'street', 'street address', 'street_address', 'full address', 'full_address'],
    },
    {
      key: 'size',
      label: 'Company Size',
      required: false,
      type: 'select',
      options: ['1-10', '11-50', '51-200', '200+'],
      autoMapPatterns: ['size', 'company size', 'company_size', 'employees', 'employee count', 'headcount'],
    },
  ],
};
