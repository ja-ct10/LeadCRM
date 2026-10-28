import { describe, expect, it } from 'vitest';
import { assignmentName, CreateTaskSchema, ProductInterestSchema, WorkflowDraftSchema } from '@leadcrm/shared';
import { recordName, recordText } from '../record-validation';

const text = `ñ é 中文 日本語 한글 مرحبا 😊 & ' " < > ∑ ₱ e\u0301 <tag>literal</tag>`;

describe('literal Unicode text', () => {
  it('preserves markup-like text and combining characters without entity encoding', () => {
    expect(recordName().parse(`  ${text}  `)).toBe(text);
    expect(recordText().parse(`  ${text}\nSecond line\t😊  `)).toBe(`${text}\nSecond line\t😊`);
    expect(recordText().parse('R&D < 10 > 2 &amp;')).toBe('R&D < 10 > 2 &amp;');
    expect(assignmentName(text)).toBe(text);
  });

  it('retains field-specific trimming and preserves Task note whitespace', () => {
    expect(ProductInterestSchema.parse({ name: `  ${text} `, category: text, description: ` ${text}\n😊 `, dealValue: 12 }).description).toBe(`${text}\n😊`);
    const workflow = WorkflowDraftSchema.parse({ name: text, description: ` ${text}\n😊 `, trigger: 'deal.created', actions: [] });
    expect(workflow.description).toBe(`${text}\n😊`);
    const description = `  ${text}\n😊  `;
    expect(CreateTaskSchema.parse({ title: text, description, dueDate: '2027-01-01T00:00:00Z', dealIds: ['deal'] }).description).toBe(description);
  });

  it('rejects unsupported characters explicitly rather than deleting them', () => {
    expect(recordText().safeParse('before\u0000after').success).toBe(false);
    expect(WorkflowDraftSchema.safeParse({ name: 'Workflow', description: 'before\u0000after', trigger: 'deal.created', actions: [] }).success).toBe(false);
    expect(CreateTaskSchema.safeParse({ title: 'Task', description: 'before\u0000after', dueDate: '2027-01-01T00:00:00Z', dealIds: ['deal'] }).success).toBe(false);
    expect(recordName().safeParse('   ').success).toBe(false);
    expect(recordText(3).safeParse('four').success).toBe(false);
  });
});
