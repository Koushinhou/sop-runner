// End-to-end test: headless Chromium, file:// URL, all network blocked & recorded.
const { chromium } = require('../build/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = '/workspace/sop-runner', URL_ = 'file://' + ROOT + '/sop-runner.html';
const DOCX = ROOT + '/sample/Webサーバ定期パッチ適用手順書.docx';
const OUT = ROOT + '/tests/out', SHOT = ROOT + '/screenshots';
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(SHOT, { recursive: true });
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✔ ' + msg); } else { fail++; console.log('  ✘ ' + msg); } }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 900 }, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
  const external = [], allReq = [], errors = [], csp = [];
  await ctx.route('**/*', route => { const u = route.request().url(); if (/^(file|blob|data):/.test(u)) return route.continue(); external.push(u); return route.abort(); });
  ctx.on('request', r => allReq.push(r.url()));
  const page = await ctx.newPage();
  page.on('websocket', ws => external.push(ws.url()));
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (/Content Security Policy/i.test(m.text())) csp.push(m.text()); });
  page.on('dialog', d => d.accept());
  const S = () => page.evaluate(() => JSON.parse(JSON.stringify(SopApp.state())));

  console.log('1) 导入（拖放）');
  await page.goto(URL_);
  await page.screenshot({ path: SHOT + '/01-import.png' });
  const b64 = fs.readFileSync(DOCX).toString('base64');
  await page.evaluate(async ({ b64, name }) => {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const dt = new DataTransfer(); dt.items.add(new File([bin], name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    const drop = document.getElementById('drop');
    drop.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true }));
    drop.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, { b64, name: path.basename(DOCX) });
  await page.waitForSelector('#stepCount');
  let st = await S();
  ok(st.steps.length === 18, '步骤数 = 18 (实际 ' + st.steps.length + ')');
  const nIn = st.steps.reduce((a, s) => a + s.inputs.length, 0);
  ok(nIn === 16, '输入项 = 16 (实际 ' + nIn + ')');
  ok(await page.textContent('#stepCount') === '18' && await page.textContent('#inputCount') === '16', '编辑页显示 18 步 / 16 输入项');
  const labels = st.steps.flatMap(s => s.inputs.map(i => i.label));
  for (const l of ['作業日', '作業者', '確認者', '開始時刻', '確認結果', '切り離し時刻', '適用対象パッケージ数', '結果', 'カーネルバージョン', '実施結果', '終了時刻', '作業責任者へ報告した'])
    ok(labels.includes(l), '检测到输入项「' + l + '」');
  ok(st.steps[7].inputs[0].unit === '件', '（　　）件 → 单位「件」');
  ok(st.steps[17].inputs[0].type === 'check', '□ → 勾选型输入');
  ok(st.steps.slice(11, 15).every(s => s.inputs.length === 1 && s.inputs[0].label === '確認結果' && /curl|systemctl|tail/.test(s.content)), '表格 4 行 → 4 步，空的確認結果单元格 → 输入框，コマンド列 → 命令');
  ok(st.steps[8].expected.includes('Complete!'), '期待結果 被提取');
  ok(st.steps.filter(s => /^`/m.test(s.content)).length >= 9, '命令行被识别（≥9 个步骤含命令）');
  ok(/`dnf check-update --security`/.test(st.steps[7].content), '行内等宽 run → 行内代码');

  console.log('2) 编辑模式');
  await page.waitForTimeout(1800);
  await page.evaluate(() => { const e = document.querySelectorAll('.ed')[5]; window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 70); });
  await page.screenshot({ path: SHOT + '/03-edit-mode.png', fullPage: false });
  await page.evaluate(() => window.scrollTo(0, 0));
  const sid = i => st.steps[i].id;
  // 合并 #2+#3
  await page.click(`button[data-act=merge][data-sid="${sid(1)}"]`);
  st = await S(); ok(st.steps.length === 17 && st.steps[1].content.includes('SSH接続'), '合并：17 步');
  // 在光标处拆分回来
  const ta = `textarea[data-ed=content][data-sid="${st.steps[1].id}"]`;
  await page.evaluate(sel => { const t = document.querySelector(sel); const p = t.value.indexOf('作業端末'); t.focus(); t.setSelectionRange(p, p); }, ta);
  await page.click(`button[data-act=split][data-sid="${st.steps[1].id}"]`);
  st = await S(); ok(st.steps.length === 18 && st.steps[2].title.startsWith('作業端末') && st.steps[2].expected.includes('bastion01') && !st.steps[1].expected, '拆分：回到 18 步，新步骤标题/期待结果正确');
  // 重排
  const lastId = st.steps[17].id;
  await page.click(`button[data-act=up][data-sid="${lastId}"]`);
  st = await S(); ok(st.steps[16].id === lastId, '上移');
  await page.click(`button[data-act=down][data-sid="${lastId}"]`);
  st = await S(); ok(st.steps[17].id === lastId, '下移');
  // 编辑文本
  await page.fill(`input[data-ed=title][data-sid="${st.steps[1].id}"]`, '概要を読み、作業範囲を把握する');
  st = await S(); ok(st.steps[1].title === '概要を読み、作業範囲を把握する', '编辑标题');
  // 添加/删除输入项
  await page.click(`button[data-act=addInput][data-sid="${st.steps[1].id}"]`);
  await page.fill(`input[data-inped=label][data-sid="${st.steps[1].id}"]`, '読了確認');
  st = await S(); ok(st.steps[1].inputs.length === 1 && st.steps[1].inputs[0].label === '読了確認', '添加输入项');
  await page.click(`button[data-act=delInput][data-sid="${st.steps[1].id}"]`);
  st = await S(); ok(st.steps[1].inputs.length === 0, '删除输入项');
  // 插入 + 删除步骤
  await page.click('button[data-act=insert][data-at="18"]');
  st = await S(); ok(st.steps.length === 19 && st.steps[18].title === '新步骤', '插入步骤');
  await page.click(`button[data-act=delStep][data-sid="${st.steps[18].id}"]`);
  st = await S(); ok(st.steps.length === 18, '删除步骤');
  // 重新检测
  await page.click(`button[data-act=redetect][data-sid="${st.steps[3].id}"]`);
  st = await S(); ok(st.steps[3].inputs.length === 1, '重新检测输入（保持 1 项）');
  // 开始执行需要执行者
  await page.click('#btnStart');
  ok((await S()).phase === 'edit', '未填执行者时不能开始');
  await page.fill('input[data-bind=executor]', '山田 太郎（テスト）');
  await page.click('#btnStart');
  st = await S(); ok(st.phase === 'run' && st.startedAt, '开始执行');

  console.log('3) 确认按钮门控');
  const valueFor = (inp, i) => inp.type === 'time' ? null : inp.label.includes('パッケージ') ? '12' : inp.label.includes('カーネル') ? '5.14.0-999.el9.x86_64' : inp.type === 'result' ? 'OK' : inp.label === '作業者' ? '山田 太郎' : inp.label === '確認者' ? '佐藤 花子' : '値' + i;
  async function fillStep(idx, opt = {}) {
    const s = (await S()).steps[idx];
    for (const inp of s.inputs) {
      if (inp.type === 'check') await page.check('#in_' + inp.id);
      else if (inp.type === 'time') await page.click(`button[data-act=now][data-iid="${inp.id}"]`);
      else if (inp.type === 'result' && !opt.result) await page.click(`button[data-act=setv][data-iid="${inp.id}"][data-v=OK]`);
      else await page.fill('#in_' + inp.id, opt.result || valueFor(inp, idx));
    }
    if (opt.note) await page.fill('textarea[data-note]', opt.note);
    if (opt.anomaly) await page.check('input[data-anom]');
  }
  st = await S();
  const s0 = st.steps[0];
  ok(await page.isDisabled('#btnConfirm'), '步骤1：未填写时 确认 禁用');
  await page.fill('#in_' + s0.inputs[1].id, '山田 太郎');
  await page.fill('#in_' + s0.inputs[2].id, '佐藤 花子');
  ok(await page.isDisabled('#btnConfirm'), '步骤1：3 项中填 2 项仍禁用');
  await page.click(`button[data-act=now][data-iid="${s0.inputs[0].id}"]`);
  ok(!(await page.isDisabled('#btnConfirm')), '步骤1：全部填写后 确认 可用');
  await page.fill('#in_' + s0.inputs[2].id, '  ');
  ok(await page.isDisabled('#btnConfirm'), '清空(仅空格)后再次禁用');
  await page.fill('#in_' + s0.inputs[2].id, '佐藤 花子');
  await page.click('#btnConfirm');
  st = await S(); ok(st.results[s0.id].confirmedAt && st.view === 1, '确认后自动进入下一步');
  // 锁定的后续步骤不能跳转
  await page.click('#side .it[data-i="10"]');
  ok((await S()).view === 1, '未确认前无法跳到后面的步骤');
  for (let i = 1; i < 6; i++) { await fillStep(i); await page.click('#btnConfirm'); }
  // 步骤 7：截图（命令 + 输入）
  st = await S(); ok(st.view === 6, '进入步骤 7');
  await page.click('.cmd button[data-copy]');
  ok((await page.textContent('#toast')).includes('lbctl disable --pool web'), '命令复制按钮（去掉 # 提示符）');
  ok(await page.isDisabled('#btnConfirm'), '步骤7：切り離し時刻 未填 → 禁用');
  await page.fill('#in_' + st.steps[6].inputs[0].id, '2026-10-03 22:15');
  await page.fill('textarea[data-note]', 'LB切り離し後、セッション数 0 を確認');
  await page.mouse.move(0, 0); await page.waitForTimeout(1800);
  await page.screenshot({ path: SHOT + '/02-running-step.png' });
  await page.click('#btnConfirm');
  await fillStep(7); await page.click('#btnConfirm');
  // 步骤 9：异常 + 备注
  await fillStep(8, { result: 'NG（1件失敗→再実行でOK）', note: 'kernel-headers の取得がタイムアウト。再実行で Complete! を確認。', anomaly: true });
  await page.click('#btnConfirm');
  st = await S(); ok(st.results[st.steps[8].id].anomaly === true, '异常标记已保存');

  console.log('4) 刷新后恢复进度');
  await page.reload();
  await page.waitForSelector('#sessions');
  ok((await page.textContent('#sessions')).includes('9 / 18'), '首页列表显示 9 / 18');
  await page.click('button[data-act=resume]');
  st = await S();
  ok(st.view === 9 && st.results[s0.id].values[s0.inputs[1].id] === '山田 太郎', '继续：定位到步骤 10，已填值保留');
  // 重新导入同一 docx → 提示恢复（自动点“确定”）
  await page.click('header button[data-act=home]');
  await page.setInputFiles('#fileDocx', DOCX);
  await page.waitForSelector('#stepCard');
  st = await S(); ok(st.view === 9 && st.steps[1].title === '概要を読み、作業範囲を把握する', '重新导入同一 docx → 恢复进度和编辑结果');
  // 撤销确认
  await page.click('#side .it[data-i="8"]');
  await page.click('button[data-act=undo]');
  st = await S(); ok(!st.results[st.steps[8].id].confirmedAt && st.view === 8, '撤销最后一次确认');
  await page.click('#btnConfirm');

  console.log('5) 执行到最后并导出');
  for (let i = 9; i < 18; i++) { await fillStep(i); await page.click('#btnConfirm'); }
  st = await S(); ok(st.phase === 'done' && st.finishedAt, '全部完成');
  await page.waitForSelector('#btnExportDocx');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: SHOT + '/04-complete-export.png', fullPage: false });
  let [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnExportDocx')]);
  await dl.saveAs(OUT + '/record.docx'); ok(/実施記録_\d{8}-\d{4}\.docx$/.test(dl.suggestedFilename()), '导出 Word：' + dl.suggestedFilename());
  [dl] = await Promise.all([page.waitForEvent('download'), page.click('header button[data-act=exportJson]')]);
  await dl.saveAs(OUT + '/run.json'); ok(JSON.parse(fs.readFileSync(OUT + '/run.json', 'utf8')).state.steps.length === 18, '导出 JSON');
  fs.writeFileSync(OUT + '/state.json', JSON.stringify(await S(), null, 1));

  console.log('6) 重置 + JSON 恢复');
  await page.click('header button[data-act=reset]');
  st = await S(); ok(st.phase === 'edit' && Object.keys(st.results).length === 0 && st.steps.length === 18, '重置：清空结果，保留步骤');
  await page.click('header button[data-act=home]');
  await page.setInputFiles('#fileJson', OUT + '/run.json');
  await page.waitForSelector('#btnExportDocx');
  st = await S(); ok(st.phase === 'done' && Object.values(st.results).filter(r => r.confirmedAt).length === 18, 'JSON 导入恢复完整执行记录');

  console.log('7) 离线检查');
  ok(external.length === 0, '外部请求数 = 0 ' + (external.length ? JSON.stringify(external) : ''));
  ok(allReq.every(u => /^(file|blob|data):/.test(u)), '所有请求均为 file:/blob:（共 ' + allReq.length + ' 个：' + [...new Set(allReq.map(u => u.split(':')[0]))].join(',') + '）');
  ok(csp.length === 0, '无 CSP 违规');
  ok(errors.length === 0, '无 JS 错误 ' + (errors.length ? JSON.stringify(errors) : ''));
  await browser.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
