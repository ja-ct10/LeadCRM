/**
 * workflowConditionEvaluator.ts
 *
 * Pure, stateless workflow condition evaluation logic.
 * Extracted from DataContext · no React state dependencies.
 *
 * Usage:
 *   import { evaluateWorkflowCondition } from './workflowConditionEvaluator';
 *   const met = evaluateWorkflowCondition(workflow, { contact, deal }, allDeals, allContacts);
 */

import type { Workflow, Contact, Deal } from '@/store/types';

interface EvaluationContext {
  contact?: Contact;
  deal?: Deal;
}

interface ConditionRule {
  field: string;
  operator: string;
  value: string;
}

interface ComplexCondition {
  logic: 'AND' | 'OR';
  rules: ConditionRule[];
}

// ··· Field resolution ························································

function resolveContext(
  field: string,
  ctx: EvaluationContext,
  allDeals: Deal[],
  allContacts: Contact[],
): EvaluationContext {
  let { deal, contact } = ctx;

  if (field.startsWith('deal.') && !deal && contact) {
    deal = allDeals.find(
      d =>
        (d.companyName && contact!.companyName &&
          d.companyName.toLowerCase() === contact!.companyName.toLowerCase()) ||
        (d.contactPerson && contact!.contactPerson &&
          d.contactPerson.toLowerCase() === contact!.contactPerson.toLowerCase()),
    );
  } else if (field.startsWith('contact.') && !contact && deal) {
    contact = allContacts.find(
      c =>
        (c.companyName && deal!.companyName &&
          c.companyName.toLowerCase() === deal!.companyName.toLowerCase()) ||
        (c.contactPerson && deal!.contactPerson &&
          c.contactPerson.toLowerCase() === deal!.contactPerson.toLowerCase()),
    );
  }

  return { deal, contact };
}

function resolveFieldValue(
  field: string,
  ctx: EvaluationContext,
): unknown {
  const { deal, contact } = ctx;

  if (field === 'deal.daysUntilClose' && deal?.expectedCloseDate) {
    const closeDate = new Date(deal.expectedCloseDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    closeDate.setHours(0, 0, 0, 0);
    return Math.ceil((closeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  if (field === 'contact.daysUntilClose' && contact?.expectedCloseDate) {
    const closeDate = new Date(contact.expectedCloseDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    closeDate.setHours(0, 0, 0, 0);
    return Math.ceil((closeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  if (field.startsWith('deal.')) return deal?.[field.split('.')[1] as keyof Deal];
  if (field.startsWith('contact.')) return contact?.[field.split('.')[1] as keyof Contact];

  return undefined;
}

// ··· Operator evaluation ·····················································

function applyOperator(actualValue: unknown, operator: string, value: string): boolean {
  if (operator === 'is_empty') {
    return actualValue === undefined || actualValue === null || String(actualValue).trim() === '';
  }
  if (operator === 'is_not_empty') {
    return actualValue !== undefined && actualValue !== null && String(actualValue).trim() !== '';
  }

  if (actualValue === undefined || actualValue === null) return false;

  const numActual = Number(actualValue);
  const numValue  = Number(value);
  const strActual = String(actualValue).toLowerCase();
  const strValue  = String(value).toLowerCase();

  switch (operator) {
    case '>':           return !isNaN(numActual) && numActual > numValue;
    case '<':           return !isNaN(numActual) && numActual < numValue;
    case '>=':          return !isNaN(numActual) && numActual >= numValue;
    case '<=':          return !isNaN(numActual) && numActual <= numValue;
    case '==':          return strActual === strValue;
    case '!=':          return strActual !== strValue;
    case 'contains':    return strActual.includes(strValue);
    case 'not_contains': return !strActual.includes(strValue);
    case 'starts_with': return strActual.startsWith(strValue);
    case 'ends_with':   return strActual.endsWith(strValue);
    default:            return false;
  }
}

// ··· Rule evaluation ·························································

function evaluateRule(
  rule: ConditionRule,
  ctx: EvaluationContext,
  allDeals: Deal[],
  allContacts: Contact[],
): boolean {
  const resolved = resolveContext(rule.field, ctx, allDeals, allContacts);
  const actualValue = resolveFieldValue(rule.field, resolved);
  return applyOperator(actualValue, rule.operator, rule.value);
}

// ··· Main export ·····························································

/**
 * Evaluates whether a workflow's condition is satisfied for the given context.
 *
 * @param workflow   - The workflow whose condition to evaluate
 * @param ctx        - The triggering entity context (contact and/or deal)
 * @param allDeals   - Full deals array for cross-entity resolution
 * @param allContacts - Full contacts array for cross-entity resolution
 * @returns true if condition is met (or no condition exists), false otherwise
 */
export function evaluateWorkflowCondition(
  workflow: Workflow,
  ctx: EvaluationContext,
  allDeals: Deal[],
  allContacts: Contact[],
): boolean {
  if (!workflow.condition) return true;

  try {
    if (workflow.condition.startsWith('{')) {
      const complex: ComplexCondition = JSON.parse(workflow.condition);
      const check = (rule: ConditionRule) => evaluateRule(rule, ctx, allDeals, allContacts);

      return complex.logic === 'OR'
        ? complex.rules.some(check)
        : complex.rules.every(check);
    }

    // Legacy string conditions
    if (workflow.condition.startsWith('title_contains_')) {
      const search = workflow.condition.replace('title_contains_', '').toLowerCase();
      const title = ctx.deal?.title || ctx.contact?.companyName || '';
      return title.toLowerCase().includes(search);
    }

    // Shorthand: value_above_NNNN
    if (workflow.condition.startsWith('value_above_')) {
      const threshold = parseFloat(workflow.condition.replace('value_above_', ''));
      const val = ctx.deal?.value ?? 0;
      return val > threshold;
    }

    // Shorthand: no_activity_14_days (checked externally via lastStageChangeDate)
    if (workflow.condition === 'no_activity_14_days') {
      const lastDate = ctx.deal?.lastStageChangeDate ?? ctx.deal?.createdAt;
      if (!lastDate) return false;
      const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
      return daysSince >= 14;
    }

    if (workflow.condition.includes('deal value >')) {
      const threshold = parseFloat(workflow.condition.split('>')[1].trim());
      const val = ctx.deal?.value ??
        (ctx.contact ? allDeals.find(d => d.companyName === ctx.contact?.companyName)?.value ?? 0 : 0);
      return val > threshold;
    }

    if (workflow.condition.includes('contact score >')) {
      const threshold = parseFloat(workflow.condition.split('>')[1].trim());
      const score = ctx.contact?.score ??
        (ctx.deal ? allContacts.find(c => c.companyName === ctx.deal?.companyName)?.score ?? 0 : 0);
      return score > threshold;
    }

  } catch (_e) {
    // Condition parse failure · treat as non-matching to prevent broken automations
    return false;
  }

  return true;
}
