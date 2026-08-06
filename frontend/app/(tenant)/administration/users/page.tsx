'use client';
import dynamic from 'next/dynamic';
const UsersPage = dynamic(() => import('../../../../src/features/tenant/administration/users/ui/users-page'), { ssr: false });
export default UsersPage;
