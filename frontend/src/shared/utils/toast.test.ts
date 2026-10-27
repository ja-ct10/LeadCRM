import { beforeEach, expect, it, vi } from 'vitest';
import { toast } from './toast';
import { feedbackError } from './feedback-error';

const raw = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), loading: vi.fn(() => 'operation-id'), dismiss: vi.fn() }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), raw) }));
beforeEach(() => vi.clearAllMocks());

it('uses readable durations and preserves explicit action/persistent durations', () => {
  toast.success('Saved.'); toast.info('Processing.'); toast.warning('Some records failed.'); toast.error('Unable to save.');
  expect(raw.success).toHaveBeenCalledWith('Saved.', { duration: 4000 });
  expect(raw.info).toHaveBeenCalledWith('Processing.', { duration: 4000 });
  expect(raw.warning).toHaveBeenCalledWith('Some records failed.', { duration: 8000 });
  expect(raw.error).toHaveBeenCalledWith('Unable to save.', { duration: 8000 });
  const action = { label: 'Retry', onClick: vi.fn() };
  toast.error('Unable to save.', { action });
  expect(raw.error).toHaveBeenLastCalledWith('Unable to save.', { action, duration: 12000 });
  toast.info('Refresh when ready.', { action, duration: Infinity });
  expect(raw.info).toHaveBeenLastCalledWith('Refresh when ready.', { action, duration: Infinity });
});

it('updates a loading operation by ID and does not suppress independent identical results', () => {
  const id = toast.loading('Saving…'); toast.success('Saved.', { id }); toast.dismiss(id);
  expect(raw.success).toHaveBeenCalledWith('Saved.', { id: 'operation-id', duration: 4000 });
  expect(raw.dismiss).toHaveBeenCalledWith('operation-id');
  toast.success('Saved.'); toast.success('Saved.'); expect(raw.success).toHaveBeenCalledTimes(3);
});

it('keeps actionable errors and replaces transport or database details', () => {
  toast.error('PrismaClientKnownRequestError: SQLSTATE 23505');
  expect(raw.error).toHaveBeenLastCalledWith('Unable to complete this action. Please try again.', { duration: 8000 });
  toast.error('Failed to fetch');
  expect(raw.error).toHaveBeenLastCalledWith('Unable to connect. Check your connection and try again.', { duration: 8000 });
  expect(feedbackError(new Error('Choose a replacement agent.'), 'Unable to save.')).toBe('Choose a replacement agent.');
  expect(feedbackError(Object.assign(new Error('internal detail'), { status: 500 }), 'Unable to save.')).toBe('Unable to save.');
  expect(feedbackError({ status: 403 }, 'Unable to save.')).toContain('administrator');
});
