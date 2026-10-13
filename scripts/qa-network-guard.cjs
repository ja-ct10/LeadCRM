'use strict';

// Loaded only by local QA children, never by production entry points.
if (process.env.LEADCRM_QA_RUN === '1') {
  // Prisma bundles its own dotenv implementation, so guard the file boundary too.
  const fs = require('node:fs');
  const privateEnvironment = file => {
    const name = file instanceof URL ? require('node:url').fileURLToPath(file) : Buffer.isBuffer(file) ? file.toString() : file;
    return typeof name === 'string' && /(?:^|[\\/])\.env(?:$|\.)/.test(name) && !name.endsWith('.env.example');
  };
  const syncRead = fs.readFileSync;
  fs.readFileSync = function(file, options) {
    if (!privateEnvironment(file)) return syncRead.call(this, file, options);
    return (typeof options === 'string' || options?.encoding) ? '' : Buffer.alloc(0);
  };
  const asyncRead = fs.readFile;
  fs.readFile = function(file, options, callback) {
    if (!privateEnvironment(file)) return asyncRead.call(this, file, options, callback);
    if (typeof options === 'function') { callback = options; options = undefined; }
    queueMicrotask(() => callback(null, (typeof options === 'string' || options?.encoding) ? '' : Buffer.alloc(0)));
  };
  const promiseRead = fs.promises.readFile;
  fs.promises.readFile = async function(file, options) {
    if (!privateEnvironment(file)) return promiseRead.call(this, file, options);
    return (typeof options === 'string' || options?.encoding) ? '' : Buffer.alloc(0);
  };
  const Module = require('node:module');
  Module.syncBuiltinESMExports();
  const originalLoad = Module._load;
  Module._load = function(request, ...args) {
    const result = originalLoad.call(this, request, ...args);
    if (request === '@next/env') return {
      ...result,
      loadEnvConfig: () => ({ combinedEnv: process.env, parsedEnv: {}, loadedEnvFiles: [] }),
    };
    return result;
  };
  const localHost = host => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(String(host).toLowerCase());
  const fontHost = host => process.env.LEADCRM_QA_BUILD_ASSETS === '1' && ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(String(host).toLowerCase());
  const permittedHost = (host, port = 443) => localHost(host) || (fontHost(host) && Number(port) === 443);
  const allowed = input => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (!['http:', 'https:'].includes(url.protocol) || !(localHost(url.hostname) || (url.protocol === 'https:' && permittedHost(url.hostname, url.port || 443)))) {
      throw new Error('QA_EXTERNAL_NETWORK_BLOCKED');
    }
    return url;
  };
  const originalFetch = globalThis.fetch;
  if (originalFetch) globalThis.fetch = function(input, init) {
    try { allowed(input); } catch (error) { return Promise.reject(error); }
    return originalFetch.call(this, input, init);
  };
  for (const protocol of ['http', 'https']) {
    const transport = require(`node:${protocol}`);
    for (const method of ['request', 'get']) {
      const original = transport[method];
      transport[method] = function(input, ...args) {
        if (typeof input === 'string' || input instanceof URL) allowed(input);
        else {
          const host = input?.hostname || (input?.host && new URL(`${protocol}://${input.host}`).hostname) || 'localhost';
          if (!(localHost(host) || (protocol === 'https' && permittedHost(host, input?.port || 443)))) throw new Error('QA_EXTERNAL_NETWORK_BLOCKED');
        }
        return original.call(this, input, ...args);
      };
    }
  }
  // Provider SDKs can use raw sockets instead of fetch/HTTP. Guard their connect
  // boundary as well while retaining local Unix sockets and Windows named pipes.
  const connectionAllowed = args => {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    if (first && typeof first === 'object') {
      if (first.path) return;
      const host = first.host || first.hostname || first.socket?.remoteAddress || 'localhost';
      if (!permittedHost(host, first.port ?? first.socket?.remotePort)) throw Error('QA_EXTERNAL_NETWORK_BLOCKED');
    } else if (typeof first === 'string' && !/^\d+$/.test(first)) return; // Local IPC path.
    else if (!permittedHost(typeof args[1] === 'string' ? args[1] : 'localhost', first)) throw Error('QA_EXTERNAL_NETWORK_BLOCKED');
  };
  const net = require('node:net'), tls = require('node:tls');
  for (const [owner, method] of [[net, 'connect'], [net, 'createConnection'], [net.Socket.prototype, 'connect'], [tls, 'connect']]) {
    const original = owner[method];
    owner[method] = function(...args) { connectionAllowed(args); return original.apply(this, args); };
  }
  Module.syncBuiltinESMExports();
  // Explicit config({ path: '../.env' }) must not load deployment credentials.
  const dotenv = require('dotenv');
  const config = dotenv.config;
  dotenv.config = options => config({ ...options, path: process.env.LEADCRM_QA_EMPTY_ENV, quiet: true });
}
