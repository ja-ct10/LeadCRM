// Local verification against the configured database, without startup seeders/jobs.
// Run `npm --prefix backend run build` first. All normal API middleware remains active.
const path = require('node:path');
const Module = require('node:module');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
process.env.NODE_ENV = 'development';
process.env.APP_URL = 'http://localhost:3000';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
const original = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  if (request === '@leadcrm/shared') return path.resolve(__dirname, '../backend/dist/shared/src/index.js');
  return original.call(this, request, ...args);
};
const app = require('../backend/dist/backend/src/app.js').default;
app.listen(4000, '127.0.0.1', () => console.log('Connected CRM API: http://127.0.0.1:4000 (no startup seeds or scheduled jobs)'));
