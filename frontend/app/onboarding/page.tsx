import { AuthGuard } from '@/shared/providers/auth-guard';
import OnboardingPage from '@/features/tenant/onboarding/ui/onboarding-page';

export default function OnboardingRoute() {
  return <AuthGuard><OnboardingPage /></AuthGuard>;
}
