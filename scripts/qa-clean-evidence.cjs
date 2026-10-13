'use strict';

const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');

function acceptanceRuns(directory) {
  return existsSync(directory) ? readdirSync(directory).filter(name => /^\d+-/.test(name)) : [];
}

function cleanPhaseEnvironment(directory, phase, environment) {
  return { ...environment, ...(['browser', 'all'].includes(phase) ? { PLAYWRIGHT_MODULE: resolve(directory, 'node_modules/playwright') } : {}) };
}

/** A previous phase report cannot establish the outcome of a new invocation. */
function cleanPhaseEvidence(directory, phase, previousRuns, child, sourceSha256) {
  const fail = (reason, evidence) => ({ status: 'FAIL', reason, ...(evidence ? { evidence } : {}) });
  let reports;
  try {
    reports = acceptanceRuns(directory).filter(name => !previousRuns.includes(name))
      .map(name => ({ name, evidence: resolve(directory, name, `qa-${phase}-native.json`) }))
      .filter(({ evidence }) => existsSync(evidence));
  } catch (error) { return fail(`Cannot inspect phase evidence: ${error.message}`); }
  if (reports.length !== 1) return fail(reports.length ? 'Ambiguous phase evidence from this invocation.' : 'Required phase evidence missing; exit zero alone cannot pass.');
  const { name, evidence } = reports[0];
  let report;
  try { report = JSON.parse(readFileSync(evidence, 'utf8')); }
  catch (error) { return fail(`Malformed phase evidence: ${error.message}`, evidence); }
  if (report?.runId !== name || report.mode !== phase || report.native !== true || report.sourceStart?.sourceSha256 !== sourceSha256) {
    return fail('Phase evidence does not match this invocation and source identity.', evidence);
  }
  if (!['PASS', 'FAIL', 'BLOCKED', 'REVALIDATION REQUIRED'].includes(report.status) || !Array.isArray(report.results) || !report.results.length) {
    return fail('Phase evidence has an unsupported status or no executed gate records.', evidence);
  }
  const statuses = report.results.map(result => result?.status);
  if (statuses.some(status => !['PASS', 'FAIL', 'BLOCKED'].includes(status)) ||
      (report.status === 'PASS' && statuses.some(status => status !== 'PASS')) ||
      (report.status === 'BLOCKED' && (!statuses.includes('BLOCKED') || statuses.includes('FAIL')))) {
    return fail('Phase status contradicts its recorded gate outcomes.', evidence);
  }
  if (child.error || child.status === null || (child.status !== 0 && report.status === 'PASS')) {
    return fail('The phase process failed despite its report; a failed invocation cannot pass.', evidence);
  }
  return { status: report.status, evidence, checks: report.results };
}

module.exports = { acceptanceRuns, cleanPhaseEnvironment, cleanPhaseEvidence };
