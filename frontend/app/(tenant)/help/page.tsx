import { Suspense } from 'react';
import HelpHome from '@/features/tenant/help/ui/help-home';

export const metadata = { title: 'Help Center | LeadCRM' };
export default function Page() {
  return <Suspense fallback={<p role="status">Loading Help Center…</p>}><HelpHome /></Suspense>;
}
