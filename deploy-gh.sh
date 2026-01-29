#!/usr/bin/env bash
# 构建并发布到 GitHub Pages（Pages 读取 gh-page 分支根目录）
#   /        -> site/        简历页（静态 HTML，原样拷贝）
#   /notes/  -> notes/       VuePress 1.x 技术笔记（base: '/notes/'）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/public"
REMOTE="git@github.com:Joy-jinyu/joy-jinyu.github.io.git"

cd "$ROOT"
rm -rf "$OUT" notes/.vuepress/dist

# VuePress 1.x 依赖 webpack 4，Node 17+ 需要旧版 OpenSSL 摘要算法
NODE_OPTIONS=--openssl-legacy-provider npx vuepress build notes

mkdir -p "$OUT"
cp -R site/. "$OUT/"
cp -R notes/.vuepress/dist "$OUT/notes"
touch "$OUT/.nojekyll"

cd "$OUT"
git init -q -b gh-page
git add -A
git commit -q -m "deploy: $(git -C "$ROOT" rev-parse --short HEAD)"
git push -f "$REMOTE" gh-page:gh-page
