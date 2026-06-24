'use client';

import { useRouter } from 'next/navigation';
import PipelinePage from '@/client-admin/crm/pipeline/PipelinePage';
import { PATH_TO_PATHNAME } from '@/shared/lib/route-map';

// PipelinePage accepts a navigate prop — wire it to the router
export default function PipelineRoute() {
  const router = useRouter();
  const navigate = (path: string) => router.push(PATH_TO_PATHNAME[path] ?? '/dashboard');
  return <PipelinePage navigate={navigate} />;
}
