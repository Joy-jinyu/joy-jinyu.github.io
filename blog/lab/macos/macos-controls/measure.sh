#!/bin/sh
# 从仓库里的 raw/*.png 和 data/controls-*.json 复算全部像素读数，写到 data/pixels.json。
# 用法：measure.sh <analyze 可执行文件>（swiftc -O -o analyze analyze.swift）
set -u
here=$(CDPATH= cd "$(dirname "$0")" && pwd); an=$1; raw=$here/raw; d=$here/data
tmp=$(mktemp -d)
F1='with_entries(select((.key|test("^(push|default|cancel|destructive|popUp|pullDown|segmented|help)[.]")) or ((.key|contains("."))|not)))'
F2='with_entries(select((.key|test("^(checkbox|radio|switch|slider|stepper)[.]")) or ((.key|contains("."))|not)))'
F3='with_entries(select((.key|test("^(textField|search|comboBox)[.]")) or ((.key|contains("."))|not)))'
F4='with_entries(select((.key|test("^(default|segmented)[.]")) or ((.key|contains("."))|not)))'
for m in light dark; do
  "$an" "$raw/buttons-$m.png" "$d/controls-$m.json" gallery | jq "$F1" > "$tmp/buttons-$m.json"
  "$an" "$raw/inputs-$m.png" "$d/controls-$m.json" gallery | jq "$F2" > "$tmp/inputs-$m.json"
  "$an" "$raw/inputs-$m.png" "$d/controls-$m.json" gallery 4 | jq "$F3" > "$tmp/fields-$m.json"
done
"$an" "$raw/swiftui-light.png" "$d/controls-light.json" swiftui 4 > "$tmp/swiftui-light.json"
"$an" "$raw/buttons-light-inactive.png" "$d/controls-inactive.json" gallery | jq "$F4" > "$tmp/buttons-light-inactive.json"
"$an" "$raw/buttons-dark-inactive.png" "$d/controls-inactive.json" gallery | jq "$F4" > "$tmp/buttons-dark-inactive.json"
# 圆角读数对阈值的敏感度：同一张图、同一个按钮，换阈值重算（push 各档，浅色活动窗口）
for t in 4 8 12 16; do
  "$an" "$raw/buttons-light.png" "$d/controls-light.json" gallery $t | jq --arg t "$t" '{("th" + $t): {mini: .["push.mini"].cornerRadiusFit, small: .["push.small"].cornerRadiusFit, regular: .["push.regular"].cornerRadiusFit}}'
done | jq -s 'add' > "$tmp/radius.json"
# 表单：标签墨迹、文本框描边、按钮外框（窗口坐标，pt，左下原点；窗口高 332）
f=$raw/form-light.png
{
  printf '{"image":"raw/form-light.png","nameLabelInk":'; "$an" "$f" box 332 20 258 55 22 60
  printf ',"nameFieldOutline":'; "$an" "$f" box 332 74 252 10 30 4
  printf ',"emailFieldOutline":'; "$an" "$f" box 332 74 222 10 32 4
  printf ',"formatLabelInk":'; "$an" "$f" box 332 20 198 55 20 60
  printf ',"formatPopUpTextInk":'; "$an" "$f" box 332 80 198 40 20 60
  printf ',"cancelBezel":'; "$an" "$f" box 332 255 25 75 32 8
  printf ',"exportBezel":'; "$an" "$f" box 332 330 25 75 32 8
  printf '}'
} > "$tmp/form-light.json"
jq -n --slurpfile bl "$tmp/buttons-light.json" --slurpfile bd "$tmp/buttons-dark.json" --slurpfile il "$tmp/inputs-light.json" --slurpfile id "$tmp/inputs-dark.json" \
  --slurpfile fl "$tmp/fields-light.json" --slurpfile fd "$tmp/fields-dark.json" --slurpfile sw "$tmp/swiftui-light.json" \
  --slurpfile bli "$tmp/buttons-light-inactive.json" --slurpfile bdi "$tmp/buttons-dark-inactive.json" --slurpfile fo "$tmp/form-light.json" \
  --slurpfile rs "$tmp/radius.json" \
  '{radiusSensitivity: ($rs[0] + {image: "raw/buttons-light.png", note: "同一按钮换阈值重算的 cornerRadiusFit"}), buttons: {light: $bl[0], dark: $bd[0], lightInactive: $bli[0], darkInactive: $bdi[0]}, inputs: {light: $il[0], dark: $id[0]}, fields: {light: $fl[0], dark: $fd[0]}, swiftui: {light: $sw[0]}, form: {light: $fo[0]}}' > "$d/pixels.json"
rm -rf "$tmp"
echo "写好 $d/pixels.json"
