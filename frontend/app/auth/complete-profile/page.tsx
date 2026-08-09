'use client';

import dynamic from 'next/dynamic';

const CompleteProfilePage = dynamic(
  () => import('../../../src/features/tenant/pages/complete-profile-page'),
  { ssr: false },
);

export default CompleteProfilePage;
