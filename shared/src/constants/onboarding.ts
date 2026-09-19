export const ONBOARDING_STEP = {
  INTRODUCTION: 0,
  WORKFLOW: 1,
  COMPANY: 2,
  COMPLETED: 3,
} as const;

export interface OnboardingState {
  onboardingStep?: number | null;
  onboardingCompletedAt?: string | Date | null;
}

export function getOnboardingState(state: OnboardingState) {
  const { onboardingStep: step, onboardingCompletedAt: completedAt } = state;
  if (completedAt) return 'completed';
  switch (step) {
    case ONBOARDING_STEP.INTRODUCTION: return 'introduction';
    case ONBOARDING_STEP.WORKFLOW: return 'workflow';
    case ONBOARDING_STEP.COMPANY: return 'company';
    default: return 'invalid';
  }
}

export function isOnboardingComplete(state: OnboardingState): boolean {
  return getOnboardingState(state) === 'completed';
}
