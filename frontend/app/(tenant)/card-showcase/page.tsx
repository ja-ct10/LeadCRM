'use client';
import dynamic from 'next/dynamic';
const CardShowcasePage = dynamic(() => import('../../../src/features/tenant/pages/card-showcase-page'), { ssr: false });
export default CardShowcasePage;
