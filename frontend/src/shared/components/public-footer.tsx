import { Mail } from 'lucide-react';
import { LEGAL_ORGANIZATION } from '@/features/tenant/legal/legal-documents';

export function PublicFooter() {
  return (
    <footer className="w-full border-t border-slate-200 bg-blue-50/70 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
      <div className="mx-auto max-w-7xl px-6 py-8 sm:px-8 sm:py-10 lg:px-12">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16">
          <div className="min-w-0">
            <a href="/login" className="inline-flex items-center gap-3 rounded-lg text-xl font-bold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:text-white">
              <span className="flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white"><img src="/leadcrm_logo.png" alt="" width={28} height={28} className="size-7 object-contain" /></span>
              <span>Lead<span className="text-blue-600 dark:text-blue-400">CRM</span></span>
            </a>
            <p className="mt-4 max-w-xl text-sm leading-7">A centralized CRM platform for Camxian Technologies, designed to manage leads, customers, sales pipelines, and automated workflows.</p>
            <p className="mt-5 flex items-start gap-2 text-sm leading-6">
              <Mail size={16} className="mt-1 shrink-0" aria-hidden="true" />
              <span className="min-w-0">Support: <a href={`mailto:${LEGAL_ORGANIZATION.supportEmail}`} className="rounded-sm text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 [overflow-wrap:anywhere] dark:text-blue-400">{LEGAL_ORGANIZATION.supportEmail}</a></span>
            </p>
          </div>
          <nav aria-labelledby="login-company-heading">
            <h2 id="login-company-heading" className="text-xs font-semibold tracking-wider">COMPANY</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-900 dark:text-slate-100">
              {[
                ['Privacy Policy', '/privacy-policy'],
                ['Terms of Service', '/terms-of-service'],
                ['Help Center', '/help'],
              ].map(([label, href]) => (
                <li key={href}><a href={href} className="rounded-sm hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:hover:text-blue-400">{label}</a></li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mt-8 border-t border-slate-200 pt-5 text-xs dark:border-slate-700">© 2026 LeadCRM. All rights reserved.</p>
      </div>
    </footer>
  );
}
