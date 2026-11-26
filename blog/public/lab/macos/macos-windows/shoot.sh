#!/bin/sh
# 配合 windows.swift：盯着输出目录里的 *.req，按里面的窗口号截图（-o 去阴影，只拍这一个窗口）。
# 全屏那一步另外用 listwin 列出探针进程的所有窗口，写进 fullscreen-windows.txt。
dir="$1"; listwin="$2"
while :; do
  for req in "$dir"/*.req; do
    [ -e "$req" ] || continue
    num=$(cat "$req"); base="${req%.req}"
    echo "$(basename "$base") front=$(lsappinfo info -only name "$(lsappinfo front)")" >> "$dir/front.log"
    case "$base" in *fullscreen-unified*)
      "$listwin" "$(pgrep -n -f WindowsProbe.app)" > "$dir/fullscreen-windows.txt"
      awk '/x=0.0 y=(0|33).0 w=1512/ {print $1}' "$dir/fullscreen-windows.txt" | while read n; do
        screencapture -x -o -t png -l "$n" "$dir/fullscreen-win-$n.png" 2>/dev/null
      done ;;
    esac
    for i in 1 2 3 4 5; do
      screencapture -x -o -t png -l "$num" "$base.png.tmp" 2>/dev/null && break
      sleep 0.3
    done
    mv "$base.png.tmp" "$base.png" 2>/dev/null || touch "$base.png.failed"
    rm -f "$req"
  done
  [ -e "$dir/windows.json" ] && exit 0
  sleep 0.1
done
