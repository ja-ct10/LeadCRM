// Run against a local Next dev preview with both mock flags enabled.
// API responses and role writes stay in memory; no application database is opened.
// PLAYWRIGHT_MODULE may point at the desktop app's bundled Playwright package.
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync, mkdtempSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { tmpdir } = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { PERMISSION_MODULES, PERMISSION_GROUPS, EMPTY_PERMISSION_FLAGS, defaultFieldLayout } = require('../shared/src/index.js');

const base = process.env.SETTINGS_QA_URL || 'http://127.0.0.1:3036';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'This fixture harness only accepts a loopback preview');
const output = process.env.SETTINGS_QA_OUTPUT || mkdtempSync(join(tmpdir(), 'leadcrm-settings-'));
mkdirSync(output, { recursive: true });
const checks = [], pageErrors = [], writes = [];
const roles = [
  { id: 'admin-role', tenantId: 'tenant_demo', name: 'Client Admin', description: 'Protected system fixture', isSystemRole: true, isArchived: false, permissions: [] },
  { id: 'custom-role', tenantId: 'tenant_demo', name: 'Layout QA', description: 'Local in-memory fixture', isSystemRole: false, isArchived: false,
    permissions: [{ module: 'roles', ...EMPTY_PERMISSION_FLAGS, canView: true, canEdit: true }, { module: 'settings', ...EMPTY_PERMISSION_FLAGS, canView: true }] },
];
const pass = (label, details) => { checks.push({ label, details }); console.log('PASS', label); };

async function fixtures(context) {
  await context.addInitScript(() => {
    localStorage.setItem('leadcrm_user', JSON.stringify({ id: 'user_client_admin', tenantId: 'tenant_demo', firstName: 'QA', lastName: 'Admin', email: 'admin@camxian.com', role: 'Client Admin', status: 'active' }));
    localStorage.setItem('leadcrm_tenant', JSON.stringify({ id: 'tenant_demo', name: 'Local layout QA', status: 'active' }));
    localStorage.setItem('app_theme', 'Classic');
  });
  await context.route('**/api/proxy/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    let data = [], extra = {};
    if (method !== 'GET') {
      assert.ok(/\/administration\/roles(?:\/[^/]+)?$/.test(path), `Unexpected fixture write: ${method} ${path}`);
      const body = request.postDataJSON(); writes.push({ method, path, body });
      if (method === 'POST') { data = { ...body, id: `created-${writes.length}`, tenantId: 'tenant_demo', isSystemRole: false, isArchived: false }; roles.push(data); }
      else { const index = roles.findIndex(role => role.id === path.split('/').pop()); assert.ok(index >= 0); data = roles[index] = { ...roles[index], ...body }; }
    } else if (path.endsWith('/administration/permissions')) data = PERMISSION_MODULES;
    else if (path.endsWith('/administration/roles')) data = roles;
    else if (path.endsWith('/administration/organization-settings')) data = { id: 'tenant_demo', name: 'Local layout QA', industry: 'Technology', email: 'qa@camxian.com', phone: '+63281233488', domain: 'camxian.com', address: 'Manila', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z' };
    else if (path.includes('/closing-requirements/layout/')) data = { layout: defaultFieldLayout(path.split('/').pop()), fields: [] };
    else if (path.includes('/notifications')) { data = []; extra = { unreadCount: 0, total: 0, counts: { all: 0, unread: 0 } }; }
    else if (path.includes('/gmail/status')) { data = { isConnected: false }; extra = { isConnected: false }; }
    else if (path.includes('/archived')) extra = { summary: {}, counts: {} };
    await route.fulfill({ json: { success: true, data, meta: { total: 0, totalPages: 1, page: 1, limit: 25 }, ...extra } });
  });
}

async function layout(page, label, editor = false) {
  // Wait for the existing role transition, then measure actual rendered geometry.
  await page.waitForTimeout(350);
  const d = await page.evaluate(() => {
    const main = document.querySelector('[data-app-scroll]'), settings = main.firstElementChild, content = settings.lastElementChild;
    const rect = e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height, width: r.width }; };
    const stats = e => ({ ...rect(e), scrollHeight: e.scrollHeight, clientHeight: e.clientHeight, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth, scrollTop: e.scrollTop });
    const nav = settings.querySelector('aside');
    const scrollingAncestors = [];
    for (let ancestor = content; ancestor; ancestor = ancestor.parentElement) {
      const overflow = getComputedStyle(ancestor).overflowY;
      if (['auto', 'scroll'].includes(overflow) && ancestor.scrollHeight > ancestor.clientHeight + 1) scrollingAncestors.push(ancestor === content ? 'settings-content' : ancestor.tagName);
    }
    const overlaps = [...content.querySelectorAll('[role="switch"]')].filter(toggle => {
      const label = toggle.previousElementSibling;
      if (!label || label.tagName !== 'DIV') return false;
      return label.getBoundingClientRect().right > toggle.getBoundingClientRect().left + 1;
    }).length;
    return { viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, rootHeight: document.documentElement.scrollHeight, rootWidth: document.documentElement.scrollWidth, scrollY,
      shell: stats(document.querySelector('.crm-shell')), main: stats(main), settings: stats(settings), content: stats(content), nav: stats(nav), navVisible: getComputedStyle(nav).display !== 'none',
      appNav: stats(document.querySelector('.navigation-sidebar')), partial: content.querySelectorAll('.sr-only').length, overlaps, scrollingAncestors };
  });
  assert.ok(d.rootHeight <= d.viewport.height + 1, `${label}: document overflow ${JSON.stringify(d)}`);
  assert.ok(d.rootWidth <= d.viewport.width + 1, `${label}: horizontal overflow`);
  assert.equal(d.scrollY, 0, `${label}: document must stay at its origin`);
  for (const key of ['shell', 'main', 'settings', 'content', 'appNav']) assert.ok(Math.abs(d[key].bottom - d.viewport.height) <= 1, `${label}: ${key} ends above/below viewport`);
  assert.ok(d.main.scrollHeight <= d.main.clientHeight + 1, `${label}: outer workspace became a second scroller`);
  assert.ok(d.content.scrollWidth <= d.content.clientWidth + 1, `${label}: content horizontal overflow`);
  if (d.navVisible) assert.ok(Math.abs(d.nav.bottom - d.settings.bottom) <= 1, `${label}: Settings navigation boundary`);
  if (editor) { assert.ok(d.partial > 0, 'Exercise the absolute accessibility labels that caused the defect'); assert.equal(d.overlaps, 0); assert.deepEqual(d.scrollingAncestors, ['settings-content'], 'Only the existing permission-content scrollbar owns the editor'); }
  pass(label, d); return d;
}

async function bottom(page, label) {
  const final = page.getByRole('switch', { name: 'Organization Settings', exact: true });
  await final.scrollIntoViewIfNeeded();
  await page.evaluate(() => { const main = document.querySelector('[data-app-scroll]'); const content = main.firstElementChild.lastElementChild; content.scrollTop = content.scrollHeight; });
  const d = await final.evaluate(toggle => {
    const card = toggle.closest('.rounded-xl'), r = card.getBoundingClientRect();
    const content = document.querySelector('[data-app-scroll]').firstElementChild.lastElementChild, c = content.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, contentTop: c.top, contentBottom: c.bottom, gap: c.bottom - r.bottom };
  });
  assert.ok(d.top >= d.contentTop - 1 && d.bottom <= d.contentBottom + 1, `${label}: final card clipped`);
  assert.ok(d.gap >= 20 && d.gap <= 60, `${label}: excessive or missing bottom spacing ${JSON.stringify(d)}`);
  await layout(page, label, true);
}

async function edit(page) {
  await page.getByRole('button', { name: 'Actions for Layout QA', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit Permissions', exact: true }).click();
  await page.getByRole('heading', { name: 'Edit Role', exact: true }).waitFor();
}

async function wrappedDescriptions(page) {
  // The current API adapter supplies empty descriptions. Stress the existing
  // paragraph styles without changing production labels, data, or components.
  await page.evaluate(() => {
    for (const description of document.querySelectorAll('[data-app-scroll] form p.text-xs')) {
      description.textContent = 'This explanatory permission description wraps across multiple lines while preserving the existing toggle, card borders, and normal spacing.';
    }
  });
  for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 911 });
    await bottom(page, `${width}px: wrapped permission descriptions`);
    const wrapping = await page.getByRole('switch', { name: 'Edit Organization Settings', exact: true }).evaluate(toggle => {
      const description = toggle.previousElementSibling.querySelector('p.text-xs');
      return { height: description.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(description).lineHeight), width: description.clientWidth, scrollWidth: description.scrollWidth };
    });
    if (width <= 768) assert.ok(wrapping.height >= wrapping.lineHeight * 2 - 1, 'Description stress text actually wraps');
    assert.ok(wrapping.scrollWidth <= wrapping.width + 1, 'Description is not horizontally clipped');
  }
}

(async () => {
  let browser;
  try {
    if (!process.argv.includes('--zoom-only')) {
      browser = await chromium.launch({ channel: 'chrome', headless: true });
      const context = await browser.newContext({ viewport: { width: 1920, height: 911 } });
      await fixtures(context);
      const page = await context.newPage(); page.on('pageerror', e => pageErrors.push(e.message));
      await page.goto(base + '/settings?tab=roles');
      await page.getByRole('button', { name: 'Create Custom Role', exact: true }).waitFor();
      await edit(page);
      if (process.argv.includes('--scroll-only')) {
        for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
          await page.setViewportSize({ width, height: 911 });
          await bottom(page, `${width}px: exactly one editor scrollbar`);
          // Exercise attempted document scrolling and wheel chaining beyond the
          // content's end. The application must remain at the viewport origin.
          await page.evaluate(() => window.scrollTo(0, 500));
          const target = await page.getByRole('switch', { name: 'Organization Settings', exact: true }).boundingBox();
          await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
          await page.mouse.wheel(0, 2000);
          await layout(page, `${width}px: wheel at bottom cannot move the document`, true);
          await page.screenshot({ path: resolve(output, `single-scrollbar-${width}.png`) });
          await page.getByRole('button', { name: 'Cancel', exact: true }).click();
          await layout(page, `${width}px: no second scrollbar after Cancel`);
          await edit(page);
        }
        assert.deepEqual(pageErrors, []);
        writeFileSync(resolve(output, 'scrollbar-results.json'), JSON.stringify({ checks, pageErrors }, null, 2));
        console.log(`Completed ${checks.length} scrollbar checks. Evidence: ${output}`);
        return;
      }
      if (process.argv.includes('--wrapping-only')) {
        await wrappedDescriptions(page);
        assert.deepEqual(pageErrors, []);
        writeFileSync(resolve(output, 'wrapping-results.json'), JSON.stringify({ checks, pageErrors }, null, 2));
        console.log(`Completed ${checks.length} wrapping checks. Evidence: ${output}`);
        return;
      }
      const cardClasses = await page.getByRole('switch', { name: 'Organization Settings', exact: true }).evaluate(e => e.closest('.rounded-xl').className);
      for (const group of PERMISSION_GROUPS) await page.getByRole('switch', { name: group.label, exact: true }).scrollIntoViewIfNeeded();
      await bottom(page, '100% desktop: all permission groups and final card');
      await page.screenshot({ path: resolve(output, 'after-desktop-100.png') });

      for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 911 });
        await bottom(page, `${width}px: editor final card and partial permissions`);
        assert.equal(await page.getByRole('switch', { name: 'Organization Settings', exact: true }).evaluate(e => e.closest('.rounded-xl').className), cardClasses);
        await page.screenshot({ path: resolve(output, `after-${width}.png`) });
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await layout(page, `${width}px: Cancel returns to role list`);
        await edit(page);
      }
      await wrappedDescriptions(page);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await edit(page);
      for (const height of [600, 720, 1080]) {
        await page.setViewportSize({ width: 1440, height }); await bottom(page, `Resize to 1440x${height}`);
      }
      await page.setViewportSize({ width: 1920, height: 911 });
      await page.evaluate(() => { const event = new Event('beforeinstallprompt'); event.prompt = async () => {}; event.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(event); });
      await page.getByRole('region', { name: 'Install LeadCRM', exact: true }).waitFor();
      await bottom(page, 'Install banner: offset applied once');
      await page.screenshot({ path: resolve(output, 'after-desktop-banner-100.png') });
      await page.getByRole('button', { name: 'Dismiss install banner', exact: true }).click();
      await bottom(page, 'Dismiss install banner: workspace grows correctly');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();

      const beforeWrites = writes.length;
      await page.getByRole('button', { name: 'Create Custom Role', exact: true }).click();
      await page.getByLabel('Role Name *', { exact: true }).fill('Cancelled fixture');
      await page.getByRole('switch', { name: 'Edit Roles', exact: true }).click();
      assert.equal(await page.getByRole('switch', { name: 'View Roles & Permissions', exact: true }).getAttribute('aria-checked'), 'true');
      assert.equal(writes.length, beforeWrites, 'Toggles never save automatically');
      await bottom(page, 'Create Role: partial group contained without saving');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(writes.length, beforeWrites); pass('Cancel discards draft without a role write');

      await page.getByRole('button', { name: 'Create Custom Role', exact: true }).click();
      await page.getByLabel('Role Name *', { exact: true }).fill('Saved fixture');
      await page.getByLabel(/Description/).fill('Layout regression only');
      await page.getByRole('switch', { name: 'Contacts', exact: true }).click();
      await page.getByRole('switch', { name: 'Edit Contacts', exact: true }).click();
      assert.equal(writes.length, beforeWrites);
      await bottom(page, 'Create Role: group and individual switches');
      await page.getByRole('button', { name: 'Create Role', exact: true }).click();
      await page.getByRole('heading', { name: 'Saved fixture', exact: true }).waitFor();
      assert.equal(writes.length, beforeWrites + 1); assert.equal(writes.at(-1).method, 'POST');
      assert.equal(writes.at(-1).body.permissions.find(p => p.module === 'contacts').canEdit, false); pass('Create Role saves once through the canonical API client');
      await edit(page);
      await page.getByLabel(/Description/).fill('Updated fixture');
      await page.getByRole('switch', { name: 'Organization Settings', exact: true }).click();
      await page.getByRole('switch', { name: 'Edit Organization Settings', exact: true }).click();
      assert.equal(writes.length, beforeWrites + 1);
      await bottom(page, 'Edit Role: final group toggles remain draft changes');
      await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
      await page.getByRole('heading', { name: 'Roles & Permissions', exact: true }).waitFor();
      assert.equal(writes.at(-1).method, 'PUT'); assert.equal(writes.at(-1).body.description, 'Updated fixture'); pass('Save Changes uses the established role endpoint');
      await edit(page); assert.equal(await page.getByLabel(/Description/).inputValue(), 'Updated fixture');
      await page.getByRole('button', { name: 'Back to roles', exact: true }).click(); await layout(page, 'Back to roles after saved edit');
      await page.getByRole('button', { name: 'Actions for Client Admin', exact: true }).click();
      for (const name of ['Edit Permissions', 'Archive Role']) assert.equal(await page.getByRole('menuitem', { name, exact: true }).getAttribute('aria-disabled'), 'true');
      await page.keyboard.press('Escape'); pass('Client Admin edit/archive protection stays intact');

      for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 911 });
        for (const [tab, label] of [['profile', 'Profile Settings'], ['appearance', 'Appearance'], ['org-general', 'General'], ['users', 'Team Management'], ['roles', 'Roles & Permissions'], ['custom-fields', 'Customize Fields'], ['products', 'Products'], ['archived', 'Archived Data'], ['forms', 'Forms']]) {
          if (width < 1280) await page.getByLabel('Settings section', { exact: true }).selectOption(tab);
          else await page.locator('[data-app-scroll] aside').getByRole('button', { name: label, exact: true }).click();
          await layout(page, `${width}px: ${label} navigation and workspace`);
        }
      }
      assert.deepEqual(pageErrors, []); pass('No browser page errors');
      await browser.close(); browser = null;
    }

    // Chromium's own default zoom preference changes CSS viewport and DPR.
    // This exercises actual browser zoom, rather than CSS zoom or pinch emulation.
    for (const zoom of [0.8, 0.9, 1, 1.1, 1.25]) {
      const profile = mkdtempSync(join(tmpdir(), 'leadcrm-settings-zoom-')); mkdirSync(join(profile, 'Default'));
      // The default storage partition uses key "x" (empty relative profile path).
      // https://chromium.googlesource.com/chromium/src/+/lkgr/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc
      writeFileSync(join(profile, 'Default', 'Preferences'), JSON.stringify({ partition: { default_zoom_level: { x: Math.log(zoom) / Math.log(1.2) } } }));
      const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true, viewport: null, args: ['--window-size=1920,911', '--force-device-scale-factor=1'] });
      try {
        await fixtures(context); const page = await context.newPage();
        page.on('pageerror', e => pageErrors.push(e.message)); await page.goto(base + '/settings?tab=roles'); await edit(page);
        const actual = await page.evaluate(() => devicePixelRatio);
        assert.ok(Math.abs(actual - zoom) < 0.02, `Browser zoom was not applied: wanted ${zoom}, DPR ${actual}`);
        await bottom(page, `${Math.round(zoom * 100)}% actual Chromium zoom`);
        // Capture the physical browser surface without Playwright's CSS-pixel
        // clip; that clip can crop the screenshot when native browser zoom is set.
        const cdp = await context.newCDPSession(page);
        const capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
        writeFileSync(resolve(output, `zoom-${Math.round(zoom * 100)}.png`), Buffer.from(capture.data, 'base64'));
        await cdp.detach();
      } finally { await context.close(); }
    }
    assert.deepEqual(pageErrors, []);
    writeFileSync(resolve(output, process.argv.includes('--zoom-only') ? 'zoom-results.json' : 'results.json'), JSON.stringify({ checks, pageErrors, roleWrites: writes.length, output }, null, 2));
    console.log(`Completed ${checks.length} checks. Evidence: ${output}`);
  } catch (error) {
    writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ message: error.message, checks, pageErrors }, null, 2));
    throw error;
  } finally { if (browser) await browser.close(); }
})();
