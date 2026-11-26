#!/bin/sh
# 配合 controls.swift：盯着输出目录里的 *.req，按里面的窗口号截图（-o 去阴影，只拍这一个窗口），并记下当时的前台应用。
dir="$1"; mode="$2"
while :; do
  for req in "$dir"/*.req; do
    [ -e "$req" ] || continue
    num=$(cat "$req"); base="${req%.req}"
    echo "$(basename "$base") front=$(lsappinfo info -only name "$(lsappinfo front)")" >> "$dir/front-$mode.log"
    screencapture -x -o -t png -l "$num" "$base.png.tmp" 2>/dev/null && mv "$base.png.tmp" "$base.png" || touch "$base.png.failed"
    rm -f "$req"
  done
  [ -e "$dir/controls-$mode.json" ] && exit 0
  sleep 0.05
done
