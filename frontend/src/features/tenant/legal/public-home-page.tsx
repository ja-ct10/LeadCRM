import { LEGAL_ORGANIZATION as organization } from './legal-documents';
import { PublicDocumentLayout, publicLinkClass } from './public-document-layout';

export default function PublicHomePage() {
  return <PublicDocumentLayout>
    <section aria-labelledby="home-title" className="max-w-3xl">
      <p className="mb-4 text-sm font-semibold text-blue-700">{organization.name}</p>
      <h1 id="home-title" className="font-display text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">Customer relationships, together in LeadCRM.</h1>
      <p className="mt-6 text-lg leading-8 text-slate-600">LeadCRM is Camxian Technologies’ internal workspace for managing leads, contacts, accounts, sales pipelines, tasks, workflows and customer conversations.</p>
      <a href="/login" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">Sign in to LeadCRM</a>
      <p className="mt-4 text-sm leading-6 text-slate-600">Access is available to staff provisioned by your administrator. Contact your administrator if you need an account.</p>
    </section>
    <section aria-labelledby="gmail-title" className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
      <h2 id="gmail-title" className="text-2xl font-semibold tracking-tight text-slate-950">Your connected work email</h2>
      <p className="mt-4 leading-7 text-slate-600">Authorized staff can connect their registered Gmail or Google Workspace mailbox after Google consent. Inbox brings permitted customer correspondence into the CRM, with drafts, replies, read status, archiving and trash controls.</p>
      <p className="mt-3 leading-7 text-slate-600">Your role, mailbox ownership and CRM assignments govern access. You can disconnect your mailbox in Inbox or revoke LeadCRM’s access in your Google Account.</p>
      <p className="mt-4 leading-7 text-slate-600">Read our <a href="/privacy-policy" className={publicLinkClass}>Privacy Policy</a> and <a href="/terms-of-service" className={publicLinkClass}>Terms of Service</a> for details about use of LeadCRM and connected account data.</p>
    </section>
  </PublicDocumentLayout>;
}
