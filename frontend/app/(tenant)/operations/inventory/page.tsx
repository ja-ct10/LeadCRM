'use client';
import dynamic from 'next/dynamic';
const InventoryPage = dynamic(() => import('../../../../src/features/tenant/operations/inventory/ui/inventory-page'), { ssr: false });
export default InventoryPage;
