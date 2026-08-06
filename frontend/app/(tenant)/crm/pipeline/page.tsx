'use client';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
const PipelinePage = dynamic(() => import('../../../../src/features/tenant/crm/pipeline/ui/pipeline-page'), { ssr: false });
export default function PipelineRoute() {
  const router = useRouter();
  return <PipelinePage navigate={(path: string) => router.push(path)} />;
}
