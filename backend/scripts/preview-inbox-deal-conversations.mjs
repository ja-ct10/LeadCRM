// UI-only acceptance of existing Inbox components; simulated Gmail metadata/actions.
// Provider authorization and original bytes are covered by disposable DB tests.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..'), require = createRequire(resolve(root, 'frontend/package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')));
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')));
const { default: tailwind } = await import(pathToFileURL(require.resolve('@tailwindcss/postcss')));
const { chromium } = require('playwright');
const output = resolve(root, 'data/outputs/inbox-deal-conversations-browser');
mkdirSync(output, { recursive: true });
const source = resolve(root, 'frontend/src').replaceAll('\\', '/');
writeFileSync(resolve(output, 'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>');
writeFileSync(resolve(output, 'fixture.tsx'), `
import React from 'react'; import { createRoot } from 'react-dom/client';
import '/@fs/${source}/index.css';
import InboxPage from '/@fs/${source}/features/tenant/inbox/ui/inbox-page.tsx';
createRoot(document.getElementById('root')!).render(<main style={{height:'100dvh', padding:8, minWidth:0}}><InboxPage /></main>);
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
export const getGmailStatus=async()=>({isConnected:true,email:mailbox,connectedAt:'2026-10-01',lastSyncAt:'2026-10-18'});
export const fetchGmailEmails=async(options={})=>({emails:rows.filter(row=>!row.deleted&&row.isArchived===(options.view==='archived')&&(options.filter!=='unread'||!row.isRead)&&(!options.query||(row.subject+' '+row.snippet).toLowerCase().includes(options.query.toLowerCase()))),unreadCount:2});
export const fetchGmailCorrespondent=async(id)=>{const row=rows.find(row=>row.conversationId===id);return {emails:[{...row,id:row.id+'-old',date:'2026-10-17T09:00:00Z',body:'<p>Older original message</p>'},{...row,body:'<p>Latest customer reply</p>'}],messageCount:3,threads:[],dealId:row.dealId,dealTitle:row.dealTitle};};
export const fetchGmailThread=async()=>({emails:[],dealOptions:[],canAssociateDeal:false});
export const fetchGmailMessageContent=async()=>({body:'<p>Latest customer reply</p>',attachments:[]});
export const setGmailConversationReadState=async(id)=>{const row=rows.find(row=>row.conversationId===id);row.isRead=true;return {count:1,completedMessageIds:[row.id],isRead:true,unreadCount:1};};
const action=async(name,ids)=>{window.fixtureActions.push({name,ids});for(const id of ids){const row=rows.find(row=>row.conversationId===id);if(name==='trash')row.deleted=true;else row.isArchived=name==='archive';}return {success:true,count:ids.length,completedMessageIds:[],completedConversationIds:ids};};
export const archiveGmailConversations=ids=>action('archive',ids),restoreGmailConversations=ids=>action('restore',ids),trashGmailConversations=ids=>action('trash',ids);
export const associateThreadDeal=async()=>({success:true}),setGmailThreadReadState=async()=>({success:true}),setGmailMessageReadState=async()=>({success:true}),archiveGmailThread=async()=>({success:true}),trashGmailThread=async()=>({success:true});
export const fetchGmailAttachment=async()=>new Blob([]),syncGmail=async()=>({hasMore:false}),disconnectGmail=async()=>({success:true}),initiateGmailConnect=async()=>{};
export const getScheduledGmailEmail=async()=>({}),cancelScheduledGmailEmail=async()=>({});
`;
const server = await createServer({ configFile:false, root:output, cacheDir:resolve(output,'.vite'), define:{'process.env':'{}'},
  plugins:[{name:'existing-inbox-fixtures',enforce:'pre',
    resolveId(id) {
      const path=id.replaceAll('\\','/');
      if (/\/services\/gmail.service(?:\.ts)?$/.test(path)) return mock+'gmail';
      if (/\/store\/AuthContext(?:\.tsx)?$/.test(path)) return mock+'auth';
      if (/\/use-notification-record-link(?:\.ts)?$/.test(path)) return mock+'notification';
      if (/\/compose-modal(?:\.tsx)?$/.test(path)) return mock+'compose';
      if (id==='next/navigation') return mock+'navigation';
      if (id==='next/link') return mock+'link';
    },
    load(id) {
      if(id===mock+'gmail')return services;
      if(id===mock+'auth')return "export const useAuth=()=>({user:{id:'fixture-user'},tenant:{id:'fixture-tenant'}});";
      if(id===mock+'notification')return 'export const useNotificationRecordLink=()=>{};';
      if(id===mock+'compose')return 'export default function Compose(){return null;}';
      if(id===mock+'navigation')return 'export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(){},replace(){}});';
      if(id===mock+'link')return "import React from 'react';export default function Link(props){return React.createElement('a',props);}";
    },
  },react()],
  resolve:{extensions:['.ts','.tsx','.mjs','.js','.cjs','.json'],alias:{'@/shared':source+'/shared','@/lib':source+'/lib','@/store':source+'/store','@/features/tenant':source+'/features/tenant','@leadcrm/shared':resolve(root,'shared/src/index.ts'),'@':resolve(root,'frontend')},dedupe:['react','react-dom']},
  css:{postcss:{plugins:[tailwind()]}},server:{host:'127.0.0.1',port:0,fs:{allow:[root,resolve(root,'node_modules')]}}
});
let browser;
const errors=[],results=[];
try {
  await server.listen(); const base=server.resolvedUrls.local[0];
  const executablePath=[chromium.executablePath(),'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  assert.ok(executablePath,'A local Chromium browser is required');
  browser=await chromium.launch({executablePath,headless:true});
  const context=await browser.newContext({reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage(); page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
  const fits=async(label,width)=>{
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' overflow at '+width);
    const boxes=await page.locator('input[type=checkbox],button[aria-label="Archived messages"],button[aria-label="Restore"],button[aria-label="Delete Permanently"]').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect();return {left:box.left,right:box.right,width:box.width};}));
    assert.ok(boxes.every(box=>box.width>0&&box.left>=-1&&box.right<=width+1),label+' clipped controls at '+width);
    await page.screenshot({path:resolve(output,label+'-'+width+'.png'),fullPage:true});
  };
  for(const theme of ['light','dark'])for(const width of [320,375,390,430,768,1024,1440]){
    await page.setViewportSize({width,height:900});await page.goto(base);
    await page.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),theme);
    const cctv=page.getByRole('button',{name:'Open email from Adrian Cortez: CCTV quotation'});
    await cctv.waitFor();
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
    await archive.click();await cctv.waitFor();await cctv.click();
    await page.getByText('Loading conversation…',{exact:true}).waitFor({state:'hidden'});
    assert.equal(await page.getByRole('article').count(),2);await fits('thread-'+theme,width);
    await page.getByRole('button',{name:'Delete Permanently',exact:true}).click();
    await page.getByRole('button',{name:'Delete',exact:true}).click();
    await page.getByRole('heading',{name:'Inbox',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.fixtureActions.filter(action=>action.name==='trash').length),1);
    await page.getByRole('button',{name:'Open email from Adrian Cortez: Network proposal'}).waitFor();
    results.push({theme,width,passed:true});
  }
  assert.deepEqual(errors,[]);
  writeFileSync(resolve(output,'results.json'),JSON.stringify({fixture:'existing InboxPage/list/viewer; simulated Gmail',results,errors},null,2));
  console.log(JSON.stringify({passed:results.length,errors,output}));
}finally{await browser?.close();await server.close();}
