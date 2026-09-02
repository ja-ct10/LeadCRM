import type { Metadata, Viewport } from 'next';
import { League_Spartan, Poppins } from 'next/font/google';
import '../src/index.css';
import { AppProviders } from '../src/shared/providers/app-providers';
import { ThemeProvider } from '../src/shared/providers/theme-provider';

// Configure Google Fonts using Next.js font optimization
const leagueSpartan = League_Spartan({
  weight: ['400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

const poppins = Poppins({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LeadCRM - Smart SaaS CRM',
  description: 'The premier CRM platform for IT solutions providers, security firms, and telecom agencies.',
  icons: {
    icon: '/leadcrm_logo.ico',
    apple: '/leadcrm_logo.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#07142A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${leagueSpartan.variable} ${poppins.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        {/* Neue Machina from Fontshare */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link href="https://api.fontshare.com/v2/css?f[]=neue-machina@200,300,400,500,700,800,900&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{
          __html: `
            .font-subtitle-test {
              font-family: 'Neue Machina', ui-sans-serif, system-ui, sans-serif !important;
              font-weight: 500;
            }
          `
        }} />
      </head>
      <body className={poppins.className} suppressHydrationWarning>
        <AppProviders>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AppProviders>
      </body>
    </html>
  );
}
