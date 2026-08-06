'use client';
import dynamic from 'next/dynamic';
const TechnicianDashboard = dynamic(() => import('../../../../src/features/tenant/operations/tasks/ui/technician-dashboard'), { ssr: false });
export default TechnicianDashboard;
