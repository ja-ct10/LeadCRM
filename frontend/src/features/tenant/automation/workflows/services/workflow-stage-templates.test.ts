import { describe, expect, it } from 'vitest';
import { getAvailableActions, WORKFLOW_TRIGGERS, WorkflowDraftSchema, type WorkflowOptions } from '@leadcrm/shared';
import { bindWorkflowTemplate, workflowTemplateBinding, workflowTemplateDescriptor, workflowTemplateSetupIssues } from './workflow-template-bindings';
import { editorDocument, editorIssues } from './workflow-editor';
import { templateAvailability } from './workflow-template-catalog';
import { WORKFLOW_RECIPES } from './workflow-recipes';
import { resolveWorkflowTemplate, workflowTemplateCatalog, workflowTemplateConfigurationNotes, WORKFLOW_UNSUPPORTED_SCENARIOS } from './workflow-stage-templates';

const uid = (number: number) => `40000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const pipelineId = uid(1), otherPipelineId = uid(2), ownerId = uid(3);
const options: WorkflowOptions = { users: [{ id: ownerId, name: 'Sales agent' }], taskAssignees: [{ id: ownerId, name: 'Sales agent' }], templates: [], campaigns: [], pipelines: [
  { id: pipelineId, name: 'Sales', stages: [
    { id: uid(10), name: 'Lead', order: 0, isDefault: true, isWon: false, isLost: false },
    { id: uid(11), name: 'Contacted', order: 1, isWon: false, isLost: false },
    { id: uid(12), name: 'Qualified', order: 2, requiredFields: ['accountId'], isWon: false, isLost: false },
    { id: uid(13), name: 'Implementation approved', order: 3, isWon: true, isLost: false },
    { id: uid(14), name: 'Declined', order: 4, isWon: false, isLost: true },
    { id: uid(15), name: 'Commercial review', order: 5, isWon: false, isLost: false },
  ] },
  { id: otherPipelineId, name: 'Other', stages: [{ id: uid(20), name: 'Lead', order: 0, isDefault: true }, { id: uid(21), name: 'Qualified', order: 1 }] },
] };

describe('configured stage workflow catalog', () => {
  it('covers every current stage in every pipeline through actual IDs and authoritative terminal flags', () => {
    const entries = workflowTemplateCatalog(options).filter(entry => entry.id.startsWith('stage:'));
    for (const pipeline of options.pipelines) for (const stage of pipeline.stages) {
      const scenario = stage.isWon ? 'won' : stage.isLost ? 'lost' : 'entry';
      const entry = entries.find(entry => entry.id === `stage:${scenario}:${pipeline.id}:${stage.id}`)!;
      expect(entry).toBeDefined();
      expect(entry.pipelineName).toBe(pipeline.name); expect(entry.stageName).toBe(stage.name);
      expect(workflowTemplateBinding(entry.recipe, entry.id, options)).toMatchObject({ pipelineId: pipeline.id, targetStageId: stage.id });
      expect(entry.recipe.actions.at(-1)?.config.assignmentTarget).toEqual({ type: 'record_owner' });
      expect(entry.recipe.actions.at(-1)?.config.priority).toBe('Medium');
      expect(entry.recipe.isActive).toBe(false);
    }
    expect(entries.find(entry => entry.id.includes(':won:'))!.recipe.trigger).toBe('deal.closed_won');
    expect(entries.find(entry => entry.id.includes(':lost:'))!.recipe.trigger).toBe('deal.closed_lost');
    expect(entries.find(entry => entry.stageName === 'Commercial review')!.recipe.actions[0].config.title).toContain('Commercial review');
    expect(new Set(entries.map(entry => entry.id)).size).toBe(entries.length);
  });

  it('gives initial, assignment and eligible Lost reopen scenarios separate supported bindings', () => {
    const entries = workflowTemplateCatalog(options);
    const initial = entries.find(entry => entry.id === `stage:created:${pipelineId}:${uid(10)}`)!;
    expect(initial.recipe.trigger).toBe('deal.created');
    expect(initial.recipe.conditions?.conditions).toEqual([{ field: 'deal.pipelineId', operator: 'equals', value: pipelineId }, { field: 'deal.stageId', operator: 'equals', value: uid(10) }]);
    expect(initial.repeatPolicy).toContain('One first follow-up');
    const assignment = entries.find(entry => entry.id === `stage:assign:${pipelineId}:${uid(11)}`)!;
    expect(assignment.recipe.actions.map(action => action.type)).toEqual(['assign_owner', 'create_task']);
    expect(assignment.recipe.actions[0].config).toEqual({});
    expect(assignment.prerequisites.join(' ')).toContain('alternative');
    const reopened = entries.find(entry => entry.id === `stage:reopen:${pipelineId}:${uid(12)}:${uid(14)}`)!;
    expect(reopened.recipe.conditions?.conditions).toEqual(expect.arrayContaining([
      { field: 'event.previousStageId', operator: 'equals', value: uid(14) }, { field: 'event.newStageId', operator: 'equals', value: uid(12) },
      { field: 'deal.hasEverBeenWon', operator: 'equals', value: false }, { field: 'deal.wonHistoryVerified', operator: 'equals', value: true },
    ]));
    expect(reopened.prerequisites.join(' ')).toContain('accountId');
    expect(reopened.prerequisites.join(' ')).toContain('never have been Won');
    expect(reopened.repeatPolicy).toContain('Superseded queued entries are skipped');
  });

  it('validates generated drafts and identifies all required preview metadata without mutating shared starters', () => {
    const originals = structuredClone(WORKFLOW_RECIPES);
    for (const entry of workflowTemplateCatalog(options).filter(entry => entry.id.startsWith('stage:'))) {
      const draft = structuredClone(entry.recipe);
      for (const action of draft.actions) if (action.type === 'assign_owner') action.config.assignmentTarget = { type: 'user', id: ownerId };
      expect(WorkflowDraftSchema.safeParse(draft).success).toBe(true);
      expect(templateAvailability(draft, WORKFLOW_TRIGGERS, getAvailableActions())).toEqual([]);
      expect(editorIssues(editorDocument(draft), WORKFLOW_TRIGGERS, getAvailableActions(), options)).toEqual([]);
      expect(workflowTemplateSetupIssues(draft, entry.id, options)).toEqual([]);
      expect(entry.prerequisites.length).toBeGreaterThan(0); expect(entry.repeatPolicy).toBeTruthy(); expect(entry.expectedResult).toContain('persisted');
    }
    expect(WORKFLOW_RECIPES).toEqual(originals);
  });

  it('keeps numeric and stable starter URLs compatible and refuses removed or invented dynamic identities', () => {
    for (const [index, recipe] of WORKFLOW_RECIPES.entries()) expect(resolveWorkflowTemplate(String(index), options)?.recipe.name).toBe(recipe.name);
    expect(resolveWorkflowTemplate('won-deal-handoff', options)?.recipe.name).toBe(WORKFLOW_RECIPES[18].name);
    const identity = `stage:entry:${pipelineId}:${uid(11)}`;
    const before = resolveWorkflowTemplate(identity, options)!;
    const renamed = structuredClone(options); renamed.pipelines[0].name = 'Renamed pipeline'; renamed.pipelines[0].stages[1].name = 'Renamed contacted';
    expect(resolveWorkflowTemplate(identity, renamed)?.recipe.name).toContain('Renamed contacted');
    before.recipe.name = 'My custom workflow'; before.recipe.actions[0].config.title = 'My task';
    expect(resolveWorkflowTemplate(identity, options)?.recipe.name).not.toBe('My custom workflow');
    const removed = structuredClone(options); removed.pipelines[0].stages.splice(1, 1);
    expect(resolveWorkflowTemplate(identity, removed)).toBeUndefined();
    expect(resolveWorkflowTemplate(`stage:entry:${otherPipelineId}:${uid(11)}`, options)).toBeUndefined();
    expect(workflowTemplateDescriptor('stage:__proto__:p:s')).toBeUndefined();
    for (const unavailable of ['', '-1', '01', '999', 'stage:timer:p:s']) expect(resolveWorkflowTemplate(unavailable, options)).toBeUndefined();
  });

  it('preserves explicit edits while setup detects unavailable, terminal and incompatible reopen selections', () => {
    const identity = `stage:entry:${pipelineId}:${uid(11)}`;
    const draft = resolveWorkflowTemplate(identity, options)!.recipe;
    draft.name = 'Administrator customization'; draft.actions[0].config.title = 'Preserve title'; draft.actions[0].config.dueDaysFromNow = 4;
    const changed = bindWorkflowTemplate(draft, identity, options, { pipelineId: otherPipelineId, targetStageId: uid(21) });
    expect(changed.name).toBe(draft.name); expect(changed.actions).toEqual(draft.actions);
    const missing = structuredClone(options); missing.pipelines = [];
    expect(workflowTemplateSetupIssues(draft, identity, missing).join(' ')).toContain('unavailable');
    const terminal = bindWorkflowTemplate(draft, identity, options, { targetStageId: uid(13) });
    expect(workflowTemplateSetupIssues(terminal, identity, options).join(' ')).toContain('open');
    const reopenId = `stage:reopen:${pipelineId}:${uid(12)}:${uid(14)}`;
    const invalid = bindWorkflowTemplate(resolveWorkflowTemplate(reopenId, options)!.recipe, reopenId, options, { sourceStageId: uid(13), targetStageId: uid(11) });
    expect(workflowTemplateSetupIssues(invalid, reopenId, options).join(' ')).toContain('Lost source');
  });

  it('makes missing/ambiguous initial stages, invalid terminal flags and unsupported timers explicit', () => {
    const custom = structuredClone(options);
    custom.pipelines[0].stages[0].name = 'Intake';
    custom.pipelines[0].stages[2].name = 'Evaluated';
    custom.pipelines[0].stages[3].isLost = true;
    const entries = workflowTemplateCatalog(custom);
    expect(entries.some(entry => entry.id.startsWith(`stage:created:${pipelineId}:`))).toBe(false);
    expect(entries.some(entry => entry.id.startsWith(`stage:reopen:${pipelineId}:`))).toBe(false);
    expect(workflowTemplateConfigurationNotes(custom).join(' ')).toContain('exactly one open Lead');
    expect(workflowTemplateConfigurationNotes(custom).join(' ')).toContain('conflicting Won and Lost');
    expect(WORKFLOW_UNSUPPORTED_SCENARIOS.join(' ')).toContain('overdue Task timers are unavailable');
    custom.pipelines[1].stages.push({ id: uid(22), name: 'Lead' });
    expect(workflowTemplateCatalog(custom).some(entry => entry.id.startsWith(`stage:created:${otherPipelineId}:`))).toBe(false);
  });

  it('treats configured stage labels as plain text rather than message variables', () => {
    const custom = structuredClone(options);
    custom.pipelines[0].stages[5].name = '{{not_a_variable}}';
    const recipe = resolveWorkflowTemplate(`stage:entry:${pipelineId}:${uid(15)}`, custom)!.recipe;
    expect(recipe.name).toContain('{{not_a_variable}}');
    expect(recipe.actions[0].config.title).not.toContain('{{');
    expect(recipe.actions[0].config.description).not.toContain('{{');
  });
});
