'use strict';

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

module.exports = { browserEvidence };
