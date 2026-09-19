export const ONBOARDING_STEP = {
    INTRODUCTION: 0,
    WORKFLOW: 1,
    COMPANY: 2,
    COMPLETED: 3,
};
export function getOnboardingState(state) {
    const { onboardingStep: step, onboardingCompletedAt: completedAt } = state;
    if (completedAt)
        return 'completed';
    switch (step) {
        case ONBOARDING_STEP.INTRODUCTION: return 'introduction';
        case ONBOARDING_STEP.WORKFLOW: return 'workflow';
        case ONBOARDING_STEP.COMPANY: return 'company';
        default: return 'invalid';
    }
}
export function isOnboardingComplete(state) {
    return getOnboardingState(state) === 'completed';
}
