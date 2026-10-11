// Real production UI + authenticated Express API against a fresh, migration-replayed
// in-memory database. No existing tenant, provider, or deployment is contacted.
// Build first; set PLAYWRIGHT_MODULE to an installed Playwright package.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { replayCrmMigrations } from './replay-crm-migrations.mjs';

const root = resolve(import.meta.dirname, '../..');
const runName = process.env.DEAL_ACTIONS_BROWSER_RUN_NAME || '';
assert.ok(!runName || /^[a-z0-9_-]+$/.test(runName));
const output = resolve(root, '.tmp/deal-actions-browser', runName);
mkdirSync(output, { recursive: true });
const apiLog = createWriteStream(resolve(output, 'api.log'));
const originalError = console.error.bind(console);
console.error = (...args) => { apiLog.write(args.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' ') + '\n'); originalError(...args); };
const db = await PGlite.create();
await replayCrmMigrations(db);
const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 });
await socket.start();
const port = Number(process.env.DEAL_ACTIONS_BROWSER_PORT || 3034);
const base = `http://localhost:${port}`;
Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: `postgresql://postgres:postgres@${socket.getServerConn()}/leadcrm_record_plan_browser?connection_limit=1&statement_cache_size=0`, JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_URL: base, CORS_ORIGIN: base, ALLOWED_ORIGINS: base });
process.env.DIRECT_URL = process.env.DATABASE_URL;
// Fixtures never dispatch providers; remove inherited credentials as well.
for (const key of Object.keys(process.env)) if (/^(BREVO|TEXTBEE|SMTP|GMAIL|GOOGLE_CLIENT|GOOGLE_REFRESH)/.test(key)) delete process.env[key];
const require = createRequire(import.meta.url), Module = require('node:module'), originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) { return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options); };
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const prisma = require('../dist/backend/src/config/database.config.js').default;
const app = require('../dist/backend/src/app.js').default;
const { tenantContext } = require('../dist/backend/src/core/tenant/tenant-context.js');
const { salesPipeline, salesTransaction } = require('../dist/backend/src/modules/crm/leads/lead-automation.service.js');
const { saveField } = require('../dist/backend/src/modules/crm/closing-requirements/closing-requirements.service.js');
const { updateFieldLayout } = require('../dist/backend/src/modules/crm/closing-requirements/field-layout.service.js');
const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
const checks = [], pageErrors = [], transportErrors = [], serverErrors = [];
let api, frontend, browser, page, apiBase, closing = false;
const record = (label, detail = {}) => { checks.push({ label, passed: true, ...detail }); console.log(`PASS ${label}`); };
try {
  const tenant = await prisma.tenant.create({ data: { name: 'Deal Actions Acceptance', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const admin = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Deal', lastName: 'Tester', email: 'deal-actions@camxian.com', role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, emailVerified: new Date(), onboardingCompletedAt: new Date() } });
  const role = await prisma.roleDefinition.create({ data: { tenantId: tenant.id, name: 'Sales Agent', permissions: { create: ['leads', 'contacts', 'accounts', 'deals', 'tasks', 'inbox'].map(module => ({ module, canView: true, canEdit: true, canCreate: true })) } } });
  const agents = Array.from({length: 61}, (_, index) => ({ id: randomUUID(), tenantId: tenant.id, firstName: 'Agent', lastName: String(index).padStart(2,'0'), email: 'agent'+index+'@camxian.com', role: 'Sales Agent', status: 'ACTIVE', mustChangePassword: false, emailVerified: new Date(), onboardingCompletedAt: new Date() }));
  await prisma.user.createMany({data:agents}); await prisma.userRole.createMany({data:agents.map(agent=>({tenantId:tenant.id,userId:agent.id,roleId:role.id}))});
  const token = (await issueAuthSession(admin)).token;
  const readerRole = await prisma.roleDefinition.create({data:{tenantId:tenant.id,name:'Deal Reader',permissions:{create:{module:'deals',canView:true}}}});
  const reader = await prisma.user.create({data:{tenantId:tenant.id,firstName:'Read',lastName:'Only',email:'deal-reader@camxian.com',role:'Deal Reader',status:'ACTIVE',mustChangePassword:false,emailVerified:new Date(),onboardingCompletedAt:new Date()}});
  await prisma.userRole.create({data:{tenantId:tenant.id,userId:reader.id,roleId:readerRole.id}});
  const readerToken = (await issueAuthSession(reader)).token;
  const scope = run => tenantContext.run({ tenantId: tenant.id }, run);
  const { pipeline, initial, stages } = await scope(() => salesTransaction(tx => salesPipeline(tx, tenant.id)));
  const allStages = stages ?? await prisma.stage.findMany({where:{tenantId:tenant.id,pipelineId:pipeline.id}});
  const qualified = allStages.find(stage=>stage.name==='Qualified'), won = allStages.find(stage=>stage.isWon), lost = allStages.find(stage=>stage.isLost);
  const destination = await prisma.pipeline.create({data:{tenantId:tenant.id,name:'Renewals',type:'Sales'}});
  const target = await prisma.stage.create({data:{tenantId:tenant.id,pipelineId:destination.id,name:'Lead',order:0,isDefault:true}});
  const required = await prisma.stage.create({data:{tenantId:tenant.id,pipelineId:destination.id,name:'Review',order:1,requiredFields:['industry']}});
  const product = await prisma.productInterest.create({ data: { tenantId: tenant.id, name: 'Acceptance product', dealValue: 25000 } });
  const account = await prisma.account.create({ data: { tenantId: tenant.id, name: 'Acceptance Account', assignedUserId: agents[0].id } });
  const lead = await prisma.lead.create({ data: { tenantId: tenant.id, firstName: 'Acceptance', lastName: 'Lead', email: 'lead@example.test', source: 'Website', accountId: account.id, assignedUserId: admin.id } });
  const contact = await prisma.contact.create({ data: { tenantId: tenant.id, firstName: 'Acceptance', lastName: 'Contact', email: 'contact@example.test', accountId: account.id, assignedUserId: admin.id, activeProducts: [], productInterests: [] } });
  const fixtures = {};
  for (const title of ['Action Deal','Desktop Drag','Mobile Drag','Won Evidence','Lost Action']) {
    const deal = await prisma.deal.create({ data: { tenantId: tenant.id, title, pipelineId: pipeline.id, stageId: title==='Won Evidence'?qualified.id:initial.id, accountId: account.id, assignedUserId: agents[0].id, ownerId: admin.id, productsNormalized: true, productInterestId: product.id, productInterestIds: [product.id], value: 25000, productInterests: [product.name], tags: [] } });
    await prisma.leadDeal.create({data:{tenantId:tenant.id,leadId:lead.id,dealId:deal.id,addedById:admin.id}});
    await prisma.contactDeal.create({data:{tenantId:tenant.id,contactId:contact.id,dealId:deal.id}});
    fixtures[title] = deal;
  }
  const field = await scope(()=>saveField(tenant.id,admin.id,{module:'deals',group:'Closed Won Requirements',name:'Approval evidence',type:'Text',required:true}));
  api = app.listen(0, '127.0.0.1'); await new Promise(done => api.once('listening', done));
  apiBase = 'http://127.0.0.1:'+api.address().port+'/api/v1';
  const log = createWriteStream(resolve(output, 'frontend.log'));
  frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), process.env.DEAL_ACTIONS_BROWSER_DEV === 'true' ? 'dev' : 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: process.env.DEAL_ACTIONS_BROWSER_DEV === 'true' ? 'development' : 'production', API_URL: 'https://leadcrm-build.example/api/v1',NEXT_PUBLIC_USE_MOCK_DATA:'false' } });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) { try { if ((await fetch(base + '/login')).ok) { ready = true; break; } } catch {} await new Promise(done => setTimeout(done, 500)); }
  assert.ok(ready, 'Next server did not become ready');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  async function session(auth, options = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
    await context.addInitScript(() => {
      const NativeEventSource = window.EventSource;
      window.__recordPlanStreams = {};
      window.EventSource = class extends NativeEventSource {
        constructor(url, options) {
          super(url, options);
          this.addEventListener('open', () => { window.__recordPlanStreams[String(url)] = true; });
        }
      };
    });
    await context.addCookies([{ name: 'leadcrm_token', value: auth, url: base, httpOnly: true, sameSite: 'Lax' }]);
    const tab = await context.newPage(); tab.on('framenavigated',frame=>{if(frame===tab.mainFrame())console.log('NAV '+frame.url());}); tab.setDefaultTimeout(20000); tab.setDefaultNavigationTimeout(120000);
    tab.on('pageerror', error => pageErrors.push(error.message));
    // Production API_URL enforces HTTPS. Route only the test transport to the
    // disposable localhost API; keep the real API, auth, RBAC and SSE handlers.
    await tab.route('**/api/proxy/**', async route => {
      const request = route.request(), url = new URL(request.url());
      const path = url.pathname.replace('/api/proxy', ''), local = apiBase + path + url.search;
      const headers = { ...request.headers(), authorization: `Bearer ${auth}` };
      if (path.endsWith('/events') || path === '/crm/record-events') return route.continue({ url: local, headers });
      try { const response = await tab.request.fetch(local, { method: request.method(), headers, data: request.postDataBuffer() ?? undefined, maxRetries: request.method() === 'GET' ? 2 : 0 }); if (response.status() >= 500) { const failure = `${request.method()} ${path}: ${await response.text()}`; serverErrors.push(failure); console.error(failure); } await route.fulfill({ response }); }
      catch (error) { if (!closing) transportErrors.push(`${request.method()} ${path}: ${String(error).split('\n')[0]}`); await route.abort().catch(() => {}); }
    });
    return tab;
  }

  page = await session(token);
  const board = tab=>tab.getByRole('region',{name:'Deal pipeline',exact:true});
  const menu = async(title, tab=page)=>{await tab.getByRole('button',{name:'Actions for '+title,exact:true}).click();await tab.getByRole('menuitem',{name:/^Edit deal/}).waitFor();};
  const action = async(title,label,tab=page)=>{await menu(title,tab);await tab.getByRole('menuitem',{name:new RegExp('^'+label)}).click();};
  const until = async(check,label)=>{for(let i=0;i<60;i++){if(await check())return;await new Promise(done=>setTimeout(done,200));}throw new Error(label);};
  const stored = title=>prisma.deal.findUnique({where:{id:fixtures[title].id}});
  const denied = await page.request.patch(apiBase+'/crm/deals/'+fixtures['Action Deal'].id+'/pipeline',{headers:{authorization:'Bearer '+readerToken},data:{pipelineId:destination.id,stageId:target.id}});
  assert.equal(denied.status(),403,await denied.text());
  assert.equal((await stored('Action Deal')).pipelineId,pipeline.id);record('Transfer endpoint enforces deals.edit before any mutation');
  await page.goto(base+'/crm/deals');
  await page.getByRole('button',{name:'Actions for Action Deal',exact:true}).waitFor();
  await menu('Action Deal');
  const labels = await page.getByRole('menuitem').allTextContents();
  assert.deepEqual(labels.map(text=>['Edit deal','Add a task','Add a note','Send an email','Mark as won','Mark as lost','Change pipeline','Archive'].find(name=>text.startsWith(name))),['Edit deal','Add a task','Add a note','Send an email','Mark as won','Mark as lost','Change pipeline','Archive']);
  assert.equal(await page.getByRole('dialog').count(),0,'Menu must not open the record drawer');
  await page.keyboard.press('Escape');
  const menuTrigger=page.getByRole('button',{name:'Actions for Action Deal',exact:true});
  assert.equal(await menuTrigger.evaluate(el=>el===document.activeElement),true);
  await menuTrigger.press('ArrowDown');
  await until(async()=>await page.getByRole('menuitem',{name:/^Edit deal/}).evaluate(el=>el===document.activeElement),'Menu keyboard opening should focus first enabled action');
  await page.keyboard.press('End');assert.equal(await page.getByRole('menuitem',{name:'Archive',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('ArrowUp');assert.equal(await page.getByRole('menuitem',{name:/^Change pipeline/}).evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Escape');await menuTrigger.press('Space');await page.getByRole('menu').waitFor();
  await page.getByRole('heading',{name:'Deals',exact:true}).click();await page.getByRole('menu').waitFor({state:'hidden'});
  await menuTrigger.focus();await menuTrigger.press('ArrowDown');
  await until(async()=>await page.getByRole('menuitem',{name:/^Edit deal/}).evaluate(el=>el===document.activeElement),'Edit action should be keyboard focused');
  await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('dialog').getByLabel('Title',{exact:false}).inputValue(),'Action Deal');
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  record('Shared live card menu order, permissions, keyboard selection/focus return and isolated interaction');

  const observer=await session(token);await observer.goto(base+'/crm/deals');
  await observer.getByRole('button',{name:'Actions for Action Deal',exact:true}).waitFor();
  await Promise.all([page,observer].map(tab=>tab.waitForFunction(()=>window.__recordPlanStreams['/api/proxy/crm/record-events'])));
  await action('Action Deal','Edit deal',observer);
  await observer.getByRole('dialog').getByLabel('Title',{exact:false}).fill('Keep this unfinished edit');
  await action('Action Deal','Edit deal');
  const editor=page.getByRole('dialog');
  await editor.getByLabel('Title',{exact:false}).fill('Action Deal Updated');
  await editor.getByLabel('Priority',{exact:true}).selectOption('HIGH');
  await editor.getByLabel('Address',{exact:true}).fill('123 Test Street');
  await editor.getByRole('combobox',{name:'Search users...',exact:true}).click();
  const options=page.getByRole('listbox',{name:'users options'});
  await until(async()=>await options.getByRole('option').count()===61,'Complete eligible directory missing');
  const bounds=await options.boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.y+bounds.height<=900,'Portal must fit viewport');
  await page.getByRole('combobox',{name:'Search users',exact:true}).fill('agent60@');
  await options.getByRole('option',{name:/Agent 60/}).click();
  await editor.getByRole('button',{name:'Update Deal',exact:true}).click();
  await page.getByRole('button',{name:'Actions for Action Deal Updated',exact:true}).waitFor();
  await until(async()=>{const d=await stored('Action Deal');return d.title==='Action Deal Updated'&&d.assignedUserId===agents[60].id&&d.address==='123 Test Street';},'Edit did not persist');
  assert.equal(await observer.getByRole('dialog').getByLabel('Title',{exact:false}).inputValue(),'Keep this unfinished edit');
  await observer.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await observer.getByRole('button',{name:'Actions for Action Deal Updated',exact:true}).waitFor({timeout:12000});
  await observer.context().close();
  record('Edit correct Deal, complete 61-agent directory, portal selection and second-session sync preserves draft');

  await action('Action Deal Updated','Add a note');
  const note=page.getByLabel('Note',{exact:true});await note.waitFor();
  await until(()=>note.evaluate(el=>el===document.activeElement),'Existing Note composer not focused');
  await note.fill('Deal action browser note');await page.getByRole('button',{name:'Save note',exact:true}).click();
  await until(async()=>await prisma.activity.count({where:{tenantId:tenant.id,dealId:fixtures['Action Deal'].id,type:'note',title:'Deal action browser note'}})===1,'Saved note did not persist');
  await until(async()=>await note.inputValue()==='','Committed note should clear draft');
  await page.getByRole('region',{name:'Notes',exact:true}).getByText('Deal action browser note',{exact:true}).waitFor();
  await page.keyboard.press('Escape');record('Add note focuses existing composer and persists exactly once');

  await action('Action Deal Updated','Add a task');
  const taskEditor=page.getByRole('dialog');await taskEditor.getByLabel(/^Title/).fill('Deal action browser task');
  await taskEditor.getByRole('button',{name:'Create task',exact:true}).click();
  await until(async()=>!!await prisma.task.findFirst({where:{title:'Deal action browser task',tenantId:tenant.id}}),'Context task did not persist');
  const task=await prisma.task.findFirst({where:{title:'Deal action browser task',tenantId:tenant.id},include:{dealLinks:true}});
  assert.equal(task.createdById,admin.id);assert.deepEqual(task.dealLinks.map(link=>link.dealId),[fixtures['Action Deal'].id]);
  await taskEditor.waitFor({state:'hidden'});record('Context Task uses plural Deal links and preserves creator ownership');

  await action('Action Deal Updated','Send an email');
  await page.getByRole('dialog',{name:'Choose an email recipient'}).getByRole('button',{name:/Acceptance Contact/}).click();
  await page.waitForURL(/\/inbox/);record('Context email requires explicit linked recipient and opens Inbox');
  await page.goto(base+'/crm/deals');
  await action('Action Deal Updated','Change pipeline');
  const transfer=page.getByRole('dialog',{name:'Move this deal to a new pipeline'});
  await transfer.getByLabel('Choose the target pipeline',{exact:true}).selectOption(destination.id);
  assert.equal(await transfer.getByLabel('Choose the target stage',{exact:true}).inputValue(),'');
  await transfer.getByLabel('Choose the target stage',{exact:true}).selectOption(required.id);
  await transfer.getByRole('button',{name:'Move deal',exact:true}).click();
  await transfer.getByRole('alert').filter({hasText:/industry/}).waitFor();
  assert.equal(await transfer.getByLabel('Choose the target stage',{exact:true}).inputValue(),required.id);
  assert.equal((await stored('Action Deal')).pipelineId,pipeline.id);
  await transfer.getByLabel('Choose the target stage',{exact:true}).selectOption(target.id);
  await transfer.getByRole('button',{name:'Move deal',exact:true}).click();
  await page.getByRole('button',{name:'Actions for Action Deal Updated',exact:true}).waitFor({state:'hidden'});
  const moved=await stored('Action Deal');assert.equal(moved.pipelineId,destination.id);assert.equal(moved.stageId,target.id);assert.equal(Number(moved.value),25000);assert.equal(moved.assignedUserId,agents[60].id);
  assert.equal(await prisma.leadDeal.count({where:{dealId:moved.id}}),1);assert.equal(await prisma.contactDeal.count({where:{dealId:moved.id}}),1);assert.equal(await prisma.taskDeal.count({where:{dealId:moved.id}}),1);
  await page.getByLabel('Pipeline',{exact:true}).selectOption(destination.id);
  await page.getByRole('button',{name:'Actions for Action Deal Updated',exact:true}).waitFor();
  await page.getByRole('button',{name:'New Deal',exact:true}).click();
  await page.getByRole('menuitem',{name:'Create New',exact:true}).click();
  await page.getByRole('heading',{name:'New Deal',exact:true}).waitFor();await page.getByRole('dialog').getByText('Renewals',{exact:true}).waitFor();
  const createEditor=page.getByRole('dialog');
  await createEditor.getByLabel('Title',{exact:false}).fill('New Renewal Deal');
  await createEditor.getByRole('button',{name:'Product Interest',exact:true}).click();
  await page.getByRole('checkbox',{name:'Acceptance product',exact:true}).check();
  await page.keyboard.press('Escape');
  await createEditor.getByRole('button',{name:'Create Deal',exact:true}).click();
  await page.getByRole('button',{name:'Actions for New Renewal Deal',exact:true}).waitFor();
  const created=await prisma.deal.findFirstOrThrow({where:{tenantId:tenant.id,title:'New Renewal Deal'}});
  assert.equal(created.pipelineId,destination.id);assert.equal(created.stageId,target.id);assert.equal(created.productInterestId,product.id);assert.equal(Number(created.value),25000);
  record('Transfer validation retains choices, atomic links/value persist, destination selector and product-backed creation work');

  await action('Action Deal Updated','Archive');
  await page.getByRole('alertdialog').getByRole('button',{name:'Archive',exact:true}).click();
  await page.getByRole('button',{name:'Actions for Action Deal Updated',exact:true}).waitFor({state:'hidden'});
  assert.equal((await stored('Action Deal')).isArchived,true);assert.equal(await prisma.taskDeal.count({where:{dealId:moved.id}}),1);assert.equal(await prisma.activity.count({where:{dealId:moved.id,type:'note'}}),1);
  const restore=await page.request.patch(apiBase+'/crm/deals/'+moved.id+'/restore',{headers:{authorization:'Bearer '+token}});assert.equal(restore.status(),200,await restore.text());
  await page.getByRole('button',{name:'Actions for Action Deal Updated',exact:true}).waitFor({timeout:12000});record('Archive hides active card, preserves children and restores via existing path with realtime refresh');

  await page.getByLabel('Pipeline',{exact:true}).selectOption(pipeline.id);
  await action('Lost Action','Mark as lost');
  const lostDialog=page.getByRole('dialog',{name:'Close Deal as lost'});assert.equal(await lostDialog.getByRole('button',{name:'Save',exact:true}).isEnabled(),false);
  await lostDialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await stored('Lost Action')).stageId,initial.id);
  await action('Lost Action','Mark as lost');await lostDialog.getByLabel('Lost reason').fill('Customer postponed project');await lostDialog.getByRole('button',{name:'Save',exact:true}).click();
  await until(async()=>(await stored('Lost Action')).stageId===lost.id,'Lost did not persist');assert.equal((await stored('Lost Action')).lostReason,'Customer postponed project');record('Lost requires nonblank reason, cancellation is inert, outcome persists');

  await action('Won Evidence','Mark as won');
  await page.getByRole('button',{name:'Edit Confirmation Type',exact:true}).click();
  await page.getByLabel('Confirmation Type',{exact:false}).selectOption('Approved Quotation');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('button',{name:'Edit Confirmation Type',exact:true}).waitFor();
  await page.getByRole('button',{name:'Edit Confirmation Date',exact:true}).click();
  await page.getByLabel('Confirmation Date',{exact:false}).fill('2026-10-11');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('button',{name:'Edit Confirmation Date',exact:true}).waitFor();
  await page.getByRole('button',{name:'Edit Approval evidence',exact:true}).click();
  assert.equal((await stored('Won Evidence')).stageId,qualified.id);
  await page.getByLabel('Approval evidence',{exact:false}).fill('Approval ABC-2026');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await until(async()=>(await stored('Won Evidence')).stageId===won.id,'Required evidence did not close Won');
  await page.getByText('Locked',{exact:true}).waitFor();assert.equal(await prisma.dealStageHistory.count({where:{dealId:fixtures['Won Evidence'].id,newStageId:won.id}}),1);
  await page.keyboard.press('Escape');record('Won uses existing required evidence flow and locks one governed transition');

  await page.goto(base+'/crm/accounts/'+account.id);
  await page.getByRole('tab',{name:/^Details/}).click();
  await page.getByRole('button',{name:'Actions for Action Deal Updated',exact:true}).waitFor();
  await action('Action Deal Updated','Edit deal');
  assert.equal(await page.getByRole('dialog').getByLabel('Title',{exact:false}).inputValue(),'Action Deal Updated');
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('link',{name:/^Action Deal Updated/}).click();
  await page.waitForURL(new RegExp('/crm/deals/'+moved.id));
  await page.getByRole('button',{name:'Record actions',exact:true}).click();
  await page.getByRole('menuitem',{name:'Duplicate deal',exact:true}).waitFor();await page.keyboard.press('Escape');
  record('Related Account Deal cards reuse actions and full-page navigation retains Duplicate');
  await page.goto(base+'/crm/deals');
  const column=(tab,name)=>board(tab).getByRole('heading',{name,exact:true}).locator('xpath=ancestor::div[4]');
  const drag=page.getByRole('button',{name:'Drag Desktop Drag',exact:true});await drag.scrollIntoViewIfNeeded();
  const d=await drag.boundingBox(),q=await column(page,'Qualified').boundingBox();
  await page.mouse.move(d.x+d.width/2,d.y+d.height/2);await page.mouse.down();await page.mouse.move(d.x+20,d.y+20,{steps:4});await page.mouse.move(q.x+q.width/2,q.y+120,{steps:20});await page.mouse.up();
  await until(async()=>(await stored('Desktop Drag')).stageId===qualified.id,'Desktop drag did not persist');record('Desktop handle drag commits stage');
  const keyboardDrag=page.getByRole('button',{name:'Drag Desktop Drag',exact:true});
  const keyboardStart=async()=>{await keyboardDrag.focus();await page.keyboard.press('Space');await until(async()=>await page.getByRole('heading',{name:'Desktop Drag',exact:true}).count()===2,'Keyboard drag did not activate');};
  const keyboardLeft=async()=>{await page.keyboard.press('ArrowLeft');await until(async()=>await column(page,'Contacted').getByRole('heading',{name:'Desktop Drag',exact:true}).count()===1,'Keyboard arrow did not preview adjacent stage');};
  await keyboardStart();await keyboardLeft();await page.keyboard.press('Escape');
  await until(async()=>await page.getByRole('heading',{name:'Desktop Drag',exact:true}).count()===1,'Keyboard cancellation did not clear the overlay');
  assert.equal((await stored('Desktop Drag')).stageId,qualified.id);record('Keyboard drag cancellation preserves stage');
  await keyboardStart();await keyboardLeft();await page.keyboard.press('Space');
  await until(async()=>(await stored('Desktop Drag')).stageId===allStages.find(stage=>stage.name==='Contacted').id,'Keyboard drop did not persist');record('Keyboard handle drag commits the adjacent open stage');

  const mobile=await session(token,{viewport:{width:390,height:844},hasTouch:true,isMobile:true});page=mobile;
  await mobile.goto(base+'/crm/deals');const handle=mobile.getByRole('button',{name:'Drag Mobile Drag',exact:true});await handle.scrollIntoViewIfNeeded();
  const mh=await handle.boundingBox();assert.ok(mh.width>=44&&mh.height>=44,'Mobile drag target must be 44px');
  const cd=await mobile.context().newCDPSession(mobile);
  const touch=(type,x,y)=>cd.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:1,radiusX:2,radiusY:2}]});
  const x=mh.x+mh.width/2,y=mh.y+mh.height/2;
  await touch('touchStart',x,y);await mobile.waitForTimeout(240);await touch('touchMove',x+20,y);
  const br=await board(mobile).boundingBox();
  for(let i=0;i<12;i++){await touch('touchMove',br.x+br.width-6,y);await mobile.waitForTimeout(180);const b=await column(mobile,'Qualified').boundingBox();if(b.x<200)break;}
  assert.ok(await board(mobile).evaluate(el=>el.scrollLeft)>400,'Touch drag must auto-scroll horizontally');
  const mq=await column(mobile,'Qualified').boundingBox();const tx=Math.min(350,Math.max(40,mq.x+100));const ty=Math.min(750,mq.y+150);
  await touch('touchMove',tx,ty);await mobile.waitForTimeout(200);await touch('touchEnd',tx,ty);
  await until(async()=>(await stored('Mobile Drag')).stageId===qualified.id,'Mobile touch drag did not persist');
  await mobile.screenshot({path:resolve(output,'mobile-drag-390.png')});record('390px touch hold/drag across horizontal board commits to database');
  await board(mobile).evaluate(el=>{el.scrollLeft=0;});
  await mobile.setViewportSize({width:320,height:844});
  const width=await mobile.evaluate(()=>({inner:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(width.scroll<=width.inner+1,JSON.stringify(width));
  assert.ok((await mobile.getByRole('textbox',{name:'Search deals',exact:true}).boundingBox()).width>=128,'Mobile search must remain usable beside pipeline controls');
  await board(mobile).evaluate(el=>{el.scrollLeft=350;});
  const cancel=mobile.getByRole('button',{name:'Drag Mobile Drag',exact:true});await cancel.scrollIntoViewIfNeeded();const cb=await cancel.boundingBox();
  await touch('touchStart',cb.x+cb.width/2,cb.y+cb.height/2);await mobile.waitForTimeout(240);await touch('touchMove',cb.x+30,cb.y+30);await touch('touchCancel',0,0);
  await until(async()=>await mobile.getByRole('heading',{name:'Mobile Drag',exact:true}).count()===1,'Cancelled drag overlay remained active');
  assert.equal((await stored('Mobile Drag')).stageId,qualified.id);await mobile.screenshot({path:resolve(output,'mobile-cancel-320.png')});record('320px layout and touch cancellation preserve persisted stage');
  await board(mobile).evaluate(el=>{el.scrollLeft=0;});const swipeBox=await board(mobile).boundingBox();
  const sx=swipeBox.x+swipeBox.width-20,sy=swipeBox.y+35;await touch('touchStart',sx,sy);
  for(let i=1;i<=6;i++){await touch('touchMove',sx-i*25,sy);await mobile.waitForTimeout(35);}await touch('touchEnd',sx-150,sy);await mobile.waitForTimeout(250);
  assert.ok(await board(mobile).evaluate(el=>el.scrollLeft)>50,'Stage headers must allow ordinary horizontal touch scrolling');record('Mobile board swipe scrolls independently of drag handles');

  await handle.scrollIntoViewIfNeeded();
  await menu('Mobile Drag',mobile);
  const menuBounds=await mobile.getByRole('menu').boundingBox();assert.ok(menuBounds.x>=0&&menuBounds.x+menuBounds.width<=320&&menuBounds.y>=0&&menuBounds.y+menuBounds.height<=844,'Mobile action menu must fit screen');
  await mobile.getByRole('menuitem',{name:/^Edit deal/}).click();
  const mobileEditor=mobile.getByRole('dialog');await mobileEditor.getByLabel('Address',{exact:true}).fill('Mobile edited address');
  await mobileEditor.getByRole('combobox',{name:'Search users...',exact:true}).click();
  await mobile.setViewportSize({width:320,height:500});
  const mobileOptions=mobile.getByRole('listbox',{name:'users options'});
  await until(async()=>{const b=await mobileOptions.boundingBox();return b&&b.x>=0&&b.y>=0&&b.x+b.width<=320&&b.y+b.height<=500;},'Assignment portal must adapt to shorter mobile viewport');
  await mobile.getByRole('combobox',{name:'Search users',exact:true}).fill('agent59@');
  await until(async()=>await mobileOptions.getByRole('option').count()===1&&await mobileOptions.getByRole('option',{name:/Agent 59/}).count()===1,'Assignment search must settle before keyboard selection');
  await mobile.getByRole('combobox',{name:'Search users',exact:true}).press('ArrowDown');await mobile.keyboard.press('Enter');
  await mobile.setViewportSize({width:320,height:844});
  await mobileEditor.getByRole('button',{name:'Update Deal',exact:true}).click();
  await mobileEditor.waitFor({state:'hidden'});
  const mobileSaved=await stored('Mobile Drag');assert.equal(mobileSaved.address,'Mobile edited address');assert.equal(mobileSaved.assignedUserId,agents[59].id);
  await mobile.screenshot({path:resolve(output,'mobile-actions-320.png')});record('320px action menu, responsive assignment portal, keyboard selection and edit persist');
  closing=true;await browser.close();browser=undefined;page=undefined;
  const mailbox=await prisma.emailAccount.create({data:{tenantId:tenant.id,userId:admin.id,email:admin.email,accessToken:'local-fixture-only',scopes:[]}});
  const messageData={tenantId:tenant.id,accountId:mailbox.id,direction:'outbound',from:admin.email,fromAddress:admin.email,recipients:[contact.email],recipientAddresses:[contact.email],subject:'Fixture conversation',body:'Local verification',snippet:'Local verification',labels:['SENT'],sentAt:new Date(),contactId:contact.id};
  await prisma.mailboxMessage.create({data:{...messageData,providerMessageId:'local-message',threadId:'local-thread'}});
  const associate=async(threadId,dealId)=>fetch(apiBase+'/integrations/gmail/threads/'+threadId+'/deal',{method:'PATCH',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({dealId})});
  const linked=await associate('local-thread',moved.id);assert.equal(linked.status,200,await linked.text());
  const linkReplay=await associate('local-thread',moved.id);assert.equal(linkReplay.status,200,await linkReplay.text());
  assert.equal(await prisma.mailboxThreadAssociation.count({where:{tenantId:tenant.id,threadId:'local-thread',dealId:moved.id}}),1);
  assert.equal(await prisma.activity.count({where:{tenantId:tenant.id,dealId:moved.id,title:'Email conversation associated with this Deal'}}),1);
  const closedLink=await associate('local-thread',fixtures['Won Evidence'].id);assert.equal(closedLink.status,400,await closedLink.text());
  const secondContact=await prisma.contact.create({data:{tenantId:tenant.id,firstName:'Second',lastName:'Recipient',email:'second@example.test',assignedUserId:admin.id,activeProducts:[],productInterests:[]}});
  await prisma.mailboxMessage.createMany({data:[{...messageData,providerMessageId:'ambiguous-one',threadId:'ambiguous-thread'},{...messageData,providerMessageId:'ambiguous-two',threadId:'ambiguous-thread',contactId:secondContact.id,recipients:[secondContact.email],recipientAddresses:[secondContact.email]}]});
  const ambiguous=await associate('ambiguous-thread',moved.id);assert.equal(ambiguous.status,409,await ambiguous.text());
  assert.equal(await prisma.mailboxThreadAssociation.count({where:{tenantId:tenant.id,threadId:'ambiguous-thread'}}),0);
  record('Existing email association API persists once, replays safely and rejects closed Deals and ambiguous people');
  assert.deepEqual(pageErrors,[]);assert.deepEqual(serverErrors,[]);
  writeFileSync(resolve(output,'results.json'),JSON.stringify({checks,pageErrors,transportErrors,serverErrors},null,2));
  console.log('Deal Actions acceptance passed: '+checks.length+' checks.');
} catch (error) {
  process.exitCode = 1;
  if (page) { await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {}); writeFileSync(resolve(output, 'failure.txt'), await page.locator('body').innerText().catch(() => '')); }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ checks, pageErrors, transportErrors, serverErrors, error: String(error) }, null, 2));
  throw error;
} finally {
  closing = true;
  // A browser/socket shutdown must not leave a test worker holding this port.
  const shutdown = setTimeout(() => process.exit(process.exitCode ?? 0), 20000); shutdown.unref();
  await browser?.close(); frontend?.kill();
  if (api) { api.closeAllConnections(); await new Promise(done => api.close(done)); }
  await prisma.$disconnect(); await socket.stop(); await db.close();
}
