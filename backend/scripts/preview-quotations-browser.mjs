// Campaign template UI preview with isolated API fixtures; no live email sends.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createWriteStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { acceptancePort, createAcceptanceContext } from './verify-browser-matrix.mjs';
const require = createRequire(import.meta.url), { chromium } = require('playwright');
const root = resolve(import.meta.dirname, '../..'), output = resolve(root, 'data/outputs/quotations/browser');
const shared = require(resolve(root, 'shared/src/index.js'));
mkdirSync(output, { recursive: true });
const port = await acceptancePort(), base = `http://127.0.0.1:${port}`, log = createWriteStream(resolve(output, 'frontend.log'));
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: resolve(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production', API_URL: 'https://leadcrm-quotation-fixture.example/api/v1', NEXT_TELEMETRY_DISABLED: '1' },
});
child.stdout.pipe(log); child.stderr.pipe(log);
let browser;
const assertions = [], now = new Date().toISOString();
const user = { id: randomUUID(), tenantId: randomUUID(), email: 'preview@camxian.com', role: 'Client Admin', firstName: 'Preview', lastName: 'Sender', status: 'ACTIVE', tenantName: 'Quotation Preview', tenantStatus: 'SANDBOX', onboardingStep: 3, onboardingCompletedAt: now, mustChangePassword: false, hasPassword: true, passwordChangedAt: now, currency: 'PHP', groups: [] };
const lead = { id: randomUUID(), firstName: 'Juan', lastName: 'Customer', email: 'juan@example.test', companyName: 'Customer Company', assignedUserId: user.id };
const contact = { ...lead, id: randomUUID(), firstName: 'Maria', lastName: 'Contact', email: 'maria@example.test' };
const product = { id: randomUUID(), name: 'Technical Service', category: 'Services', description: 'Setup and support', dealValue: 1234.56, active: true, createdAt: now, updatedAt: now };
const deal = { id: randomUUID(), title: 'Technical Service Deal', productInterestId: product.id, value: 99999 };
const task = { id: randomUUID(), tenantId: user.tenantId, title: 'Template UI preview task', description: 'Task notes remain visible. '.repeat(50), status: 'pending', priority: 'High', createdById: user.id, createdBy: user, assignedUserId: user.id, assignedUser: user, createdAt: now, dueDate: '2030-01-01T12:00:00Z', dealIds: [deal.id], deals: [deal] };
const permissions = Object.fromEntries(['campaigns','leads','contacts','accounts','deals','products','settings','users','groups','roles','custom_fields','archived_data','tasks','forms','notifications','dashboard','reporting'].map(module => [module, Object.fromEntries(['canView','canCreate','canEdit','canArchive','canSend','canViewReports'].map(flag => [flag, true]))]));
async function fits(page, label, width) {
  await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].every(element => { const box = element.getBoundingClientRect(); return box.left >= -1 && box.right <= innerWidth + 1; }));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${label}: page overflow at ${width}`);
  assertions.push(`${width}: ${label}`);
}
async function templateVariablePicker(page, editor, trigger, field, key, label, width) {
  await page.locator('[data-sonner-toast]').last().waitFor({ state: 'hidden' });
  await field.fill('Hello customer!'); await field.focus();
  await field.evaluate(node => node.setSelectionRange(6, 14));
  await trigger.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0);
  await trigger.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
  const style = await trigger.evaluate(node => {
    const computed = getComputedStyle(node);
    return Object.fromEntries(['height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderRadius', 'borderColor', 'fontSize', 'fontWeight', 'color', 'backgroundColor'].map(key => [key, computed[key]]));
  });
  assert.equal(await trigger.locator('svg').getAttribute('width'), '14');
  await trigger.focus(); await trigger.press('ArrowDown');
  const search = page.getByLabel('Search variables', { exact: true });
  const picker = page.getByRole('group').filter({ has: search });
  const bounds = async () => {
    await page.waitForFunction(node => {
      const box = node.getBoundingClientRect();
      return getComputedStyle(node).opacity === '1' && box.left >= 7 && box.right <= innerWidth - 7 && box.top >= 7 && box.bottom <= innerHeight - 7;
    }, await picker.elementHandle());
    assert.equal(await search.evaluate(node => {
      const box = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    }), true, `${label}: searchable picker is above sheet content`);
    await fits(page, label, width);
  };
  await search.waitFor(); await bounds();
  assert.equal(await picker.evaluate(node => !!node.closest('[data-theme-portal]') && !node.closest('[role="dialog"]')), true);
  await page.waitForFunction(node => document.activeElement === node, await search.elementHandle());
  const list = picker.locator('.max-h-80');
  assert.equal(await list.evaluate(node => { node.scrollTop = 60; const moved = node.scrollTop > 0; node.scrollTop = 0; return moved; }), true, `${label}: variable list scrolls`);
  await page.screenshot({ path: resolve(output, `picker-${label}-${width}.png`) });
  await search.fill(key); await search.press('Tab'); await page.keyboard.press('Enter');
  const token = `{{${key}}}`, expected = `Hello ${token}!`;
  assert.equal(await field.inputValue(), expected);
  await search.waitFor({ state: 'detached' });
  await page.waitForFunction(({ node, caret }) => document.activeElement === node && node.selectionStart === caret && node.selectionEnd === caret, { node: await field.elementHandle(), caret: 6 + token.length });
  await trigger.click(); await search.waitFor(); await search.press('Escape');
  await search.waitFor({ state: 'detached' }); assert.equal(await editor.isVisible(), true);
  assert.equal(await trigger.evaluate(node => document.activeElement === node), true);
  await trigger.click(); await search.waitFor(); await editor.getByRole('heading', { level: 2 }).click();
  await search.waitFor({ state: 'detached' });
  await page.setViewportSize({ width, height: 480 });
  await trigger.scrollIntoViewIfNeeded(); await trigger.click(); await search.waitFor(); await bounds();
  const moved = await field.evaluate(node => {
    let parent = node.parentElement;
    while (parent && !(parent.scrollHeight > parent.clientHeight && /auto|scroll/.test(getComputedStyle(parent).overflowY))) parent = parent.parentElement;
    if (!parent) return false;
    const before = parent.scrollTop; parent.scrollTop += before > 0 ? -20 : 20;
    return parent.scrollTop !== before;
  });
  assert.equal(moved, true, `${label}: side-panel scrolling remains available with picker open`);
  await bounds(); await page.screenshot({ path: resolve(output, `picker-${label}-short-${width}.png`) });
  await search.press('Escape'); await search.waitFor({ state: 'detached' });
  await page.setViewportSize({ width, height: 960 });
  assertions.push(`${width}: ${label} portal, bounds, search, scroll, keyboard insertion, caret, outside click, Escape and short viewport`);
  return style;
}

async function taskDetails(page, width) {
  await page.goto(`${base}/operations/taskboard?taskId=${task.id}`);
  const editor = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: task.title, exact: true }) });
  await editor.waitFor();
  assert.equal(await editor.getByRole('button', { name: 'Close', exact: true }).count(), 0);
  assert.equal(await editor.locator('footer').count(), 0);
  for (const section of ['Task Information', 'Schedule & Assignment', 'Additional Information', 'Associated Deals', 'Task History']) assert.equal(await editor.getByRole('button', { name: new RegExp(`^${section}`) }).count(), 1);
  const body = editor.locator('div.overflow-y-auto.space-y-3');
  assert.equal(await body.evaluate(node => { node.scrollTop = node.scrollHeight; return node.scrollTop > 0 && Math.abs(node.getBoundingClientRect().bottom - innerHeight) <= 1; }), true, 'Task content fills the space formerly used by the footer');
  await editor.getByRole('button', { name: 'Task History', exact: true }).scrollIntoViewIfNeeded();
  await fits(page, 'Task Details without footer', width);
  await page.screenshot({ path: resolve(output, `task-details-${width}.png`) });
  await editor.getByRole('button', { name: 'Close record', exact: true }).click(); await editor.waitFor({ state: 'detached' });
  assertions.push(`${width}: Task Details content, history scrolling, no footer, full-height body and header X dismissal`);
}
async function templateControls(page, type, width) {
  // Compare resting styles after the previous view's hover transition has ended.
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => [...document.querySelectorAll('[role="toolbar"] button')].every(button => button.getAnimations().length === 0));
  const controls = [page.getByLabel('Search templates', { exact: true }), page.getByLabel(`Filter ${type.toLowerCase()} templates`, { exact: true }),
    page.getByRole('button', { name: 'Refresh', exact: true }), page.getByRole('button', { name: `New ${type} Template`, exact: true })];
  const boxes = [];
  for (const control of controls) {
    const box = await control.boundingBox();
    assert.ok(box && box.x >= -1 && box.x + box.width <= width + 1, `${type}: accessible toolbar control at ${width}`);
    boxes.push(box);
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    assert.ok(a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1, `${type}: toolbar controls overlap at ${width}`);
  }
  assert.equal(await controls[3].count(), 1, `${type}: single create action`);
  assert.equal(await page.getByRole('button', { name: /Create First .* Template/i }).count(), 0);
  assert.equal(await controls[3].getAttribute('title'), `New ${type} Template`);
  const heading = page.getByRole('heading', { name: `${type} Templates`, level: 2, exact: true });
  const subtitle = page.getByText(`Create and reuse ${type === 'Email' ? 'email' : 'SMS'} templates for your campaigns.`, { exact: true });
  const headingBox = await heading.boundingBox(), subtitleBox = await subtitle.boundingBox();
  const toolbar = await page.getByRole('toolbar', { name: 'templates controls' }).boundingBox();
  const container = await controls[3].locator('..').boundingBox();
  const [search, filter, refresh, create] = boxes;
  const right = box => box.x + box.width, center = box => box.y + box.height / 2;
  assert.ok(Math.abs(right(create) - right(container)) < 2, `${type}: right-aligned create action`);
  assert.ok(Math.abs(headingBox.x - container.x) < 2, `${type}: left-aligned heading`);
  assert.ok(await heading.evaluate(element => element.scrollWidth <= element.clientWidth), `${type}: readable heading`);
  const textVisible = await controls[3].locator('span').evaluate(element => getComputedStyle(element).display !== 'none');
  if (width < 640) {
    assert.equal(textVisible, false, `${type}: icon-only mobile action`);
    assert.equal(create.width, 44); assert.equal(create.height, 44);
    assert.ok(Math.abs(center(headingBox) - center(create)) < 2, `${type}: Add beside heading`);
    assert.ok(subtitleBox.y >= Math.max(headingBox.y + headingBox.height, create.y + create.height) - 1, `${type}: subtitle below heading row`);
    assert.ok(Math.abs(search.width - toolbar.width) < 2 && Math.abs(search.x - toolbar.x) < 2, `${type}: full-width Search`);
    assert.ok(filter.y >= search.y + search.height - 1 && Math.abs(center(filter) - center(refresh)) < 2, `${type}: Filter and Refresh share second row`);
    assert.ok(Math.abs(filter.x - toolbar.x) < 2 && Math.abs(right(refresh) - right(toolbar)) < 2, `${type}: Filter left and Refresh far right`);
  } else {
    assert.equal(textVisible, true, `${type}: full desktop label`);
    assert.equal(create.height, 36, `${type}: original desktop button height`);
    assert.ok(Math.abs(toolbar.y - create.y) < 2, `${type}: create action stays in desktop toolbar`);
    assert.ok(Math.abs(center(search) - center(filter)) < 2 && Math.abs(center(filter) - center(refresh)) < 2, `${type}: desktop controls share a row`);
    assert.ok(filter.x - right(search) < 12 && refresh.x - right(filter) < 12, `${type}: desktop controls retain their original spacing`);
    assert.ok(headingBox.y >= toolbar.y + toolbar.height, `${type}: section heading below desktop toolbar`);
  }
  assertions.push(`${width}: ${type} section copy, single responsive creation action and toolbar alignment`);
  const styles = [];
  for (const control of [...controls, page.getByRole('navigation', { name: 'Pagination' }), page.getByRole('button', { name: 'Records per page' })]) {
    styles.push(await control.evaluate(element => {
      const style = getComputedStyle(element);
      return Object.fromEntries(['height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderRadius', 'borderColor', 'fontSize', 'fontWeight', 'color', 'backgroundColor'].map(key => [key, style[key]]));
    }));
  }
  await fits(page, `${type} template controls and pagination`, width);
  return styles;
}
async function templateFilterLayout(page, type, width) {
  const section = page.getByRole('heading', { name: `${type} Templates`, level: 2, exact: true }).locator('xpath=ancestor::section[1]');
  const card = section.getByRole('heading', { level: 3 }).first().locator('..');
  const grid = card.locator('..'), pagination = section.getByRole('navigation', { name: 'Pagination' });
  const filter = page.getByLabel(`Filter ${type.toLowerCase()} templates`, { exact: true });
  const closed = await grid.boundingBox(), closedCard = await card.boundingBox();
  const count = await grid.locator(':scope > *').count();
  assert.ok(closed && closedCard);
  assert.equal(await page.getByRole('heading', { name: 'Campaigns', level: 1, exact: true }).locator('..').textContent(), 'Campaigns', 'Campaigns title has no total badge');
  await filter.click();
  if (width >= 1280) {
    const rail = section.getByRole('complementary', { name: 'Filters', exact: true });
    await rail.waitFor();
    await page.waitForFunction(node => Math.abs(node.getBoundingClientRect().width - 260) < 1, await rail.elementHandle());
    const sidebar = await rail.boundingBox(), open = await grid.boundingBox(), openCard = await card.boundingBox(), footer = await pagination.boundingBox();
    assert.ok(sidebar && open && openCard && footer);
    assert.ok(open.x >= sidebar.x + sidebar.width + 10 && Math.abs(open.y - sidebar.y) < 2, `${type}: cards align beside desktop sidebar`);
    assert.ok(open.x > closed.x && open.width < closed.width && openCard.width <= open.width + 1, `${type}: results narrow and cards reflow when filters open`);
    assert.ok(Math.abs(footer.x - open.x) < 2 && Math.abs(footer.width - open.width) < 2, `${type}: pagination stays in results column`);
  } else {
    await page.getByRole('dialog', { name: 'Filters', exact: true }).waitFor();
    const open = await grid.boundingBox(), openCard = await card.boundingBox();
    assert.ok(open && openCard);
    assert.ok(Math.abs(open.x - closed.x) < 2 && Math.abs(open.width - closed.width) < 2 && Math.abs(openCard.width - closedCard.width) < 2, `${type}: drawer preserves card layout`);
  }
  assert.equal(await grid.evaluate(node => [...node.children].every(child => child.scrollWidth <= child.clientWidth + 1)), true, `${type}: card content fits with filters open`);
  assert.equal(await grid.locator(':scope > *').count(), count, `${type}: opening filters preserves records`);
  await fits(page, `${type} open filter layout`, width);
  await page.screenshot({ path: resolve(output, `${type.toLowerCase()}-filters-open-${width}.png`), fullPage: true });
  await page.getByRole('button', { name: 'Close filters', exact: true }).click();
  await page.waitForFunction(({ node, closed }) => {
    const box = node.getBoundingClientRect();
    return Math.abs(box.x - closed.x) < 2 && Math.abs(box.width - closed.width) < 2;
  }, { node: await grid.elementHandle(), closed });
  assert.equal(await filter.getAttribute('aria-expanded'), 'false');
  assert.ok(Math.abs((await card.boundingBox()).width - closedCard.width) < 2, `${type}: card width restored after closing filters`);
  assert.equal(await grid.locator(':scope > *').count(), count, `${type}: closing filters preserves records`);
  await fits(page, `${type} restored filter layout`, width);
  assertions.push(`${width}: ${type} filters preserve records, resize desktop results and pagination, retain compact drawer, and restore original layout`);
}
try {
  for (let attempt = 0; attempt < 60; attempt++) { try { if ((await fetch(base + '/login')).ok) break; } catch {} await new Promise(done => setTimeout(done, 500)); }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const widths = process.env.TEMPLATE_PREVIEW_WIDTHS ? process.env.TEMPLATE_PREVIEW_WIDTHS.split(',').map(Number) : [320,375,390,430,639,640,768,1024,1279,1280,1440,1920];
  assert.ok(widths.length && widths.every(width => Number.isInteger(width) && width >= 320));
  for (const width of widths) {
    const context = await createAcceptanceContext(browser, { viewport: { width, height: 960 }, reducedMotion: 'reduce', sandboxedFrames: true });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let templates = ['Email', 'SMS'].flatMap(type => Array.from({ length: 23 }, (_, index) => ({ id: randomUUID(), tenantId: user.tenantId, name: `${type} Follow ${index + 1}`, type,
      category: index % 2 ? 'Support' : 'Sales', subject: type === 'Email' ? 'Hello {{firstName}}' : undefined, content: `Hello {{firstName}}, ${type} message ${index + 1}.` })));
    const templateRequests = [], messageControlStyles = [], variableTriggerStyles = [];
    await context.route('**/api/proxy/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname.replace('/api/proxy', ''), method = route.request().method();
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      const list = data => json({ success: true, data, meta: { total: data.length, page: 1, limit: 10, hasMore: false } });
      if (path === '/auth/me') return json({ success: true, data: { user, session: { lastActiveAt: now, idleExpiresAt: new Date(Date.now()+1800000).toISOString(), expiresAt: new Date(Date.now()+86400000).toISOString(), serverNow: new Date().toISOString() } } });
      if (path.endsWith('/permissions')) return json({ success: true, data: permissions });
      if (path.endsWith('/events') || path.endsWith('record-events')) return route.fulfill({ contentType: 'text/event-stream', body: ': UI preview\n\n' });
      if (path.startsWith('/preferences/table/')) return json({ success: true, data: { pageSize: 25, sort: { field: 'createdAt', direction: 'desc' }, conditions: [] } });
      if (path === '/crm/record-access') return json({ success: true, data: { userId: user.id, tenantId: user.tenantId, clientAdmin: true, assignmentRestricted: false } });
      if (path === '/marketing/campaigns/variable-fields') return json({ success: true, data: shared.CUSTOM_FIELD_MODULES.flatMap(module => shared.getCrmFieldCatalog(module)) });
      if (path === '/marketing/campaigns/email-settings') return json({ success: true, data: { senderName: 'Preview Sender', senderEmail: 'preview@example.test' } });
      if (path === '/marketing/campaigns/sms-settings') return json({ success: true, data: { organizationName: 'Preview Organization', organizationEmail: 'preview@example.test' } });
      if (path === '/operations/tasks') return list([task]);
      if (path === `/operations/tasks/${task.id}`) return json({ success: true, data: task });
      if (path === '/operations/tasks/summary') return json({ success: true, data: { total: 1, active: 1, completed: 0, overdue: 0, byStatus: { pending: 1, in_progress: 0, blocked: 0, completed: 0 }, workload: [] } });
      if (path === '/administration/product-interests') return json({ success: true, data: [product], meta: { enabled: true, categories: ['Services'] } });
      if (path === '/crm/leads') return list([lead]);
      if (path === '/crm/contacts') return list([contact]);
      if (path.endsWith('/relationships')) return json({ success: true, data: { deals: [deal], hasMoreDeals: false } });
      if (path === `/crm/deals/${deal.id}`) return json({ success: true, data: deal });
      if (path === `/crm/leads/${lead.id}`) return json({ success: true, data: lead });
      if (path === `/crm/contacts/${contact.id}`) return json({ success: true, data: contact });
      if (path === '/marketing/templates' && method === 'POST') { const data = route.request().postDataJSON(); const template = { ...data, id: randomUUID(), tenantId: user.tenantId }; templates.push(template); return json({ success: true, data: template }, 201); }
      if (path === '/marketing/templates') {
        const query = Object.fromEntries(url.searchParams), category = query.category, type = query.type;
        templateRequests.push(query);
        const terms = (query.search ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
        const data = templates.filter(template => (!type || template.type === type) && (!category || template.category === category) && terms.every(term => `${template.name} ${template.category}`.toLowerCase().includes(term)));
        const currentPage = Number(query.page ?? 1), limit = Math.min(100, Number(query.limit ?? 10));
        return json({ success: true, data: data.slice((currentPage - 1) * limit, currentPage * limit), meta: { total: data.length, page: currentPage, limit, hasMore: currentPage * limit < data.length } });
      }
      return list([]);
    });
    try {
      for (const route of ['/campaigns', '/marketing/campaigns']) {
        await page.goto(base + route);
        const navigation = page.getByRole('group', { name: 'Campaign views', exact: true });
        await navigation.waitFor();
        assert.deepEqual(await navigation.getByRole('button').allTextContents(), ['All Campaigns', 'Email Templates', 'SMS Templates']);
        assert.equal(await navigation.getByRole('button', { name: 'All Campaigns', exact: true }).getAttribute('aria-pressed'), 'true');
      }
      for (const type of ['Email', 'SMS']) {
        await page.getByRole('button', { name: `${type} Templates`, exact: true }).click();
        await page.getByText('Page 1 of 3', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Preview', exact: true }).count(), 10);
        messageControlStyles.push(await templateControls(page, type, width));
        await page.screenshot({ path: resolve(output, `${type.toLowerCase()}-templates-${width}.png`), fullPage: true });
        await templateFilterLayout(page, type, width);
        await page.getByRole('button', { name: 'Next page' }).click(); await page.getByRole('heading', { name: `${type} Follow 11`, exact: true }).waitFor();
        await page.getByLabel('Search templates', { exact: true }).fill('sAlEs'); await page.getByText('Page 1 of 2', { exact: true }).waitFor();
        assert.equal(await page.getByRole('heading', { name: `${type} Follow 2`, exact: true }).count(), 0);
        await page.getByLabel('Search templates', { exact: true }).fill('Follow'); await page.getByText('Page 1 of 3', { exact: true }).waitFor();
        await page.getByLabel(`Filter ${type.toLowerCase()} templates`, { exact: true }).click();
        await page.getByRole('checkbox', { name: 'Filter by Support', exact: true }).check(); await fits(page, `${type} category filter`, width);
        await page.getByRole('button', { name: 'Close filters', exact: true }).click(); await page.getByText('Page 1 of 2', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Next page' }).click(); await page.getByRole('heading', { name: `${type} Follow 22`, exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Next page' }).isDisabled(), true);
        const beforeRefresh = templateRequests.length;
        await page.getByRole('button', { name: 'Refresh', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('button[aria-label="Refresh"]')?.getAttribute('aria-busy') === 'false');
        assert.ok(templateRequests.slice(beforeRefresh).some(query => query.type === type && query.search === 'Follow' && query.category === 'Support' && query.page === '2'));
        assert.ok(templateRequests.slice(beforeRefresh).every(query => query.type === type));
        await page.getByRole('button', { name: 'Records per page' }).click(); await page.getByRole('option', { name: '20', exact: true }).click();
        await page.getByText('Page 1 of 1', { exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Preview', exact: true }).count(), 11);
        await page.getByLabel(`Filter ${type.toLowerCase()} templates`, { exact: true }).click(); await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
        await page.getByRole('button', { name: 'Close filters', exact: true }).click(); await page.getByText('Page 1 of 2', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('Search templates', { exact: true }).inputValue(), 'Follow');
        await page.getByLabel('Search templates', { exact: true }).fill('nothing matches this'); await page.getByRole('heading', { name: 'No templates match your search or filters' }).waitFor();
        await fits(page, `${type} empty search results`, width);
        await page.getByRole('button', { name: 'Clear search and filters', exact: true }).click(); await page.getByRole('heading', { name: `${type} Follow 1`, exact: true }).waitFor();
        const template = templates.find(template => template.type === type);
        if (type === 'SMS') assert.ok(await page.getByText(`${template.content.length} characters`, { exact: true }).count());
        await page.getByRole('button', { name: 'Preview', exact: true }).first().click(); await page.getByRole('dialog', { name: 'Template Preview', exact: true }).waitFor();
        await fits(page, `${type} existing preview`, width); await page.getByRole('button', { name: 'Close template preview' }).click();
        await page.getByRole('button', { name: 'Use Template', exact: true }).first().click(); await page.getByRole('heading', { name: 'Create Campaign', exact: true }).waitFor();
        assert.equal(await page.getByLabel('Body', { exact: false }).inputValue(), template.content);
        if (type === 'Email') assert.equal(await page.getByLabel('Subject Line', { exact: false }).inputValue(), template.subject);
        await fits(page, `${type} existing Use Template`, width); await page.getByRole('button', { name: 'Back to campaigns' }).click();
        await page.getByRole('heading', { name: `${type} Follow 1`, exact: true }).waitFor();
        await page.getByRole('button', { name: `New ${type} Template`, exact: true }).click();
        const editor = page.getByRole('dialog', { name: `Create ${type} Template`, exact: true }); await editor.waitFor();
        const trigger = editor.getByRole('button', { name: 'Insert Variable', exact: true });
        const pickerStyle = await templateVariablePicker(page, editor, trigger, editor.getByLabel('Message Content', { exact: false }), 'firstName', type, width);
        if (type === 'SMS') assert.deepEqual(pickerStyle, variableTriggerStyles[0], 'Email/SMS variable triggers match');
        variableTriggerStyles.push(pickerStyle);
        if (type === 'Email') {
          const bodyValue = await editor.getByLabel('Message Content', { exact: false }).inputValue();
          await templateVariablePicker(page, editor, trigger, editor.getByLabel('Subject Line', { exact: false }), 'firstName', 'Email-subject', width);
          assert.equal(await editor.getByLabel('Message Content', { exact: false }).inputValue(), bodyValue, 'Subject insertion preserves the body');
        }
        await fits(page, `${type} existing creation and variable insertion`, width); await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
        const savedTemplates = templates;
        templates = templates.filter(template => template.type !== type);
        await page.getByRole('button', { name: 'Refresh', exact: true }).click();
        await page.getByRole('heading', { name: `No ${type} Templates Found`, exact: true }).waitFor();
        await templateControls(page, type, width);
        if (width === 320) await page.screenshot({ path: resolve(output, `${type.toLowerCase()}-empty-${width}.png`), fullPage: true });
        templates = savedTemplates;
        await page.getByRole('button', { name: 'Refresh', exact: true }).click();
        await page.getByRole('heading', { name: `${type} Follow 1`, exact: true }).waitFor();
      }
      assert.deepEqual(messageControlStyles[0], messageControlStyles[1], `${width}: Email/SMS template control styles match`);
      assert.ok(templateRequests.every(query => !query.type || ['Email', 'SMS'].includes(query.type)));
      await taskDetails(page, width);
      assert.deepEqual(errors, []); assertions.push(`${width}: three Campaign views on both routes; Email/SMS filtering, pagination, Preview, Use Template, creation access and cursor picker; Task Details`);
      console.log(`${width}px: Campaign views and Email/SMS template preview checks passed`);
    } catch (error) {
      await page.screenshot({ path: resolve(output, `failure-${width}.png`), fullPage: true });
      throw error;
    } finally { await context.close(); }
  }
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ evidence: 'Production frontend with isolated API fixtures; no database writes or provider sends.', assertions, passed: assertions.length }, null, 2));
  rmSync(resolve(output, 'failure.json'), { force: true });
  console.log(JSON.stringify({ passed: assertions.length, output }));
} catch (error) { writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack, assertions }, null, 2)); throw error; }
finally { await browser?.close(); child.kill(); log.end(); }
