'use client';
import { useParams } from 'next/navigation';
import ImportDetailsPage from '@/features/tenant/crm/shared/import/ui/import-details-page';
export default function Page() { const { importId } = useParams<{ importId: string }>(); return <ImportDetailsPage moduleKey="deals" importId={importId} />; }
