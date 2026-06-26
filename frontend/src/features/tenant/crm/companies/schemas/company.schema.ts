// Plain validation — no zod (not in project dependencies)

export interface CompanyFormValues {
  name: string;
  industry?: string;
  size?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  assignedUserId?: string;
  notes?: string;
}

export interface CompanyFormErrors {
  name?: string;
  email?: string;
  website?: string;
}

export function validateCompanyForm(values: CompanyFormValues): CompanyFormErrors {
  const errors: CompanyFormErrors = {};

  if (!values.name?.trim()) {
    errors.name = 'Company name is required';
  }

  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Must be a valid email';
  }

  if (values.website && !/^https?:\/\/.+/.test(values.website)) {
    errors.website = 'Must start with http:// or https://';
  }

  return errors;
}
