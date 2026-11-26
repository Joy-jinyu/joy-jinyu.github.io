#!/bin/sh
# 从 raw/ 里的原始截图（Display P3，2x）重算 data/pixels.json。用法：pixels.sh <编译好的 region>
# 区域（px，左上为原点）：OK 按钮、表格第一行（选中行）、复选框
region="$1"; here=$(CDPATH= cd "$(dirname "$0")" && pwd)
{
  echo '{'
  for f in "$here"/raw/accent-*.png; do
    n=$(basename "$f" .png); n=${n#accent-}
    printf '"%s": {"png": "raw/%s", "okButton": %s, "selectedRow": %s, "checkbox": %s},\n' "$n" "$(basename "$f")" \
      "$("$region" "$f" 244 100 380 140)" "$("$region" "$f" 64 284 696 326)" "$("$region" "$f" 440 106 472 136)"
  done
  printf '"_regions": {"unit": "px（2x 截图，左上为原点）", "okButton": [244,100,380,140], "selectedRow": [64,284,696,326], "checkbox": [440,106,472,136], "tool": "region.swift"}\n'
  echo '}'
} | jq . > "$here/data/pixels.json"
