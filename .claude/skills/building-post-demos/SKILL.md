---
name: building-post-demos
description: Use when adding or changing an interactive component in blog/src/components/ for a blog post (演示、demo、交互组件、对比演示、playground), or when a demo looks wrong in light theme, on mobile, or with reduced motion.
---

# 博客交互演示组件

## 核心

演示要讲清楚一件文字讲不清的事，而且它自己必须经得起这个系列的评分卡：讲 UI 细节的文章，演示本身出现细节问题就是事故。

现成的写法参考 `blog/src/components/KeyRoute.astro`（逻辑拆到 `src/lib/`）和 `AiRunCompare.astro`（逻辑写在组件内，用 iframe 加载 `blog/public/lab/` 下的原样文件）。

## 组件的组成

1. **frontmatter 顶部**写一段中文 JSDoc：演示什么、怎么操作。逻辑超过约 80 行就拆到 `blog/src/lib/<name>.ts`。
2. **根元素**是自定义元素，class 带 `not-prose`，例如 `<key-route class="kr not-prose">`。正文的列表、链接、表格样式会通过 `:where(.not-prose *)` 跳过它。
3. **脚本**写在 `<script>` 里，`customElements.define` 前先判断 `customElements.get`，避免重复注册。状态挂在属性上（`aria-pressed`、`aria-expanded`、`data-*`），样式从属性派生。定时器在 `disconnectedCallback` 里清掉。
4. **样式**用 `<style is:global>`，所有 class 加组件前缀（`kr-`、`dc-`）。颜色、线条、缓动只用 `blog/src/styles/global.css` 里的 token：`--line`、`--panel`、`--strong`、`--muted`、`--brand`、`--brand-ink`、`--ease`、`--solid`。在演示内部模拟「别人的界面」时，可以有自己的局部变量，但要同时给深色和浅色两套值。

## 每个演示都要过的清单

| 项 | 做法 |
| --- | --- |
| 两套主题 | 默认是深色，`:root[data-theme="light"]` 是浅色，两种都要截图看 |
| 手机 | `@media (max-width: 640px)` 收紧内边距、改成单列；375px 宽时没有横向滚动 |
| 悬停 | hover 样式包在 `@media (hover: hover)` 里 |
| 按下 | 有 `:active` 态；用了 `-webkit-tap-highlight-color: transparent` 就必须有 `:active` |
| 指针 | 可点的元素写 `cursor: var(--cursor-pointer)` |
| 键盘 | 能用 Tab 到达，焦点可见；开关类按钮用 `aria-pressed` 或 `aria-expanded` |
| 减少动态效果 | `prefers-reduced-motion: reduce` 时把位移、缩放换成淡入淡出，不要整个删掉 |
| 点击区域 | 按钮最小高度 34px 左右，和现有组件保持一致 |
| 状态切换不跳 | 选中、展开时宽高不变，不要因为加了「✓」之类的字符把整行挤动 |
| 数字 | 会变的数字用 `font-variant-numeric: tabular-nums` |
| 文案 | 数字和单位之间用 `&nbsp;`；省略号用 `…` |

## 在浏览器里验证

1. 预览：优先用 `yarn dev:blog`。dev server 起不来时，临时把这篇的 `draft: true` 改成 `false`，执行 `npx astro build --root blog`，**再改回 `true`，并用 `rg -n '^draft' <文件>` 确认已经改回**。站点的 base 是 `/blog`，所以要把 `blog/dist` 复制成 `<scratchpad>/www/blog`，在 `<scratchpad>/www` 里执行 `python3 -m http.server 4399`，再打开 `http://localhost:4399/blog/<文件名>/`。
2. 跑脚本。仓库没装 `playwright-core`，脚本要复制到装了它的目录（例如 scratchpad）里运行，浏览器用本机 Chrome：

   ```bash
   cd <scratchpad>/pw && npm i playwright-core   # 只需要装一次
   cp <仓库>/.claude/skills/building-post-demos/check-demo.mjs . && node check-demo.mjs <页面 URL> <组件选择器> <截图输出目录>
   ```

   脚本会输出状态码、深色 / 浅色 / 375px 截图、横向溢出、减少动态效果下的根元素属性、控制台错误和加载失败的 URL。只起 `blog/` 目录时，`/favicon.png`、`/notes/hero-bg.js` 会 404，这是站点根目录的资源，可以忽略。
3. **逐张看截图。** 脚本通过不等于好看，对齐、折行、挤压这些问题要用眼睛看。
4. 演示里的核心行为（例如数字宽度不变、动画能折返）用 `page.evaluate` 量出数字，写进交稿说明。
