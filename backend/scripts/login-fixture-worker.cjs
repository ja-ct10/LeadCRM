// A separate backend process for local acceptance, with no schedulers/providers.
const { resolve } = require('node:path');
const Module = require('node:module'), original = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  return request === '@leadcrm/shared' ? resolve(__dirname, '../dist/shared/src/index.js') : original.call(this, request, parent, isMain, options);
};
const app = require('../dist/backend/src/app.js').default;
const server = app.listen(0, '127.0.0.1', () => process.send?.({ port: server.address().port }));
process.on('message', async message => {
  if (message === 'stop') {
    await new Promise(done => server.close(done));
    await require('../dist/backend/src/config/database.config.js').default.$disconnect();
    process.exit(0);
  }
});
