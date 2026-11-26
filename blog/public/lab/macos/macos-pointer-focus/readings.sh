#!/bin/zsh
# 从 raw/ 里的原始截图复算读数，写 data/ringdiff.json 和 data/pixels.json。
# 用法：readings.sh <编译好的 ringdiff> <编译好的 probe/pixels>
#   swiftc -O -o ringdiff ringdiff.swift；swiftc -O -o pixels ../probe/pixels.swift
rd="$1"; pix="$2"; here=${0:A:h}
CDPATH= cd "$here/raw" || exit 1
fr() { jq -r ".frames.$1 | \"\(.x) \(.top) \(.w) \(.h)\"" ../data/focus-light.json; }
{
  for m in light dark; do for c in textField searchField pushOK table; do "$rd" $m-none.png $m-focus-$c.png focus:$m:$c $(fr $c); done; done
  for c in pushOK checkbox segmented popUp; do "$rd" controls-none.png controls-focus-$c.png focus:controls:$c $(fr $c); done
  # 工具栏按钮的 frame 取自 focus-light.json 的 trackingAreas（NSToolbarButton）
  tb=$(jq -r '.trackingAreas[] | select(.class=="NSToolbarButton") | .frame | "\(.x) \(.top) \(.w) \(.h)"' ../data/focus-light.json)
  for m in light dark; do
    for c in pushOK pushCancel checkbox recessed; do "$rd" $m-hover-before.png $m-hover-after.png hover:$m:$c $(fr $c); done
    "$rd" $m-hover-before.png $m-hover-after.png hover:${m}:toolbarButton ${=tb}
  done
} | jq -s '.' > ../data/ringdiff.json
at() { "$pix" "$1" at $2 $3 | tail -1 | awk '{print $1}'; }
{
  echo '{"note":"截图像素（Display P3 截图按 sRGB 读，受壁纸着色影响，只作「看起来」的佐证）。坐标 px，2x，原点在窗口左上角。","selectionRow":{"point":"x=200px y=470px（选中行 Drafts 的空白处）"'
  for m in light dark; do for st in tableFocused fieldFocused mainNotKey otherWindowMain; do echo ",\"$m.$st\":{\"file\":\"raw/$m-sel-$st.png\",\"hex\":\"$(at $m-sel-$st.png 200 470)\"}"; done; done
  echo '},"closeButton":{"point":"x=52px y=52px（关闭按钮圆心）"'
  for m in light dark; do for st in tableFocused fieldFocused mainNotKey otherWindowMain; do echo ",\"$m.$st\":{\"file\":\"raw/$m-sel-$st.png\",\"hex\":\"$(at $m-sel-$st.png 52 52)\"}"; done; done
  echo '}}'
} | jq '.' > ../data/pixels.json
