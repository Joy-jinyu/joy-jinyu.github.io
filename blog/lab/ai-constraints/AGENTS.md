# UI 规则

这份规则只写 AI 实测里漏掉的事，每条都写成能检查的动作。出处是 UI 审美系列各篇的附录。

## 布局

- 两块看起来该对齐的元素，用同一个公式算宽度，留白也算在里面：例如两块都写
  `width: min(var(--col-w), 100% - 2 * var(--gutter))`，外层不再加左右留白。改完把窗口从最宽拖到最窄，确认边始终重合。
- 只让局部区域滚动时，滚动的那一层和要跟它对齐的每一层都加 `scrollbar-gutter: stable`。
- 藏起来的内容要同时藏掉点击、焦点和读屏：收起时用 `visibility: hidden` 或 `inert`，transform、opacity、height: 0 都不够。

## 动效

- 同一个动画要走不同距离时，时长按距离算，不要共用一个固定值，例如 `clamp(200ms, 160ms + 0.5ms × 高度, 450ms)`；每帧最大位移控制在 60px 以内。
- 动画结束后的收尾（移除节点、设 hidden）等 `transitionend` 或 `animation.finished`，定时器只做兜底。

## 间距

- 文字相关的间距按「看到的」定：从字形的上下边量，不从行盒量。
- 单行的标题、标签、说明，用 `text-box: trim-both cap alphabetic` 裁掉上下的空白，再用 `padding-block: 0.16em 0.12em`
  把汉字冒出去的部分补回来，整段包在 `@supports (text-box: trim-both cap alphabetic)` 里。
- 同一组里看到的间距，不超过组与组之间的一半。

## 排版

- 页面上的上下两级（分组标题和条目标题、标题和说明），除了字号，至少还要在字重、颜色、字距里的一项上不同。
  交付前把所有文字改成同一个字号看一遍，并成一级的上下两级要再拉开一项。
- 来自接口或后台的文案，不指望里面有空格：CSS 里写 `text-autospace: normal`（浏览器默认不开）。

## 风格

- 新页面先确定风格来源：引入团队的变量文件。只写「和现有风格一致」不算来源。
- 变量文件里没有的项，不要自己新定一个值：在交付说明里列出缺了哪几项、页面上哪里用到。
- 两个颜色叠在一起用（文字放在底色上），只用变量文件里标明合格的组合；变量文件没标的组合，先算对比度，不到 4.5:1 不用。

## 状态

- 每个请求都要设超时（fetch 没有默认超时），例如 `AbortSignal.timeout(15000)`；超时按失败处理：
  给出能看懂的提示和重试入口，把按钮上的「……中」和禁用状态恢复过来。
- 一个操作会让当前聚焦的元素消失或被藏起来时（重试、删除、关闭），先把焦点移到下一个合理的位置，再移除元素。

## H5

- 写了 `viewport-fit=cover`，四条边都要处理：贴边的栏和正文同时补上 `env(safe-area-inset-left)` 和
  `env(safe-area-inset-right)`，不能只处理上下。
- 浏览器自查要模拟安全区（CDP 的 `Emulation.setSafeAreaInsetsOverride`），竖屏 393×852（上 59、下 34）和
  横屏 852×393（左右 59、下 21）各查一遍：可点元素不能落进安全区以外。

## 交付前的检查

在浏览器里打开页面，按需要运行这些脚本（贴进 Console，或在 Playwright 里 `page.evaluate` / `addInitScript`），把结果写进交付说明：

- 间距：……/lab/ai-spacing/xray-snippet.js
- 字号层级：……/lab/ai-typography/type-snippet.js
- 实际用色：……/lab/ai-consistency/style-snippet.js
- 接口出错和挂起：……/lab/ai-states/net-snippet.js（要在页面脚本之前注入，才能管到首次加载）
- 安全区和点击区域：……/lab/ai-h5/h5-snippet.js
