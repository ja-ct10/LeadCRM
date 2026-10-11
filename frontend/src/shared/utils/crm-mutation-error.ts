import { toast } from 'sonner';
export function showCrmMutationError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if ((error as { status?: number })?.status === 403) toast.error('Access Denied', { description: message });
  else toast.error(message);
}
