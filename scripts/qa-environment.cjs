'use strict';

const { randomBytes } = require('node:crypto');
const { existsSync, mkdirSync, mkdtempSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

/** Keep account credentials and application .env files out of local acceptance. */
function qaEnvironment(root, overrides = {}) {
  const directory = resolve(root, 'data/outputs/system-audit');
  mkdirSync(directory, { recursive: true });
  const empty = resolve(directory, 'empty.env');
  writeFileSync(empty, '# Disposable QA only.\n');
  // Chromium's singleton socket has a 108-byte Unix path limit. Never inherit
  // TMPDIR here: nested fixture launches must have equally short private paths.
  const temporary = mkdtempSync(process.platform === 'linux' ? '/tmp/leadcrm-qa-' : join(directory, 'qa-temp-'));
  const storage = resolve(temporary, 'private-files');
  mkdirSync(storage);
  const env = {};
  for (const name of ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'ComSpec', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'CI', 'npm_execpath']) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  Object.assign(env, {
    NODE_ENV: 'test', LEADCRM_QA_RUN: '1', LEADCRM_QA_EMPTY_ENV: empty,
    DOTENV_CONFIG_PATH: empty, NEXT_TELEMETRY_DISABLED: '1',
    CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: 'true',
    NPM_CONFIG_USERCONFIG: empty,
    // Prisma's Windows cache otherwise follows the child package's CWD.
    // Install and workspace generation must share this disposable copy's cache.
    CACHE_DIR: resolve(root, 'node_modules/.cache'),
    TEMP: temporary, TMP: temporary, TMPDIR: temporary,
    JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:1/leadcrm_qa_unconfigured_test',
    DIRECT_URL: 'postgresql://postgres:postgres@127.0.0.1:1/leadcrm_qa_unconfigured_test',
    APP_URL: 'http://localhost:3000', ALLOWED_ORIGINS: 'http://localhost:3000',
    STORAGE_ROOT: storage,
    BREVO_API_KEY: '', BREVO_FROM_EMAIL: '', BREVO_WEBHOOK_TOKEN: '', BREVO_SMS_SENDER: '',
    BREVO_SANDBOX_EMAILS: '', TEXTBEE_API_KEY: '', TEXTBEE_DEVICE_ID: '', TEXTBEE_WEBHOOK_SECRET: '',
    RESEND_API_KEY: '', GMAIL_SYSTEM_SENDER_USER_ID: '', GMAIL_SYSTEM_SENDER_GMAIL_EMAIL: '', SMTP_FROM: '',
    GMAIL_CLIENT_ID: 'disposable-test', GMAIL_CLIENT_SECRET: 'disposable-test',
    GMAIL_REDIRECT_URI: 'http://localhost:4000/api/v1/integrations/gmail/callback',
    GMAIL_TEST_MAILBOX_OVERRIDE: '', LEADCRM_PRODUCTION_AUTH_ENABLED: 'false',
    LEADCRM_PRODUCTION_EMAIL_ALLOWLIST: '', LEADCRM_TEST_AUTH_ENABLED: 'false',
    LEADCRM_TEST_EMAIL_ALLOWLIST: '', NEXT_PUBLIC_USE_MOCK_AUTH: 'false', NEXT_PUBLIC_USE_MOCK_DATA: 'false',
  });
  const inheritedPlaywright = process.env.PLAYWRIGHT_MODULE;
  if (inheritedPlaywright && existsSync(inheritedPlaywright)) env.PLAYWRIGHT_MODULE = inheritedPlaywright;
  else {
    const installedPlaywright = resolve(root, 'node_modules/playwright');
    if (existsSync(installedPlaywright)) env.PLAYWRIGHT_MODULE = installedPlaywright;
  }
  for (const name of ['PLAYWRIGHT_NODE_PATH', 'PLAYWRIGHT_BROWSERS_PATH', 'POSTGRES_TEST_BIN', 'LEADCRM_TEST_POSTGRES_BIN']) {
    if (process.env[name]) env[name] = process.env[name];
  }
  Object.assign(env, overrides);
  for (const name of ['DATABASE_URL', 'DIRECT_URL', 'LOGIN_LOCKOUT_POSTGRES_URL']) {
    if (!env[name]) continue;
    const url = new URL(env[name]);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !/^\/leadcrm_[a-z0-9_]+$/i.test(url.pathname)) {
      throw new Error('QA requires a disposable LeadCRM database on loopback');
    }
  }
  // Neither a caller's NODE_OPTIONS nor an external dotenv path is inherited.
  env.NODE_OPTIONS = `--require "${resolve(root, 'scripts/qa-network-guard.cjs').replaceAll('\\', '/')}"`;
  return env;
}

module.exports = { qaEnvironment };
