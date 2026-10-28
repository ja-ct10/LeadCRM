/* Add once on the company website. Set data-remember="true" only after tracking consent. */
(function () {
  'use strict';
  var script = document.currentScript, remember = script && script.getAttribute('data-remember') === 'true';
  var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'gclid', 'gbraid', 'wbraid', 'msclkid', 'fbclid'];
  var params = {}, location = new URL(window.location.href), referrer;
  keys.forEach(function (key) { var v = location.searchParams.get(key); if (v) params[key] = v.replace(/[\x00-\x1f\x7f-\x9f]/g, '').trim().slice(0, 200); });
  try { var origin = new URL(document.referrer).origin; if (origin !== location.origin) referrer = origin + '/'; } catch (_) {}
  var touch = { params: params, landingPage: location.origin + location.pathname, observedAt: new Date().toISOString() };
  if (referrer) touch.referrer = referrer;
  var context = { first: touch, last: touch, storage: remember ? 'remembered' : 'session' };
  try {
    var key = 'leadcrm-website-source', saved = JSON.parse((remember ? localStorage : sessionStorage).getItem(key) || 'null');
    if (saved && saved.first && saved.last && Date.now() - Date.parse(saved.first.observedAt) >= 0 && Date.now() - Date.parse(saved.first.observedAt) < 30 * 86400000) {
      context.first = saved.first;
      if (!Object.keys(params).length && !referrer) context.last = saved.last;
    }
    if (!remember) localStorage.removeItem(key);
    (remember ? localStorage : sessionStorage).setItem(key, JSON.stringify(context));
  } catch (_) { context.storage = 'unavailable'; }
  window.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'leadcrm:ready') return;
    document.querySelectorAll('iframe[data-leadcrm-form]').forEach(function (frame) {
      try {
        var formOrigin = new URL(frame.src).origin;
        if (event.source === frame.contentWindow && event.origin === formOrigin) frame.contentWindow.postMessage({ type: 'leadcrm:source', context: context }, formOrigin);
      } catch (_) {}
    });
  });
}());
