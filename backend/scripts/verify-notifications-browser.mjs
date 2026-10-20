import { acceptancePort, createAcceptanceContext } from './verify-browser-matrix.mjs';
// Uses an isolated PostgreSQL cluster and the built application. No external messages.
// Set PLAYWRIGHT_MODULE to an installed Playwright package.
import { notificationTestPostgres } from './notification-test-postgres.mjs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '../..'), output = process.env.LEADCRM_BROWSER_OUTPUT || (process.env.NOTIFICATION_EVIDENCE_DIR || resolve(root, 'data/outputs/notification-verification/browser'));
mkdirSync(output, { recursive: true });
const pg = await notificationTestPostgres();
const base = `http://localhost:${await acceptancePort()}`;
const database = await pg.database('leadcrm_notification_browser_1');
Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: database, DIRECT_URL: database,
  JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_URL: base, CORS_ORIGIN: base,
  ALLOWED_ORIGINS: base, BREVO_API_KEY: '', RESEND_API_KEY: '', NOTIFICATION_WORKER_ENABLED: 'false' });
const require = createRequire(import.meta.url), Module = require('node:module'), originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) { return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options); };
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const prisma = require('../dist/backend/src/config/database.config.js').default;
const app = require('../dist/backend/src/app.js').default;
const { dispatchTenantNotifications } = require('../dist/backend/src/modules/notifications/notification-events.service.js');
const { issueAuthSession } = require('../dist/backend/src/core/auth/auth-session.js');
let api, frontend, browser, page, closing = false, rejectDelete = false, rejectFeed = false, rejectRecordRead = false;
const checks = [], pageErrors = [], transportErrors = [], requests = [];
const record = label => { checks.push(label); console.log('PASS', label); };
const eventually = async predicate => { for(let n=0;n<80;n++){if(await predicate())return; await new Promise(done=>setTimeout(done,100));}throw Error('Condition did not settle'); };
try {
  const tenant = await prisma.tenant.create({ data: { name: 'Notification Acceptance', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
  const role = await prisma.roleDefinition.create({ data: { tenantId: tenant.id, name: 'Sales Agent' } });
  await prisma.rolePermission.createMany({ data: ['leads','contacts','accounts','deals','tasks'].map(module => ({ tenantId: tenant.id, roleId: role.id, module, canView: true, canEdit: true, canCreate: true,
    ...(['leads','contacts','accounts','deals'].includes(module) ? { canViewAll: true, canViewMy: true } : {}) })) });
  const agent = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Notification', lastName: 'Tester', email: 'notification-preview@camxian.com', role: role.name, status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
  await prisma.userRole.create({ data: { tenantId: tenant.id, roleId: role.id, userId: agent.id } });
  const other = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Other', lastName: 'Tester', email: 'other-preview@camxian.com', role: role.name, status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
  await prisma.userRole.create({ data: { tenantId: tenant.id, roleId: role.id, userId: other.id } });
  let token = (await issueAuthSession(agent)).token;
  const createContact = name => prisma.contact.create({ data: { tenantId: tenant.id, firstName: name, lastName: 'Acceptance', email: randomUUID()+'@example.test', assignedUserId: agent.id } });
  for(let n=0;n<110;n++)await createContact('Contact '+n);
  while((await dispatchTenantNotifications(tenant.id,new Date(),100)).claimed) {}
  const where = { tenantId: tenant.id, userId: agent.id };
  assert.equal(await prisma.notification.count({where}),110);
  api = app.listen(0, '127.0.0.1'); await new Promise(done => api.once('listening', done));
  const log = createWriteStream(resolve(output, 'frontend.log'));
  frontend = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '-p', new URL(base).port, '-H', '127.0.0.1'], { cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production', API_URL: 'https://leadcrm-build.example/api/v1' } });
  frontend.stdout.pipe(log); frontend.stderr.pipe(log);
  await eventually(async()=>{try{return (await fetch(base+'/login')).ok;}catch{return false;}});
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await createAcceptanceContext(browser, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  await context.addCookies([{ name: 'leadcrm_token', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
  page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => pageErrors.push(error.message));
  // Redirect only transport; all authentication, authorization and persistence use local API/SQL.
  await page.route('**/api/proxy/**', async route => {
    const request = route.request(), url = new URL(request.url()); requests.push({ method: request.method(), path: url.pathname, query: url.search });
    if ((rejectDelete && request.method()==='DELETE' && url.pathname.endsWith('/notifications')) || (rejectFeed && url.pathname.endsWith('/notifications') && request.method()==='GET')
      || (rejectRecordRead && request.method()==='PATCH' && url.pathname.endsWith('/notifications/read-all') && request.postDataJSON()?.record)) {
      await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,error:{message:'Acceptance failure'}})});return;
    }
    try {
      const localUrl=`http://127.0.0.1:${api.address().port}/api/v1${url.pathname.replace('/api/proxy', '')}${url.search}`;
      if(url.pathname.endsWith('/events')||url.pathname.endsWith('/record-events')) {
        // Playwright's buffered request transport cannot finish an infinite SSE
        // response. Verify the real authenticated first event, then close this
        // harness connection. Sustained streaming is tested by its own suite.
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),10000);
        try {
          const response=await fetch(localUrl,{headers:{authorization:`Bearer ${token}`},signal:controller.signal});
          const reader=response.body.getReader(),first=await reader.read();
          await route.fulfill({status:response.status,contentType:response.headers.get('content-type')||'text/event-stream',body:Buffer.from(first.value||[])});
          await reader.cancel();
        }finally{clearTimeout(timeout);controller.abort();}
        return;
      }
      const response = await page.request.fetch(localUrl, { method: request.method(), headers: { ...request.headers(), authorization: `Bearer ${token}` }, data: request.postDataBuffer() ?? undefined, maxRetries: request.method() === 'GET' ? 2 : 0 });
      await route.fulfill({ response });
    } catch (error) { if (!closing) transportErrors.push(`${request.method()} ${url.pathname}: ${String(error).split('\n')[0]}`); await route.abort().catch(() => {}); }
  });
  const navigate = path => page.goto(base + path);
  const rows = () => page.locator('[data-notification-id]');
  const bell = () => page.getByRole('button',{name:/^Notifications, \d+ unread$/});
  const dialog = () => page.getByRole('dialog',{name:'Notifications',exact:true});
  async function responsive(label, locator) {
    for(const theme of ['Light', 'Dark']) {
      await page.evaluate(mode => { localStorage.setItem('app_theme', mode); window.dispatchEvent(new StorageEvent('storage', { key: 'app_theme' })); }, theme);
      await eventually(async()=>await page.locator('.crm-shell[data-theme-container]').evaluate((el,mode)=>el.classList.contains('dark')===(mode==='Dark'),theme));
    for(const width of [320,375,390,430,768,1024,1440,1920]) {
      await page.setViewportSize({width,height:900}); await page.waitForTimeout(200);
      if(label==='page') await page.getByRole('heading',{name:'Notifications',exact:true}).scrollIntoViewIfNeeded();
      assert.equal(await page.getByText('Failed to load data. Please refresh the page.',{exact:true}).count(),0);
      const dimensions = await locator.evaluate(el=>({overflow:el.scrollWidth>el.clientWidth+1,outside:[...el.querySelectorAll('button,input')].filter(e=>e.getClientRects().length&&(e.getBoundingClientRect().left< -1||e.getBoundingClientRect().right>innerWidth+1)).map(e=>e.getAttribute('aria-label')||e.textContent)}));
      assert.equal(dimensions.overflow,false,JSON.stringify(dimensions)); assert.deepEqual(dimensions.outside,[],JSON.stringify(dimensions));
      await page.screenshot({path:resolve(output,`${label}-${theme.toLowerCase()}-${width}.png`)});record(`${label} ${theme} responsive ${width}`);
    }
    }
    await page.evaluate(() => { localStorage.setItem('app_theme', 'Light'); window.dispatchEvent(new StorageEvent('storage', { key: 'app_theme' })); });
    await page.setViewportSize({width:1440,height:900});
  }
  await navigate('/crm/contacts'); await bell().filter({hasText:'99+'}).waitFor();
  assert.equal(requests.filter(r=>r.path.endsWith('/notifications')).length,0);record('Closed dropdown loads counts only; badge caps at 99+');
  await bell().focus(); await page.keyboard.press('Enter'); await dialog().getByRole('button',{name:/Contact Assigned to You/}).first().waitFor();
  assert.equal(await dialog().getByRole('button',{name:/Contact Assigned to You/}).count(),5);
  await responsive('dropdown',dialog());
  await page.keyboard.press('Escape'); await dialog().waitFor({state:'hidden'}); assert.equal(await bell().evaluate(el=>el===document.activeElement),true);record('Recent five, keyboard opening, Escape and focus restoration');
  await bell().click(); await page.getByRole('heading',{name:'Contacts',exact:true}).click(); await dialog().waitFor({state:'hidden'});record('Outside click closes dropdown');
  await navigate('/notifications'); await eventually(async()=>await rows().count()===20);
  const expected = await prisma.notification.findMany({where,take:20,orderBy:[{createdAt:'desc'},{id:'asc'}]});
  assert.deepEqual(await rows().evaluateAll(items=>items.map(e=>e.getAttribute('data-notification-id'))),expected.map(n=>n.id));
  await page.getByRole('button',{name:'Load More',exact:true}).click(); await eventually(async()=>await rows().count()===40);record('Newest-first stable SQL order and keyset Load More');
  await responsive('page',page.locator('main'));
  const id=await rows().first().getAttribute('data-notification-id'); const source=await prisma.notification.findUniqueOrThrow({where:{id}});
  await rows().first().getByRole('button',{name:/Contact Assigned to You/}).click();
  await page.waitForURL('**/crm/contacts/'+source.entityId);
  await eventually(async()=> (await prisma.notification.findUniqueOrThrow({where:{id}})).isRead);record('Notification read persists after its actual Contact details load');
  await navigate('/notifications'); await eventually(async()=>await rows().count()===20);
  await page.getByRole('tab',{name:/^Read/}).click(); await eventually(async()=>await rows().count()===1);
  await page.getByRole('tab',{name:/^All/}).focus(); await page.keyboard.press('ArrowRight'); assert.equal(await page.getByRole('tab',{name:/^Unread/}).getAttribute('aria-selected'),'true');record('Read/Unread tabs and arrow-key operation');
  await page.getByRole('tab',{name:/^All/}).click(); await eventually(async()=>await rows().count()===20);
  await page.getByLabel('Select all notifications shown',{exact:true}).focus(); await page.keyboard.press('Space'); assert.equal(await page.getByLabel('Select all notifications shown',{exact:true}).isChecked(),true); await page.getByRole('button',{name:'Delete (20)',exact:true}).click();
  const confirm=page.getByRole('alertdialog'); await confirm.getByRole('button',{name:'Delete',exact:true}).focus(); await page.keyboard.press('Tab'); assert.equal(await confirm.evaluate(el=>el.contains(document.activeElement)),true);
  await responsive('delete-dialog',confirm);
  await confirm.getByRole('button',{name:'Cancel',exact:true}).click(); assert.equal(await prisma.notification.count({where}),110);
  assert.equal(await page.getByRole('button',{name:'Delete (20)',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.getByRole('button',{name:'Delete (20)',exact:true}).click(); rejectDelete=true; await confirm.getByRole('button',{name:'Delete',exact:true}).click();
  await page.getByText('Failed to delete notifications',{exact:true}).waitFor(); assert.equal(await page.getByRole('button',{name:'Delete (20)',exact:true}).count(),1); assert.equal(await prisma.notification.count({where}),110);
  rejectDelete=false; await confirm.getByRole('button',{name:'Delete',exact:true}).click(); await confirm.waitFor({state:'hidden'});
  await eventually(async()=>await prisma.notification.count({where})===90);assert.equal(await page.getByRole('button',{name:'Delete (20)',exact:true}).count(),0);record('Cancel and failed deletion preserve data/selection; successful bulk deletion clears selection');
  const singleId=await rows().first().getAttribute('data-notification-id'); await rows().first().getByRole('button',{name:'Delete notification',exact:true}).click();
  await confirm.getByRole('button',{name:'Delete',exact:true}).click(); await confirm.waitFor({state:'hidden'}); assert.equal(await prisma.notification.findUnique({where:{id:singleId}}),null);record('Individual deletion persists');
  assert.equal(await prisma.contact.count({where:{tenantId:tenant.id}}),110);
  await page.getByRole('button',{name:'Mark all notifications as read',exact:true}).click(); await eventually(async()=>await prisma.notification.count({where:{...where,isRead:false}})===0);
  await page.getByRole('tab',{name:/^Unread/}).click(); await page.getByText('No unread notifications',{exact:true}).waitFor(); await page.reload(); await bell().filter({hasText:'99+'}).waitFor({state:'hidden'});record('Mark all read covers unloaded rows and survives reload without changing Contacts');
  const unavailable=await createContact('Unavailable'); await dispatchTenantNotifications(tenant.id,new Date(),100); await prisma.contact.update({where:{id:unavailable.id},data:{isArchived:true}});
  await navigate('/notifications'); await rows().first().getByText('Notification no longer available',{exact:true}).waitFor();
  await rows().first().getByRole('button',{name:/Notification no longer available/}).click(); await page.getByText(/related record.*(unavailable|available)/i).first().waitFor(); assert.ok(page.url().endsWith('/notifications'));record('Archived destination is redacted and cannot redirect');
  rejectFeed=true; await page.reload(); await page.getByRole('button',{name:'Try Again',exact:true}).waitFor(); rejectFeed=false; await page.getByRole('button',{name:'Try Again',exact:true}).click(); await rows().first().waitFor();record('Feed failure and explicit retry');
  await navigate('/settings/profile'); await page.getByRole('button',{name:'Notifications',exact:true}).click();
  const toggle=page.getByRole('switch',{name:'In-app general notification alerts',exact:true}); await toggle.waitFor(); await eventually(async()=>!(await toggle.isDisabled()));
  assert.equal(await page.getByRole('switch',{name:/unavailable/}).count(),3); await toggle.click(); await page.getByRole('button',{name:'Save Channels',exact:true}).click(); await page.getByText('Notification preferences saved.',{exact:true}).waitFor();
  await page.reload(); await page.getByRole('button',{name:'Notifications',exact:true}).click(); await eventually(async()=>await toggle.getAttribute('aria-checked')==='false');
  const muted=await createContact('Muted');await dispatchTenantNotifications(tenant.id,new Date(),100); assert.equal(await prisma.notification.count({where:{...where,entityId:muted.id}}),0);record('Saved preference survives reload and suppresses real optional delivery; unsupported channels disabled');
  await toggle.click(); await page.getByRole('button',{name:'Save Channels',exact:true}).click(); await page.getByText('Notification preferences saved.',{exact:true}).waitFor();
  const task=await prisma.task.create({data:{tenantId:tenant.id,title:'Notification task destination',assignedUserId:agent.id,dueDate:new Date(Date.now()+3*86400000)}});
  await dispatchTenantNotifications(tenant.id,new Date(),100); await navigate('/notifications'); await rows().first().getByRole('button',{name:/New Task Assigned/}).click();
  await page.getByRole('dialog',{name:task.title,exact:true}).waitFor(); await page.getByText(task.title,{exact:true}).first().waitFor();
  await eventually(async()=>await prisma.notification.count({where:{...where,entityType:'Task',entityId:task.id,isRead:false}})===0);record('Task notification opens the existing task drawer and reads its associated notifications');
  const adminRole=await prisma.roleDefinition.create({data:{tenantId:tenant.id,name:'Client Admin',isSystemRole:true}});
  const admin=await prisma.user.create({data:{tenantId:tenant.id,firstName:'Policy',lastName:'Admin',email:'policy-admin@camxian.com',role:'Client Admin',mustChangePassword:false,onboardingCompletedAt:new Date(),userRoles:{create:{roleId:adminRole.id}}}});
  const group=await prisma.tenantGroup.upsert({where:{tenantId_systemKey:{tenantId:tenant.id,systemKey:'SALES'}},create:{tenantId:tenant.id,name:'Sales',systemKey:'SALES'},update:{}});
  await prisma.tenantGroupMember.create({data:{tenantId:tenant.id,groupId:group.id,userId:agent.id}});
  const product=await prisma.productInterest.create({data:{tenantId:tenant.id,name:'Browser Product',dealValue:45000}});
  const forms=require('../dist/backend/src/modules/marketing/forms/forms.service.js');
  const publicForms=require('../dist/backend/src/modules/marketing/forms/public-forms.service.js');
  const form=await forms.createForm(tenant.id,admin.id,{name:'Browser Website Form'});
  const published=await forms.publishForm(form.id,tenant.id,admin.id);
  const inquiryEmail=randomUUID()+'@example.test';
  await publicForms.submitPublicForm(form.publicId,{version:published.publishedVersion,requestId:randomUUID(),values:{firstName:'Josh',lastName:'Tiron',email:inquiryEmail,productInterest:product.id,address:'Makati'}});
  await dispatchTenantNotifications(tenant.id,new Date(),100);
  token=(await issueAuthSession(admin)).token; await context.clearCookies(); await context.addCookies([{name:'leadcrm_token',value:token,url:base,httpOnly:true,sameSite:'Lax'}]);
  await navigate('/notifications');
  const website=rows().filter({hasText:'New Website Lead'}); await website.getByText('Josh Tiron submitted a new inquiry. Assigned to Notification Tester.',{exact:true}).waitFor();
  assert.equal(await website.count(),1); await website.getByRole('button',{name:/New Website Lead/}).click();
  const captured=await prisma.lead.findFirstOrThrow({where:{tenantId:tenant.id,email:inquiryEmail}}); await page.waitForURL('**/crm/leads/'+captured.id);record('Real published Website Lead has accurate admin presentation and authorized Lead navigation');
  await prisma.rolePermission.update({where:{roleId_module:{roleId:role.id,module:'contacts'}},data:{canCreate:false}}); await dispatchTenantNotifications(tenant.id,new Date(),100);
  await navigate('/notifications'); await rows().filter({hasText:'Role Permissions Updated'}).getByRole('button',{name:/Role Permissions Updated/}).click();
  await page.waitForURL('**/settings?tab=roles');record('Registered role permission security notice opens existing Roles & Permissions');
  token=(await issueAuthSession(other)).token; await context.clearCookies(); await context.addCookies([{name:'leadcrm_token',value:token,url:base,httpOnly:true,sameSite:'Lax'}]);
  await navigate('/notifications'); await page.getByText('No notifications yet',{exact:true}).waitFor(); assert.equal(await rows().count(),0); await bell().filter({hasText:'99+'}).waitFor({state:'hidden'});record('New authenticated user sees an isolated empty feed');

  // The earlier public-form scenario creates an unrelated Deal assignment.
  // Start this scenario with only its two fixture Deals unread.
  await prisma.notification.updateMany({where:{...where,entityType:'Deal',isRead:false},data:{isRead:true,readAt:new Date()}});
  const pipeline=await prisma.pipeline.findFirstOrThrow({where:{tenantId:tenant.id,isArchived:false},include:{stages:{orderBy:{order:'asc'}}}});
  const unreadDeals=[];
  for(const title of ['Unread notification Deal One','Unread notification Deal Two']) unreadDeals.push(await prisma.deal.create({data:{tenantId:tenant.id,title,pipelineId:pipeline.id,stageId:pipeline.stages[0].id,assignedUserId:agent.id}}));
  await prisma.notification.createMany({data:[unreadDeals[0],unreadDeals[0],unreadDeals[1]].map(deal=>({tenantId:tenant.id,userId:agent.id,type:'deal_assigned',title:'Deal requires attention',entityType:'Deal',entityId:deal.id}))});
  const privateNotice=await prisma.notification.create({data:{tenantId:tenant.id,userId:other.id,type:'deal_assigned',title:'Private other-user alert',entityType:'Deal',entityId:unreadDeals[0].id}});
  token=(await issueAuthSession(agent)).token; await context.clearCookies(); await context.addCookies([{name:'leadcrm_token',value:token,url:base,httpOnly:true,sameSite:'Lax'}]);
  const recordReads=()=>requests.filter(request=>request.method==='PATCH'&&request.path.endsWith('/notifications/read-all')).length;
  const beforeOpen=recordReads();
  const beforeUnread=await prisma.notification.count({where:{...where,isRead:false}});
  await navigate('/crm/deals');
  const navigation=page.getByRole('navigation',{name:'Workspace',exact:true});
  const dealNav=navigation.getByRole('button',{name:'Deals',exact:true});
  const moduleDot=()=>dealNav.getByRole('status',{name:'Unread Deals notifications',exact:true});
  const card=deal=>page.locator('div.select-none').filter({has:page.getByText(deal.title,{exact:true})});
  const cardDot=deal=>card(deal).getByRole('status',{name:'Unread Deal notifications',exact:true});
  await cardDot(unreadDeals[0]).waitFor(); await cardDot(unreadDeals[1]).waitFor();
  assert.equal(await cardDot(unreadDeals[0]).count(),1); assert.equal(recordReads(),beforeOpen);
  if(await page.getByRole('button',{name:'Expand sidebar',exact:true}).count()) await page.getByRole('button',{name:'Expand sidebar',exact:true}).click();
  await moduleDot().waitFor();
  assert.equal(await moduleDot().evaluate(dot=>dot.classList.contains('absolute')),false);
  assert.equal(await dealNav.locator('svg').evaluate(icon=>icon.parentElement.querySelector('[role="status"]')===null),true);
  const expandedDot=await moduleDot().boundingBox(), expandedNav=await dealNav.boundingBox();
  assert.ok(expandedDot.x>expandedNav.x+expandedNav.width/2);
  await page.screenshot({path:resolve(output,'unread-records-expanded.png')});
  await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
  assert.equal(await moduleDot().evaluate(dot=>dot.classList.contains('absolute')),true);
  await page.screenshot({path:resolve(output,'unread-records-collapsed.png')});
  await page.getByRole('button',{name:'Expand sidebar',exact:true}).click();
  record('Expanded sidebar has one far-right dot; collapsed sidebar has one icon dot; module load never reads records');
  rejectRecordRead=true;
  await card(unreadDeals[0]).getByText(unreadDeals[0].title,{exact:true}).click();
  const dealPanel=page.getByRole('dialog',{name:'Deal details',exact:true});
  await dealPanel.waitFor(); await page.getByText('Failed to update notifications',{exact:true}).waitFor();
  assert.equal(await prisma.notification.count({where:{...where,entityId:unreadDeals[0].id,isRead:false}}),2);
  await dealPanel.getByRole('button',{name:'Close record',exact:true}).click();
  await cardDot(unreadDeals[0]).waitFor(); rejectRecordRead=false;
  record('Failed record-read request preserves the Deal dot and unread notifications');
  await card(unreadDeals[0]).getByText(unreadDeals[0].title,{exact:true}).click();
  await eventually(async()=>await prisma.notification.count({where:{...where,entityId:unreadDeals[0].id,isRead:false}})===0);
  await dealPanel.getByRole('button',{name:'Close record',exact:true}).click();
  await cardDot(unreadDeals[0]).waitFor({state:'hidden'}); await moduleDot().waitFor(); await cardDot(unreadDeals[1]).waitFor();
  await page.getByRole('button',{name:`Notifications, ${beforeUnread-2} unread`,exact:true}).waitFor();
  assert.equal((await prisma.notification.findUniqueOrThrow({where:{id:privateNotice.id}})).isRead,false);
  record('Successful Deal details read clears its duplicate notifications, keeps the other Deal/module dots and updates the bell');
  await card(unreadDeals[1]).getByText(unreadDeals[1].title,{exact:true}).click();
  await eventually(async()=>await prisma.notification.count({where:{...where,entityId:unreadDeals[1].id,isRead:false}})===0);
  await dealPanel.getByRole('button',{name:'Close record',exact:true}).click();
  await moduleDot().waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click(); await moduleDot().waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Expand sidebar',exact:true}).click();
  record('Last unread Deal clears its card dot and both sidebar states');
  await prisma.notification.create({data:{tenantId:tenant.id,userId:agent.id,type:'deal_assigned',title:'Fresh record alert',entityType:'Deal',entityId:unreadDeals[0].id}});
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await moduleDot().waitFor(); await cardDot(unreadDeals[0]).waitFor();
  record('Existing shared focus synchronization reflects new record notifications without a page refresh');
  token=(await issueAuthSession(other)).token; await context.clearCookies(); await context.addCookies([{name:'leadcrm_token',value:token,url:base,httpOnly:true,sameSite:'Lax'}]);
  await navigate('/notifications'); await rows().getByText('Private other-user alert',{exact:true}).waitFor();
  assert.equal(await rows().count(),1); assert.equal((await prisma.notification.findUniqueOrThrow({where:{id:privateNotice.id}})).isRead,false);
  record('Reading the same Deal as another user leaves the original recipient notification unread');
  assert.deepEqual(pageErrors,[]);assert.deepEqual(transportErrors,[]);
  writeFileSync(resolve(output,'results.json'),JSON.stringify({checks,pageErrors,transportErrors,requestCount:requests.length},null,2));
  console.log(`Browser acceptance passed: ${checks.length} checks.`);
} catch(error) {
  await page?.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});
  if(page)writeFileSync(resolve(output,'failure.txt'),await page.locator('body').innerText().catch(()=>''));
  writeFileSync(resolve(output,'results.json'),JSON.stringify({checks,pageErrors,transportErrors,error:String(error)},null,2));throw error;
} finally {
  closing=true;await browser?.close();frontend?.kill();if(api){api.closeAllConnections();await new Promise(done=>api.close(done));}
  await prisma.$disconnect();pg.stop();
}
