import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeScope } from '../../src/shared/components/theme-scope';
import { FeedbackToaster } from '../../src/shared/components/feedback-toaster';
import { ConfirmActionDialog } from '../../src/shared/components/crm/confirm-action-dialog';
import { SelectedRowsBar } from '../../src/shared/components/crm/selected-rows-bar';
import { Sheet, SheetContent } from '../../src/shared/components/ui/sheet';
import { AppBrand, AppLogo } from '../../src/shared/components/app-logo';
import { useTheme } from '../../src/shared/hooks/use-theme';
import { toast } from '../../src/shared/utils/toast';
import { campaignPreviewDocument } from '../../src/features/tenant/marketing/campaigns/services/campaign-html';
import '../../src/index.css';

const control = 'rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground';
function Preview() {
  const theme = useTheme();
  const [dialog, setDialog] = useState(false), [drawer, setDrawer] = useState(false), [fail, setFail] = useState(false);
  const body = '<h2>Hello Sam</h2><p>Review your proposal and contact us with any questions.</p><p><a href="https://example.test">View proposal</a></p><table><tr><td>Proposal</td><td>Ready to review</td></tr></table>';
  return <ThemeScope className="min-h-screen bg-background pb-28">
    <header className="sticky top-0 z-40 flex h-[52px] items-center justify-between border-b border-border bg-card px-4"><span>Feedback verification</span><button className={control}>Profile control</button></header>
    <main className="space-y-4 p-4">
      <div data-toast-clearance className="flex flex-wrap gap-2 border-b border-border pb-4">
        {(['Light', 'Dark', 'Classic', 'System'] as const).map(mode => <button key={mode} className={control} onClick={() => theme.setTheme(mode)}>{mode}</button>)}
        {['blue', 'purple', 'orange'].map(accent => <button key={accent} className={control} onClick={() => theme.setAccent(accent)}>{accent}</button>)}
      </div>
      <div data-toast-clearance className="flex flex-wrap gap-2">
        <button className={control} onClick={() => { toast.dismiss(); toast.success('Changes saved.'); }}>Success toast</button>
        <button className={control} onClick={() => { toast.dismiss(); toast.error('Unable to save changes. Please try again.'); }}>Error toast</button>
        <button className={control} onClick={() => { toast.dismiss(); toast.warning('Some records could not be imported.', { description: 'Review the remaining records and retry. ' + 'LongRecordName'.repeat(35), action: { label: 'Review remaining records', onClick: () => toast.dismiss() } }); }}>Long toast</button>
        <button className={control} onClick={() => { toast.dismiss(); toast.success('Lead created.'); toast.warning('Some records could not be imported.'); toast.info('Processing remaining records.'); }}>Toast stack</button>
        <button className={control} onClick={() => toast.dismiss()}>Dismiss all</button>
        <button className={control} onClick={() => setDrawer(true)}>Open drawer</button>
        <button className={control} onClick={() => setDialog(true)}>Archive record</button>
        <label className={control}><input type="checkbox" checked={fail} onChange={event => setFail(event.target.checked)} /> Fail confirmation</label>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-border bg-card p-4"><AppBrand><AppLogo className="w-44 p-1" /></AppBrand><h1 className="text-lg font-semibold">Email preview</h1><iframe title="Email body preview" sandbox="allow-popups allow-popups-to-escape-sandbox" className="h-72 w-full border-0" srcDoc={campaignPreviewDocument(body, {}, theme.resolved, theme.accent)} /></section>
        <section className="rounded-xl border border-border bg-card p-4"><h2 className="font-semibold">Record details</h2><p className="mt-3 text-muted-foreground">Notifications remain clear of the header, actions, and selection controls.</p></section>
      </div>
    </main>
    <SelectedRowsBar count={2} onClear={() => {}}><button className={control} onClick={() => setDialog(true)}>Archive selected</button></SelectedRowsBar>
    <Sheet open={drawer} onOpenChange={setDrawer}><SheetContent aria-label="Record editor"><header className="border-b border-border p-5 pr-16">Edit record</header><div className="space-y-4 p-4"><label>Name<input className={control} defaultValue="Saved record" /></label><button className={control} onClick={() => setDialog(true)}>Archive record in drawer</button></div></SheetContent></Sheet>
    <ConfirmActionDialog open={dialog} onOpenChange={setDialog} title="Archive record?" description="The record will leave active views. You can restore it from Archived Data." confirmLabel="Archive" variant="destructive"
      onConfirm={async () => { await new Promise(resolve => setTimeout(resolve, 100)); if (fail) throw Object.assign(new Error('Access denied'), { status: 403 }); toast.success('Record archived.'); }} />
    <FeedbackToaster dark={theme.isDark} />
  </ThemeScope>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
