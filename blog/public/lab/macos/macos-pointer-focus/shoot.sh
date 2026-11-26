#!/bin/sh
# 配合 focus.swift：盯着输出目录里的 *.req，按里面的窗口号截图（-o 去阴影，只拍这一个窗口）。
# req 内容是「窗口号 期望宽px 期望高px」：窗口正在做缩放动画时截出来的图尺寸不对，重拍。
# 用法：shoot.sh <输出目录> <模式>；探针写出 <模式>.done 后退出，最多等 20 秒。
dir="$1"; mode="$2"; n=0
while [ $n -lt 200 ]; do
  for req in "$dir"/*.req; do
    [ -e "$req" ] || continue
    read num ew eh < "$req"; base="${req%.req}"
    echo "$(basename "$base") front=$(lsappinfo info -only name "$(lsappinfo front)")" >> "$dir/front.log"
    for i in 1 2 3 4 5 6 7 8; do
      screencapture -x -o -t png -l "$num" "$base.png.tmp" 2>>"$dir/shoot.err"
      if [ -s "$base.png.tmp" ]; then
        size=$(sips -g pixelWidth -g pixelHeight "$base.png.tmp" | awk '/pixel/ {printf "%s ", $2}')
        [ "$size" = "$ew $eh " ] && break
        echo "$(basename "$base") try $i size $size" >> "$dir/shoot.err"
      fi
      sleep 0.25
    done
    mv "$base.png.tmp" "$base.png" 2>/dev/null || touch "$base.png.failed"
    rm -f "$req"
  done
  [ -e "$dir/$mode.done" ] && exit 0
  sleep 0.05; n=$((n + 1))
done
