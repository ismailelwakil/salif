/* سلف — browser error reporting. Posts to our server, which forwards to Sentry.
   The DSN public key never needs to live in the page. */
'use strict';
(function () {
  function report(err, extra) {
    try {
      const payload = {
        message: err && err.message ? String(err.message) : String(err || 'unknown'),
        stack: err && err.stack ? String(err.stack).slice(0, 4000) : '',
        href: location.href,
        lang: document.documentElement.lang || '',
        extra: extra || null,
      };
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/telemetry', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/telemetry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
      }
    } catch (e) {}
  }
  window.addEventListener('error', function (ev) {
    report(ev.error || ev.message, { source: ev.filename, line: ev.lineno });
  });
  window.addEventListener('unhandledrejection', function (ev) {
    report(ev.reason, { kind: 'unhandledrejection' });
  });
  window.SalifSentry = { report: report };
})();
