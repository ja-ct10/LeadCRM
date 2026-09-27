'use client';
import { useState } from 'react';
import type {
  ActionDefinition,
  WorkflowAction,
  WorkflowCondition,
  WorkflowOptions,
  TriggerDefinition,
  WorkflowEntity,
} from '@leadcrm/shared';
import { workflowOperators } from '@leadcrm/shared';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { operatorLabels, references } from '../services/workflow-editor';
export const workflowControl =
  'w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]';
export const emptyOptions: WorkflowOptions = {
  users: [],
  pipelines: [],
  templates: [],
  campaigns: [],
};
export const referenceOptions = references;
export function ConditionFields({
  value,
  trigger,
  options,
  onChange,
}: {
  value: WorkflowCondition;
  trigger?: TriggerDefinition;
  options: WorkflowOptions;
  onChange: (value: WorkflowCondition) => void;
}) {
  return (
    <div className="space-y-4 text-sm">
      <label className="block space-y-1">
        Match conditions
        <select
          className={workflowControl}
          value={value.operator}
          onChange={(event) =>
            onChange({ ...value, operator: event.target.value as 'AND' | 'OR' })
          }
        >
          <option value="AND">All conditions (AND)</option>
          <option value="OR">Any condition (OR)</option>
        </select>
      </label>
      {value.conditions.map((rule, index) => {
        const field = trigger?.fields.find(
          (field) => field.field === rule.field,
        );
        const choices =
          field?.options?.map((option) => ({ id: option, name: option })) ??
          references(field?.type ?? '', options);
        const update = (patch: Partial<typeof rule>) =>
          onChange({
            ...value,
            conditions: value.conditions.map((entry, i) =>
              i === index ? { ...entry, ...patch } : entry,
            ),
          });
        return (
          <div
            key={index}
            className="space-y-3 rounded-xl border border-[var(--border)] p-3"
          >
            <p className="text-xs font-semibold text-[var(--muted-foreground)]">
              Condition {index + 1}
            </p>
            <label className="block">
              Field
              <select
                aria-label={`Condition ${index + 1} field`}
                className={workflowControl}
                value={rule.field}
                onChange={(event) => {
                  const next = trigger?.fields.find(
                    (field) => field.field === event.target.value,
                  );
                  update({
                    field: event.target.value,
                    operator: 'equals',
                    value:
                      next?.type === 'number'
                        ? 0
                        : next?.type === 'boolean'
                          ? false
                          : '',
                  });
                }}
              >
                <option value="">Choose a field</option>
                {trigger?.fields.map((field) => (
                  <option key={field.field} value={field.field}>
                    {field.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Operator
              <select
                aria-label={`Condition ${index + 1} operator`}
                className={workflowControl}
                value={rule.operator}
                onChange={(event) =>
                  update({
                    operator: event.target.value as typeof rule.operator,
                  })
                }
              >
                {workflowOperators(field?.type ?? 'string').map((operator) => (
                  <option key={operator} value={operator}>
                    {operatorLabels[operator]}
                  </option>
                ))}
              </select>
            </label>
            {!['is_empty', 'is_not_empty'].includes(rule.operator) && (
              <label className="block">
                Value
                {field?.type === 'boolean' ? (
                  <select
                    className={workflowControl}
                    aria-label={`Condition ${index + 1} value`}
                    value={String(rule.value)}
                    onChange={(event) =>
                      update({ value: event.target.value === 'true' })
                    }
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : choices ? (
                  <select
                    aria-label={`Condition ${index + 1} value`}
                    className={workflowControl}
                    value={String(rule.value ?? '')}
                    onChange={(event) => update({ value: event.target.value })}
                  >
                    <option value="">Choose…</option>
                    {choices.map((choice) => (
                      <option key={choice.id} value={choice.id}>
                        {choice.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    aria-label={`Condition ${index + 1} value`}
                    type={
                      field?.type === 'number'
                        ? 'number'
                        : field?.type === 'date'
                          ? 'date'
                          : 'text'
                    }
                    maxLength={1000}
                    value={String(rule.value ?? '')}
                    onChange={(event) =>
                      update({
                        value:
                          field?.type === 'number' && event.target.value !== ''
                            ? Number(event.target.value)
                            : event.target.value,
                      })
                    }
                  />
                )}
              </label>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange({
                  ...value,
                  conditions: value.conditions.filter((_, i) => i !== index),
                })
              }
            >
              Remove condition
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange({
            ...value,
            conditions: [
              ...value.conditions,
              {
                field: trigger?.fields[0]?.field ?? '',
                operator: 'equals',
                value: trigger?.fields[0]?.type === 'number' ? 0 : '',
              },
            ],
          })
        }
        disabled={!trigger || value.conditions.length >= 30}
      >
        Add condition
      </Button>
    </div>
  );
}
export function ActionFields({
  action,
  definition,
  options,
  entity,
  onChange,
}: {
  action: WorkflowAction;
  definition?: ActionDefinition;
  options: WorkflowOptions;
  entity?: WorkflowEntity;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const [pipeline, setPipeline] = useState('');
  const selectedPipeline =
    options.pipelines.find((entry) =>
      entry.stages.some((stage) => stage.id === action.config.stageId),
    )?.id ?? pipeline;
  return (
    <div className="space-y-4 text-sm">
      <p className="text-[var(--muted-foreground)]">{definition?.description}</p>
      {action.type === 'move_deal_stage' && (
        <label className="block space-y-1">
          Pipeline
          <select
            className={workflowControl}
            value={selectedPipeline}
            onChange={(event) => {
              setPipeline(event.target.value);
              onChange({ ...action.config, stageId: '' });
            }}
          >
            <option value="">All pipelines</option>
            {options.pipelines.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
          <span className="block text-xs text-[var(--muted-foreground)]">
            Stage entry requirements are checked by the Deal service.
          </span>
        </label>
      )}
      {Object.entries(definition?.configSchema ?? {}).map(([key, field]) => {
        let choices =
          references(field.type, options) ??
          field.options?.map((option) => ({ id: option, name: option }));
        if (key === 'stageId' && selectedPipeline)
          choices =
            options.pipelines.find((entry) => entry.id === selectedPipeline)
              ?.stages ?? [];
        if (action.type === 'update_field' && key === 'field')
          choices = [
            {
              id: entity === 'contact' ? 'notes' : 'description',
              name: entity === 'contact' ? 'Notes' : 'Description',
            },
          ];
        const change = (value: unknown) =>
          onChange({ ...action.config, [key]: value });
        const value = String(action.config[key] ?? '');
        const variable = ['title', 'description', 'subject', 'body'].includes(
          key,
        );
        return (
          <div key={key} className="space-y-2">
            <label className="block space-y-1">
              <span>
                {field.label}
                {field.required && <span className="text-red-600"> *</span>}
              </span>
              {choices ? (
                <select
                  aria-label={field.label}
                  className={workflowControl}
                  value={value}
                  onChange={(event) => change(event.target.value)}
                >
                  <option value="">
                    {['assignedUserId', 'userId'].includes(key) &&
                    !field.required
                      ? 'Current record owner'
                      : 'Choose…'}
                  </option>
                  {value && !choices.some((choice) => choice.id === value) && (
                    <option value={value}>Unavailable selection</option>
                  )}
                  {choices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.name}
                    </option>
                  ))}
                </select>
              ) : ['body', 'description', 'value'].includes(key) ? (
                <textarea
                  aria-label={field.label}
                  className={workflowControl}
                  rows={4}
                  maxLength={10000}
                  value={value}
                  onChange={(event) => change(event.target.value)}
                />
              ) : (
                <Input
                  aria-label={field.label}
                  type={field.type === 'number' ? 'number' : 'text'}
                  min={0}
                  max={365}
                  maxLength={255}
                  value={value}
                  onChange={(event) =>
                    change(
                      field.type === 'number' && event.target.value !== ''
                        ? Number(event.target.value)
                        : event.target.value,
                    )
                  }
                />
              )}
            </label>
            {choices?.length === 0 && (
              <p className="text-xs text-[var(--muted-foreground)]">
                No available {field.label.toLowerCase()} options.
              </p>
            )}
            {key === 'dueDaysFromNow' && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Leave empty for 3 days. Use 0 for today or 1 for tomorrow.
              </p>
            )}
            {variable && (
              <div
                className="flex flex-wrap gap-1"
                aria-label={`Personalize ${field.label}`}
              >
                {[
                  ['first_name', 'First name'],
                  ['last_name', 'Last name'],
                  ['email', 'Email'],
                  ['company', 'Company'],
                ].map(([token, label]) => (
                  <button
                    key={token}
                    type="button"
                    title={`Append ${label.toLowerCase()}`}
                    className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted-foreground)] hover:bg-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    onClick={() => change(`${value}{{${token}}}`)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
