#!/bin/sh
# 从仓库里的 raw/ 截图复算 data/pixels.json 的全部读数。
# 用法：read-pixels.sh <edge 可执行文件（edge.swift 编译）> <pixels 可执行文件（probe/pixels.swift 编译）>
# 输出就是 data/pixels-readings.txt。截图 2x，1 pt = 2 px。
E="$1"; P="$2"; R="$(dirname "$0")/raw"
echo "== 侧边栏玻璃：左上角（白色描边逐行起点）、左边和顶边"
"$E" "$R/main-light-key.png" find 0 10 120 90 '#FFFFFF' 1
"$P" "$R/main-light-key.png" scan y 400 0 40
"$P" "$R/main-light-key.png" scan x 200 0 40
echo "== 选中条（中号）：左上角、竖直范围、水平范围"
"$E" "$R/main-light-key.png" 30 200 200 240 40
"$P" "$R/main-light-key.png" scan x 150 195 280
"$P" "$R/main-light-key.png" scan y 220 20 300
echo "== 侧边栏选中条颜色（at 250 212）和选中行前景（at 103 238）"
for f in main-light-key main-light-tablefocus main-light-inactive main-dark-key main-dark-tablefocus main-dark-inactive; do
  echo "$f pill=$("$E" "$R/$f.png" at 250 212) fg=$("$E" "$R/$f.png" at 103 238)"
done
echo "== 没选中的侧边栏图标（Inbox 行）"
for f in main-light-key main-dark-key; do echo "$f"; "$P" "$R/$f.png" scan y 174 100 150; done
echo "== 表格颜色"
for f in tables-light-key tables-dark-key; do
  echo "$f fullWidth row1=$("$E" "$R/$f.png" at 300 165) row2=$("$E" "$R/$f.png" at 300 212) selUnfocused=$("$E" "$R/$f.png" at 300 260) inset selFocused=$("$E" "$R/$f.png" at 930 270)"
done
echo "== inset 选中块的左右边"
"$P" "$R/tables-light-key.png" scan y 260 640 660
"$P" "$R/tables-light-key.png" scan y 260 1255 1265
