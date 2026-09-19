import { AuthGuard } from '@/shared/providers/auth-guard';
import ChangePasswordPage from '@/features/tenant/auth/ui/change-password-page';
export default function Page() { return <AuthGuard><ChangePasswordPage /></AuthGuard>; }
