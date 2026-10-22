#!/usr/bin/env bash
# 构建并发布到 GitHub Pages（Pages 读取 gh-page 分支根目录）
#   /        -> site/        简历页（静态 HTML，原样拷贝）
#   /notes/  -> notes/       Astro Starlight 技术笔记（base: '/notes'）
#   /blog/   -> blog/        Astro + MDX 博客（base: '/blog'）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/public"
REMOTE="git@github.com:Joy-jinyu/joy-jinyu.github.io.git"

cd "$ROOT"
# 一并清掉 Astro 内容缓存：缓存里的页面 HTML 会引用旧的代码块样式文件名（改了 expressiveCode 配置也不失效），发出去就丢样式
rm -rf "$OUT" notes/dist notes/.astro notes/node_modules/.astro blog/dist blog/.astro blog/node_modules/.astro

npx astro build --root notes
npx astro build --root blog

mkdir -p "$OUT"
cp -R site/. "$OUT/"
cp -R notes/dist "$OUT/notes"
cp -R blog/dist "$OUT/blog"
touch "$OUT/.nojekyll"

cd "$OUT"
git init -q -b gh-page
git add -A
git commit -q -m "deploy: $(git -C "$ROOT" rev-parse --short HEAD)"
git push -f "$REMOTE" gh-page:gh-page
