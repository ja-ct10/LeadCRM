import { expect, it } from 'vitest';
import { campaignFields, campaignVariableChoices, renderEmailVariables } from '@leadcrm/shared';
import { DEFAULT_CAMXIAN_TEMPLATES } from './default-templates';

it.each(['Email', 'SMS'] as const)('uses canonical catalog tokens in all new %s defaults', type => {
  const choices = campaignVariableChoices(campaignFields('LEADS'), 'LEADS', { forInsertion: true });
  const keys = new Set(choices.filter(choice => choice.personalizationAvailable).map(choice => choice.technicalKey));
  const templates = DEFAULT_CAMXIAN_TEMPLATES.filter(template => template.type === type);
  expect(templates).toHaveLength(3);
  for (const template of templates) {
    const text = ('subject' in template ? template.subject : '') + '\n' + template.content;
    expect(template.content).toMatch(/^Hi {{firstName}},/);
    if ('subject' in template) expect(template.subject).toContain('{{firstName}}');
    expect(text).not.toMatch(/{{(?:first_name|company_name)}}/);
    for (const match of text.matchAll(/{{([^}]+)}}/g)) expect(keys.has(match[1])).toBe(true);
  }
  const companyTemplates = templates.filter(template => template.content.includes('for {{companyName}}') || template.content.includes('with {{companyName}}'));
  expect(companyTemplates).toHaveLength(type === 'Email' ? 3 : 1);
});

it('preserves sender tokens and renders canonical default content', () => {
  for (const template of DEFAULT_CAMXIAN_TEMPLATES.filter(template => template.type === 'Email')) {
    expect(template.content).toContain('{{sender_name}}');
    expect(template.content).toContain('{{sender_email}}');
    const rendered = renderEmailVariables(template.content, { firstName: 'Juan', companyName: 'Customer Company', sender_name: 'Sender', sender_email: 'sender@example.test' });
    expect(rendered).toContain('Hi Juan,'); expect(rendered).toContain('Customer Company');
    expect(rendered).toContain('Sender'); expect(rendered).toContain('sender@example.test');
    expect(rendered).not.toContain('{{');
  }
});
