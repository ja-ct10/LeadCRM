/**
 * Returns an ISO date string for the start of a given number of days ago.
 */
export function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the current UTC timestamp as an ISO string.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Formats a Date to MM/DD/YYYY (Philippine locale default).
 */
export function formatDatePH(date: Date): string {
  return date.toLocaleDateString('en-PH', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}
