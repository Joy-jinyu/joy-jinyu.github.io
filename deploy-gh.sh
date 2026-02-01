#!/usr/bin/env bash
# 构建并发布到 GitHub Pages（Pages 读取 gh-page 分支根目录）
#   /        -> site/        简历页（静态 HTML，原样拷贝）
#   /notes/  -> notes/       Astro Starlight 技术笔记（base: '/notes'）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/public"
REMOTE="git@github.com:Joy-jinyu/joy-jinyu.github.io.git"

cd "$ROOT"
rm -rf "$OUT" notes/dist

npx astro build --root notes

mkdir -p "$OUT"
cp -R site/. "$OUT/"
cp -R notes/dist "$OUT/notes"
touch "$OUT/.nojekyll"

cd "$OUT"
git init -q -b gh-page
git add -A
git commit -q -m "deploy: $(git -C "$ROOT" rev-parse --short HEAD)"
git push -f "$REMOTE" gh-page:gh-page
