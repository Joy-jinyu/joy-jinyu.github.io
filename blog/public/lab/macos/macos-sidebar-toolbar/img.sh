#!/bin/sh
# 把 sidebar 探针的截图裁成文中的插图：裁剪（pt，×2 成 px）→ 转 sRGB → webp。
# 用法：img.sh <crop 可执行文件（crop.swift 编译）>。截图读本目录的 raw/，插图写进 img/。
crop="$1"; src="$(dirname "$0")/raw"; out="$(dirname "$0")/img"; tmp=$(mktemp -d)
srgb="/System/Library/ColorSync/Profiles/sRGB Profile.icc"
# 名字 源文件 x y w h（pt）；w 为 0 表示整张图不裁
while read name file x y w h; do
  [ -z "$name" ] && continue
  if [ "$w" = 0 ]; then cp "$src/$file.png" "$tmp/c.png"
  else "$crop" "$src/$file.png" $((x * 2)) $((y * 2)) $((w * 2)) $((h * 2)) "$tmp/c.png"; fi
  sips -m "$srgb" "$tmp/c.png" --out "$tmp/s.png" >/dev/null
  cwebp -quiet -q 90 "$tmp/s.png" -o "$out/$name.webp"
  echo "$name $(sips -g pixelWidth -g pixelHeight "$tmp/s.png" | awk '/pixel/ {printf "%s ", $2}')"
done <<'EOF'
hero-light hero-light-key 0 0 720 160
hero-dark hero-dark-key 0 0 720 160
side-key-light main-light-key 0 0 150 330
side-unfocused-light main-light-tablefocus 0 0 150 330
side-inactive-light main-light-inactive 0 0 150 330
side-key-dark main-dark-key 0 0 150 330
side-unfocused-dark main-dark-tablefocus 0 0 150 330
side-inactive-dark main-dark-inactive 0 0 150 330
rows-small rowsize-small-light 0 40 150 230
rows-medium rowsize-medium-light 0 40 150 230
rows-large rowsize-large-light 0 40 150 230
toolbar-wide main-light-key 148 0 712 60
toolbar-wide-dark main-dark-key 148 0 712 60
toolbar-narrow main-light-narrow 148 0 372 60
table-inset-light tables-light-key 320 40 312 155
table-inset-dark tables-dark-key 320 40 312 155
EOF
rm -rf "$tmp"
