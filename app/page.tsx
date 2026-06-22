'use client';

import dynamic from 'next/dynamic';

// Dynamically import the entire SPA with SSR disabled.
// All components use localStorage and browser-only APIs.
const App = dynamic(() => import('../src/App'), { ssr: false });

export default function Home() {
  return <App />;
}
