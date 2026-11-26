#!/bin/sh
# 配合 feedback.swift：盯着输出目录里的 *.req，按里面的窗口号截图（-o 去阴影，只拍这一个窗口）。
# 每张图记下当时真正的前台应用。探针写出 done 后退出；最多等 15 秒。
dir="$1"; end=$(( $(date +%s) + 15 ))
while [ "$(date +%s)" -lt "$end" ]; do
  for req in "$dir"/*.req; do
    [ -e "$req" ] || continue
    num=$(cat "$req"); base="${req%.req}"
    echo "$(basename "$base") front=$(lsappinfo info -only name "$(lsappinfo front)")" >> "$dir/front.log"
    for i in 1 2 3 4 5; do
      screencapture -x -o -t png -l "$num" "$base.png.tmp" 2>>"$dir/shoot.err" && break
      sleep 0.2
    done
    mv "$base.png.tmp" "$base.png" 2>/dev/null || touch "$base.png.failed"
    rm -f "$req"
  done
  [ -e "$dir/done" ] && exit 0
  sleep 0.1
done
