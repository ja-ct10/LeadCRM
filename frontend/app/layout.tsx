import type { Metadata, Viewport } from 'next';
import '../src/index.css';

export const metadata: Metadata = {
  title: 'LeadCRM - Smart SaaS CRM',
  description: 'The premier CRM platform for IT solutions providers, security firms, and telecom agencies.',
};

export const viewport: Viewport = {
  themeColor: '#07142A',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>{children}</body>
    </html>
  );
}
