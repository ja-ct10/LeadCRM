/**
 * Production entry point for the compiled backend, including Coolify containers.
 * This file is copied into dist/ during build.
 * Backend working-directory command: node dist/start.js
 *
 * Responsibilities:
 * 1. Register module alias for @leadcrm/shared → compiled shared package
 * 2. Boot the Express server
 */
'use strict';

const Module = require('module');
const path = require('path');

// --- Module alias: @leadcrm/shared → dist/shared/src/index.js ---
// TypeScript path aliases compile to bare `require('@leadcrm/shared')` in JS.
// Resolve the shared package compiled alongside the backend instead of loading
// the workspace's TypeScript entrypoint in the production Node process.
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === '@leadcrm/shared') {
    return path.join(__dirname, 'shared', 'src', 'index.js');
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

// --- Boot server ---
const seedIndex = process.argv.indexOf('--seed-campaign-templates');
if (seedIndex !== -1) {
  process.argv.splice(seedIndex, 1);
  require('./backend/src/scripts/seed-campaign-templates.js');
} else {
  require(process.argv.includes('--notifications-worker')
    ? './backend/src/modules/notifications/notification-worker.js'
    : './backend/src/server.js');
}
