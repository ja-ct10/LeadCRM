// Browser acceptance of the real Inbox/composer with controlled Gmail responses. No live delivery.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..'), require = createRequire(resolve(root, 'frontend/package.json'));
const { build, preview } = await import(pathToFileURL(require.resolve('vite')));
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')));
const { default: tailwind } = await import(pathToFileURL(require.resolve('@tailwindcss/postcss')));
const { chromium } = require('playwright');
const output = resolve(root, 'data/outputs/system-audit/inbox-forward-employees'); mkdirSync(output, { recursive: true });
const source = resolve(root, 'frontend/src').replaceAll('\\', '/');
const fixture = resolve(output, 'browser'); mkdirSync(fixture, { recursive: true });
writeFileSync(resolve(fixture, 'index.html'), '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/fixture.tsx"></script>');
writeFileSync(resolve(fixture, 'fixture.tsx'), `import React from 'react';import{createRoot}from'react-dom/client';import '/@fs/${source}/index.css';import Inbox from '/@fs/${source}/features/tenant/inbox/ui/inbox-page.tsx';createRoot(document.getElementById('root')!).render(<main style={{height:'100dvh',padding:8}}><Inbox/></main>);`);
const services = `
const owner='owner@example.test',customer='customer@example.test';
const original={id:'original',threadId:'original-thread',from:'Customer <'+customer+'>',to:[owner],cc:['copy@example.test'],subject:'Forward UI verification',snippet:'Saved content',body:'<p>Saved content</p>',date:'2026-10-28T01:00:00Z',labels:['INBOX'],isRead:true,direction:'inbound'};
const full='<p>Fresh &amp; readable <strong>quotation</strong></p><p>Second line</p><div class="gmail_quote"><p>Original quoted history</p></div>';
const recipientMode=new URLSearchParams(location.search).has('internal-recipient');
const internalCopy={...original,id:'internal_receipt',threadId:'internal_thread',from:'First Employee <first@example.test>',to:['second@example.test'],subject:'Internal employee forward',body:'<p>Persisted employee content</p>',snippet:'Persisted employee content',gmailActionsAvailable:false};
const files=[{id:'pdf',filename:'Quote.pdf',mimeType:'application/pdf',size:18},{id:'eml',filename:'Original.eml',mimeType:'message/rfc822'},{id:'retry',filename:'Retry.txt',mimeType:'text/plain',size:4}];
let sent=[],attempts=0;window.forwardCalls=[];window.forwardMode='success';window.forwardDownloads=[];
export const getGmailStatus=async()=>recipientMode?{isConnected:false,email:null,canReadMailbox:true,mailboxEmail:'second@example.test'}:({isConnected:true,email:owner,connectedAt:'2026-10-01',lastSyncAt:'2026-10-28',forwardRecipientEmails:['first@example.test','second@example.test']});
export const fetchGmailEmails=async(options={})=>({emails:recipientMode?[internalCopy]:options.filter==='sent'?sent:[original,...sent],unreadCount:0});
export const fetchGmailThread=async(id)=>({emails:recipientMode?[internalCopy]:id==='original-thread'?[{...original,id:'older',date:'2026-10-27T01:00:00Z'},original]:sent.filter(row=>row.threadId===id),dealOptions:[],canAssociateDeal:false});
export const fetchGmailMessageContent=async(id)=>({body:id==='internal_receipt'?internalCopy.body:id==='original'?full:id==='older'?'<pre>Plain &lt;original&gt; &amp; preserved\\nSecond line</pre>':sent.find(row=>row.id===id)?.body??'',attachments:id==='original'?files:[]});
export const fetchGmailAttachment=async(id,file)=>{window.forwardDownloads.push(file);if(file==='retry'&&++attempts===1)throw Error('Download failed.');return new Blob([file==='pdf'?'%PDF-original-bytes':'Text']);};
export const sendGmailEmail=async(to,subject,body,replyToMessageId,draftId,forwardSourceMessageId,requestId,composeMode,extras)=>{
 const payload={to,subject,body,replyToMessageId,draftId,forwardSourceMessageId,requestId,composeMode,...extras};window.forwardCalls.push(payload);
 if(window.forwardMode==='recipient')throw Object.assign(Error('Forwarding is only allowed to active employee accounts in your LeadCRM workspace.'),{status:403,code:'MAILBOX_RECIPIENT_REJECTED'});
 if(window.forwardMode==='gmail')throw Object.assign(Error('Gmail rejected this send.'),{status:403,code:'GMAIL_WRITE_REJECTED'});
 if(window.forwardMode==='unknown')throw Object.assign(Error('Verify delivery before retrying.'),{status:503,code:'GMAIL_OUTCOME_UNKNOWN'});
 await new Promise(done=>setTimeout(done,150));sent=[{...original,id:'sent',threadId:'forward-new-thread',from:owner,to,cc:[],subject,body,snippet:'Forwarded',labels:['SENT'],direction:'outbound',date:new Date().toISOString()}];return{success:true,messageId:'sent',threadId:'forward-new-thread'};
};
export const saveGmailDraft=async()=>({draftId:'draft',messageId:'draft-message'}),scheduleGmailEmail=async()=>({id:'scheduled'}),deleteGmailDraft=async()=>{};
export const setGmailThreadReadState=async()=>({success:true}),setGmailConversationReadState=async()=>({success:true}),setGmailMessageReadState=async()=>({success:true});
export const fetchGmailCorrespondent=async()=>({emails:[],threads:[],messageCount:0}),associateThreadDeal=async()=>({success:true});
export const archiveGmailThread=async()=>({success:true}),trashGmailThread=async()=>({success:true}),archiveGmailConversations=async()=>({success:true}),trashGmailConversations=async()=>({success:true}),restoreGmailConversations=async()=>({success:true});
export const getScheduledGmailEmail=async()=>({}),cancelScheduledGmailEmail=async()=>({}),syncGmail=async()=>({hasMore:false}),disconnectGmail=async()=>({success:true}),initiateGmailConnect=async()=>{};
`;
const mock = '\0forward-fixture:';
const config = { configFile: false, root: fixture, cacheDir: resolve(fixture, '.vite'), define: { 'process.env': '{}' },
  plugins: [{ name: 'forward-fixtures', enforce: 'pre', resolveId(id) {
    const path = id.replaceAll('\\', '/');
    if (/\/services\/gmail.service(?:\.ts)?$/.test(path)) return mock + 'gmail';
    if (/\/store\/AuthContext(?:\.tsx)?$/.test(path)) return mock + 'auth';
    if (/\/use-notification-record-link(?:\.ts)?$/.test(path)) return mock + 'notification';
    if (/\/shared\/services\/mailbox-events(?:\.ts)?$/.test(path)) return mock + 'events';
    if (id === 'next/navigation') return mock + 'navigation'; if (id === 'next/link') return mock + 'link';
  }, load(id) {
    if (id === mock + 'gmail') return services;
    if (id === mock + 'auth') return "export const useAuth=()=>({user:{id:'fixture-owner',role:'Client Admin'},tenant:{id:'fixture-tenant'}});";
    if (id === mock + 'notification') return 'export const useNotificationRecordLink=()=>{};';
    if (id === mock + 'events') return 'export const subscribeMailboxEvents=()=>({close(){}});export const MAILBOX_RECONNECT_DELAY_MS=60000;';
    if (id === mock + 'navigation') return 'export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(){},replace(){}});';
    if (id === mock + 'link') return "import React from'react';export default function Link(props){return React.createElement('a',props);}";
  } }, react()],
  resolve: { extensions: ['.ts', '.tsx', '.mjs', '.js', '.cjs', '.json'], alias: { '@/shared': source + '/shared', '@/lib': source + '/lib', '@/store': source + '/store', '@/features/tenant': source + '/features/tenant', '@leadcrm/shared': resolve(root, 'shared/src/index.ts'), '@': resolve(root, 'frontend') }, dedupe: ['react', 'react-dom'] },
  css: { postcss: { plugins: [tailwind()] } }, server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
};
await build({ ...config, publicDir: false, build: { outDir: resolve(fixture, 'dist'), emptyOutDir: true } });
const server = await preview({ ...config, build: { outDir: resolve(fixture, 'dist') }, preview: { host: '127.0.0.1', port: 0 } });
let browser;
const results = [], errors = [];
try {
  const executablePath = [chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  assert.ok(executablePath, 'Local Chromium is required'); browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, reducedMotion: 'reduce' });
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(120000); page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
  await page.goto(server.resolvedUrls.local[0]); await page.getByText('Forward UI verification', { exact: true }).click();
  await page.getByRole('button', { name: 'Collapse message from Customer', exact: true }).waitFor();
  assert.equal(await page.getByText('No unique CRM email match.', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Collapse message from Customer', exact: true }).click();
  assert.equal(await page.getByText('No unique CRM email match.', { exact: true }).count(), 0);
  const expand = page.getByRole('button', { name: 'Expand message from Customer', exact: true });
  await expand.last().click(); results.push('Collapsed and expanded notices absent');
  await page.getByRole('button', { name: 'Forward', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Email body' }); await editor.waitFor();
  assert.ok((await editor.innerText()).includes('Fresh & readable quotation')); assert.ok((await editor.innerText()).includes('Original quoted history'));
  await page.getByText('Original.eml: This file format cannot be forwarded. Remove it to continue.', { exact: true }).waitFor();
  await page.getByText('Retry.txt: Download failed.', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Send email', { exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Remove Original.eml from forward', exact: true }).click();
  await page.getByRole('button', { name: 'Retry Retry.txt', exact: true }).click();
  await page.getByRole('list', { name: 'Attachments needing attention' }).waitFor({ state: 'hidden' });
  results.push('Full original content, attachment bytes, explicit omission and retry');
  await page.getByLabel('To', { exact: true }).fill('invalid'); await page.getByLabel('Send email', { exact: true }).click();
  assert.ok((await page.getByRole('alert').innerText()).includes('valid email addresses')); assert.equal(await page.evaluate(() => window.forwardCalls.length), 0);
  for (const address of ['external@example.test', 'customer@example.test', 'foreign-employee@example.test']) {
    await page.getByLabel('To', { exact: true }).fill(address); await page.getByLabel('Send email', { exact: true }).click();
    assert.ok((await page.getByRole('alert').innerText()).includes('active employee accounts')); assert.equal(await page.evaluate(() => window.forwardCalls.length), 0);
  }
  results.push('External, CRM customer and foreign employee addresses rejected before delivery');
  await page.getByLabel('To', { exact: true }).fill('first@example.test, second@example.test');
  await page.getByLabel('Subject', { exact: true }).fill('Edited forward'); await editor.fill('Edited introduction\nOriginal forwarded content & details');
  assert.equal(await page.getByLabel('To', { exact: true }).getAttribute('aria-invalid'), 'false'); results.push('Invalid and multiple recipients, subject/body edits');
  for (const mode of ['recipient', 'gmail', 'unknown']) {
    await page.evaluate(value => { window.forwardMode = value; }, mode); await page.getByLabel('Send email', { exact: true }).click();
    await page.getByRole('alert').waitFor(); assert.equal(await page.getByRole('dialog', { name: 'Compose email' }).count(), 1);
    assert.ok((await editor.innerText()).includes('Edited introduction'));
  }
  await page.screenshot({ path: resolve(output, 'forward-error-retains-draft.png') }); results.push('Recipient, Gmail and uncertain-outcome errors retain edits');
  await page.evaluate(() => { window.forwardMode = 'success'; const button = document.querySelector('button[aria-label="Send email"]'); button.click(); button.click(); });
  await page.getByRole('dialog', { name: 'Compose email' }).waitFor({ state: 'hidden' });
  const calls = await page.evaluate(() => window.forwardCalls); assert.equal(calls.length, 4); assert.equal(calls[2].requestId, calls[3].requestId);
  assert.deepEqual(calls[3].to, ['first@example.test', 'second@example.test']); assert.equal(calls[3].composeMode, 'forward'); assert.equal(calls[3].forwardSourceMessageId, 'original'); assert.equal(calls[3].replyToMessageId, undefined);
  assert.deepEqual(calls[3].attachments.map(file => file.filename), ['Quote.pdf', 'Retry.txt']); assert.equal(calls[3].attachments[0].content, Buffer.from('%PDF-original-bytes').toString('base64'));
  await page.getByRole('button', { name: 'Back to inbox', exact: true }).click(); await page.getByLabel('Filter emails', { exact: true }).click(); await page.getByRole('menuitemradio', { name: 'Sent', exact: true }).click();
  await page.getByText('Edited forward', { exact: true }).waitFor(); await page.screenshot({ path: resolve(output, 'forward-sent-visible.png') }); results.push('Duplicate prevention, stable request ID and Sent visibility');
  await page.getByText('Edited forward', { exact: true }).click(); await page.getByRole('button', { name: 'Forward', exact: true }).waitFor();
  assert.equal(await page.getByText('No unique CRM email match.', { exact: true }).count(), 0);
  await page.goto(server.resolvedUrls.local[0] + '?internal-recipient');
  await page.getByText('Internal employee forward', { exact: true }).click();
  for (const name of ['Reply', 'Forward', 'Archive conversation', 'Move to Gmail Trash']) {
    await page.getByRole('button', { name, exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name, exact: true }).isDisabled(), true);
  }
  assert.ok((await page.locator('iframe[data-mailbox-body]').getAttribute('srcdoc')).includes('Persisted employee content'));
  await page.reload(); await page.getByText('Internal employee forward', { exact: true }).click();
  await page.getByRole('button', { name: 'Forward', exact: true }).waitFor();
  await page.screenshot({ path: resolve(output, 'internal-recipient-without-gmail.png') }); results.push('Disconnected recipient reads persisted content across reload with Gmail actions disabled');
  assert.deepEqual(errors, []); writeFileSync(resolve(output, 'browser-results.json'), JSON.stringify({ passed: results, pageErrors: errors, liveGmailDelivery: false }, null, 2));
  console.log(JSON.stringify({ passed: results.length, results, pageErrors: errors, liveGmailDelivery: false }, null, 2));
} finally { await browser?.close(); await server.close(); }
