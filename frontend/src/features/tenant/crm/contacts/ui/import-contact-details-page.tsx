'use client';

import { useParams } from 'next/navigation';
import ImportDetailsPage from '@/features/tenant/crm/shared/import/ui/import-details-page';

export default function ImportContactDetailsPage() {
  const params = useParams();
  const importId = params?.importId as string;

  return <ImportDetailsPage moduleKey="contacts" importId={importId} />;
}
