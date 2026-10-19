// UI-only acceptance of existing Inbox components; simulated Gmail metadata/actions.
// Provider authorization and original bytes are covered by disposable DB tests.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..'), require = createRequire(resolve(root, 'frontend/package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')));
const { build, preview } = await import(pathToFileURL(require.resolve('vite')));
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')));
const { default: tailwind } = await import(pathToFileURL(require.resolve('@tailwindcss/postcss')));
const { chromium } = require('playwright');
const audit = process.argv.includes('--console-audit');
const cleanChrome = process.argv.includes('--clean-chrome');
const selectedWidth = Number(process.argv.find(value=>value.startsWith('--width='))?.split('=')[1]);
const widths = selectedWidth ? [selectedWidth] : [320,375,390,430,768,1024,1440];
const output = resolve(root, 'data/outputs/inbox-deal-conversations-browser', audit ? cleanChrome ? 'console-clean-chrome' : 'console-isolated' : '.');
mkdirSync(output, { recursive: true });
let pdf;
const logo = readFileSync(resolve(root, 'frontend/public/leadcrm_logo.png'));
if (audit) {
  const PDFDocument = require('pdfkit');
  pdf = await new Promise(done => {
    const document = new PDFDocument(), chunks = [];
    document.on('data', chunk => chunks.push(chunk)); document.on('end', () => done(Buffer.concat(chunks)));
    document.text('Original Inbox audit PDF'); document.addPage().text('Original second page'); document.end();
  });
  writeFileSync(resolve(output, 'original.pdf'), pdf);
  writeFileSync(resolve(output, 'logo.png'), logo);
}
const formattedBody = '<style>body{background:#fff9f0}h1{color:#1264ea}.email-button{display:inline-block;background:#1264ea;color:white;padding:12px}@media(max-width:400px){.responsive{width:100%}}</style><h1>Audit quotation</h1><img alt="Remote logo" src="https://images.example.test/logo.png" width="80"><img alt="CID logo" src="cid:logo@mail" width="80"><a class="email-button" href="https://example.test/quotation">View quotation</a><table class="responsive" width="600" cellpadding="12"><tr><td>Original table formatting</td><td>Second column</td></tr></table><p>Latest customer reply</p><blockquote>' + '<p>Original quoted reply</p>'.repeat(18) + '</blockquote><script>parent.emailAttack=true;window.emailAttack=true</script><img src="javascript:alert(1)" onerror="parent.emailAttack=true"><a href="javascript:alert(1)" onclick="parent.emailAttack=true">Unsafe link</a><iframe srcdoc="<script>parent.emailAttack=true</script>"></iframe>';
const plainBody = '<pre>Plain text &lt;Original &amp; preserved&gt;\nSecond line</pre>';
const attachments = [{ id:'pdf',filename:'original.pdf',mimeType:'application/pdf' },{ id:'logo',filename:'logo.png',mimeType:'image/png',contentId:'logo@mail',disposition:'inline' },{ id:'photo',filename:'photo.png',mimeType:'image/png' }];
// Test instrumentation runs only in the parent fixture, never as an iframe init script.
function instrumentFrames() {
  const documents = [], observers = new Set(), blobs = new Set();
  window.inboxErrorEvents = [];
  const recordError = event => window.inboxErrorEvents.push({message:event.message,url:event.filename,stack:event.error?.stack});
  window.addEventListener('error',recordError);
  let loads = 0;
  const NativeObserver = window.ResizeObserver;
  window.ResizeObserver = class extends NativeObserver {
    constructor(callback) { super(callback); this.mailTargets = new Set(); }
    observe(target, options) {
      if (target.ownerDocument.defaultView?.frameElement?.matches('iframe[data-mailbox-body]')) { this.mailTargets.add(target); observers.add(this); }
      return super.observe(target, options);
    }
    unobserve(target) { this.mailTargets.delete(target); if (!this.mailTargets.size) observers.delete(this); return super.unobserve(target); }
    disconnect() { this.mailTargets.clear(); observers.delete(this); return super.disconnect(); }
  };
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => { const url = create(blob); blobs.add(url); return url; };
  URL.revokeObjectURL = url => { blobs.delete(url); return revoke(url); };
  document.addEventListener('load', event => {
    const frame = event.target;
    if (!(frame instanceof HTMLIFrameElement) || !frame.matches('[data-mailbox-body]')) return;
    loads++;
    const doc = frame.contentDocument;
    if (!doc || documents.some(record => record.doc === doc)) return;
    doc.defaultView.addEventListener('error',recordError);
    const record = { doc, listeners: new Map() }; documents.push(record);
    const add = doc.addEventListener.bind(doc), remove = doc.removeEventListener.bind(doc);
    doc.addEventListener = (type, listener, options) => {
      if (type === 'load' || type === 'toggle') {
        const listeners = record.listeners.get(type) ?? new Set(); listeners.add(listener); record.listeners.set(type, listeners);
      }
      return add(type, listener, options);
    };
    doc.removeEventListener = (type, listener, options) => { record.listeners.get(type)?.delete(listener); return remove(type, listener, options); };
  }, true);
  window.inboxFrameSnapshot = () => ({
    loads, frames: document.querySelectorAll('iframe[data-mailbox-body]').length, observers: observers.size,
    listeners: documents.reduce((count, record) => count + [...record.listeners.values()].reduce((total, listeners) => total + listeners.size, 0), 0),
    blobs: blobs.size, reads: { ...window.fixtureReads }, errors: [...window.inboxErrorEvents],
  });
}
const source = resolve(root, 'frontend/src').replaceAll('\\', '/');
writeFileSync(resolve(output, 'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div>' + (audit ? `<script>(${instrumentFrames.toString()})();</script>` : '') + '<script type="module" src="/fixture.tsx"></script></body></html>');
writeFileSync(resolve(output, 'fixture.tsx'), `
import React from 'react'; import { createRoot } from 'react-dom/client';
import '/@fs/${source}/index.css';
import InboxPage from '/@fs/${source}/features/tenant/inbox/ui/inbox-page.tsx';
import { mailboxDisplayDocument } from '/@fs/${source}/features/tenant/inbox/services/email-html.ts';
const root = createRoot(document.getElementById('root')!);
let revision = 0;
const showInbox = () => root.render(<main data-revision={++revision} style={{height:'100dvh', padding:8, minWidth:0}}><InboxPage /></main>);
window.auditRerender = showInbox;
window.auditNavigateAway = () => root.render(<main>Fixture route away</main>);
window.auditDisplayDocument = mailboxDisplayDocument;
showInbox();
`);
const mock = '\0inbox-fixture:';
const services = `
const sender = 'Adrian Cortez <adrian@example.test>', mailbox = 'staff@camxian.com';
const rows = [
 {id:'a-latest',threadId:'same-provider-thread',conversationId:'c_'+'a'.repeat(32),dealId:'deal-a',dealTitle:'CCTV Installation and Commissioning with a Long Deal Label',subject:'CCTV quotation'},
 {id:'b-latest',threadId:'same-provider-thread',conversationId:'c_'+'b'.repeat(32),dealId:'deal-b',dealTitle:'Network Infrastructure',subject:'Network proposal'},
 {id:'sent-only',threadId:'sent-only-thread',conversationId:'c_'+'c'.repeat(32),subject:'Sent-only inquiry',sentOnly:true},
].map(row => ({...row,from:sender,to:[mailbox],participants:['Adrian Cortez'],correspondentAddresses:['adrian@example.test'],snippet:'Please review the original quotation and supporting documents.',body:'<p>Original message</p>',date:'2026-10-18T09:00:00Z',labels:row.sentOnly?['SENT']:['INBOX','UNREAD'],isRead:!!row.sentOnly,messageCount:row.sentOnly?1:3,canArchive:!row.sentOnly,isArchived:false}));
window.fixtureActions=[];
window.fixtureReads={content:0,attachments:0};
if (${audit}) { rows[0].body=${JSON.stringify(formattedBody)}; rows[0].attachments=${JSON.stringify(attachments)}; rows[1].body=${JSON.stringify(plainBody)}; }
export const getGmailStatus=async()=>({isConnected:true,email:mailbox,connectedAt:'2026-10-01',lastSyncAt:'2026-10-18'});
export const fetchGmailEmails=async(options={})=>({emails:rows.filter(row=>!row.deleted&&row.isArchived===(options.view==='archived')&&(options.filter!=='unread'||!row.isRead)&&(!options.query||(row.subject+' '+row.snippet).toLowerCase().includes(options.query.toLowerCase()))),unreadCount:2});
export const fetchGmailCorrespondent=async(id)=>{const row=rows.find(row=>row.conversationId===id);return {emails:[{...row,id:row.id+'-old',date:'2026-10-17T09:00:00Z',body:${audit ? JSON.stringify(plainBody) : "'<p>Older original message</p>'"},attachments:[]},{...row,body:${audit ? 'row.body' : "'<p>Latest customer reply</p>'"}}],messageCount:3,threads:[],dealId:row.dealId,dealTitle:row.dealTitle};};
export const fetchGmailThread=async()=>({emails:[],dealOptions:[],canAssociateDeal:false});
export const fetchGmailMessageContent=async(id)=>{window.fixtureReads.content++;const row=rows.find(row=>row.id===id);return {body:${audit ? `row?.body ?? ${JSON.stringify(plainBody)}` : "'<p>Latest customer reply</p>'"},attachments:row?.attachments??[]};};
export const setGmailConversationReadState=async(id)=>{const row=rows.find(row=>row.conversationId===id);row.isRead=true;return {count:1,completedMessageIds:[row.id],isRead:true,unreadCount:1};};
const action=async(name,ids)=>{window.fixtureActions.push({name,ids});for(const id of ids){const row=rows.find(row=>row.conversationId===id);if(name==='trash')row.deleted=true;else row.isArchived=name==='archive';}return {success:true,count:ids.length,completedMessageIds:[],completedConversationIds:ids};};
export const archiveGmailConversations=ids=>action('archive',ids),restoreGmailConversations=ids=>action('restore',ids),trashGmailConversations=ids=>action('trash',ids);
export const associateThreadDeal=async()=>({success:true}),setGmailThreadReadState=async()=>({success:true}),setGmailMessageReadState=async()=>({success:true}),archiveGmailThread=async()=>({success:true}),trashGmailThread=async()=>({success:true});
export const fetchGmailAttachment=async(id,part,signal)=>{window.fixtureReads.attachments++;return ${audit ? "(await fetch(part==='pdf'?'/original.pdf':'/logo.png',{signal})).blob()" : 'new Blob([])'};},syncGmail=async()=>({hasMore:false}),disconnectGmail=async()=>({success:true}),initiateGmailConnect=async()=>{};
export const getScheduledGmailEmail=async()=>({}),cancelScheduledGmailEmail=async()=>({});
`;
const config = { configFile:false, root:output, cacheDir:resolve(output,'.vite'), define:{'process.env':'{}'},
  plugins:[{name:'existing-inbox-fixtures',enforce:'pre',
    resolveId(id) {
      const path=id.replaceAll('\\','/');
      if (/\/services\/gmail.service(?:\.ts)?$/.test(path)) return mock+'gmail';
      if (/\/store\/AuthContext(?:\.tsx)?$/.test(path)) return mock+'auth';
      if (/\/use-notification-record-link(?:\.ts)?$/.test(path)) return mock+'notification';
      if (/\/shared\/services\/mailbox-events(?:\.ts)?$/.test(path)) return mock+'events';
      if (/\/compose-modal(?:\.tsx)?$/.test(path)) return mock+'compose';
      if (id==='next/navigation') return mock+'navigation';
      if (id==='next/link') return mock+'link';
    },
    load(id) {
      if(id===mock+'gmail')return services;
      if(id===mock+'auth')return "export const useAuth=()=>({user:{id:'fixture-user'},tenant:{id:'fixture-tenant'}});";
      if(id===mock+'notification')return 'export const useNotificationRecordLink=()=>{};';
      if(id===mock+'events')return 'export const subscribeMailboxEvents=()=>({close(){}});export const MAILBOX_RECONNECT_DELAY_MS=60000;';
      if(id===mock+'compose')return 'export default function Compose(){return null;}';
      if(id===mock+'navigation')return 'export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(){},replace(){}});';
      if(id===mock+'link')return "import React from 'react';export default function Link(props){return React.createElement('a',props);}";
    },
  },react()],
  resolve:{extensions:['.ts','.tsx','.mjs','.js','.cjs','.json'],alias:{'@/shared':source+'/shared','@/lib':source+'/lib','@/store':source+'/store','@/features/tenant':source+'/features/tenant','@leadcrm/shared':resolve(root,'shared/src/index.ts'),'@':resolve(root,'frontend')},dedupe:['react','react-dom']},
  css:{postcss:{plugins:[tailwind()]}},server:{host:'127.0.0.1',port:0,fs:{allow:[root,resolve(root,'node_modules')]}}
};
const production = process.argv.includes('--production');
if(production) await build({...config,build:{outDir:resolve(output,'production'),emptyOutDir:true},publicDir:false});
const server = production ? await preview({...config,build:{outDir:resolve(output,'production')},preview:{host:'127.0.0.1',port:0}}) : await createServer(config);
let browser,page;
const errors=[],results=[],consoleMessages=[],securityMessages=[],failedRequests=[],inspectionControl=[];
let phase='application';
try {
  if(!production) await server.listen(); const base=server.resolvedUrls.local[0];
  const executablePath=[chromium.executablePath(),'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  assert.ok(executablePath,'A local Chromium browser is required');
  browser=await chromium.launch({...cleanChrome ? {channel:'chrome',args:['--disable-extensions']} : {executablePath},headless:true});
  const context=await browser.newContext({reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await context.route('https://api.fontshare.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
  if (audit) {
    if(production) await context.route(/\/(original\.pdf|logo\.png)$/,route=>route.fulfill({contentType:route.request().url().endsWith('.pdf')?'application/pdf':'image/png',body:route.request().url().endsWith('.pdf')?pdf:logo}));
    await context.route('https://images.example.test/logo.png', async route => {
      assert.equal(route.request().headers().referer,undefined);
      await route.fulfill({contentType:'image/png',body:logo});
    });
    await context.route(/^chrome(?:-extension)?:\/\/(?:mhjfbmdgcfjbbpaeojofohoefgiehjai|resources)\//,route=>route.continue());
  }
  page=await context.newPage(); page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(120000);
  page.on('console',message=>consoleMessages.push({phase,type:message.type(),text:message.text(),location:message.location()}));
  page.on('requestfailed',request=>failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
  const diagnostics=await context.newCDPSession(page);
  diagnostics.on('Log.entryAdded',({entry})=>securityMessages.push({phase,...entry}));
  await diagnostics.send('Log.enable');
  const fits=async(label,width)=>{
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' overflow at '+width);
    const boxes=await page.locator('input[type=checkbox],button[aria-label="Archived messages"],button[aria-label="Restore"],button[aria-label="Delete Permanently"]').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect();return {left:box.left,right:box.right,width:box.width};}));
    assert.ok(boxes.every(box=>box.width>0&&box.left>=-1&&box.right<=width+1),label+' clipped controls at '+width);
    // Capture through Chrome directly; screenshot helpers may inject scripts into child frames.
    const screenshot=await diagnostics.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
    writeFileSync(resolve(output,label+'-'+width+'.png'),Buffer.from(screenshot.data,'base64'));
  };
  const snapshot=()=>page.evaluate(()=>window.inboxFrameSnapshot());
  const noWindowErrors=async()=>assert.deepEqual((await snapshot()).errors,[],phase);
  const released=async()=>{
    await page.waitForFunction(()=>{const state=window.inboxFrameSnapshot();return !state.frames&&!state.observers&&!state.listeners&&!state.blobs;});
    await noWindowErrors();
  };
  const ready=async()=>{
    await page.getByText('Loading original message…',{exact:true}).waitFor({state:'hidden'});
    await page.waitForFunction(()=>{
      const state=window.inboxFrameSnapshot();
      return state.frames>0&&state.observers===state.frames&&state.listeners===state.frames*2&&
        [...document.querySelectorAll('iframe[data-mailbox-body]')].every(frame=>frame.contentDocument?.body&&[...frame.contentDocument.images].every(image=>!image.hasAttribute('src')||image.complete&&image.naturalWidth>0));
    });
    await noWindowErrors();
  };
  const auditConversation=async(width,theme)=>{
    phase='inspect-html';
    await ready();
    // Read through the parent. Injected iframe inspection can itself trigger sandbox errors.
    const display=await page.locator('iframe[data-mailbox-body]').last().evaluate(frame=>{
      const doc=frame.contentDocument,link=doc.querySelector('a[href]');
      return {active:doc.querySelectorAll('script,iframe,object,[onerror],[onclick],a[href^="javascript:"]').length,
        target:link.target,rel:link.rel,color:frame.contentWindow.getComputedStyle(doc.querySelector('h1')).color,
        padding:doc.querySelector('table').getAttribute('cellpadding')};
    });
    assert.deepEqual(display,{active:0,target:'_blank',rel:'noopener noreferrer',color:'rgb(18, 100, 234)',padding:'12'});
    assert.equal(await page.locator('iframe[data-mailbox-body]').last().getAttribute('sandbox'),'allow-same-origin allow-popups allow-popups-to-escape-sandbox');
    assert.ok((await page.locator('iframe[data-mailbox-body]').last().getAttribute('srcdoc')).includes("script-src 'none'"));
    const before=await snapshot();
    phase='unchanged-parent-renders';
    await page.evaluate(()=>{window.auditRerender();window.auditRerender();window.auditRerender();});
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    assert.deepEqual(await snapshot(),before,'Unchanged parent renders must not reload frames, duplicate observers/listeners or reread content/attachments');
    const collapsed=await page.locator('iframe[data-mailbox-body]').last().evaluate(frame=>frame.clientHeight);
    phase='quote-toggles';
    const toggleQuote=async()=>{
      const point=await page.evaluate(()=>{
        const frame=document.querySelector('iframe[data-mailbox-body]'),summary=frame.contentDocument.querySelector('summary');
        summary.scrollIntoView({block:'center'});
        const outer=frame.getBoundingClientRect(),inner=summary.getBoundingClientRect();
        return {x:outer.left+inner.left+10,y:outer.top+inner.top+inner.height/2};
      });
      await page.mouse.click(point.x,point.y);
    };
    await toggleQuote();
    await page.waitForFunction(height=>document.querySelector('iframe[data-mailbox-body]').clientHeight>height,collapsed);
    await toggleQuote();
    await page.waitForFunction(height=>document.querySelector('iframe[data-mailbox-body]').clientHeight<=height,collapsed);
    await noWindowErrors();
    const older=page.getByRole('button',{name:'Expand message from Adrian Cortez',exact:true}).first();
    phase='expand-older';
    await older.click();await ready();
    assert.equal(await page.evaluate(()=>document.querySelector('iframe[data-mailbox-body]').contentDocument.querySelector('pre').innerText),'Plain text <Original & preserved>\nSecond line');
    assert.equal((await snapshot()).frames,2);
    await page.getByRole('button',{name:'Collapse message from Adrian Cortez',exact:true}).first().click();await ready();
    assert.equal((await snapshot()).frames,1);
    phase='pdf-preview';
    await page.getByRole('button',{name:'Preview original.pdf',exact:true}).click();
    await page.getByTitle('Email attachment PDF preview').waitFor();
    const pdfFrame=await page.getByTitle('Email attachment PDF preview').getAttribute('src');
    assert.deepEqual(Buffer.from(await page.evaluate(async url=>[...new Uint8Array(await(await fetch(url.split('#')[0])).arrayBuffer())],pdfFrame)),pdf);
    phase='pdf-download';
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();
    assert.deepEqual(readFileSync(await(await download).path()),pdf);
    await page.getByLabel('Close sheet',{exact:true}).click();
    await noWindowErrors();
    phase='image-preview';
    await page.getByRole('button',{name:'Preview photo.png',exact:true}).click();
    const image=page.getByRole('dialog').getByAltText('photo.png');await image.waitFor();
    await page.waitForFunction(()=>{const image=document.querySelector('[role="dialog"] img');return image?.complete&&image.naturalWidth>0;});
    assert.equal(await image.evaluate(node=>getComputedStyle(node).objectFit),'contain');
    await fits('attachment-'+theme,width);
    await page.getByLabel('Close sheet',{exact:true}).click();
    await noWindowErrors();
    assert.equal(await page.evaluate(()=>window.emailAttack),undefined);
    assert.equal(await page.evaluate(()=>document.querySelector('iframe[data-mailbox-body]').contentWindow.emailAttack),undefined);
    const end=await snapshot();
    assert.equal(end.observers,1);assert.equal(end.listeners,2);
    assert.equal(end.loads,before.loads+1,'Only opening the older message should add an email document load');
    return {before,end};
  };
  for(const theme of ['light','dark'])for(const width of widths){
    phase='inbox-initial';
    await page.setViewportSize({width,height:900});await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),theme);
    const cctv=page.getByRole('button',{name:'Open email from Adrian Cortez: CCTV quotation'});
    await cctv.waitFor();
    if(audit) await released();
    const archive=page.getByRole('button',{name:'Archived messages'}),filter=page.getByRole('button',{name:'Filter emails'});
    assert.ok(await archive.evaluate((node,filter)=>!!(node.compareDocumentPosition(filter)&Node.DOCUMENT_POSITION_FOLLOWING),await filter.elementHandle()));
    if(width<640)assert.ok((await archive.boundingBox()).y>(await page.getByRole('textbox',{name:'Search email'}).boundingBox()).y);
    await fits('inbox-'+theme,width);
    await cctv.locator('..').locator('input[type=checkbox]').check();
    assert.equal(await page.getByRole('toolbar',{name:'Conversation actions'}).count(),0);
    await page.getByRole('button',{name:'Archive',exact:true}).click();
    await cctv.waitFor({state:'hidden'});await archive.click();
    await page.getByRole('heading',{name:'Archived Messages'}).waitFor();await cctv.waitFor();
    assert.equal(await page.getByRole('button',{name:/Open email from .*Sent-only/}).count(),0);
    await cctv.locator('..').locator('input[type=checkbox]').check();
    await page.getByRole('button',{name:'Restore',exact:true}).waitFor();await fits('archived-'+theme,width);
    await page.getByRole('button',{name:'Delete Permanently',exact:true}).click();
    const confirmation=page.getByRole('alertdialog');await confirmation.waitFor();
    assert.match(await confirmation.innerText(),/can be recovered there/);assert.doesNotMatch(await confirmation.innerText(),/cannot be undone/i);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.fixtureActions.filter(action=>action.name==='trash').length),0);
    await page.getByRole('button',{name:'Restore',exact:true}).click();await cctv.waitFor({state:'hidden'});
    await archive.click();await cctv.waitFor();phase='open-thread';await cctv.click();
    await page.getByText('Loading conversation…',{exact:true}).waitFor({state:'hidden'});
    assert.equal(await page.getByRole('article').count(),2);await fits('thread-'+theme,width);
    let lifecycle;
    if(audit){
      lifecycle=await auditConversation(width,theme);
      phase='reopen-cycles';
      for(let cycle=0;cycle<3;cycle++){
        await page.getByRole('button',{name:'Back to inbox',exact:true}).click();await released();
        await cctv.click();await ready();
        assert.equal((await snapshot()).frames,1);
      }
      await page.getByRole('button',{name:'Back to inbox',exact:true}).click();await released();
      phase='conversation-switch';
      await page.getByRole('button',{name:'Open email from Adrian Cortez: Network proposal'}).click();await ready();
      assert.equal(await page.evaluate(()=>document.querySelector('iframe[data-mailbox-body]').contentDocument.querySelector('pre').innerText),'Plain text <Original & preserved>\nSecond line');
      await page.getByRole('button',{name:'Back to inbox',exact:true}).click();await released();
      phase='navigate-away-return';
      await page.evaluate(()=>window.auditNavigateAway());await released();
      await page.evaluate(()=>window.auditRerender());await cctv.waitFor();await released();
      phase='browser-refresh';
      await page.reload();await cctv.waitFor();await released();
      await cctv.click();await ready();
    }
    phase='close-thread';
    await page.getByRole('button',{name:'Delete Permanently',exact:true}).click();
    await page.getByRole('button',{name:'Delete',exact:true}).click();
    await page.getByRole('heading',{name:'Inbox',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.fixtureActions.filter(action=>action.name==='trash').length),1);
    await page.getByRole('button',{name:'Open email from Adrian Cortez: Network proposal'}).waitFor();
    if(audit) await released();
    results.push({theme,width,passed:true,...lifecycle?{lifecycle}:{}});
  }
  assert.deepEqual(errors,[]);
  assert.deepEqual(consoleMessages.filter(message=>message.type==='error'),[]);
  assert.deepEqual(securityMessages.filter(message=>message.level==='error'),[]);
  // Replacing srcDoc or leaving a conversation can cancel the old document's image request.
  assert.deepEqual(failedRequests.filter(request=>request.error!=='net::ERR_ABORTED'),[]);
  if(audit){
    // Separate control: no application components, same sanitized document and native quote toggles.
    const source=await page.evaluate(body=>window.auditDisplayDocument(body),formattedBody);
    for(const inspected of [false,true]){
      const control=await context.newPage(),log=[];
      const session=await context.newCDPSession(control);
      await session.send('Log.enable');session.on('Log.entryAdded',({entry})=>log.push(entry));
      await control.setContent('<main></main>');
      await control.evaluate(source=>{
        const frame=document.createElement('iframe');frame.sandbox='allow-same-origin';frame.style.cssText='width:100%;height:80px';
        frame.onload=()=>{
          const doc=frame.contentDocument;
          const measure=()=>{frame.style.height=Math.ceil(Math.max(doc.body.scrollHeight,doc.body.getBoundingClientRect().height))+'px';};
          const observer=new ResizeObserver(measure);observer.observe(doc.body);doc.addEventListener('toggle',measure,true);measure();
        };
        frame.srcdoc=source;document.querySelector('main').append(frame);
      },source);
      await control.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('summary'));
      if(inspected){
        const frame=control.frameLocator('iframe');
        await frame.locator('script,iframe,object,[onerror],[onclick]').count();
        await frame.getByRole('link',{name:'Unsafe link'}).count();
        const link=frame.getByRole('link',{name:'View quotation'});
        await link.getAttribute('target');await link.getAttribute('rel');
        await frame.getByRole('heading',{name:'Audit quotation'}).evaluate(node=>getComputedStyle(node).color);
        await frame.locator('table').getAttribute('cellpadding');
      }
      for(const open of [true,false]){
        const point=await control.evaluate(()=>{
          const frame=document.querySelector('iframe'),summary=frame.contentDocument.querySelector('summary');summary.scrollIntoView({block:'center'});
          const outer=frame.getBoundingClientRect(),inner=summary.getBoundingClientRect();return{x:outer.left+inner.left+10,y:outer.top+inner.top+inner.height/2};
        });
        await control.mouse.click(point.x,point.y);
        assert.equal(await control.evaluate(()=>document.querySelector('iframe').contentDocument.querySelector('details').open),open);
        // Wait for the native toggle event without injecting a function into the email realm.
        await control.evaluate(()=>new Promise(done=>setTimeout(done,100)));
      }
      const blocked=log.filter(entry=>entry.level==='error'&&entry.source==='security');
      if(!inspected) assert.equal(blocked.length,0);
      assert.deepEqual(log.filter(entry=>entry.level==='error'&&!/Blocked script execution.*sandboxed.*allow-scripts/s.test(entry.text)),[]);
      inspectionControl.push({inspected,blockedScriptMessages:blocked.length,log});
      await control.close();
    }
    await page.getByRole('button',{name:'Open email from Adrian Cortez: Network proposal'}).click();await ready();
    phase='controlled-script-attempt';
    await page.evaluate(()=>{
      const doc=document.querySelector('iframe[data-mailbox-body]').contentDocument;
      const script=doc.createElement('script');script.textContent='window.emailAttack=true;parent.emailAttack=true';doc.body.append(script);
    });
    await diagnostics.send('Runtime.getIsolateId');
    const blocked=securityMessages.filter(message=>message.phase===phase&&message.level==='error');
    assert.equal(blocked.length,1);
    assert.match(blocked[0].text,/Blocked script execution in 'about:srcdoc'.*sandboxed.*allow-scripts/s);
    assert.equal(await page.evaluate(()=>window.emailAttack),undefined);
    assert.equal(await page.evaluate(()=>document.querySelector('iframe[data-mailbox-body]').contentWindow.emailAttack),undefined);
    await page.getByRole('button',{name:'Back to inbox',exact:true}).click();await released();
    results.push({scenario:'Controlled script insertion reproduces the screenshot warning; sandbox blocks execution',passed:true});
  }
  writeFileSync(resolve(output,'results.json'),JSON.stringify({fixture:'existing InboxPage/list/viewer; simulated Gmail',profile:cleanChrome?'Fresh Chrome profile with extensions disabled':'Isolated browser context',browser:await browser.version(),results,errors,consoleMessages,securityMessages,failedRequests,inspectionControl},null,2));
  console.log(JSON.stringify({passed:results.length,errors,output}));
}catch(error){
  if(page&&!page.isClosed()){
    await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});
    writeFileSync(resolve(output,'failure-state.json'),JSON.stringify(await page.evaluate(()=>({body:document.body.innerText,state:window.inboxFrameSnapshot?.()})).catch(()=>null),null,2));
  }
  throw error;
}finally{
  writeFileSync(resolve(output,'diagnostics.json'),JSON.stringify({results,errors,consoleMessages,securityMessages,failedRequests,inspectionControl},null,2));
  await browser?.close();if(production) await new Promise(done=>server.httpServer.close(done));else await server.close();
}
