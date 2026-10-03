const { chromium } = require('../build/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('console', m => console.log('CONSOLE', m.type(), m.text())); p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('file:///workspace/sop-runner/sop-runner.html');
  await p.setInputFiles('#fileDocx', process.argv[2] || '/workspace/sop-runner/sample/Webサーバ定期パッチ適用手順書.docx');
  await p.waitForSelector('#stepCount', { timeout: 5000 });
  const s = await p.evaluate(() => SopApp.state());
  s.steps.forEach((st, i) => console.log(`#${i + 1} [${st.section}] ${st.title}\n   ctx: ${st.context}\n   content: ${st.content.replace(/\n/g, ' ⏎ ')}\n   exp: ${st.expected}\n   inputs: ${st.inputs.map(x => x.label + '(' + x.type + (x.unit ? ',' + x.unit : '') + ')').join(' | ')}`));
  await b.close();
})();
