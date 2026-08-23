'use client';

import { useParams } from 'next/navigation';
import ImportDetailsPage from '@/features/tenant/crm/shared/import/ui/import-details-page';

export default function ImportLeadDetailsPage() {
  const params = useParams();
  const importId = params?.importId as string;

  return <ImportDetailsPage moduleKey="leads" importId={importId} />;
}
