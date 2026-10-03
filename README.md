# SOP Runner（离线单文件版）

- `sop-runner.html` —— 交付物。双击打开（file://），无需安装、不联网。JSZip 3.10.1 已内联。
- `js-test.html` —— 在公司电脑上先双击它、点按钮；出现绿色提示即说明允许本地 HTML+JS。
- `sample/Webサーバ定期パッチ適用手順書.docx` —— 架空的示例手顺书（`sample/make_sample.py` 生成）。
- `src/` —— 源码（parser.js 解析、export.js 导出、app.js 界面、app.css、template.html）；`build/build.js` 把它们合成单文件。
- `tests/` —— Playwright 端到端测试、导出校验（python-docx）、离线静态扫描。`./run_tests.sh` 一键重跑。

## 替换为公司证跡模板
导出分三层（见 `src/export.js`）：`RecordModel.build()`（纯数据）→ `ExportTemplates[name].render()`（版式）→ `DocxWriter.pack()`（打包）。
新增一个 `ExportTemplates` 条目即可，例如：把公司模板的 `word/document.xml` 作为字符串嵌入，替换其中的 `{{executor}}` 等占位符并复制表格行。
