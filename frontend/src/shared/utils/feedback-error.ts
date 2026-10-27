/** Preserve actionable application errors while keeping transport/database details out of the UI. */
export function feedbackMessage(message: string, fallback = 'Unable to complete this action. Please try again.'): string {
  if (!message.trim()) return fallback;
  if (/failed to fetch|networkerror|fetch failed|ECONN|ENOTFOUND|network request failed/i.test(message)) {
    return 'Unable to connect. Check your connection and try again.';
  }
  if (/Prisma|SQLSTATE|\bstack trace\b|\bat .+\(.+:\d+:\d+\)|<html|<!doctype|unexpected token|internal server error|API request failed/i.test(message)) return fallback;
  return message;
}

export function feedbackError(error: unknown, fallback: string): string {
  const status = (error as { status?: number } | null)?.status;
  if (status === 403) return 'You do not have permission for this action. Ask an administrator for access.';
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  if (status && status >= 500) return fallback;
  return error instanceof Error ? feedbackMessage(error.message, fallback) : fallback;
}
