#!/usr/bin/env bash
# 把投稿编辑器（NSH 应用 blog/editor-app）打包成静态页，放进 blog/public/editor-app/，随博客一起构建发布。
# deploy-gh.sh 和本地预览都调这个脚本；nsh 版本要和 NSH_VERSION（.github/workflows/deploy.yml）一致。
set -euo pipefail

# 清掉 CDPATH：设了它时 cd 相对路径会把目录打印出来，混进 ROOT
ROOT="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/blog/editor-app"
OUT="$APP/.nsh/web"
DEST="$ROOT/blog/public/editor-app"

command -v nsh >/dev/null || { echo "没有 nsh：curl -fsSL https://nsh.dev/install.sh | NSH_VERSION=v0.6.0 sh" >&2; exit 1; }

# 测试用的 tests/nsh.json 要和正式的权限一致，否则测试过了、上线却被拒（ERR_ACCESS_DENIED）
caps() { jq -S '.capabilities' "$1"; }
if ! diff <(caps "$APP/nsh.json") <(caps "$APP/tests/nsh.json") >/dev/null; then
  echo "nsh.json 和 tests/nsh.json 的 capabilities 不一致，先改成一样" >&2
  exit 1
fi

rm -rf "$OUT" "$DEST"
# v0.6.0 的 nsh package 不认目录形式的入口，要在应用目录里传 App.tsx
(CDPATH= cd "$APP" && nsh package App.tsx --target web -o "$OUT")
# 输出是 $OUT/<应用名>/ 一个目录；没有产出时 glob 为空，不能当成字面量往下走
shopt -s nullglob
dirs=("$OUT"/*/)
[ "${#dirs[@]}" -eq 1 ] || { echo "nsh package 的输出不是一个目录：${dirs[*]}" >&2; exit 1; }
cp -R "${dirs[0]}" "$DEST"
# GitHub Pages 不认预压缩文件，带上只会让 gh-page 变大
find "$DEST" \( -name '*.br' -o -name '*.gz' \) -delete
echo "editor-app -> $DEST ($(du -sh "$DEST" | cut -f1))"
