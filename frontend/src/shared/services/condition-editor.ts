import { conditionFieldKind, conditionOperatorValueShape } from '@leadcrm/shared';

type Profile = 'workflow' | 'audience';
type ConditionDraft = { field: string; operator: string; value: unknown };
type ConditionValue = string | number | boolean | null | string[] | { from: string; to: string };
type WorkflowValue = string | number | boolean | null;
/** A blank draft is intentional; persistence validation decides when the rule is complete. */
export function initialConditionValue(type: string | undefined, operator: string, profile?: 'workflow'): WorkflowValue;
export function initialConditionValue(type: string | undefined, operator: string, profile: 'audience'): ConditionValue;
export function initialConditionValue(type: string | undefined, operator: string, profile: Profile): ConditionValue;
export function initialConditionValue(type: string | undefined, operator: string, profile: Profile = 'workflow'): ConditionValue {
  const shape = conditionOperatorValueShape(operator);
  if (shape === 'none') return null;
  if (shape === 'range') return { from: '', to: '' };
  if (shape === 'collection' || (profile === 'audience' && conditionFieldKind(type) === 'collection')) return [];
  return '';
}
export function transitionConditionField(current: ConditionDraft, field: { key: string; type: string } | undefined, operators: readonly string[], profile?: 'workflow'): { field: string; operator: string; value: WorkflowValue };
export function transitionConditionField(current: ConditionDraft, field: { key: string; type: string } | undefined, operators: readonly string[], profile: 'audience'): { field: string; operator: string; value: ConditionValue };
export function transitionConditionField(current: ConditionDraft, field: { key: string; type: string } | undefined, operators: readonly string[], profile: Profile = 'workflow') {
  const operator = operators.includes(current.operator) ? current.operator : operators[0] ?? '';
  return { field: field?.key ?? '', operator, value: initialConditionValue(field?.type, operator, profile) };
}
export function transitionConditionOperator(current: ConditionDraft, operator: string, type?: string, profile?: 'workflow'): { field: string; operator: string; value: WorkflowValue };
export function transitionConditionOperator(current: ConditionDraft, operator: string, type: string | undefined, profile: 'audience'): { field: string; operator: string; value: ConditionValue };
export function transitionConditionOperator(current: ConditionDraft, operator: string, type?: string, profile: Profile = 'workflow') {
  const currentShape = conditionOperatorValueShape(current.operator), nextShape = conditionOperatorValueShape(operator);
  return { field: current.field, operator, value: nextShape === 'none' || currentShape !== nextShape ? initialConditionValue(type, operator, profile) : current.value };
}
