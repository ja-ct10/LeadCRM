export const acceptanceWidths = [320, 375, 390, 430, 768, 1024, 1440, 1920];
export async function setAcceptanceTheme(page, mode, { allowUnscoped = false } = {}) {
  await page.evaluate(mode => {
    localStorage.setItem('app_theme', mode);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { mode, theme: mode === 'Dark' ? 'dark' : 'light' } }));
  }, mode);
  await page.waitForFunction(({ mode, allowUnscoped }) => {
    const scopes = [...document.querySelectorAll('[data-theme-container]')];
    return document.documentElement.dataset.appTheme === (mode === 'Dark' ? 'dark' : 'light') &&
      (scopes.length > 0 || allowUnscoped) && scopes.every(scope => scope.classList.contains('dark') === (mode === 'Dark'));
  }, { mode, allowUnscoped });
}
export async function* responsiveMatrix(page, options = {}) {
  for (const theme of ['Light', 'Dark']) {
    await setAcceptanceTheme(page, theme, options);
    for (const width of acceptanceWidths) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);
      yield { theme, width };
    }
  }
  await setAcceptanceTheme(page, 'Light', options);
  await page.setViewportSize({ width: 1440, height: 900 });
}
/** Loopback APIs only; allow documented public typography assets, never providers. */
export async function isolateBrowserContext(context) {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    const allowed = ['localhost', '127.0.0.1', '[::1]', 'fonts.googleapis.com', 'fonts.gstatic.com', 'api.fontshare.com', 'cdn.fontshare.com'].includes(url.hostname);
    return allowed || ['data:', 'blob:'].includes(url.protocol) ? route.fallback() : route.abort('blockedbyclient');
  });
}
