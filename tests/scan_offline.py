# 静态扫描 sop-runner.html：列出所有 http(s) 字符串并分类；检查可能发起网络请求的 API/标签
import re, sys
html = open('sop-runner.html', encoding='utf-8').read()
urls = re.findall(r'https?://[^\s"\'<>)`]+', html)
cats = {}
for u in urls:
    if u.startswith('http://schemas.openxmlformats.org/') or u.startswith('http://purl.org/dc/') or u.startswith('http://www.w3.org/2001/XMLSchema-instance'):
        k = 'OOXML/XML 命名空间标识符（字符串常量，不会被请求）'
    elif any(x in u for x in ('stuartk.com', 'github.com', 'github.io', 'raw.github.com')):
        k = 'JSZip 许可证注释 / 错误提示文本中的链接（不会被请求）'
    else:
        k = '其他'
    cats.setdefault(k, set()).add(u)
for k, v in cats.items():
    print(f'[{k}] {len(v)} 个唯一 URL'); [print('   ', x) for x in sorted(v)]
bad = []
for name, rx in {'<script src>': r'<script[^>]+src=', '<link href>': r'<link[^>]+href=', '<img src=http>': r'<img[^>]+src=["\']?https?:', 'CSS url(http)': r'url\(\s*["\']?https?:', '@import': r'@import', 'fetch(': r'\bfetch\(', 'XMLHttpRequest': r'XMLHttpRequest', 'WebSocket': r'WebSocket', 'sendBeacon': r'sendBeacon', 'EventSource': r'EventSource', '<iframe': r'<iframe'}.items():
    n = len(re.findall(rx, html))
    print(f'{name:16s}: {n}'); bad += [name] if n else []
other = cats.get('其他', set())
print('\n结论：', '通过（无会被请求的外部资源）' if not other and not bad else f'需检查 other={other} bad={bad}')
sys.exit(1 if other or bad else 0)
