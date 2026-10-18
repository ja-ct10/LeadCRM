import type { WorkflowAvailability } from '@leadcrm/shared';

export function memberAvailable(userId: string, availability: WorkflowAvailability, now = new Date()): boolean {
  const member = availability.members.find(row => row.userId === userId);
  if (member?.unavailable) return false;
  const schedule = member?.schedule ?? availability.schedule;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: availability.timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find(row => row.type === name)!.value;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday'));
  const time = `${part('hour')}:${part('minute')}`;
  if (schedule.start < schedule.end) return schedule.days.includes(day) && time >= schedule.start && time < schedule.end;
  // An overnight shift belongs to its starting day, including the hours after midnight.
  return (schedule.days.includes(day) && time >= schedule.start) || (schedule.days.includes((day + 6) % 7) && time < schedule.end);
}
export type AssignmentReservation = { token: string; expiresAt: number; entityId?: string; weight?: number };
export function liveReservations(value: unknown, now: number): AssignmentReservation[] {
  return Array.isArray(value) ? value.filter((row): row is AssignmentReservation => !!row && typeof row === 'object' &&
    typeof row.token === 'string' && typeof row.expiresAt === 'number' && row.expiresAt > now) : [];
}
