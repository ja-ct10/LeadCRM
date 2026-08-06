'use client';
import dynamic from 'next/dynamic';
const ServiceOrdersPage = dynamic(() => import('../../../../src/features/tenant/operations/service-orders/ui/service-orders-page'), { ssr: false });
export default ServiceOrdersPage;
