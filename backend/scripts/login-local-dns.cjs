// Child-process-only fixture alias. Never loaded by production startup.
const dns = require('node:dns'), lookup = dns.lookup;
dns.lookup = function(hostname, options, callback) {
  if (hostname !== 'login-qa.local.test' || process.env.LOGIN_QA_DISPOSABLE !== 'true') return lookup.apply(this, arguments);
  const done = typeof options === 'function' ? options : callback;
  queueMicrotask(() => options?.all ? done(null,[{address:'127.0.0.1',family:4}]) : done(null,'127.0.0.1',4));
};
