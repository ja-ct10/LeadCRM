import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { setAcceptanceTheme } from './verify-browser-matrix.mjs';

/** Runs only inside the existing disposable DB / authenticated browser harness. */
export async function verifySearchHighlighting({ page, prisma, tenant, foreignTenant, call, until, record, control, output }) {
  const data = { tenantId: tenant.id, productsNormalized: true };
  const lead = await prisma.lead.create({ data: { ...data, firstName: 'Locator', lastName: 'Lead', createdAt: new Date('2020-01-01') } });
  const contact = await prisma.contact.create({ data: { ...data, firstName: 'Locator', lastName: 'Contact', createdAt: new Date('2020-01-01') } });
  const account = await prisma.account.create({ data: { tenantId: tenant.id, name: 'Locator Account', createdAt: new Date('2020-01-01') } });
  const pipeline = await prisma.pipeline.create({ data: { tenantId: tenant.id, name: 'Locator Pipeline' } });
  const stages = [];
  for (let order = 0; order < 7; order++) stages.push(await prisma.stage.create({ data: { tenantId: tenant.id, pipelineId: pipeline.id, name: `Locator Stage ${order}`, order, requiredFields: [] } }));
  const lastStage = stages.at(-1);
  for (let index = 0; index < 30; index++) await prisma.deal.create({ data: { ...data, title: `Earlier card ${index}`, pipelineId: pipeline.id, stageId: lastStage.id, productInterests: [], tags: [] } });
  const deal = await prisma.deal.create({ data: { ...data, title: 'Locator Deal', pipelineId: pipeline.id, stageId: lastStage.id, productInterests: [], tags: [], createdAt: new Date('2020-01-01') } });
  const targets = [
    { module: 'leads', row: lead, title: 'Locator Lead' },
    { module: 'contacts', row: contact, title: 'Locator Contact' },
    { module: 'accounts', row: account, title: 'Locator Account' },
    { module: 'deals', row: deal, title: 'Locator Deal' },
  ];
  const base = new URL(page.url()).origin;
  await page.setViewportSize({ width: 1440, height: 900 });
  await setAcceptanceTheme(page, 'Light');
  await prisma.lead.create({ data: { ...data, firstName: 'Archived', lastName: 'Locator', isArchived: true } });
  const refreshModules = [
    ['/crm/leads', '/crm/leads', 'Leads data grid', 'Refresh'],
    ['/crm/contacts', '/crm/contacts', 'Contacts data grid', 'Refresh'],
    ['/crm/accounts', '/crm/accounts', 'Accounts data grid', 'Refresh'],
    ['/operations/taskboard', '/operations/tasks', 'Tasks data grid', 'Refresh tasks'],
    ['/automation/workflows', '/automation/workflows', 'Workflows table', 'Refresh'],
    ['/marketing/campaigns', '/marketing/campaigns', 'Campaigns table', 'Refresh'],
    ['/settings?tab=users', '/administration/users', 'Team Management table', 'Refresh'],
    ['/settings?tab=products', '/administration/product-interests', 'Products table', 'Refresh products'],
    ['/settings?tab=archived', '/administration/archived-data', 'Archived data grid', 'Refresh'],
  ];
  for (const [path, api, label, buttonLabel] of (process.argv.includes('--highlight-only') ? [] : refreshModules)) {
    await page.goto(base + path);
    // Session restoration and route hydration share the navigation budget.
    await page.getByRole('textbox', { name: 'Search CRM records', exact: true }).waitFor({ timeout: 120000 });
    const region = page.getByRole('region', { name: label, exact: true });
    await region.getByRole('grid').waitFor();
    const refresh = page.getByRole('button', { name: buttonLabel, exact: true }).last();
    await until(async () => !await refresh.isDisabled(), label + ' initial loading finished');
    const rows = await region.locator('tbody tr[data-row-id]').count();
    assert.ok(rows > 0, label + ' has existing rows');
    control.holdPath = api;
    await refresh.click();
    await until(async () => control.pending >= 1, label + ' real refresh started');
    const spinner = region.getByRole('status', { name: 'Refreshing data...' });
    assert.ok(await spinner.isVisible(), label + ' existing spinner is inside the table');
    assert.ok(await region.locator('tbody tr[data-row-id]').first().isVisible());
    assert.equal(await region.getAttribute('aria-busy'), 'true');
    assert.ok(await refresh.isDisabled(), label + ' disables the control while refresh is pending');
    const duplicateClicks = await refresh.evaluate(element => {
      let dispatched = 0;
      const clicked = () => dispatched++;
      element.addEventListener('click', clicked);
      element.click(); element.click();
      element.removeEventListener('click', clicked);
      return dispatched;
    });
    // Background polling can add reads; it does not represent another button click.
    assert.equal(duplicateClicks, 0, label + ' duplicate refresh clicks are blocked');
    control.release();
    await until(async () => !await refresh.isDisabled(), label + ' refresh completed');
    assert.equal(await spinner.count(), 0);
    control.failPath = api;
    await refresh.click();
    await until(async () => !await refresh.isDisabled(), label + ' failed refresh completed');
    assert.equal(await spinner.count(), 0);
    assert.ok((await page.textContent('body')).includes('Refresh unavailable'));
    assert.ok(await region.locator('tbody tr[data-row-id]').first().isVisible());
    record(`${label}: table spinner, retained rows, duplicate prevention and success/failure cleanup`);
  }
  for (const module of ['contacts', 'accounts']) {
    await page.goto(base + `/crm/${module}?search=__no_refresh_matches__`);
    const heading = page.getByRole('heading', { name: `No ${module} match your search`, exact: true });
    await heading.waitFor();
    const dimensions = await heading.evaluate(element => element.closest('[aria-busy]').getBoundingClientRect().toJSON());
    const refresh = page.getByRole('button', { name: 'Refresh', exact: true });
    await until(async () => !await refresh.isDisabled(), 'Empty module loading completed');
    control.holdPath = `/crm/${module}`;
    await refresh.click();
    await until(async () => control.pending >= 1, 'Empty module refresh pending');
    const spinner = page.getByRole('status', { name: 'Refreshing data...' });
    assert.ok(await spinner.isVisible());
    assert.equal(await heading.isVisible(), false, 'No empty message during refresh');
    const during = await spinner.evaluate(element => element.parentElement.getBoundingClientRect().toJSON());
    assert.equal(during.height, dimensions.height, 'Empty module dimensions remain stable');
    control.release();
    await until(async () => !await refresh.isDisabled(), 'Empty module refresh completed');
    assert.equal(await spinner.count(), 0);
    assert.ok(await heading.isVisible());
    record(`${module}: existing spinner in empty results, stable dimensions and no empty message during refresh`);
  }
  const openSearch = async title => {
    if (page.viewportSize().width < 768) await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search CRM records' }).fill(title);
    await page.locator('[role="button"]').filter({ has: page.getByText(title, { exact: true }) }).last().click();
  };
  for (const theme of ['Light', 'Dark']) for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await setAcceptanceTheme(page, theme);
    for (const target of targets) {
      await page.goto(base + '/crm/leads?page=3&search=no-match&filter_status=COLD');
      await openSearch(target.title);
      const selected = target.module === 'deals' ? page.locator(`[data-deal-id="${target.row.id}"]`) : page.locator(`[data-row-id="${target.row.id}"]`);
      await until(async () => await selected.getAttribute('data-search-highlight') === 'true', `${target.module} exact search highlight`);
      assert.equal(new URL(page.url()).searchParams.get('highlight'), target.row.id);
      // The mobile search dialog finishes its existing exit animation first.
      await until(async () => await page.getByRole('dialog').count() === 0, 'Search must not open details');
      await until(async () => await selected.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.top >= 0 && rect.top < innerHeight;
      }), 'Selected record was not vertically visible');
      if (target.module === 'deals') {
        assert.equal(await page.getByLabel('Pipeline', { exact: true }).inputValue(), pipeline.name);
        assert.equal(await page.getByLabel('Pipeline', { exact: true }).evaluate(element => element.readOnly), true);
        await until(async () => await selected.evaluate(element => {
          const card = element.getBoundingClientRect(), stageScroll = element.parentElement.getBoundingClientRect();
          const board = element.closest('[aria-label="Deal pipeline"]');
          return board.scrollLeft > 0 && element.parentElement.scrollTop > 0 && card.left >= 0 && card.right <= innerWidth && card.top >= stageScroll.top && card.bottom <= stageScroll.bottom + 1;
        }), 'Deal did not scroll horizontally and within the stage').catch(async error => {
          console.log('Deal scroll geometry', await selected.evaluate(element => {
            const board = element.closest('[aria-label="Deal pipeline"]'), column = element.parentElement;
            return { card: element.getBoundingClientRect().toJSON(), column: column.getBoundingClientRect().toJSON(), columnHeight: getComputedStyle(column).height, scrollTop: column.scrollTop, scrollHeight: column.scrollHeight, board: board.getBoundingClientRect().toJSON(), scrollLeft: board.scrollLeft };
          }));
          await page.screenshot({ path: resolve(output, 'deal-scroll-failure.png') });
          throw error;
        });
        assert.equal(await selected.evaluate(element => getComputedStyle(element).outlineStyle), 'solid');
      } else {
        const fills = await selected.locator('td').evaluateAll(cells => cells.map(cell => getComputedStyle(cell).backgroundColor));
        assert.ok(fills.length > 2 && fills.every(fill => fill === fills[0] && fill !== 'rgba(0, 0, 0, 0)'), 'Every ordinary/pinned/selection/action cell must have the same opaque highlight');
        const positions = await selected.evaluate(element => {
          const table = element.closest('table'), viewport = table.parentElement;
          viewport.scrollLeft = 0;
          const cells = [...element.children], before = cells.map(cell => cell.getBoundingClientRect().left);
          viewport.scrollLeft = 90;
          return { delta: viewport.scrollLeft, scrollable: viewport.scrollWidth > viewport.clientWidth, cells: cells.map((cell, index) => ({ pinned: cell.classList.contains('grid-pinned-cell'), position: getComputedStyle(cell).position, moved: before[index] - cell.getBoundingClientRect().left, shadow: getComputedStyle(cell).boxShadow })),
            aligned: cells.every((cell, index) => Math.abs(cell.getBoundingClientRect().left - table.querySelectorAll('thead th')[index].getBoundingClientRect().left) < 1) };
        });
        assert.ok(positions.delta > 0 || !positions.scrollable, 'Overflowing table must be horizontally scrollable');
        assert.ok(positions.aligned, 'Headers and cells must stay aligned');
        for (const cell of positions.cells) {
          if (width >= 768 && cell.pinned) { assert.equal(cell.position, 'sticky'); assert.ok(Math.abs(cell.moved) <= 1); }
          else { assert.notEqual(cell.position, 'sticky'); assert.ok(Math.abs(cell.moved - positions.delta) < 1); }
          if (width < 768 && cell.pinned) assert.equal(cell.shadow, 'none');
        }
        if (width === 768 && theme === 'Light') {
          const label = { leads: 'Leads data grid', contacts: 'Contacts data grid', accounts: 'Accounts data grid' }[target.module];
          const trigger = page.getByRole('region', { name: label, exact: true }).getByRole('button', { name: /^Column options for / }).first();
          await trigger.click();
          const menu = page.getByRole('menu').last();
          await menu.getByRole('menuitemradio').first().waitFor();
          const bounds = await menu.boundingBox();
          assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
          await page.keyboard.press('Escape');
          assert.ok(await trigger.evaluate(element => document.activeElement === element));
        }
      }
      record(`${target.module}: exact Global Search target, ${width}px ${theme}, visible highlight and responsive scrolling`);
    }
    await page.screenshot({ path: resolve(output, `search-${width}-${theme}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await setAcceptanceTheme(page, 'Light');
  // The earlier customization case switches Name to First Name. Arrange the
  // pinned Name fixture explicitly before checking its responsive behavior.
  const configured = (await call('/preferences/columns/leads')).body.data;
  const pinnedFixture = await call('/preferences/columns/leads', 'PUT', { columns: configured.columns.map(column => ({
    ...column, visible: column.id === 'name' ? true : ['firstName', 'lastName'].includes(column.id) ? false : column.visible,
  })) });
  assert.equal(pinnedFixture.status, 200, JSON.stringify(pinnedFixture.body));
  await page.goto(base + `/crm/leads?highlight=${lead.id}`);
  const preferences = (await call('/preferences/columns/leads')).body.data;
  for (const width of [390, 768, 320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const header = page.getByRole('columnheader', { name: 'Name', exact: true });
    assert.equal(await header.evaluate(element => getComputedStyle(element).position), width < 768 ? 'relative' : 'sticky');
  }
  assert.deepEqual((await call('/preferences/columns/leads')).body.data, preferences);
  record('Pinning preferences survive mobile/tablet/desktop transitions without reload');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base + `/crm/deals?highlight=${deal.id}`);
  const card = page.locator(`[data-deal-id="${deal.id}"]`);
  await until(async () => await card.getAttribute('data-search-highlight') === 'true', 'Reduced motion target');
  assert.equal(await card.evaluate(element => getComputedStyle(element).animationName), 'none');
  const refresh = page.getByRole('button', { name: 'Refresh', exact: true });
  await until(async () => !await refresh.isDisabled(), 'Deal loading completed');
  control.holdPath = '/crm/deals';
  await refresh.click();
  await until(async () => control.pending >= 1, 'Deal refresh pending');
  assert.ok(await page.getByRole('status', { name: 'Refreshing deals...' }).isVisible());
  assert.ok(await card.isVisible());
  control.release();
  await until(async () => !await refresh.isDisabled(), 'Deal refresh completed');
  assert.equal(await page.getByRole('status', { name: 'Refreshing deals...' }).count(), 0);
  control.failPath = '/crm/deals';
  await refresh.click();
  await until(async () => !await refresh.isDisabled(), 'Failed Deal refresh completed');
  assert.equal(await page.getByRole('status', { name: 'Refreshing deals...' }).count(), 0);
  assert.ok(await card.isVisible());
  record('Deal board uses existing spinner while retaining cards; success/failure clear it; reduced motion is respected');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const second = await prisma.deal.create({ data: { ...data, title: 'Locator Second Deal', pipelineId: pipeline.id, stageId: stages[2].id, productInterests: [], tags: [] } });
  await openSearch(second.title);
  await until(async () => await page.locator(`[data-deal-id="${second.id}"]`).getAttribute('data-search-highlight') === 'true', 'Second Deal search');
  assert.equal(await card.getAttribute('data-search-highlight'), null);
  assert.equal(await page.getByRole('dialog').count(), 0);
  record('Consecutive Deal searches on the same page clear the previous highlight and retain closed details');
  const foreign = await prisma.lead.create({ data: { tenantId: foreignTenant.id, firstName: 'Foreign', lastName: 'Locator' } });
  assert.ok([403, 404].includes((await call(`/crm/leads/${foreign.id}`)).status));
  await page.goto(base + `/crm/leads?highlight=${foreign.id}`);
  await page.getByRole('alert').first().waitFor();
  assert.equal(await page.locator('[data-search-highlight="true"]').count(), 0);
  record('Cross-tenant search target is denied and never highlights another row');
  for (const theme of ['Light', 'Dark']) {
    await page.goto(base + '/settings?tab=profile');
    await setAcceptanceTheme(page, theme);
    const button = page.getByRole('button', { name: 'Change Password', exact: true });
    await button.waitFor();
    assert.equal(await button.evaluate(element => element.style.backgroundColor), 'var(--primary)');
    await button.click();
    await page.getByRole('dialog').waitFor();
    await page.getByLabel('New password *', { exact: true }).fill('Strong test1!');
    await page.getByRole('button', { name: 'Show new password' }).click();
    assert.equal(await page.getByLabel('New password *', { exact: true }).getAttribute('type'), 'text');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    record(`Shared primary Change Password button opens unchanged dialog and visibility controls in ${theme}`);
  }
}
