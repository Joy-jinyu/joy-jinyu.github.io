#!/usr/bin/env bash
# 下载 HIG 页面的原始 JSON 并转成纯文本，供核对原文用。原文版权归 Apple，只放本地，不进仓库。
# 用法：fetch-hig.sh <输出目录> <页面 slug>...   例：fetch-hig.sh /tmp/hig windows toolbars
set -u
out=$1; shift; mkdir -p "$out"
here=$(CDPATH= cd "$(dirname "$0")" && pwd)
for p in "$@"; do
  curl -sL -A "Mozilla/5.0" "https://developer.apple.com/tutorials/data/design/human-interface-guidelines/$p.json" -o "$out/$p.json"
  python3 -I "$here/hig-dump.py" "$out/$p.json" > "$out/$p.md" || echo "解析失败：$p"
done
