'use client';
import dynamic from 'next/dynamic';
const AdminConsole = dynamic(() => import('@/features/system-admin/admin-console'), { ssr: false });
export default function AdminDashboardPage() {
  return <AdminConsole activeTabProp="dashboard" />;
}
