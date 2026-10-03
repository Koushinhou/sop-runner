#!/bin/bash
# 重新构建并运行全部测试
set -e
cd "$(dirname "$0")"
python3 sample/make_sample.py >/dev/null
node build/build.js
python3 tests/scan_offline.py
node tests/e2e.js
python3 tests/verify_export.py
node tests/jstest.js
