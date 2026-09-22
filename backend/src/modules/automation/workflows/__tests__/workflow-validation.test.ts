import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkflowDraft } from '@leadcrm/shared';
import { NotFoundError } from '../../../../shared/errors/http-error';
import { validateAction } from '../../actions/action-validation';
import { validateWorkflow } from '../workflow-validation';

vi.mock('../../actions/action-validation', () => ({ validateAction: vi.fn() }));

const draft: WorkflowDraft = {
  name: 'Follow up',
  trigger: 'lead.created',
  isActive: true,
  actions: [{ type: 'create_task', config: { title: 'Call lead' } }],
};

describe('workflow activation errors', () => {
  beforeEach(() => vi.resetAllMocks());

  it('identifies the action when a configuration reference is invalid', async () => {
    vi.mocked(validateAction).mockRejectedValue(new NotFoundError('Active workspace user'));
    await expect(validateWorkflow(draft, 'tenant')).rejects.toThrow('Action 1: Active workspace user not found');
  });

  it('preserves unexpected failures for generic server error handling', async () => {
    const databaseFailure = new Error('Internal database connection details');
    vi.mocked(validateAction).mockRejectedValue(databaseFailure);
    await expect(validateWorkflow(draft, 'tenant')).rejects.toBe(databaseFailure);
  });
});
