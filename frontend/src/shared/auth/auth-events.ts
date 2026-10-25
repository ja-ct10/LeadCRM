export const PASSWORD_CHANGE_REQUIRED_EVENT = 'leadcrm:password-change-required';
export const SESSION_METADATA_EVENT = 'leadcrm:session-metadata';
export const SESSION_ENDED_EVENT = 'leadcrm:session-ended';
export const SESSION_CHANGED_EVENT = 'leadcrm:session-changed';
export const SESSION_ACTIVITY_KEY = 'leadcrm:session-activity';

// Correlate transport events with the auth lifecycle; late responses cannot end a new login.
let authEpoch = 0;
export const getAuthEpoch = () => authEpoch;
export const advanceAuthEpoch = () => ++authEpoch;

export function publishSessionActivity(value: { userId: string; sessionId?: string; at: number; logout?: boolean; idle?: boolean }): void {
  try { localStorage.setItem(SESSION_ACTIVITY_KEY, JSON.stringify(value)); } catch { /* Server validation still enforces expiration when storage is unavailable. */ }
}

export function markIdleExpired(): void {
  try { sessionStorage.setItem('leadcrm:idle-expired', '1'); } catch { /* The redirect can also carry this non-sensitive reason. */ }
}
