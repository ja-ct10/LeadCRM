import assert from 'node:assert/strict';
import { resolve } from 'node:path';

// Uses only the parent harness's disposable SQL, real API, sessions and proxy.
export async function verifyDashboardMetrics({ page, staffPage, base, output, http, prisma, tenant, agent, replacement, pipeline, stages, record, until, wait, expectValue }) {
  const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
  const chart = title => page.getByRole('heading', { name: title, exact: true }).locator('..').locator('..');
  const revenue = () => page.getByRole('img', { name: /^Revenue Trend by/ });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  const fetchReport = query => http(`/reporting/dashboard?${query}`);
  const reconcile = report => {
    assert.equal(report.metrics.totalRevenue, report.trend.reduce((sum,row) => sum + row.revenue,0));
    assert.equal(report.metrics.won, report.trend.reduce((sum,row) => sum + row.won,0));
    assert.equal(report.metrics.lost, report.trend.reduce((sum,row) => sum + row.lost,0));
    assert.equal(report.metrics.activeDeals, report.distribution.reduce((sum,row) => sum + row.count,0));
    assert.equal(report.metrics.forecastedRevenue, report.metrics.openPipelineValue);
    assert.equal(report.metrics.forecastedRevenue, report.distribution.reduce((sum,row) => sum + row.value,0));
  };
  assert.ok(await page.getByText('No won revenue in the selected period.', { exact: true }).isVisible());
  assert.ok(await page.getByText('No resolved deals in the selected period.', { exact: true }).isVisible());
  record('Zero revenue, resolved outcomes and current Win Rate have honest empty states');
  async function create(title, value, index = 0) {
    const product = await prisma.productInterest.create({ data: { tenantId: tenant.id, name: title, dealValue: value } });
    const deal = await http('/crm/deals', 'POST', { title, pipelineId: pipeline.id, stageId: stages[0].id, productInterestIds: [product.id], assignedUserId: agent.id });
    if (index >= 3) await http(`/crm/deals/${deal.id}/stage`, 'PATCH', { stageId: stages[2].id });
    if (index) await http(`/crm/deals/${deal.id}/stage`, 'PATCH', { stageId: stages[index].id, ...(index === 4 ? { lostReason: 'Deferred' } : {}) });
    return deal;
  }
  await create('Metrics open Lead', 100000);
  await create('Metrics open Contacted', 50000, 1);
  const qualified = await create('Metrics open Qualified', 75000, 2);
  await prisma.stage.update({ where: { id: stages[0].id }, data: { probability: null } });
  await prisma.deal.update({ where: { id: qualified.id }, data: { expectedCloseDate: new Date('2030-01-01') } });
  await expectValue('Forecasted Revenue', money(225000));
  await expectValue('Active Deals', '3');
  reconcile(await fetchReport('range=thisMonth'));
  record('Unweighted Forecasted Revenue reconciles with three current stage values despite missing probability and future close date');
  const winner = await create('Metrics credited win', 1000, 3);
  await create('Metrics second credited win', 500, 3);
  await create('Metrics lost', 2000, 4);
  const timestamp = new Date();
  const unknown = await prisma.deal.create({ data: { tenantId: tenant.id, pipelineId: pipeline.id, stageId: stages[3].id, title: 'Unattributed historical fixture',
    value: 5000, currency: 'PHP', createdAt: new Date(+timestamp - 3600000), closedAt: timestamp, assignedUserId: agent.id, ownerId: agent.id } });
  await prisma.dealStageHistory.deleteMany({ where: { dealId: unknown.id } });
  await expectValue('Total Revenue', money(6500));
  await expectValue('Win Rate', '42.9%');
  await page.getByText('2 won deals', { exact: true }).last().waitFor();
  assert.ok(await page.getByText(/1 won deals.*5,000.00 without verified eligible sales credit/).isVisible());
  await page.getByText(/Reporting warnings/).click();
  await page.getByText(/period wins lack verified historical agent attribution/).waitFor();
  await page.getByText(/cohort deals lack a recorded starting milestone/).waitFor();
  await page.getByText(/deals lack recorded starting history/).waitFor();
  record('Multiple wins group under immutable agent credit; unknown revenue and incomplete funnel history are exposed');
  const initial = await fetchReport('range=thisMonth'); reconcile(initial);
  assert.equal(initial.leaderboard[0].revenue, 1500); assert.equal(initial.leaderboard[0].won, 2);
  assert.equal(initial.conversion.cohort, 7); assert.equal(initial.conversion.qualifiedToWon, null);

  for (const theme of ['light','dark']) {
    await page.evaluate(theme => { localStorage.setItem('app_theme', theme === 'dark' ? 'Dark' : 'Light'); window.dispatchEvent(new CustomEvent('themechange', { detail: { theme, mode: theme === 'dark' ? 'Dark' : 'Light' } })); }, theme);
    await until(() => page.locator('.crm-shell[data-theme-container]').evaluate((element,dark) => element.classList.contains('dark') === dark, theme === 'dark'), 'Theme applied');
    for (const interval of ['Week','Month','Year']) {
      await page.getByRole('button', { name: 'Filter Revenue Trend', exact: true }).click();
      await page.getByRole('menuitem', { name: interval, exact: true }).click();
      await page.getByRole('heading', { name: `Revenue Trend by ${interval}`, exact: true }).waitFor();
      const report = await fetchReport(`range=thisMonth&revenueInterval=${interval.toLowerCase()}`); reconcile(report);
      for (const width of [320,375,390,768,1024,1440]) {
        await page.setViewportSize({ width, height: 1000 }); await wait(350);
        const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
          charts: [...document.querySelectorAll('canvas')].map(canvas => { const bounds = canvas.getBoundingClientRect(); return { width: bounds.width, height: bounds.height, left: bounds.left, right: bounds.right, labels: canvas.__labels ?? [] }; }) }));
        assert.ok(dimensions.scrollWidth <= width + 1, JSON.stringify(dimensions));
        assert.equal(dimensions.charts.length, 4);
        for (const canvas of dimensions.charts) {
          assert.ok(canvas.width > 0 && canvas.height > 0 && canvas.left >= 0 && canvas.right <= width + 1, JSON.stringify(canvas));
          assert.ok(!canvas.labels.some(label => /^\d{4}-\d{2}-\d{2}$/.test(label)), 'Human-readable dates');
        }
        assert.ok(dimensions.charts[3].labels.includes('Lead'), 'Vertical stage category labels');
        assert.ok(dimensions.charts[3].labels.some(label => label.startsWith('₱')), 'Compact currency scale');
        record(`${theme} ${interval} charts, labels and legends fit ${width}px`, dimensions);
      }
    }
    await page.getByRole('heading', { name: 'Sales Leaderboard', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, `${theme}-metrics-1440.png`), fullPage: true });
    await page.setViewportSize({ width: 320, height: 1000 });
    await page.getByRole('heading', { name: 'Sales Leaderboard', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, `${theme}-metrics-320.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await revenue().scrollIntoViewIfNeeded(); await wait(1100);
  const canvas = revenue().locator('canvas');
  const point = await canvas.evaluate(canvas => canvas.__points.find(point => point.radius === 6));
  assert.ok(point, 'Single actual revenue marker');
  const bounds = await canvas.boundingBox(); assert.ok(point.x > bounds.width * 0.3 && point.x < bounds.width * 0.8, 'Single bucket is centered');
  await canvas.hover({ position: { x: point.x, y: point.y } });
  await until(() => canvas.evaluate(canvas => canvas.__labels.some(label => label.includes('Revenue (PHP):') && label.includes('6,500.00'))), 'Exact revenue tooltip');
  await page.mouse.move(0,0);
  record('Single revenue bucket is centered, visible and exposes the exact recorded revenue tooltip');

  await prisma.deal.update({ where: { id: winner.id }, data: { assignedUserId: replacement.id } });
  assert.equal((await fetchReport('range=thisMonth')).leaderboard[0].id, agent.id);
  let failed = true;
  await page.route('**/api/proxy/reporting/dashboard?*', route => failed ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: 'Metrics refresh unavailable' } }) }) : route.continue());
  await page.getByRole('button', { name: 'Sync Metrics', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Metrics refresh unavailable' }).waitFor();
  assert.equal(await page.getByRole('group', { name: 'Total Revenue', exact: true }).locator('.text-base').innerText(), money(6500));
  failed = false; await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await until(async () => await page.getByRole('alert').filter({ hasText: 'Metrics refresh unavailable' }).count() === 0, 'Refresh recovery');
  await page.unroute('**/api/proxy/reporting/dashboard?*');
  record('Sync failure retains authoritative values; retry recovers; reassignment retains historical revenue owner');

  await page.getByRole('button', { name: 'Dashboard date range', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Custom Date Range', exact: true }).click();
  await page.getByLabel('Start date', { exact: true }).fill('2020-01-01');
  await page.getByLabel('End date', { exact: true }).fill('2020-01-02');
  await page.getByRole('button', { name: 'Apply dates', exact: true }).click();
  await expectValue('Total Revenue', money(0), false);
  await expectValue('Win Rate', '42.9%', false); await expectValue('Forecasted Revenue', money(225000), false);
  assert.ok(await page.getByText('No resolved deals in the selected period.').isVisible());
  assert.equal((await fetchReport('range=custom&start=2020-01-01&end=2020-01-02')).conversion.cohort, 7);
  record('Custom global date filter changes period charts while current KPIs and independent cohort stay consistent');
  for (const label of ['Week','Month','Year','Custom Range']) {
    const range = label === 'Custom Range' ? 'custom' : label.toLowerCase();
    const response = page.waitForResponse(response => response.url().includes('/reporting/dashboard?') && new URL(response.url()).searchParams.get('funnelRange') === range);
    await page.getByRole('button', { name: 'Filter Deal Pipeline Conversion Funnel', exact: true }).click();
    await page.getByRole('menuitem', { name: label, exact: true }).click();
    if (label === 'Custom Range') {
      await page.getByLabel('Funnel From Date', { exact: true }).fill(today);
      await page.getByLabel('Funnel To Date', { exact: true }).fill(today);
      await page.getByRole('button', { name: 'Apply funnel dates', exact: true }).click();
    }
    const result = await (await response).json();
    assert.equal(result.data.conversion.period.range, range);
    assert.equal(result.data.metrics.totalRevenue, 0);
    await page.getByText(/deals in the creation cohort.*Historical milestones/).waitFor({ state: 'visible' });
    record(`Independent ${label} cohort filter renders recorded history`);
  }
  await page.getByRole('button', { name: 'Dashboard date range', exact: true }).click();
  await page.getByRole('menuitem', { name: 'This Month', exact: true }).click();
  await expectValue('Total Revenue', money(6500), false);
  const invalid = await create('Metrics missing money', 100, 0);
  await prisma.deal.update({ where: { id: invalid.id }, data: { value: null } });
  await expectValue('Forecasted Revenue', 'Unavailable');
  await page.getByText('Pipeline value unavailable.', { exact: true }).waitFor();
  await prisma.deal.update({ where: { id: invalid.id }, data: { value: 1234567890.12 } });
  await expectValue('Forecasted Revenue', money(1234792890.12));
  for (const width of [320,375,390,768,1024,1440]) {
    await page.setViewportSize({ width, height: 1000 }); await wait(250);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await prisma.deal.update({ where: { id: invalid.id }, data: { isArchived: true } });
  await expectValue('Forecasted Revenue', money(225000));
  record('Missing money is unavailable, long amounts fit all requested widths, and archival updates current metrics through SSE');
  await staffPage.getByRole('group', { name: 'Forecasted Revenue', exact: true }).waitFor();
  reconcile(await fetchReport('range=thisMonth'));
}
