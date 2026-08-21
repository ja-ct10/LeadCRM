// Production entry point for Render.
// Registers the @leadcrm/shared module alias then starts the server.
const path = require('path');
const Module = require('module');

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === '@leadcrm/shared') {
    return originalResolve.call(
      this,
      path.join(__dirname, 'dist', 'shared', 'src', 'index.js'),
      parent,
      ...rest,
    );
  }
  return originalResolve.call(this, request, parent, ...rest);
};

// Now start the server
require('./dist/backend/src/server.js');
