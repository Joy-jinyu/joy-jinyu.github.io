---
title: CSS 核心概念
description: 梳理层叠规则、优先级计算与继承、盒模型、BFC、定位、Flex 与 Grid、层叠上下文与 z-index、CSS 变量和现代选择器。
---

CSS（Cascading Style Sheets，层叠样式表）的大部分"玄学"问题，都能归结到几个核心机制：样式冲突时谁生效（层叠与优先级）、值从哪来（继承）、元素占多大地方（盒模型）、元素放在哪（格式化上下文、定位、Flex/Grid）、谁盖住谁（层叠上下文）。这篇逐个讲清这些机制，读完遇到"样式不生效""z-index 没用""margin 合并了"这类问题时能定位到原因。

## 层叠：样式冲突时谁生效

同一个元素的同一个属性可能被多条规则声明，浏览器按以下顺序逐级比较，前一级分出胜负就不再往后看：

1. **来源与重要性**
2. **层叠层**（`@layer`）
3. **优先级**（特异性）
4. **出现顺序**：后声明的覆盖先声明的

### 来源与重要性

样式有三个来源：浏览器默认样式（user-agent）、用户样式（用户在浏览器里设置的）、作者样式（开发者写的）。加上 `!important` 后顺序会反转，从低到高：

| 优先级 | 来源 |
| --- | --- |
| 1（最低） | 浏览器默认样式 |
| 2 | 用户样式 |
| 3 | 作者样式 |
| 4 | CSS 动画（`@keyframes`） |
| 5 | 作者样式中的 `!important` |
| 6 | 用户样式中的 `!important` |
| 7 | 浏览器默认样式中的 `!important` |
| 8（最高） | CSS 过渡（`transition`） |

反转的设计是为了让用户的 `!important`（比如无障碍需要的大字号）能压过网页作者。日常开发中只需记住：`!important` 胜过普通声明，两条都带 `!important` 时再按后面的规则比较。

### 层叠层

`@layer` 允许把样式分组并显式声明层的顺序，层的顺序比优先级更先比较：

```css
@layer reset, base, components;

@layer reset {
  button { padding: 0; }
}
@layer components {
  .btn { padding: 8px 16px; }
}
```

后声明的层胜出，与选择器优先级无关；没有放进任何层的样式比所有层都优先。这让第三方样式、重置样式可以放进低优先级的层，业务代码不必靠堆叠选择器去覆盖它们。（`!important` 的层顺序是反过来的，这里不展开。）

## 优先级（特异性）计算

优先级是一个三元组 `(A, B, C)`，从左往右逐位比较，高位大就胜出，不会进位：

| 位 | 计数 |
| --- | --- |
| A | ID 选择器 `#id` |
| B | 类 `.cls`、属性选择器 `[type="text"]`、伪类 `:hover` |
| C | 元素选择器 `div`、伪元素 `::before` |

不计入优先级的：通用选择器 `*`、组合符（空格、`>`、`+`、`~`）、`:where()`。

| 选择器 | 优先级 |
| --- | --- |
| `*` | (0, 0, 0) |
| `li` | (0, 0, 1) |
| `ul li::before` | (0, 0, 3) |
| `.nav a:hover` | (0, 2, 1) |
| `input[type="text"]` | (0, 1, 1) |
| `#app .item` | (1, 1, 0) |
| `:is(#a, .b) p` | (1, 0, 1) |
| `:where(#a, .b) p` | (0, 0, 1) |

几条规则：

- 一个 ID 胜过任意多个类，因为是逐位比较而不是加总。
- 选择器列表 `a, .b` 不是一个选择器，每一项单独计算，各自匹配各自的元素。
- `:is()`、`:not()`、`:has()` 本身不计数，取参数里优先级**最高**的那一项；`:where()` 恒为 0。
- 行内 `style` 属性的优先级高于任何选择器；`!important` 又能压过行内样式。

:::tip
覆盖样式时优先调整层叠层或结构，而不是叠加选择器、加 ID 或 `!important`，否则会陷入"越写越长"的优先级竞赛。
:::

## 继承

没有被任何规则声明的属性，取值来源分两种：

- **可继承属性**取父元素的计算值。主要是文字相关的：`color`、`font-*`、`line-height`、`text-align`、`letter-spacing`、`white-space`、`visibility`、`cursor`、`list-style` 等。
- **不可继承属性**取初始值。主要是盒子和布局相关的：`width`/`height`、`margin`、`padding`、`border`、`background`、`position`、`display`、`overflow`、`z-index` 等。

这样设计是合理的：给 `<body>` 设置字体，整页文字都跟着变；但给容器设置边框，不应该让每个子元素都带上边框。

可以用全局关键字显式控制，所有属性都支持：

| 关键字 | 含义 |
| --- | --- |
| `inherit` | 强制取父元素的值 |
| `initial` | 取规范定义的初始值（不是浏览器默认样式） |
| `unset` | 可继承属性等于 `inherit`，否则等于 `initial` |
| `revert` | 回退到浏览器默认样式（或用户样式） |
| `revert-layer` | 回退到上一个层叠层的值 |

`initial` 常被误解：`display` 的初始值是 `inline`，所以给 `<div>` 写 `display: initial` 得到的是行内元素，而不是块级。想恢复浏览器默认表现应该用 `revert`。

## 盒模型与 box-sizing

每个元素都生成一个矩形盒子，从内到外依次是内容（content）、内边距（padding）、边框（border）、外边距（margin）。

`box-sizing` 决定 `width` / `height` 指的是哪一层：

| 值 | `width` 包含 | 元素实际占用宽度 |
| --- | --- | --- |
| `content-box`（默认） | 只有内容 | width + padding + border |
| `border-box` | 内容 + padding + border | width |

```css
.box {
  width: 200px;
  padding: 20px;
  border: 1px solid;
}
/* content-box：实际占 242px；border-box：实际占 200px，内容区 158px */
```

`border-box` 更符合直觉，现在几乎所有项目都会全局设置：

```css
*, *::before, *::after {
  box-sizing: border-box;
}
```

### 外边距合并

普通文档流中，块级元素垂直方向相邻的外边距会合并（collapse），取较大值而不是相加：

- 相邻兄弟：上面元素的 `margin-bottom` 和下面元素的 `margin-top` 合并。
- 父子：父元素没有边框、内边距、行内内容或 BFC 隔开时，第一个子元素的 `margin-top` 会"穿透"到父元素外面。
- 空块：自身的上下外边距合并。

水平方向的外边距、Flex 和 Grid 子项的外边距都不会合并。

## BFC：块级格式化上下文

BFC（Block Formatting Context）是一块独立的布局区域：里面的元素怎么排布不影响外面，外面也不影响里面。

**以下情况会创建新的 BFC**（常见的几种）：

- 根元素 `<html>`
- 浮动元素（`float` 不为 `none`）
- 绝对定位元素（`position: absolute` 或 `fixed`）
- `display: inline-block`、`table-cell`、`flow-root`
- `overflow` 不为 `visible` 和 `clip` 的块元素
- Flex 和 Grid 容器的直接子项

**BFC 的效果**：

1. **包含内部浮动**：计算高度时会把浮动子元素算进去，解决"子元素浮动后父元素高度塌陷"。
2. **阻止与子元素的外边距合并**：BFC 容器和它的子元素之间不发生 margin 穿透。
3. **不与浮动元素重叠**：BFC 区域不会和旁边的浮动元素重叠，可用于两栏布局。

过去常用 `overflow: hidden` 创建 BFC，但它会裁剪溢出内容。现在有专门的写法，没有副作用：

```css
.container {
  display: flow-root;
}
```

浮动布局如今已基本被 Flex 和 Grid 取代，BFC 更多出现在解释"为什么外边距没合并""为什么高度包住了浮动"这类问题时。

## 定位方式

| `position` | 是否脱离文档流 | 偏移参照 |
| --- | --- | --- |
| `static`（默认） | 否 | 不响应 `top`/`left` 等 |
| `relative` | 否，原位置保留 | 自身原来的位置 |
| `absolute` | 是 | 最近的非 `static` 定位祖先（包含块） |
| `fixed` | 是 | 视口 |
| `sticky` | 否 | 滚动到阈值前像 `relative`，之后"粘"在最近的滚动容器上 |

几个常见坑：

- `absolute` 找的是最近的定位祖先；没有就相对初始包含块（大致是首屏视口大小的区域）。常见写法是父元素 `position: relative`、子元素 `position: absolute`。
- 祖先元素设置了 `transform`、`filter`、`perspective` 等属性时，会成为 `fixed` 和 `absolute` 后代的包含块。这时 `fixed` 元素不再相对视口定位，弹窗"跟着容器跑"多半是这个原因。
- `sticky` 需要设置 `top` 等阈值才生效；它相对最近的滚动容器粘住。祖先设置 `overflow: hidden`（或 `auto`、`scroll`）后会成为它的滚动容器，如果这个祖先本身并不滚动，sticky 看起来就像失效了；只想裁剪溢出内容时可以改用 `overflow: clip`，它不会产生滚动容器；粘住的范围也不会超出父元素。

## Flex 布局要点

Flex 是一维布局：沿一条主轴排列子项，再处理交叉轴的对齐。

```css
.row {
  display: flex;
  justify-content: space-between; /* 主轴对齐 */
  align-items: center;            /* 交叉轴对齐 */
  gap: 12px;                      /* 子项间距 */
}
```

容器上的常用属性：`flex-direction`（主轴方向）、`flex-wrap`（是否换行）、`justify-content`、`align-items`、`align-content`（多行时行的分布）、`gap`。

子项上最关键的是 `flex` 简写，它是 `flex-grow`、`flex-shrink`、`flex-basis` 的组合：

| 写法 | 等价于 | 效果 |
| --- | --- | --- |
| `flex: 1` | `1 1 0%` | 基准尺寸从 0 起算，按比例平分空间（受下面的 `min-width` 陷阱影响） |
| `flex: auto` | `1 1 auto` | 在内容宽度基础上分配剩余空间 |
| `flex: none` | `0 0 auto` | 不伸不缩，保持内容宽度 |
| `flex: 0 0 200px` | | 固定 200px |

一个高频坑：Flex 子项的 `min-width` 默认值是 `auto`，即不会收缩到比内容更窄。子项里有长文本或长单词时，即使写了 `flex: 1` 也会把容器撑破，文本省略号也不生效。解决方式是给子项加 `min-width: 0`（纵向主轴对应 `min-height: 0`）。

## Grid 布局要点

Grid 是二维布局：同时定义行和列，子项放进网格单元。

```css
.layout {
  display: grid;
  grid-template-columns: 200px 1fr;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header header"
    "aside  main"
    "footer footer";
  gap: 16px;
  min-height: 100vh;
}
.header { grid-area: header; }
.aside  { grid-area: aside; }
.main   { grid-area: main; }
.footer { grid-area: footer; }
```

- `fr` 表示剩余空间的份数，`1fr 2fr` 按 1:2 分配。
- `repeat(auto-fill, minmax(200px, 1fr))` 能在不写媒体查询的情况下实现自适应列数的卡片网格：每列至少 200px，放不下就换行。`auto-fit` 和 `auto-fill` 的区别在于项目较少时，`auto-fit` 会把空列折叠掉、让现有项目拉伸占满。
- 子项可以用 `grid-column: 1 / 3` 或 `grid-column: span 2` 跨列。
- `subgrid` 让嵌套网格沿用父网格的轨道，适合需要跨卡片对齐内容的场景。

选择原则：沿一个方向排列、尺寸由内容决定，用 Flex；需要行列同时对齐的整体布局，用 Grid。两者经常嵌套使用。

## 层叠上下文与 z-index

`z-index` 只在同一个**层叠上下文**里比较。每个层叠上下文是一个整体，内部元素的 `z-index` 再大，也越不过父级上下文在外层的位置。

**以下情况会创建层叠上下文**（常见的几种）：

- 根元素 `<html>`
- `position` 为 `relative` / `absolute` 且 `z-index` 不为 `auto`
- `position: fixed` 或 `sticky`
- Flex、Grid 子项且 `z-index` 不为 `auto`
- `opacity` 小于 1
- `transform`、`filter`、`perspective`、`clip-path`、`mask` 不为 `none`
- `isolation: isolate`
- `will-change` 指定了上述属性
- `mix-blend-mode` 不为 `normal`

一个典型问题：

```html
<div class="card" style="transform: translateZ(0)">
  <div class="dropdown" style="position: absolute; z-index: 9999">下拉框</div>
</div>
<div class="next-card" style="position: relative; z-index: 1">下一张卡片</div>
```

`.card` 因为 `transform` 创建了层叠上下文，且自身 `z-index` 相当于 0，于是整个 `.card`（包括里面的下拉框）都排在 `z-index: 1` 的 `.next-card` 下面，下拉框写 9999 也没用。解决方法是去掉父级创建上下文的属性、提高父级的层级，或把下拉框挂到 `<body>` 下（Portal）。

同一层叠上下文内，从下到上的绘制顺序大致是：上下文根的背景和边框 → `z-index` 为负的定位元素 → 普通块级元素 → 浮动元素 → 行内内容 → `z-index: auto` 或 `0` 的定位元素 → `z-index` 为正的定位元素。

`isolation: isolate` 是专门用来创建层叠上下文且没有其他副作用的属性，适合给组件根节点加上，把组件内部的 `z-index` 关在组件里面。

## CSS 变量

CSS 自定义属性以 `--` 开头，用 `var()` 读取：

```css
:root {
  --color-primary: #1677ff;
  --space: 8px;
}

.btn {
  color: var(--color-primary);
  padding: var(--space) calc(var(--space) * 2);
  border-color: var(--btn-border, currentColor); /* 第二个参数是回退值 */
}

.dark {
  --color-primary: #4096ff; /* 在子树里重新赋值，局部生效 */
}
```

它和 Sass 等预处理器变量的根本区别：

| 方面 | CSS 变量 | 预处理器变量 |
| --- | --- | --- |
| 生效时机 | 运行时，浏览器计算样式时解析 | 编译时替换成固定值 |
| 作用域 | 跟随 DOM 树，可继承，可在子树内覆盖 | 跟随源码的词法作用域 |
| 能否被 JS 修改 | 能：`el.style.setProperty('--x', '1')` | 不能 |
| 能否用于媒体查询条件 | 不能 | 能 |

所以主题切换、暗色模式这类"运行时改一批值"的需求适合用 CSS 变量。变量值引用无效时，属性会变成"计算时无效"，表现为取继承值或初始值，而不是回退到前一条声明，这点和普通的无效声明不同。

需要给变量指定类型（比如让渐变颜色可以过渡动画）时，可以用 `@property` 注册：

```css
@property --angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}
```

## 现代选择器：:is、:where、:has

```css
/* :is() 合并重复的选择器前缀 */
:is(header, footer) a:hover { color: red; }
/* 等价于 header a:hover, footer a:hover */

/* :where() 写法相同，但优先级恒为 0，适合写可被轻松覆盖的默认样式 */
:where(ul, ol) { padding-left: 1.5em; }

/* :has() 根据后代或后续兄弟选中元素，常被称为"父选择器" */
.card:has(img) { padding: 0; }
label:has(+ input:invalid) { color: red; }
form:has(:invalid) button[type="submit"] { opacity: 0.5; }
```

| 选择器 | 优先级 | 参数中有无效选择器时 |
| --- | --- | --- |
| `:is()` | 取参数中最高者 | 忽略无效项，其余照常匹配 |
| `:where()` | 恒为 0 | 忽略无效项，其余照常匹配 |
| `:has()` | 取参数中最高者 | 整条规则失效 |

`:has()` 让很多过去必须用 JS 切换类名的场景变成纯 CSS。这几个选择器在主流浏览器的较新版本中都已可用，需要兼容旧浏览器时要先确认目标环境。此外，CSS 现在也原生支持类似 Sass 的嵌套写法（`.card { & .title {} }`）。

## 小结

- 层叠比较顺序：来源与 `!important` → 层叠层 → 优先级 → 出现顺序；优先级按 (ID, 类/属性/伪类, 元素/伪元素) 逐位比较。
- 文字相关属性默认继承，盒子与布局属性不继承；`initial` 是规范初始值，恢复浏览器默认用 `revert`。
- 全局使用 `box-sizing: border-box`；垂直外边距会合并，BFC 可以隔断合并、包含浮动，创建 BFC 推荐 `display: flow-root`。
- `absolute` 参照最近定位祖先，`transform` 等属性会改变 `fixed` 的参照；Flex 子项溢出时检查 `min-width: 0`。
- `z-index` 只在同一层叠上下文内比较，`opacity`、`transform` 等都会创建上下文；组件根节点可用 `isolation: isolate` 隔离。
- CSS 变量在运行时解析、沿 DOM 继承，适合主题切换；`:is` / `:where` / `:has` 分别用于合并选择器、零优先级默认样式和"父选择器"。

## 参考

- [MDN：层叠与继承](https://developer.mozilla.org/zh-CN/docs/Learn/CSS/Building_blocks/Cascade_and_inheritance)
- [MDN：优先级](https://developer.mozilla.org/zh-CN/docs/Web/CSS/Specificity)
- [MDN：@layer](https://developer.mozilla.org/zh-CN/docs/Web/CSS/@layer)
- [MDN：区块格式化上下文](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_display/Block_formatting_context)
- [MDN：层叠上下文](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context)
- [MDN：使用 CSS 自定义属性（变量）](https://developer.mozilla.org/zh-CN/docs/Web/CSS/Using_CSS_custom_properties)
- [MDN：:has()](https://developer.mozilla.org/zh-CN/docs/Web/CSS/:has)
