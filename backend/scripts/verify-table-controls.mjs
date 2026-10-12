import assert from 'node:assert/strict';
import { resolve } from 'node:path';

/** Runs against the parent's disposable SQL, authenticated HTTP and production browser. */
export async function verifyTableControls({ page, prisma, tenant, foreignTenant, admin, deniedToken, call, until, record, reads, control, output }) {
  const modules = [
    { id: 'leads', path: '/crm/leads', api: '/crm/leads', model: 'lead', field: 'firstName', search: 'Josh', region: 'Leads data grid', hide: 'Email' },
    { id: 'contacts', path: '/crm/contacts', api: '/crm/contacts', model: 'contact', field: 'firstName', search: 'Search Target', region: 'Contacts data grid', hide: 'Email' },
    { id: 'accounts', path: '/crm/accounts', api: '/crm/accounts', model: 'account', field: 'name', search: 'Search Target', region: 'Accounts data grid', hide: 'Industry' },
    { id: 'tasks', path: '/operations/taskboard', api: '/operations/tasks', model: 'task', field: 'title', search: 'Search Target', region: 'Tasks data grid', hide: 'Due Date' },
    { id: 'workflows', path: '/automation/workflows', api: '/automation/workflows', model: 'workflow', field: 'name', search: 'Search Target', region: 'Workflows table', hide: 'Trigger' },
    { id: 'campaigns', path: '/marketing/campaigns', api: '/marketing/campaigns', model: 'campaign', field: 'name', search: 'Search Target', region: 'Campaigns table', hide: 'Type' },
    { id: 'users', path: '/settings?tab=users', api: '/administration/users', model: 'user', field: 'firstName', search: 'Search Target', region: 'Team Management table', hide: 'Role' },
  ];
  // Keep the API allowlists explicit in the acceptance test, independently of UI rendering.
  const sortFields = {
    leads: ['name', 'firstName', 'lastName', 'email', 'phone', 'companyName', 'status', 'source', 'createdAt', 'updatedAt'],
    contacts: ['firstName', 'lastName', 'email', 'phone', 'companyName', 'status', 'source', 'createdAt'],
    accounts: ['name', 'industry', 'size', 'city', 'country', 'createdAt'], tasks: ['title', 'dueDate', 'createdAt', 'updatedAt'],
    workflows: ['name', 'status', 'createdAt'], campaigns: ['name', 'createdAt'], users: ['name', 'role', 'email', 'status', 'groups', 'createdAt'],
  };
  const common = { tenantId: tenant.id };
  const foreignAdmin = await prisma.user.create({ data: { tenantId: foreignTenant.id, firstName: 'Search Target Foreign', lastName: 'Admin', email: 'foreign-admin@camxian.com', role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date() } });
  await prisma.account.create({ data: { tenantId: foreignTenant.id, name: 'Search Target Foreign Account', productsNormalized: true } });
  await prisma.contact.create({ data: { tenantId: foreignTenant.id, firstName: 'Search Target Foreign', lastName: 'Contact', productsNormalized: true } });
  await prisma.task.create({ data: { tenantId: foreignTenant.id, title: 'Search Target Foreign Task', assignedUserId: foreignAdmin.id, dueDate: new Date(), createdById: foreignAdmin.id } });
  await prisma.workflow.create({ data: { tenantId: foreignTenant.id, name: 'Search Target Foreign Workflow', trigger: 'lead.created', actions: [] } });
  await prisma.campaign.create({ data: { tenantId: foreignTenant.id, name: 'Search Target Foreign Campaign', type: 'EMAIL' } });
  // Enough real records for every table to test a non-first page.
  for (let index = 4; index <= 32; index++) {
    const number = String(index).padStart(2, '0');
    await prisma.account.create({ data: { ...common, name: `Search Target Account ${number}`, productsNormalized: true } });
    await prisma.contact.create({ data: { ...common, firstName: 'Search Target', lastName: `Person ${number}`, productsNormalized: true } });
    await prisma.task.create({ data: { ...common, title: `Search Target Task ${number}`, assignedUserId: admin.id, dueDate: new Date(), createdById: admin.id } });
    await prisma.workflow.create({ data: { ...common, name: `Search Target Workflow ${number}`, trigger: 'lead.created', actions: [] } });
    await prisma.campaign.create({ data: { ...common, name: `Search Target Campaign ${number}`, type: 'EMAIL' } });
    await prisma.user.create({ data: { ...common, firstName: 'Search Target', lastName: `User ${number}`, role: 'Sales', status: 'ACTIVE', email: `table-control-${number}@camxian.com`, mustChangePassword: false, onboardingCompletedAt: new Date() } });
  }
  for (const module of modules) {
    for (const field of sortFields[module.id]) for (const direction of ['asc', 'desc']) {
      const query = `?search=${encodeURIComponent(module.search)}&${module.id === 'tasks' ? `sortBy=${field}&sortOrder=${direction}` : `sort=${field}:${direction}`}`;
      const full = await call(module.api + query + '&limit=100');
      assert.equal(full.status, 200, `${module.id} ${field}:${direction}`);
      const second = await call(module.api + query + '&limit=1&page=2');
      assert.equal(second.status, 200);
      assert.equal(second.body.meta.total, full.body.meta.total);
      assert.equal(second.body.data[0].id, full.body.data[1].id, `${module.id} sorted before pagination`);
      assert.ok(full.body.data.every(row => row.tenantId === tenant.id));
    }
    const denied = await call(`/preferences/columns/${module.id}`, 'GET', undefined, deniedToken);
    assert.ok([403, 404].includes(denied.status), `${module.id} denied preference access`);
    assert.ok([403, 404].includes((await call(module.api, 'GET', undefined, deniedToken)).status), `${module.id} denied list access`);
  }
  record('Every supported sort field and direction orders before SQL pagination; module preferences deny restricted roles');

  await page.setViewportSize({ width: 1440, height: 900 });
  const navigate = path => page.goto('http://localhost:3027' + path);
  for (const module of modules) {
    await navigate(module.path);
    const region = page.getByRole('region', { name: module.region, exact: true });
    await region.getByRole('grid').waitFor();
    const manage = page.getByRole('button', { name: 'Manage Columns', exact: true });
    assert.equal(await manage.count(), 1, `${module.id} one Manage Columns entry`);
    assert.equal(await region.getByRole('button', { name: 'Table settings', exact: true }).count(), 0);
    const refresh = page.getByRole('button', { name: module.id === 'tasks' ? 'Refresh tasks' : 'Refresh', exact: true }).last();
    assert.ok((await manage.boundingBox()).x > (await refresh.boundingBox()).x, module.id + ' control order');
    assert.equal(await manage.evaluate(element => element.previousElementSibling?.getAttribute('aria-label')), module.id === 'tasks' ? 'Refresh tasks' : 'Refresh');
    await manage.click();
    const drawer = page.getByRole('dialog', { name: `Manage Columns - ${module.id}`, exact: true });
    const hide = drawer.getByRole('switch', { name: new RegExp(`^Toggle ${module.hide} visibility$`, 'i') });
    // Module terminology can differ from its stored column ID.
    if (await hide.count()) { await hide.click(); await drawer.getByRole('button', { name: 'Save', exact: true }).click(); await drawer.getByRole('button', { name: 'Saved', exact: true }).waitFor(); }
    await drawer.getByRole('button', { name: 'Close drawer' }).click();

    const search = page.getByRole('textbox', { name: new RegExp(`^Search ${module.id}(?:\\.\\.\\.)?$`, 'i') });
    await search.fill(module.search);
    await until(async () => !await refresh.isDisabled() && (await region.locator('tbody tr').count()) > 0, `${module.id} initial search`);
    await page.getByRole('navigation', { name: 'Pagination' }).getByRole('button', { name: 'Records per page' }).click();
    await page.getByRole('option', { name: '10', exact: true }).click();
    await until(async () => await page.getByRole('navigation', { name: 'Pagination' }).count() > 0 && !await refresh.isDisabled(), `${module.id} page-size request`);

    const menuTrigger = region.getByRole('button', { name: /^Column options for / }).first();
    await menuTrigger.click();
    const menu = page.getByRole('menu').last();
    assert.equal(await menu.getByRole('menuitem', { name: 'Restore default sorting' }).count(), 1);
    // Date sorting is offered even when the date column is hidden.
    await menu.getByRole('menuitemradio', { name: /^Created(?: Date| at)?$/i }).click();
    await menu.getByRole('menuitemradio', { name: 'Sort ascending', exact: true }).click();
    await until(async () => (await call(`/preferences/table/${module.id}`)).body.data.sort?.field === 'createdAt' && (await call(`/preferences/table/${module.id}`)).body.data.sort?.direction === 'asc', `${module.id} saved sort`);
    await until(async () => !await refresh.isDisabled() && await page.getByRole('navigation', { name: 'Pagination' }).count() > 0, `${module.id} sorted list`);
    await page.getByRole('navigation', { name: 'Pagination' }).getByRole('button', { name: 'Next page' }).click();
    await until(async () => await page.getByRole('navigation', { name: 'Pagination' }).getByText(/Page 2 of/).count() > 0, `${module.id} second page`);

    const header = region.getByRole('columnheader').filter({ has: page.locator('.cursor-col-resize') }).first();
    await header.scrollIntoViewIfNeeded();
    const headerLabel = await header.getAttribute('aria-label');
    const before = await header.boundingBox();
    // A short table stretches columns to fill its container. Persisted widths
    // follow the declared colgroup size, independently of that extra space.
    const declaredWidth = await header.evaluate(element => parseFloat(element.closest('table').querySelectorAll('col')[Array.from(element.parentElement.children).indexOf(element)].style.width));
    const resized = Math.round(declaredWidth + 65);
    await page.mouse.move(before.x + before.width - 2, before.y + 15); await page.mouse.down();
    await page.mouse.move(before.x + before.width + 63, before.y + 15); await page.mouse.up();
    await until(async () => (await call(`/preferences/columns/${module.id}`)).body.data.columns.some(column => column.width === resized), module.id + ' resize write');
    const savedLayout = (await call(`/preferences/columns/${module.id}`)).body.data.columns;
    const savedTable = (await call(`/preferences/table/${module.id}`)).body.data;
    const settings = page.getByRole('button', { name: 'Table settings', exact: true }).last();
    if (module.id === 'leads') {
      control.failPath = '/preferences/columns/leads'; control.failMethod = 'PUT';
      await settings.click(); await page.getByRole('menuitem', { name: 'Reset Column Size', exact: true }).click();
      await page.getByText('Unable to reset column sizes. Please try again.', { exact: true }).waitFor();
      assert.deepEqual((await call('/preferences/columns/leads')).body.data.columns, savedLayout);
      await until(async () => !await settings.isDisabled(), 'failed width reset ended');
    }
    await settings.click(); await page.getByRole('menuitem', { name: 'Reset Column Size', exact: true }).click();
    await until(async () => (await call(`/preferences/columns/${module.id}`)).body.data.columns.every(column => column.width === undefined), module.id + ' width-only reset');
    const resetLayout = (await call(`/preferences/columns/${module.id}`)).body.data.columns;
    assert.deepEqual(resetLayout, savedLayout.map(({ width, ...column }) => column));
    assert.deepEqual((await call(`/preferences/table/${module.id}`)).body.data, savedTable);
    assert.equal(Math.round((await region.getByRole('columnheader', { name: headerLabel, exact: true }).boundingBox()).width), Math.round(before.width));
    assert.equal(await search.inputValue(), module.search);
    assert.equal(await page.getByRole('navigation', { name: 'Pagination' }).getByText(/Page 2 of/).count(), 1);

    const sorted = await call(module.api + `?search=${encodeURIComponent(module.search)}&${module.id === 'tasks' ? 'sortBy=createdAt&sortOrder=asc' : 'sort=createdAt:asc'}&limit=10&page=2`);
    const row = sorted.body.data[0];
    const current = await prisma[module.model].findUnique({ where: { id: row.id } });
    const newText = current[module.field] + ' Refreshed';
    await prisma[module.model].update({ where: { id: row.id }, data: { [module.field]: newText } });
    const freshRecord = {
      leads: { ...common, firstName: 'Josh Fresh Total', lastName: 'Acceptance', productsNormalized: true },
      contacts: { ...common, firstName: 'Search Target Fresh', lastName: 'Acceptance', productsNormalized: true },
      accounts: { ...common, name: 'Search Target Fresh Account', productsNormalized: true },
      tasks: { ...common, title: 'Search Target Fresh Task', assignedUserId: admin.id, dueDate: new Date(), createdById: admin.id },
      workflows: { ...common, name: 'Search Target Fresh Workflow', trigger: 'lead.created', actions: [] },
      campaigns: { ...common, name: 'Search Target Fresh Campaign', type: 'EMAIL' },
      users: { ...common, firstName: 'Search Target Fresh', lastName: 'Acceptance', role: 'Sales', status: 'ACTIVE', email: 'fresh-total@camxian.com', mustChangePassword: false, onboardingCompletedAt: new Date() },
    };
    await prisma[module.model].create({ data: freshRecord[module.id] });
    const count = () => reads.filter(read => read.path === module.api && read.method === 'GET').length;
    const calls = count();
    control.holdPath = module.api;
    await refresh.click();
    await until(async () => control.pending === 1, module.id + ' refresh reached HTTP');
    assert.equal(await refresh.isDisabled(), true);
    assert.ok(await refresh.locator('.animate-spin').count());
    await refresh.evaluate(element => { element.click(); element.click(); });
    assert.equal(count(), calls + 1, module.id + ' repeated refresh shares one request');
    control.release();
    await until(async () => !await refresh.isDisabled(), module.id + ' refresh completed');
    assert.equal(count(), calls + 1, module.id + ' one list refresh');
    assert.ok((await region.textContent()).includes(newText), module.id + ' fresh rows displayed');
    assert.equal(await search.inputValue(), module.search);
    assert.equal(await page.getByRole('navigation', { name: 'Pagination' }).getByText(/Page 2 of/).count(), 1);
    assert.deepEqual((await call(`/preferences/table/${module.id}`)).body.data, savedTable);
    const refreshedTotal = sorted.body.meta.total + 1;
    assert.equal((await call(module.api + `?search=${encodeURIComponent(module.search)}`)).body.meta.total, refreshedTotal);
    assert.ok((await region.textContent()).includes(`${refreshedTotal} total`), module.id + ' refreshed total displayed');

    control.failPath = module.api;
    await refresh.click();
    await until(async () => !await refresh.isDisabled(), module.id + ' failed refresh completed');
    assert.ok((await page.textContent('body')).includes('Refresh unavailable'), module.id + ' visible refresh error');
    assert.ok((await region.textContent()).includes(newText), module.id + ' failed refresh retains rows');
    await refresh.click(); await until(async () => !await refresh.isDisabled(), module.id + ' retry completed');
    await page.reload(); await region.getByRole('grid').waitFor();
    assert.equal((await call(`/preferences/columns/${module.id}`)).body.data.columns.some(column => column.width !== undefined), false);
    assert.deepEqual((await call(`/preferences/table/${module.id}`)).body.data.sort, { field: 'createdAt', direction: 'asc' });
    await region.getByRole('button', { name: /^Column options for / }).first().click();
    await page.getByRole('menuitem', { name: 'Restore default sorting' }).click();
    await until(async () => (await call(`/preferences/table/${module.id}`)).body.data.sort?.direction !== 'asc', module.id + ' default sort saved');
    await region.getByRole('button', { name: /^Column options for / }).first().focus();
    await page.keyboard.press('ArrowDown');
    await page.getByRole('menu').last().waitFor(); await page.keyboard.press('Escape');
    assert.ok(await region.getByRole('button', { name: /^Column options for / }).first().evaluate(element => document.activeElement === element));
    await page.screenshot({ path: resolve(output, `${module.id}-controls.png`) });
    for (const dark of [false, true]) for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(dark => {
        localStorage.setItem('app_theme', dark ? 'Dark' : 'Light');
        window.dispatchEvent(new StorageEvent('storage', { key: 'app_theme', storageArea: localStorage }));
      }, dark);
      await until(async () => await page.evaluate(() => document.documentElement.dataset.appTheme) === (dark ? 'dark' : 'light'), module.id + ' resolved theme');
      await manage.click();
      const bounds = await drawer.boundingBox(); assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1);
      assert.equal(await drawer.evaluate(element => element.closest('[data-theme-container]').classList.contains('dark')), dark);
      await page.screenshot({ path: resolve(output, `${module.id}-${width}-${dark ? 'dark' : 'light'}.png`) });
      await page.keyboard.press('Escape');
      await region.getByRole('button', { name: /^Column options for / }).first().click();
      const menuBounds = await page.getByRole('menu').last().boundingBox();
      assert.ok(menuBounds.x >= 0 && menuBounds.x + menuBounds.width <= width);
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    // A valid page survives refresh; a page removed by an external deletion
    // must recover to the remaining page through the same data hook.
    await search.fill(module.search);
    await until(async () => !await refresh.isDisabled() && (await region.textContent()).includes(`${refreshedTotal} total`), module.id + ' search restored');
    await page.getByRole('navigation', { name: 'Pagination' }).getByRole('button', { name: 'Next page' }).click();
    await until(async () => !await refresh.isDisabled() && await page.getByRole('navigation', { name: 'Pagination' }).getByText(/Page 2 of/).count() > 0, module.id + ' page before deletion');
    const remaining = await call(module.api + `?search=${encodeURIComponent(module.search)}&limit=100`);
    await prisma[module.model].deleteMany({ where: { tenantId: tenant.id, id: { in: remaining.body.data.slice(2).map(row => row.id) } } });
    await refresh.click();
    await until(async () => !await refresh.isDisabled() && await page.getByRole('navigation', { name: 'Pagination' }).getByText(/Page 1 of 1/).count() > 0 && (await region.textContent()).includes('2 total'), module.id + ' removed page recovered');
    assert.equal(await search.inputValue(), module.search);
    record(`${module.id}: one toolbar drawer, saved menu sorting, width-only reset/reload, valid/removed-page refresh, one request, failure/retry and keyboard focus`);
  }
  assert.equal(await prisma.userPreference.count({ where: { tenantId: foreignTenant.id } }), 0, 'Writes did not touch another tenant');
}
