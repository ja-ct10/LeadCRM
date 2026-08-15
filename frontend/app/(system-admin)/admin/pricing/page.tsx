'use client';
import dynamic from 'next/dynamic';
const AdminConsole = dynamic(() => import('@/features/system-admin/admin-console'), { ssr: false });
export default function AdminPricingPage() {
  return <AdminConsole activeTabProp="pricing" />;
}
