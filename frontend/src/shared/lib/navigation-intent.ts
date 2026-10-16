'use client';

export type NavigationAction = () => void | Promise<void>;
export const NAVIGATION_INTENT_EVENT = 'leadcrm:navigation-intent';
export type NavigationIntentEvent = CustomEvent<{ navigate: NavigationAction }>;

/** A mounted editor may defer the original UI action; other pages navigate immediately. */
export function requestNavigation(navigate: NavigationAction): void {
  if (typeof window === 'undefined' || window.dispatchEvent(new CustomEvent(NAVIGATION_INTENT_EVENT, {
    cancelable: true,
    detail: { navigate },
  }))) void navigate();
}
