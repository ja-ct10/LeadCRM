import { Suspense } from 'react';
import WorkflowBuilderPage from '@/features/tenant/automation/workflows/ui/workflow-builder-page';
export default function Page() { return <Suspense fallback={<p>Loading workflow…</p>}><WorkflowBuilderPage /></Suspense>; }
