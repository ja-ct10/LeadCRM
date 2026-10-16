'use strict';
const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

function ensureBrowserFailureReport(directory, error) {
  const existing = ['results.json', 'report.json'].map(name => resolve(directory, name)).find(path => existsSync(path));
  if (existing) return existing;
  mkdirSync(directory, { recursive: true });
  const report = resolve(directory, 'results.json');
  writeFileSync(report, JSON.stringify({ status: 'FAIL', checks: [], pageErrors: [], transportErrors: [],
    error: error instanceof Error ? error.stack || error.message : String(error) }, null, 2) + '\n');
  return report;
}

function browserEvidence(result, exitCode) {
  const checks = Array.isArray(result?.checks) ? result.checks : [];
  const passed = checks.filter(check => check?.passed !== false).length;
  const failures = checks.filter(check => check?.passed === false).length;
  const errors = ['errors', 'pageErrors', 'transportErrors', 'serverErrors'].flatMap(key => Array.isArray(result?.[key]) ? result[key] : []);
  const unsupportedStatus = result && Object.prototype.hasOwnProperty.call(result, 'status') &&
    (typeof result.status !== 'string' || !['PASS', 'PASSED'].includes(result.status.trim().toUpperCase()));
  const failed = Math.max(failures, exitCode || result?.error || result?.failure || unsupportedStatus || errors.length ? 1 : 0);
  return { executed: passed + failed, passed, failed, skipped: 0,
    complete: exitCode === 0 && passed > 0 && failed === 0 };
}

function browserFailureDiagnostics(result, exitCode) {
  const { complete, ...counts } = browserEvidence(result, exitCode);
  const failedChecks = Array.isArray(result?.checks) ? result.checks.filter(check => check?.passed === false) : [];
  return JSON.stringify({
    exitCode, ...counts,
    status: result?.status ?? 'FAIL',
    error: result?.error ?? result?.failure ?? 'Required browser assertions failed, were missing, or did not complete.',
    failedChecks,
    ...Object.fromEntries(['errors', 'pageErrors', 'transportErrors', 'serverErrors'].map(key => [key, Array.isArray(result?.[key]) ? result[key] : []])),
  }, null, 2);
}

function cleanupBrowserDatabase(database, onError) {
  try { database?.stop(); }
  catch (error) { onError(error); }
}

module.exports = { browserEvidence, browserFailureDiagnostics, ensureBrowserFailureReport, cleanupBrowserDatabase };
