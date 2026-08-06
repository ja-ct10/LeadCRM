'use client';
import dynamic from 'next/dynamic';
const WorkflowsPage = dynamic(() => import('../../../../src/features/tenant/automation/workflows/ui/workflows-page'), { ssr: false });
export default WorkflowsPage;
