import { acceptancePort, createAcceptanceContext, responsiveMatrix } from './verify-browser-matrix.mjs';
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
const output = process.env.LEADCRM_BROWSER_OUTPUT || (resolve(root, '.tmp/deal-actions-browser', runName));
mkdirSync(output, { recursive: true });
const apiLog = createWriteStream(resolve(output, 'api.log'));
const originalError = console.error.bind(console);
console.error = (...args) => { apiLog.write(args.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' ') + '\n'); originalError(...args); };
const db = await PGlite.create();
await replayCrmMigrations(db);
const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 });
await socket.start();
const port = Number(process.env.DEAL_ACTIONS_BROWSER_PORT || await acceptancePort());
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
const closingContexts = new WeakSet();
let api, frontend, browser, page, apiBase, closing = false;
const record = (label, detail = {}) => { checks.push({ label, passed: true, ...detail }); console.log(`PASS ${label}`); };
async function runAcceptance() {
  const tenant = await prisma.tenant.create({ data: { name: 'Deal Actions Acceptance', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const admin = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Deal', lastName: 'Tester', email: 'deal-actions@camxian.com', role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, emailVerified: new Date(), onboardingCompletedAt: new Date() } });
  const role = await prisma.roleDefinition.create({ data: { tenantId: tenant.id, name: 'Sales Agent', permissions: { create: ['leads', 'contacts', 'accounts', 'deals', 'tasks', 'inbox'].map(module => ({ module, canView: true, canEdit: true, canCreate: true })) } } });
  const agents = Array.from({length: 61}, (_, index) => ({ id: randomUUID(), tenantId: tenant.id, firstName: 'Agent', lastName: String(index).padStart(2,'0'), email: 'agent'+index+'@camxian.com', role: 'Sales Agent', status: 'ACTIVE', mustChangePassword: false, emailVerified: new Date(), onboardingCompletedAt: new Date() }));
  agents[0].lastName = 'An exceptionally long assigned Agent family name';
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
  const destination = await prisma.pipeline.create({data:{tenantId:tenant.id,name:'Renewals',type:'Sales',isArchived:true}});
  const target = await prisma.stage.create({data:{tenantId:tenant.id,pipelineId:destination.id,name:'Lead',order:0,isDefault:true}});
  const required = await prisma.stage.create({data:{tenantId:tenant.id,pipelineId:destination.id,name:'Review',order:1,requiredFields:['leadSource']}});
  const product = await prisma.productInterest.create({ data: { tenantId: tenant.id, name: 'Acceptance product', dealValue: 25000 } });
  const account = await prisma.account.create({ data: { tenantId: tenant.id, name: 'Acceptance Account',  } });
  const lead = await prisma.lead.create({ data: { tenantId: tenant.id, firstName: 'Acceptance', lastName: 'Lead', email: 'lead@example.test', source: 'Website', accountId: account.id, assignedUserId: admin.id } });
  const contact = await prisma.contact.create({ data: { tenantId: tenant.id, firstName: 'Acceptance', lastName: 'Contact', email: 'contact@example.test', accountId: account.id, assignedUserId: agents[0].id, productInterests: [] } });
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
    const context = await createAcceptanceContext(browser, { viewport: { width: 1440, height: 900 }, ...options });
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
      catch (error) { if (!closing && !closingContexts.has(context)) transportErrors.push(`${request.method()} ${path}: ${String(error).split('\n')[0]}`); await route.abort().catch(() => {}); }
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
  assert.equal(await page.getByRole('combobox',{name:'Pipeline',exact:true}).count(),0);
  const pipelineField=page.getByRole('textbox',{name:'Pipeline',exact:true});
  assert.equal(await pipelineField.inputValue(),pipeline.name);
  assert.equal(await pipelineField.evaluate(el=>el.readOnly),true);
  assert.equal(await page.getByRole('button',{name:'New Deal',exact:true}).getAttribute('aria-haspopup'),null);
  await page.getByRole('button',{name:'Manage pipeline stages',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'hidden'});
  record('Deals header exposes a direct New Deal button, read-only persisted Pipeline, and permitted stage management');
  await page.getByRole('button',{name:'New Deal',exact:true}).click();
  const newDeal=page.getByRole('dialog');
  await newDeal.getByRole('heading',{name:'New Deal',exact:true}).waitFor();
  assert.equal(await page.getByRole('menuitem',{name:'Create New',exact:true}).count(),0);
  assert.equal(await page.getByRole('menuitem',{name:'Import File',exact:true}).count(),0);
  await newDeal.getByText(pipeline.name,{exact:true}).waitFor();
  await newDeal.getByLabel('Title',{exact:false}).fill('Direct Sales Deal');
  await newDeal.getByRole('button',{name:'Product Interest',exact:true}).click();
  await page.getByRole('checkbox',{name:product.name,exact:true}).check();
  await page.keyboard.press('Escape');
  await newDeal.getByLabel('Associate Deal To',{exact:false}).selectOption('contact');
  await newDeal.getByRole('combobox',{name:'Search contacts...',exact:true}).click();
  await page.getByRole('combobox',{name:'Search contacts',exact:true}).fill('Acceptance');
  await page.getByRole('listbox',{name:'contacts options',exact:true}).getByRole('option',{name:/Acceptance Contact/}).click();
  await newDeal.getByLabel('Expected Close Date',{exact:true}).fill('2026-10-20');
  await newDeal.getByRole('button',{name:'Create Deal',exact:true}).click();
  await page.getByRole('button',{name:'Actions for Direct Sales Deal',exact:true}).waitFor();
  const direct=await prisma.deal.findFirstOrThrow({where:{tenantId:tenant.id,title:'Direct Sales Deal'}});
  assert.equal(direct.pipelineId,pipeline.id);assert.equal(direct.stageId,initial.id);assert.equal(direct.assignedUserId,agents[0].id);
  assert.equal(direct.productInterestId,product.id);assert.equal(Number(direct.value),25000);
  assert.equal(await prisma.leadDeal.count({where:{dealId:direct.id}}),0);
  assert.equal(await prisma.contactDeal.count({where:{dealId:direct.id,contactId:contact.id}}),1);
  record('Direct New Deal saves the current pipeline, Lead stage, Product, close date and Contact-derived Assigned Agent and appears on the board');
  const directCard = page.locator(`[data-deal-id="${direct.id}"]`);
  assert.equal(await directCard.getByTitle('Expected Close Date').count(),0);
  const qualifiedCard = page.locator(`[data-deal-id="${fixtures['Won Evidence'].id}"]`);
  assert.equal(await qualifiedCard.getByTitle('Expected Close Date').textContent(),'—');
  await prisma.deal.update({where:{id:fixtures['Won Evidence'].id},data:{expectedCloseDate:new Date('2026-10-20T00:00:00Z')}});
  await qualifiedCard.getByText('Oct 20, 2026',{exact:true}).waitFor();
  for await(const {theme,width} of responsiveMatrix(page)) {
    for (const label of ['Active Open Deals','Total Open Value','Closed Won Revenue']) assert.equal(await page.getByText(label,{exact:true}).count(),0);
    const control=page.getByRole('textbox',{name:'Pipeline',exact:true});
    assert.equal(await control.inputValue(),pipeline.name);assert.equal(await control.evaluate(el=>el.readOnly&&!el.disabled),true);
    await control.click();await page.keyboard.type('Another pipeline');
    assert.equal(await control.inputValue(),pipeline.name);
    assert.equal(await page.getByRole('combobox',{name:'Pipeline',exact:true}).count(),0);
    const button=page.getByRole('button',{name:'New Deal',exact:true});
    assert.equal(await button.getAttribute('aria-haspopup'),null);assert.equal(await button.locator('.lucide-chevron-down,.lucide-chevron-up').count(),0);
    assert.equal(await page.getByText('Import File',{exact:true}).count(),0);
    const bounds=await control.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);
    const shell=await page.locator('[data-app-scroll]').evaluate(el=>({left:el.getBoundingClientRect().left,padding:parseFloat(getComputedStyle(el).paddingLeft),top:el.getBoundingClientRect().top,topPadding:parseFloat(getComputedStyle(el).paddingTop)}));
    const title=await page.getByRole('heading',{name:'Deals',exact:true}).boundingBox();
    assert.ok(Math.abs(title.x-shell.left-shell.padding)<2,'Header uses existing CRM shell horizontal padding');
    assert.ok(title.y-shell.top-shell.topPadding<15,'Header has no duplicate top padding');
    await qualifiedCard.scrollIntoViewIfNeeded();
    const date=await qualifiedCard.getByTitle('Expected Close Date').boundingBox();
    const assigned=qualifiedCard.getByTitle(`Assigned to ${agents[0].firstName} ${agents[0].lastName}`);
    const agentBounds=await assigned.boundingBox();
    assert.ok(Math.abs(date.y+date.height/2-agentBounds.y-agentBounds.height/2)<2,'Close date and Agent share one row');
    assert.ok(date.x+date.width<=agentBounds.x+1,'Date and Agent do not overlap');
    assert.equal(await assigned.locator('span').evaluate(el=>getComputedStyle(el).textOverflow),'ellipsis');
    assert.ok(await qualifiedCard.getByRole('button',{name:'Actions for Won Evidence',exact:true}).isVisible());
    assert.equal(await directCard.getByTitle('Expected Close Date').count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:resolve(output,`deals-toolbar-${theme.toLowerCase()}-${width}.png`)});
    record(`${theme}/${width}px: CRM alignment, no KPIs, Qualified-only close date, long Agent name, card actions and no page overflow`);
  }
  if (process.argv.includes('--layout-only')) {
    const search=page.getByRole('textbox',{name:'Search deals',exact:true});
    await search.fill('Direct Sales Deal');
    assert.equal(await board(page).getByRole('heading',{level:4}).count(),1);
    await search.fill('');
    const handle=page.getByRole('button',{name:'Drag Direct Sales Deal',exact:true});
    await handle.scrollIntoViewIfNeeded();
    const from=await handle.boundingBox();
    const contacted=allStages.find(stage=>stage.name==='Contacted');
    const targetColumn=board(page).getByRole('heading',{name:contacted.name,exact:true}).locator('xpath=ancestor::div[4]');
    const to=await targetColumn.boundingBox();
    await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
    await page.mouse.move(from.x+from.width/2+15,from.y+from.height/2,{steps:5});
    await page.mouse.move(to.x+to.width/2,to.y+120,{steps:20});
    await until(async()=>await targetColumn.getByRole('heading',{name:'Direct Sales Deal',exact:true}).count()===1,'Drag previews Contacted');
    await page.mouse.up();
    await until(async()=>(await prisma.deal.findUniqueOrThrow({where:{id:direct.id}})).stageId===contacted.id,'Drag commits Contacted');
    assert.equal(await directCard.getByTitle('Expected Close Date').count(),0);
    for (const stageId of [qualified.id,contacted.id]) {
      const response=await page.request.patch(apiBase+'/crm/deals/'+direct.id+'/stage',{headers:{authorization:'Bearer '+token},data:{stageId}});
      assert.equal(response.status(),200,await response.text());
      await until(async()=>await directCard.getByTitle('Expected Close Date').count()===(stageId===qualified.id?1:0),'Date follows the current Qualified stage');
    }
    assert.ok((await prisma.deal.findUniqueOrThrow({where:{id:direct.id}})).expectedCloseDate);
    await menu('Direct Sales Deal');await page.getByRole('menuitem',{name:/^Edit deal/}).waitFor();await page.keyboard.press('Escape');
    record('Shared search, pointer drag, Qualified entry/exit date visibility and card actions preserve current Deal behavior and stored date');
    return;
  }
  for(const [parameter,id] of [['leadId',lead.id],['contactId',contact.id],['accountId',account.id],['organizationId',account.id]]) {
    await page.goto(base+'/crm/deals?'+parameter+'='+id);
    await page.getByRole('button',{name:'Actions for Action Deal',exact:true}).waitFor();
    await page.reload();await page.getByRole('button',{name:'Actions for Action Deal',exact:true}).waitFor();
    assert.equal(await page.getByRole('textbox',{name:'Pipeline',exact:true}).inputValue(),pipeline.name);
    record(`${parameter} relationship navigation and refresh retain the authorized Deal board`);
  }
  await page.goto(base+'/crm/deals?highlight='+direct.id);
  await page.locator('[data-search-highlight="true"]').waitFor();await page.reload();await page.locator('[data-search-highlight="true"]').waitFor();
  record('Search highlight deep link resolves the persisted pipeline and survives reload');
  await page.goto(base+'/crm/deals?dealId='+direct.id);
  await page.getByRole('dialog').waitFor();await page.reload();await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  record('Explicit Deal detail deep link opens after refresh');
  const historicalImport=await prisma.crmImportJob.create({data:{tenantId:tenant.id,createdById:admin.id,module:'DEAL',fileName:'historical.csv',status:'completed'}});
  for(const path of ['/crm/deals/import','/crm/deals/imports','/crm/deals/imports/'+historicalImport.id]) {
    await page.goto(base+path);await page.waitForLoadState('networkidle');
    for(const name of ['Upload CSV file','Browse files','Download CSV template']) assert.equal(await page.getByRole('button',{name,exact:true}).count(),0);
    assert.equal(await page.getByRole('heading',{name:/^Import (Deals|Details|Results)$/}).count(),0);
    record(`${path}: no Deal import functionality`);
  }
  const rejected=await page.request.post(apiBase+'/crm/deals/imports',{headers:{authorization:'Bearer '+token},data:{fileName:'deals.csv'}});
  assert.equal(rejected.status(),404);assert.equal(await prisma.crmImportJob.count({where:{tenantId:tenant.id,module:'DEAL'}}),1);
  record('Authenticated retired Deal import POST returns 404 and historical job remains preserved');
  await page.goto(base+'/crm/deals');await page.getByRole('button',{name:'Actions for Action Deal',exact:true}).waitFor();
  await menu('Action Deal');
  const labels = await page.getByRole('menuitem').allTextContents();
  assert.deepEqual(labels.map(text=>['Edit deal','Add a task','Add a note','Send an email','Mark as won','Mark as lost','Change stage','Archive'].find(name=>text.startsWith(name))),['Edit deal','Add a task','Add a note','Send an email','Mark as won','Mark as lost','Change stage','Archive']);
  assert.equal(await page.getByRole('dialog').count(),0,'Menu must not open the record drawer');
  await page.keyboard.press('Escape');
  const menuTrigger=page.getByRole('button',{name:'Actions for Action Deal',exact:true});
  assert.equal(await menuTrigger.evaluate(el=>el===document.activeElement),true);
  await menuTrigger.press('ArrowDown');
  await until(async()=>await page.getByRole('menuitem',{name:/^Edit deal/}).evaluate(el=>el===document.activeElement),'Menu keyboard opening should focus first enabled action');
  await page.keyboard.press('End');assert.equal(await page.getByRole('menuitem',{name:'Archive',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('ArrowUp');assert.equal(await page.getByRole('menuitem',{name:/^Change stage/}).evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Escape');await menuTrigger.press('Space');await page.getByRole('menu').waitFor();
  await page.getByRole('heading',{name:'Deals',exact:true}).click();await page.getByRole('menu').waitFor({state:'hidden'});
  await menuTrigger.focus();await menuTrigger.press('ArrowDown');
  await until(async()=>await page.getByRole('menuitem',{name:/^Edit deal/}).evaluate(el=>el===document.activeElement),'Edit action should be keyboard focused');
  await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('dialog').getByLabel('Title',{exact:false}).inputValue(),'Action Deal');
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  record('Shared live card menu order, permissions, keyboard selection/focus return and isolated interaction');
  // The database records the creation stage before any UI interaction.
  const initialStageHistory=await prisma.dealStageHistory.count({where:{dealId:fixtures['Action Deal'].id}});
  await action('Action Deal','Change stage');
  const currentOnly=page.getByRole('dialog',{name:'Change Deal stage'});
  const currentLocation=currentOnly.getByRole('region',{name:'Current deal location'});
  await currentLocation.getByText(pipeline.name,{exact:true}).waitFor();await currentLocation.getByText(initial.name,{exact:true}).waitFor();
  assert.equal(await currentOnly.getByLabel('Choose the target pipeline',{exact:true}).count(),0);
  assert.equal(await currentOnly.getByRole('combobox').count(),1);
  assert.equal(await currentOnly.getByLabel('Choose the target stage',{exact:true}).isEnabled(),true);
  assert.equal(await currentOnly.getByRole('option',{name:initial.name+' (current)',exact:true}).evaluate(option=>option.disabled),true);
  assert.equal(await currentOnly.getByRole('button',{name:'Move deal',exact:true}).isDisabled(),true);
  await currentOnly.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.setViewportSize({width:320,height:500});await action('Action Deal','Change stage');
  await until(async()=>{const b=await currentOnly.boundingBox();return b&&b.x>=0&&b.y>=0&&b.x+b.width<=320&&b.y+b.height<=500;},'Single-pipeline dialog must fit a short mobile viewport');
  await currentLocation.getByText(pipeline.name,{exact:true}).waitFor();
  await page.screenshot({path:resolve(output,'current-single-pipeline-320.png')});
  await currentOnly.getByRole('button',{name:'Cancel',exact:true}).click();await currentOnly.waitFor({state:'hidden'});
  await page.setViewportSize({width:1440,height:900});
  assert.equal((await stored('Action Deal')).pipelineId,pipeline.id);assert.equal((await stored('Action Deal')).stageId,initial.id);assert.equal(await prisma.dealStageHistory.count({where:{dealId:fixtures['Action Deal'].id}}),initialStageHistory);
  record('Single Sales Pipeline Change stage opens on desktop and 320x500, reads current pipeline/stage and cancels without a mutation');

  const observer=await session(token);await observer.goto(base+'/crm/deals');
  await observer.getByRole('button',{name:'Actions for Action Deal',exact:true}).waitFor();
  await Promise.all([page,observer].map(tab=>tab.waitForFunction(()=>window.__recordPlanStreams['/api/proxy/crm/record-events'])));
  await action('Action Deal','Edit deal',observer);
  await observer.getByRole('dialog').getByLabel('Title',{exact:false}).fill('Keep this unfinished edit');
  await action('Action Deal','Change stage');
  const stageChange=page.getByRole('dialog',{name:'Change Deal stage'});
  assert.equal(await stageChange.getByLabel('Choose the target pipeline',{exact:true}).count(),0);
  await stageChange.getByLabel('Choose the target stage',{exact:true}).selectOption(qualified.id);
  await stageChange.getByRole('button',{name:'Move deal',exact:true}).click();await stageChange.waitFor({state:'hidden'});
  await until(async()=>(await stored('Action Deal')).stageId===qualified.id,'Single-pipeline stage selection did not persist');
  assert.equal((await stored('Action Deal')).pipelineId,pipeline.id);assert.equal(await prisma.dealStageHistory.count({where:{dealId:fixtures['Action Deal'].id}}),initialStageHistory+1);
  await observer.getByRole('region',{name:'Deal pipeline',exact:true}).getByRole('heading',{name:'Qualified',exact:true}).locator('xpath=ancestor::div[4]').getByRole('button',{name:'Actions for Action Deal',exact:true}).waitFor({timeout:12000});
  assert.equal(await observer.getByRole('dialog').getByLabel('Title',{exact:false}).inputValue(),'Keep this unfinished edit');
  await observer.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await observer.getByRole('alertdialog',{name:'Discard unsaved changes?',exact:true}).getByRole('button',{name:'Discard changes',exact:true}).click();
  await action('Lost Action','Add a task',observer);
  const pendingTask=observer.getByRole('dialog');
  await pendingTask.getByLabel(/^Title/).fill('Keep this unfinished task');
  await action('Lost Action','Change stage');
  const contacted=allStages.find(stage=>stage.name==='Contacted');
  await stageChange.getByLabel('Choose the target stage',{exact:true}).selectOption(contacted.id);
  await stageChange.getByRole('button',{name:'Move deal',exact:true}).click();await stageChange.waitFor({state:'hidden'});
  await observer.getByRole('region',{name:'Deal pipeline',exact:true}).getByRole('heading',{name:contacted.name,exact:true}).locator('xpath=ancestor::div[4]').getByRole('button',{name:'Actions for Lost Action',exact:true}).waitFor({timeout:12000});
  assert.equal(await pendingTask.getByLabel(/^Title/).inputValue(),'Keep this unfinished task');
  assert.equal(await prisma.task.count({where:{tenantId:tenant.id,title:'Keep this unfinished task'}}),0);
  await pendingTask.getByRole('button',{name:'Close',exact:true}).click();
  await observer.getByRole('alertdialog',{name:'Discard unsaved changes?',exact:true}).getByRole('button',{name:'Discard changes',exact:true}).click();
  await pendingTask.waitFor({state:'hidden'});
  record('Second-session stage synchronization preserves an unsaved Task draft without creating a record');
  await action('Action Deal','Edit deal',observer);await observer.getByRole('dialog').getByLabel('Title',{exact:false}).fill('Keep this unfinished edit');
  record('Single Sales Pipeline stage selection commits once and second-session sync preserves the open edit draft');
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
  await observer.getByRole('alertdialog',{name:'Discard unsaved changes?',exact:true}).getByRole('button',{name:'Discard changes',exact:true}).click();
  await observer.getByRole('button',{name:'Actions for Action Deal Updated',exact:true}).waitFor({timeout:12000});
  closingContexts.add(observer.context()); await observer.context().close();
  record('Edit correct Deal, complete 61-agent directory, portal selection and second-session sync preserves draft');
  await prisma.pipeline.update({where:{id:destination.id},data:{isArchived:false}});await page.reload();

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
  await taskEditor.getByRole('button', { name: /^Assigned Agent/ }).click();
  const taskOwners = page.getByRole('dialog', { name: 'Select owner', exact: true });
  await taskOwners.getByLabel('Search owner', { exact: true }).fill('Agent 00');
  await until(async () => await taskOwners.getByRole('checkbox').count() === 1 && await taskOwners.getByLabel('Agent 00', { exact: true }).count() === 1,
    'Task assignment search must find the exact eligible agent beyond a bounded default page');
  await taskOwners.getByLabel('Agent 00', { exact: true }).check();
  await page.getByLabel('Search owner', { exact: true }).press('Escape');
  await taskEditor.getByRole('button',{name:'Create task',exact:true}).click();
  await until(async()=>!!await prisma.task.findFirst({where:{title:'Deal action browser task',tenantId:tenant.id}}),'Context task did not persist');
  const task=await prisma.task.findFirst({where:{title:'Deal action browser task',tenantId:tenant.id},include:{dealLinks:true}});
  assert.equal(task.createdById,admin.id);assert.deepEqual(task.dealLinks.map(link=>link.dealId),[fixtures['Action Deal'].id]);
  await taskEditor.waitFor({state:'hidden'});record('Context Task uses plural Deal links and preserves creator ownership');

  await action('Action Deal Updated','Send an email');
  await page.getByRole('dialog',{name:'Choose an email recipient'}).getByRole('button',{name:/Acceptance Contact/}).click();
  await page.waitForURL(/\/inbox/);record('Context email requires explicit linked recipient and opens Inbox');
  await page.goto(base+'/crm/deals');
  // The separate pipeline API remains compatible; Change stage never offers transfers.
  const transferResponse = await fetch(apiBase + '/crm/deals/' + fixtures['Action Deal'].id + '/pipeline', {
    method: 'PATCH', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ pipelineId: destination.id, stageId: target.id }),
  });
  assert.equal(transferResponse.status, 200, await transferResponse.text());
  const moved=await stored('Action Deal');assert.equal(moved.pipelineId,destination.id);assert.equal(moved.stageId,target.id);assert.equal(Number(moved.value),25000);assert.equal(moved.assignedUserId,agents[60].id);
  assert.equal(await prisma.leadDeal.count({where:{dealId:moved.id}}),1);assert.equal(await prisma.contactDeal.count({where:{dealId:moved.id}}),1);assert.equal(await prisma.taskDeal.count({where:{dealId:moved.id}}),1);
  await page.goto(base+'/crm/deals?highlight='+moved.id+'&pipelineId='+destination.id);
  await page.getByRole('button',{name:'Actions for Action Deal Updated',exact:true}).waitFor();
  await action('Action Deal Updated','Change stage');
  const movedLocation=page.getByRole('dialog',{name:'Change Deal stage'});
  await movedLocation.getByRole('region',{name:'Current deal location'}).getByText(destination.name,{exact:true}).waitFor();
  assert.equal(await movedLocation.getByLabel('Choose the target pipeline',{exact:true}).count(),0);
  assert.equal(await movedLocation.getByRole('option',{name:'Qualified',exact:true}).count(),0);
  await movedLocation.getByLabel('Choose the target stage',{exact:true}).selectOption(required.id);
  await movedLocation.getByRole('button',{name:'Move deal',exact:true}).click();
  await movedLocation.getByRole('alert').filter({hasText:/leadSource/}).waitFor();
  assert.equal(await movedLocation.getByLabel('Choose the target stage',{exact:true}).inputValue(),required.id);
  assert.equal((await stored('Action Deal')).pipelineId,destination.id);
  await movedLocation.getByRole('button',{name:'Cancel',exact:true}).click();
  record('Change stage reads the assigned Renewals pipeline, excludes Sales stages and preserves stage requirements without transferring pipelines');
  await page.getByRole('button',{name:'New Deal',exact:true}).click();
  await page.getByRole('heading',{name:'New Deal',exact:true}).waitFor();await page.getByRole('dialog').getByText('Renewals',{exact:true}).waitFor();
  const createEditor=page.getByRole('dialog');
  assert.equal(await createEditor.getByText('Contacts',{exact:true}).count(),1);
  assert.equal(await createEditor.getByText('Leads',{exact:true}).count(),1);
  assert.equal(await createEditor.getByText(/Associate one or more.*optional/i).count(),0);
  await createEditor.getByLabel('Title',{exact:false}).fill('New Renewal Deal');
  await createEditor.getByRole('button',{name:'Product Interest',exact:true}).click();
  await page.getByRole('checkbox',{name:'Acceptance product',exact:true}).check();
  await page.keyboard.press('Escape');
  await createEditor.getByRole('button',{name:'Create Deal',exact:true}).click();
  await page.getByRole('button',{name:'Actions for New Renewal Deal',exact:true}).waitFor();
  const created=await prisma.deal.findFirstOrThrow({where:{tenantId:tenant.id,title:'New Renewal Deal'}});
  assert.equal(created.pipelineId,destination.id);assert.equal(created.stageId,target.id);assert.equal(created.productInterestId,product.id);assert.equal(Number(created.value),25000);
  record('Transfer validation retains choices, atomic links/value persist, destination deep link and product-backed creation work');

  await action('Action Deal Updated','Archive');
  await page.getByRole('alertdialog').getByRole('button',{name:'Archive',exact:true}).click();
  await page.getByRole('button',{name:'Actions for Action Deal Updated',exact:true}).waitFor({state:'hidden'});
  assert.equal((await stored('Action Deal')).isArchived,true);assert.equal(await prisma.taskDeal.count({where:{dealId:moved.id}}),1);assert.equal(await prisma.activity.count({where:{dealId:moved.id,type:'note'}}),1);
  const restore=await page.request.patch(apiBase+'/crm/deals/'+moved.id+'/restore',{headers:{authorization:'Bearer '+token}});assert.equal(restore.status(),200,await restore.text());
  await page.getByRole('button',{name:'Actions for Action Deal Updated',exact:true}).waitFor({timeout:12000});record('Archive hides active card, preserves children and restores via existing path with realtime refresh');

  await page.goto(base+'/crm/deals?pipelineId='+pipeline.id);
  const beforeLoss=(await stored('Lost Action')).stageId;
  const beforeLossHistory=await prisma.dealStageHistory.count({where:{dealId:fixtures['Lost Action'].id}});
  await action('Lost Action','Mark as lost');
  const lostDialog=page.getByRole('dialog',{name:'Close Deal as lost'});assert.equal(await lostDialog.getByRole('button',{name:'Save',exact:true}).isEnabled(),false);
  await lostDialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await stored('Lost Action')).stageId,beforeLoss);
  assert.equal(await prisma.dealStageHistory.count({where:{dealId:fixtures['Lost Action'].id}}),beforeLossHistory);
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
  const keyboardId=fixtures['Desktop Drag'].id;
  const dragAnnouncement=page.locator('[role="status"][id^="DndLiveRegion"]').first();
  const keyboardStart=async()=>{
    await keyboardDrag.focus();await page.keyboard.press('Space');
    await until(async()=>await keyboardDrag.getAttribute('aria-pressed')==='true'&&await page.getByRole('heading',{name:'Desktop Drag',exact:true}).count()===2,'Keyboard drag did not activate');
    await until(async()=>(await dragAnnouncement.textContent()).includes(`Draggable item ${keyboardId} was moved over droppable area`),'Keyboard collision geometry did not become ready');
    // Flush the sensor's already-queued keydown listener installation.
    await page.evaluate(()=>new Promise(done=>setTimeout(done,0)));
  };
  const keyboardLeft=async()=>{await page.keyboard.press('ArrowLeft');await until(async()=>await column(page,'Contacted').getByRole('heading',{name:'Desktop Drag',exact:true}).count()===1,'Keyboard arrow did not preview adjacent stage');};
  await keyboardStart();await keyboardLeft();await page.keyboard.press('Escape');
  await until(async()=>(await dragAnnouncement.textContent())===`Dragging was cancelled. Draggable item ${keyboardId} was dropped.`,'Keyboard cancellation was not announced');
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
  // Stop edge scrolling before measuring; protocol delays can carry the target
  // past the viewport. Steer back when necessary instead of accepting negative x.
  let targetVisible=false;
  for(let i=0;i<40;i++){
    await touch('touchMove',br.x+br.width/2,y);
    await mobile.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    const b=await column(mobile,'Qualified').boundingBox();
    const left=Math.max(br.x+br.width*.2,b.x),right=Math.min(br.x+br.width*.8,b.x+b.width);
    if(right>left){targetVisible=true;break;}
    const edge=b.x>=br.x+br.width*.8?br.x+br.width-12:br.x+12;
    await touch('touchMove',edge,y);await mobile.waitForTimeout(100);
  }
  assert.ok(targetVisible,'Touch auto-scroll must bring Qualified into the visible board');
  assert.ok(await board(mobile).evaluate(el=>el.scrollLeft)>400,'Touch drag must auto-scroll horizontally');
  const mq=await column(mobile,'Qualified').boundingBox();
  const visibleLeft=Math.max(br.x+br.width*.2,mq.x),visibleRight=Math.min(br.x+br.width*.8,mq.x+mq.width);
  assert.ok(visibleRight>visibleLeft,'Qualified must intersect the interior of the visible board');
  const tx=(visibleLeft+visibleRight)/2,ty=Math.min(750,mq.y+150);
  await touch('touchMove',tx,ty);
  await until(async()=>await column(mobile,'Qualified').getByRole('heading',{name:'Mobile Drag',exact:true}).count()===1,'Touch drag did not preview Qualified');
  await touch('touchEnd',tx,ty);
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
  await mobile.setViewportSize({width:320,height:500});
  const touchStageAction=async()=>{await mobile.getByRole('button',{name:'Actions for Mobile Drag',exact:true}).tap();await mobile.getByRole('menuitem',{name:/^Change stage/}).tap();};
  await touchStageAction();
  const mobileTransfer=mobile.getByRole('dialog',{name:'Change Deal stage'});
  await until(async()=>{const b=await mobileTransfer.boundingBox();return b&&b.x>=0&&b.y>=0&&b.x+b.width<=320&&b.y+b.height<=500;},'Transfer dialog must fit a short mobile viewport');
  await mobileTransfer.getByRole('region',{name:'Current deal location'}).getByText(pipeline.name,{exact:true}).waitFor();
  assert.equal(await mobileTransfer.getByLabel('Choose the target pipeline',{exact:true}).count(),0);
  await mobileTransfer.getByLabel('Choose the target stage',{exact:true}).selectOption(allStages.find(stage=>stage.name==='Contacted').id);
  await mobile.screenshot({path:resolve(output,'current-stage-selection-320.png')});
  await mobileTransfer.getByRole('button',{name:'Move deal',exact:true}).tap();await mobileTransfer.waitFor({state:'hidden'});
  await until(async()=>(await stored('Mobile Drag')).stageId===allStages.find(stage=>stage.name==='Contacted').id,'Small mobile stage selection did not persist');
  assert.equal((await stored('Mobile Drag')).pipelineId,pipeline.id);
  await touchStageAction();
  await mobileTransfer.getByRole('region',{name:'Current deal location'}).getByText('Contacted',{exact:true}).waitFor();
  assert.equal(await mobileTransfer.getByLabel('Choose the target pipeline',{exact:true}).count(),0);
  assert.equal(await mobileTransfer.getByRole('option',{name:'Review',exact:true}).count(),0);
  await mobileTransfer.getByLabel('Choose the target stage',{exact:true}).selectOption(qualified.id);
  assert.equal(await mobileTransfer.getByRole('button',{name:'Move deal',exact:true}).isEnabled(),true);
  await mobile.screenshot({path:resolve(output,'current-pipeline-transfer-320.png')});
  await mobileTransfer.getByRole('button',{name:'Cancel',exact:true}).tap();await mobileTransfer.waitFor({state:'hidden'});
  assert.equal((await stored('Mobile Drag')).pipelineId,pipeline.id);assert.equal((await stored('Mobile Drag')).stageId,allStages.find(stage=>stage.name==='Contacted').id);
  record('320x500 touch viewport saves a stage in Sales and cancels another same-pipeline selection');
  closing=true;await browser.close();browser=undefined;page=undefined;
  const mailbox=await prisma.emailAccount.create({data:{tenantId:tenant.id,userId:admin.id,email:admin.email,accessToken:'local-fixture-only',scopes:[]}});
  const messageData={tenantId:tenant.id,accountId:mailbox.id,direction:'outbound',from:admin.email,fromAddress:admin.email,recipients:[contact.email],recipientAddresses:[contact.email],authorizationParticipants:[admin.email,contact.email],participantPolicyVersion:1,subject:'Fixture conversation',body:'Local verification',snippet:'Local verification',labels:['SENT'],sentAt:new Date(),contactId:contact.id};
  await prisma.mailboxMessage.create({data:{...messageData,providerMessageId:'local-message',threadId:'local-thread'}});
  const associate=async(threadId,dealId)=>fetch(apiBase+'/integrations/gmail/threads/'+threadId+'/deal',{method:'PATCH',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({dealId})});
  const linked=await associate('local-thread',moved.id);assert.equal(linked.status,200,await linked.text());
  const linkReplay=await associate('local-thread',moved.id);assert.equal(linkReplay.status,200,await linkReplay.text());
  assert.equal(await prisma.mailboxThreadAssociation.count({where:{tenantId:tenant.id,threadId:'local-thread',dealId:moved.id}}),1);
  assert.equal(await prisma.activity.count({where:{tenantId:tenant.id,dealId:moved.id,title:'Email conversation associated with this Deal'}}),1);
  const closedLink=await associate('local-thread',fixtures['Won Evidence'].id);assert.equal(closedLink.status,400,await closedLink.text());
  const secondContact=await prisma.contact.create({data:{tenantId:tenant.id,firstName:'Second',lastName:'Recipient',email:'second@example.test',assignedUserId:admin.id,productInterests:[]}});
  await prisma.mailboxMessage.createMany({data:[{...messageData,providerMessageId:'ambiguous-one',threadId:'ambiguous-thread'},{...messageData,providerMessageId:'ambiguous-two',threadId:'ambiguous-thread',contactId:secondContact.id,recipients:[secondContact.email],recipientAddresses:[secondContact.email],authorizationParticipants:[admin.email,secondContact.email]}]});
  const ambiguous=await associate('ambiguous-thread',moved.id);assert.equal(ambiguous.status,409,await ambiguous.text());
  assert.equal(await prisma.mailboxThreadAssociation.count({where:{tenantId:tenant.id,threadId:'ambiguous-thread'}}),0);
  record('Existing email association API persists once, replays safely and rejects closed Deals and ambiguous people');
}
try {
  await runAcceptance();
  assert.deepEqual(pageErrors,[]);assert.deepEqual(serverErrors,[]);assert.deepEqual(transportErrors,[]);
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
