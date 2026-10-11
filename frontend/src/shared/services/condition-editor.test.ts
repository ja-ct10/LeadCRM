import { describe, expect, it } from 'vitest';
import { campaignFieldOperators, conditionFieldKind, conditionOperatorLabel, conditionOperators, semanticConditionOperator, validConditionScalar, workflowOperators } from '@leadcrm/shared';
import { initialConditionValue, transitionConditionField, transitionConditionOperator } from './condition-editor';

describe('shared condition policies and draft transitions', () => {
  it('keeps Workflow wire keys while exposing the same ordered numeric capabilities to audiences', () => {
    const workflow = workflowOperators('number');
    expect(workflow).toEqual(['equals', 'not_equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal']);
    expect(workflow.map(key => conditionOperatorLabel(key))).toEqual(['Equals', 'Not equals', 'Greater than', 'Greater than or equal', 'Less than', 'Less than or equal']);
    expect(workflow.map(semanticConditionOperator)).toEqual(campaignFieldOperators({ type: 'number' } as never).slice(0, 6));
  });
  it('uses declared metadata and preserves module-specific capabilities', () => {
    expect(conditionFieldKind('Number')).toBe('number');
    expect(conditionFieldKind('123')).toBeUndefined();
    expect(workflowOperators('number')).not.toContain('contains');
    expect(conditionOperators('crm', 'date')).not.toContain('between');
    expect(conditionOperators('audience', 'date')).toContain('between');
    expect(conditionOperatorLabel('gte', 'dropdown', 'date')).toBe('On or after');
    expect(conditionOperatorLabel('lte', 'dropdown', 'date')).toBe('On or before');
    expect(conditionOperators('workflow', 'file')).toEqual([]);
    expect(campaignFieldOperators(undefined)).toEqual([]);
    expect(semanticConditionOperator('__proto__')).toBeUndefined();
  });
  it('does not coerce incomplete, zero, false or non-finite scalar values', () => {
    expect(initialConditionValue('number', 'equals')).toBe('');
    expect(initialConditionValue('boolean', 'equals')).toBe('');
    expect(validConditionScalar('number', '')).toBe(false);
    expect(validConditionScalar('number', 0)).toBe(true);
    expect(validConditionScalar('number', -2.5)).toBe(true);
    expect(validConditionScalar('number', Infinity)).toBe(false);
    expect(validConditionScalar('boolean', false)).toBe(true);
    expect(validConditionScalar('date', '2026-02-30')).toBe(false);
  });
  it('preserves compatible operators but resets operands when switching fields', () => {
    const current = { field: 'count', operator: 'greater_than', value: 12 };
    expect(transitionConditionField(current, { key: 'otherCount', type: 'number' }, workflowOperators('number'))).toEqual({ field: 'otherCount', operator: 'greater_than', value: '' });
    expect(transitionConditionField(current, { key: 'title', type: 'string' }, workflowOperators('string'))).toEqual({ field: 'title', operator: 'equals', value: '' });
  });
  it('switches scalar, presence and range inputs without leaking the old value shape', () => {
    const current = { field: 'createdAt', operator: 'gte', value: '2026-10-11' };
    expect(transitionConditionOperator(current, 'between', 'date', 'audience').value).toEqual({ from: '', to: '' });
    expect(transitionConditionOperator(current, 'any', 'date', 'audience').value).toBeNull();
    expect(transitionConditionOperator({ ...current, operator: 'any', value: null }, 'gte', 'date', 'audience').value).toBe('');
    expect(transitionConditionOperator({ field: 'count', operator: 'equals', value: 0 }, 'greater_than', 'number').value).toBe(0);
    expect(transitionConditionOperator({ field: 'flag', operator: 'equals', value: false }, 'not_equals', 'boolean').value).toBe(false);
  });
});
