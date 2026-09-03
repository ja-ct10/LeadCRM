'use client';
import dynamic from 'next/dynamic';
const RolesPage = dynamic(() => import('../../../../src/features/tenant/administration/roles/ui/roles-page'), { ssr: false });
export default RolesPage;
