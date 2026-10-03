const { chromium } = require('../build/node_modules/playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const ext = [];
  await p.route('**/*', r => /^file:/.test(r.request().url()) ? r.continue() : (ext.push(r.request().url()), r.abort()));
  await p.goto('file:///workspace/sop-runner/js-test.html'); await p.click('#btn');
  const t = await p.textContent('#msg'); console.log(t.includes('JavaScript 运行正常') && t.includes('localStorage 可用') && !ext.length ? 'js-test.html OK: ' + t : 'FAIL ' + t + ext); await b.close(); })();
