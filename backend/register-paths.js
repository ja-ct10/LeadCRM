// Register module alias for @leadcrm/shared at runtime.
// TypeScript path mappings only work at compile time — Node.js needs this
// to resolve the @leadcrm/shared import from the compiled dist/ output.
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
