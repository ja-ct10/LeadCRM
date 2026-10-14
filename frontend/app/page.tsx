import type { Metadata } from 'next';
import PublicHomePage from '@/features/tenant/legal/public-home-page';

export const metadata: Metadata = {
  title: 'LeadCRM | Camxian Technologies',
  description: 'Camxian Technologies’ internal CRM for customer relationships, sales and connected work email.',
  alternates: { canonical: 'https://lead-crm.tech/' },
};
export default function Page() { return <PublicHomePage />; }
