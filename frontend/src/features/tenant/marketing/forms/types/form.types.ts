'use client';

export type FormFieldType =
  | 'heading'
  | 'paragraph'
  | 'single-line'
  | 'multi-line'
  | 'email'
  | 'phone'
  | 'number'
  | 'checkbox'
  | 'dropdown'
  | 'url'
  | 'contact-name'
  | 'contact-email'
  | 'contact-phone'
  | 'company-name'
  | 'company-website';

export type FormStatus = 'draft' | 'published';

export type FormFieldRadius = 'none' | 'sm' | 'md' | 'lg' | 'full';
export type FormFieldSize = 'sm' | 'regular' | 'lg';

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];         // for dropdown
  mapToField?: string;        // CRM field mapping
}

export interface FormDesign {
  generalBg: string;
  generalBorder: string;
  generalText: string;
  fieldBg: string;
  fieldBorder: string;
  fieldText: string;
  fieldRadius: FormFieldRadius;
  fieldSize: FormFieldSize;
  buttonBg: string;
  buttonBorder: string;
  buttonText: string;
}

export interface FormSettings {
  notificationEmail: string;
  trackUrlParams: boolean;
  utmParams: Array<{ key: string; mapTo: string }>;
}

export interface FormRecord {
  id: string;
  tenantId: string;
  name: string;
  status: FormStatus;
  fields: FormField[];
  design: FormDesign;
  settings: FormSettings;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface CreateFormInput {
  name: string;
  tenantId: string;
}

export const DEFAULT_DESIGN: FormDesign = {
  generalBg: '',
  generalBorder: '',
  generalText: '',
  fieldBg: '',
  fieldBorder: '',
  fieldText: '',
  fieldRadius: 'none',
  fieldSize: 'regular',
  buttonBg: '',
  buttonBorder: '',
  buttonText: '',
};

export const DEFAULT_SETTINGS: FormSettings = {
  notificationEmail: '',
  trackUrlParams: true,
  utmParams: [
    { key: 'utm_source', mapTo: '' },
    { key: 'utm_medium', mapTo: '' },
    { key: 'utm_campaign', mapTo: '' },
    { key: 'utm_content', mapTo: '' },
    { key: 'utm_term', mapTo: '' },
  ],
};

export const DEFAULT_FIELDS: FormField[] = [
  { id: 'field-heading-1', type: 'heading', label: 'Heading' },
  { id: 'field-fullname-1', type: 'contact-name', label: 'Full name', placeholder: 'e.g. John Doe', required: false, mapToField: 'contact_name' },
  { id: 'field-email-1', type: 'contact-email', label: 'Email address', placeholder: 'e.g. johndoe@example.com', required: false, mapToField: 'contact_email' },
];
