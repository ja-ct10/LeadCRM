'use client';
import dynamic from 'next/dynamic';
const AssetsPage = dynamic(() => import('../../../../src/features/tenant/operations/assets/ui/assets-page'), { ssr: false });
export default AssetsPage;
