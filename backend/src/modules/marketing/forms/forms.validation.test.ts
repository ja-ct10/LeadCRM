import { describe, expect, it } from 'vitest';
import { ClosingFieldInputSchema, CreateFormSchema, UpdateFormSchema, defaultContactForm, FormDefinitionSchema, PublicSubmissionSchema, getCrmFieldCatalog, leadCatalogFormField, validateFormValues, withProductOptions } from '@leadcrm/shared';
const products = [{ id: 'b2855ea0-ae4f-4e7b-97fa-5d68f2a9c550', name: 'Smart Lock', dealValue: 10, active: true, createdAt: '', updatedAt: '' }];
const fields = () => withProductOptions(defaultContactForm().fields, products);
const valid = { firstName: "  Anne-Marie  ", lastName: "O'Connor", email: ' ANNE@example.com ', phone: '9123456789', productInterest: products[0].id };
describe('Forms authoritative validation', () => {
  it.each(['', '   ', '\t\n'])('requires a trimmed name at create, update and definition boundaries (%j)', name => {
    expect(CreateFormSchema.safeParse({ name }).success).toBe(false);
    expect(UpdateFormSchema.safeParse({ name, revision: 0 }).success).toBe(false);
    expect(FormDefinitionSchema.safeParse({ ...defaultContactForm(), name }).success).toBe(false);
  });
  it('adapts Lead labels and canonical identities without generic type cards or foreign modules', () => {
    const age = { ...ClosingFieldInputSchema.parse({ name: 'Age', type: 'Number', required: false, module: 'leads', group: 'Basic Information' }), id: 'age-id', technicalAlias: 'age', version: 1 };
    const catalog = getCrmFieldCatalog('leads', [age]);
    const inputs = catalog.flatMap(field => leadCatalogFormField(field) ?? []);
    expect(inputs).toContainEqual(expect.objectContaining({ label: 'First Name', mapToField: 'firstName', type: 'single-line' }));
    expect(inputs).toContainEqual(expect.objectContaining({ label: 'Email', mapToField: 'email', type: 'email' }));
    expect(inputs).toContainEqual(expect.objectContaining({ label: 'Age', customFieldId: 'age-id', type: 'number' }));
    expect(inputs.some(field => ['Text', 'Number', 'Date', 'File Upload'].includes(field.label))).toBe(false);
    for (const module of ['contacts', 'accounts', 'deals'] as const) expect(getCrmFieldCatalog(module).flatMap(field => leadCatalogFormField(field) ?? [])).toEqual([]);
    const entry = catalog.find(field => field.customFieldId === age.id)!;
    expect(leadCatalogFormField({ ...entry, label: 'Age in years' })?.customFieldId).toBe(age.id);
    expect(leadCatalogFormField({ ...entry, active: false })).toBeUndefined();
    expect(leadCatalogFormField({ ...entry, visibleInForm: false })).toBeUndefined();
  });
  it('keeps Header, Paragraph and Separator static and rejects injected layout answers or mappings', () => {
    const layout = [{ id: 'header', type: 'header' as const, label: 'Welcome', required: true }, { id: 'paragraph', type: 'paragraph' as const, label: 'Details', required: true }, { id: 'separator', type: 'divider' as const, label: 'Separator line', required: true }];
    expect(validateFormValues(layout, {})).toEqual({ values: {}, errors: {} });
    expect(validateFormValues(layout, { header: 'Injected' }).errors).toHaveProperty('header');
    expect(validateFormValues(layout, { separator: 'Injected' }).errors).toHaveProperty('separator');
    expect(FormDefinitionSchema.safeParse({ ...defaultContactForm(), fields: [{ ...layout[2], mapToField: 'firstName' }] }).success).toBe(false);
    expect(FormDefinitionSchema.safeParse({ ...defaultContactForm(), fields: [{ ...layout[0], customFieldId: 'age' }] }).success).toBe(false);
    const duplicate = { id: 'a', type: 'number', label: 'Age', customFieldId: 'age' };
    expect(FormDefinitionSchema.safeParse({ ...defaultContactForm(), fields: [duplicate, { ...duplicate, id: 'b' }] }).success).toBe(false);
  });
  it('creates independent default copies in the exact order', () => {
    const a = defaultContactForm(), b = defaultContactForm(); a.fields[0].label = 'Changed';
    expect(b.fields.map(f => f.label)).toEqual(['First Name','Last Name','Company','Contact Number','Email Address','Product Interest','Full Address']);
    expect(b.fields[5].options).toEqual([]);
  });
  it('normalizes identity without destroying names', () => { const r = validateFormValues(fields(), valid); expect(r.errors).toEqual({}); expect(r.values).toMatchObject({ firstName: 'Anne-Marie', lastName: "O'Connor", email: 'anne@example.com', phone: '+639123456789' }); });
  it.each(['', '   '])('rejects empty required fields (%j)', firstName => expect(validateFormValues(fields(), { ...valid, firstName }).errors.firstName).toBeTruthy());
  it.each(['8123456789', '09123456789', '+19123456789', '9123 456789', '91234567890'])('rejects invalid phone %s', phone => expect(validateFormValues(fields(), { ...valid, phone }).errors.phone).toBeTruthy());
  it('rejects unknown options, invalid email and unknown fields', () => { const r = validateFormValues(fields(), { ...valid, email: 'invalid', productInterest: 'Injected', tenantId: 'other' }); expect(Object.keys(r.errors).sort()).toEqual(['email','productInterest','tenantId']); });
  it('bounds values and rejects control characters', () => { expect(validateFormValues(fields(), { ...valid, firstName: 'a'.repeat(101), address: '\u0000' }).errors).toHaveProperty('firstName'); });
  it('rejects CSS, unsupported uploads, duplicate mappings and IDs', () => {
    const f = defaultContactForm(); f.design.generalBg = 'red; background:url(https://evil.test)'; expect(FormDefinitionSchema.safeParse(f).success).toBe(false);
    expect(FormDefinitionSchema.safeParse({ ...defaultContactForm(), fields: [{ id: 'file1', label: 'Upload', type: 'file' }] }).success).toBe(false);
    for (const mapToField of ['status', 'accountId', 'assignedUserId', 'stageId', 'contacts.email']) {
      expect(FormDefinitionSchema.safeParse({ ...defaultContactForm(), fields: [{ id: 'unsafe', label: 'Unsafe mapping', type: 'single-line', mapToField }] }).success).toBe(false);
    }
    expect(FormDefinitionSchema.safeParse({ ...defaultContactForm(), fields: [{ id: 'badEmail', label: 'Email', type: 'number', mapToField: 'email' }] }).success).toBe(false);
    const g = defaultContactForm(); g.fields.push(g.fields[0]); expect(FormDefinitionSchema.safeParse(g).success).toBe(false);
  });
  it('whitelists envelope and UTM keys with bounded lengths', () => {
    const body = { requestId: 'b2855ea0-ae4f-4e7b-97fa-5d68f2a9c550', version: 1, values: valid };
    expect(PublicSubmissionSchema.safeParse(body).success).toBe(true);
    expect(PublicSubmissionSchema.safeParse({ version: 1, values: valid }).success).toBe(false);
    expect(PublicSubmissionSchema.safeParse({ ...body, tenantId: 'evil' }).success).toBe(false);
    expect(PublicSubmissionSchema.safeParse({ ...body, tracking: { arbitrary: 'x' } }).success).toBe(false);
    expect(PublicSubmissionSchema.safeParse({ ...body, tracking: { utm_source: 'x'.repeat(201) } }).success).toBe(false);
  });
});
