// 生成单文件 sop-runner.html（所有库内联）
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const rd = p => fs.readFileSync(path.join(root, p), 'utf8');
const guard = (s, n) => { if (/<\/script/i.test(s)) throw new Error(n + ' contains </script'); return s; };
let html = rd('src/template.html');
const parts = {
  '/*__CSS__*/': rd('src/app.css'),
  '/*__JSZIP__*/': guard(fs.readFileSync(path.join(__dirname, 'node_modules/jszip/dist/jszip.min.js'), 'utf8'), 'jszip'),
  '/*__PARSER__*/': guard(rd('src/parser.js'), 'parser'),
  '/*__EXPORT__*/': guard(rd('src/export.js'), 'export'),
  '/*__APP__*/': guard(rd('src/app.js'), 'app'),
};
for (const [k, v] of Object.entries(parts)) html = html.split(k).join(v);
fs.writeFileSync(path.join(root, 'sop-runner.html'), html);
console.log('sop-runner.html', html.length, 'chars', Buffer.byteLength(html), 'bytes');
