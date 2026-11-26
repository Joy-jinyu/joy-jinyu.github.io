#!/bin/sh
# 配合 typecolor active：.app 没有录屏权限，由终端里的这个脚本代拍。
# 用法：shoot.sh <App 路径> <输出目录> <标签> [light|dark] [启动参数…]，整个脚本要包在 lockf 里跑。
app="$1"; dir="$2"; tag="$3"; shift 3
open -n "$app" --args active "$dir" "$tag" "$@"
i=0
while [ ! -e "$dir/$tag.json" ] && [ $i -lt 120 ]; do
  for req in "$dir"/"$tag"-*.req; do
    [ -e "$req" ] || continue
    base="${req%.req}"
    echo "$(basename "$base") front=$(lsappinfo info -only name "$(lsappinfo front)")" >> "$dir/front.log"
    screencapture -x -o -t png -l "$(cat "$req")" "$base.png.tmp" && mv "$base.png.tmp" "$base.png"
    rm -f "$req"
  done
  sleep 0.1; i=$((i + 1))
done
