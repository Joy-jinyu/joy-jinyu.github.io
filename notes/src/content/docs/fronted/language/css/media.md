---
title: 媒体查询与响应式
description: 讲 @media 语法与常用媒体特性、移动优先与断点策略、viewport meta、相对单位、响应式图片，以及按容器尺寸适配的容器查询。
---

响应式设计的目标是让同一套页面在手机、平板、桌面等不同尺寸和能力的设备上都可用。实现它需要几样工具配合：视口设置让移动端按真实宽度渲染，相对单位和弹性布局让尺寸随环境变化，媒体查询在关键位置切换样式，响应式图片按需加载合适的资源，容器查询让组件按自身所在空间适配。这篇依次讲这些工具及其常见用法。

## viewport meta：一切的前提

移动浏览器出现早期，大量网页只为桌面设计。为了让这些页面能完整显示，移动浏览器默认用一个较宽的虚拟视口（常见约 980px）来布局，再整体缩小显示。这时 `@media (max-width: 600px)` 永远不会命中，因为布局视口宽度并不是手机屏幕宽度。

所以响应式页面必须在 `<head>` 中声明：

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

- `width=device-width`：布局视口宽度等于设备宽度（以 CSS 像素计）。
- `initial-scale=1`：初始不缩放。

:::caution
不要加 `user-scalable=no` 或 `maximum-scale=1` 禁止缩放。视力不好的用户依赖双指放大，禁用缩放是常见的无障碍问题，部分浏览器也会忽略这些设置。
:::

## @media 语法

```css
@media screen and (min-width: 768px) {
  .sidebar { display: block; }
}
```

一条媒体查询由可选的**媒体类型**和若干**媒体特性**组成：

- 媒体类型：`all`（默认）、`screen`、`print`。其他旧类型（`handheld`、`tv` 等）已废弃。
- 媒体特性写在括号里，如 `(min-width: 768px)`。
- 逻辑组合：`and` 表示同时满足；逗号表示"或"；`not` 对整条查询取反。

```css
/* 打印时隐藏导航 */
@media print {
  nav { display: none; }
}

/* 窄屏或者竖屏 */
@media (max-width: 600px), (orientation: portrait) { }
```

### 范围语法

传统的 `min-` / `max-` 前缀写法容易在边界上出错。现在主流浏览器支持更直观的范围语法：

```css
/* 传统写法 */
@media (min-width: 600px) and (max-width: 899.98px) { }

/* 范围语法：含 600、不含 900 */
@media (600px <= width < 900px) { }
```

`min-width: 600px` 等价于 `width >= 600px`，包含边界值。用传统写法时，两个相邻断点如果都包含同一个值（比如一个 `max-width: 600px`，一个 `min-width: 600px`），宽度恰好为 600px 时两组样式会同时生效，所以常见 `599.98px` 这种写法。范围语法可以用 `<` 直接排除边界。

### 在 JS 和 HTML 中使用媒体查询

```js
const mq = window.matchMedia('(min-width: 768px)');
console.log(mq.matches);
mq.addEventListener('change', (e) => {
  console.log(e.matches ? '进入宽屏' : '进入窄屏');
});
```

HTML 中，`<link media="print">` 可以只在匹配时应用样式表（不匹配的样式表仍会下载，只是优先级较低、不阻塞渲染）；`<source media>` 用于响应式图片和视频，见后文。

## 常用媒体特性

| 特性 | 取值 | 用途 |
| --- | --- | --- |
| `width` / `height` | 长度 | 视口宽高，响应式布局的主要依据 |
| `orientation` | `portrait` / `landscape` | 横竖屏 |
| `aspect-ratio` | 比例，如 `16/9` | 视口宽高比 |
| `prefers-color-scheme` | `light` / `dark` | 用户的系统主题偏好 |
| `prefers-reduced-motion` | `no-preference` / `reduce` | 用户是否要求减少动画 |
| `prefers-contrast` | `more` / `less` 等 | 用户是否要求更高或更低的对比度 |
| `hover` | `hover` / `none` | **主要**输入设备能否悬停 |
| `pointer` | `fine` / `coarse` / `none` | **主要**输入设备的精确度 |
| `any-hover` / `any-pointer` | 同上 | **任意一个**可用输入设备满足即可 |
| `resolution` | 如 `2dppx`、`192dpi` | 屏幕像素密度 |

### 暗色模式

```css
:root {
  color-scheme: light dark; /* 告诉浏览器页面支持两种配色，表单控件、滚动条随之变化 */
  --bg: #fff;
  --text: #222;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121212;
    --text: #e6e6e6;
  }
}

body {
  background: var(--bg);
  color: var(--text);
}
```

配合 CSS 变量，切换主题只需要改一组变量的值。如果页面还提供手动切换按钮，通常的做法是在 `<html>` 上加 `data-theme` 属性覆盖这组变量，用户没有选择时才跟随系统。

### 减少动画

部分用户会因为大幅度的动画感到眩晕，系统设置里开启了"减少动态效果"时应当尊重：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

更细致的做法是只移除位移、缩放、视差这类大幅运动，保留透明度渐变等温和的过渡。

### hover 与 pointer

屏幕宽度并不能代表输入方式：大屏平板用手指操作，窄窗口的桌面浏览器用鼠标。判断交互方式应该用 `hover` 和 `pointer`：

```css
/* 只在能悬停的设备上加悬停效果，避免触屏点击后样式"粘住" */
@media (hover: hover) {
  .card:hover { box-shadow: 0 4px 12px rgb(0 0 0 / 0.15); }
}

/* 触屏等粗略指针设备上加大点击区域 */
@media (pointer: coarse) {
  .icon-btn { min-width: 44px; min-height: 44px; }
}
```

`hover` / `pointer` 只看主要输入设备；一台插了鼠标的平板，主要设备可能仍是触屏。需要"只要有任何一个设备能悬停"时用 `any-hover`。

### resolution

```css
.logo { background-image: url(logo.png); }

@media (min-resolution: 2dppx) {
  .logo { background-image: url(logo@2x.png); }
}
```

`dppx` 表示每个 CSS 像素对应几个物理像素，等同于 JS 中的 `devicePixelRatio`。旧代码中常见的 `-webkit-min-device-pixel-ratio` 是非标准写法，现在用 `resolution` 即可。内容图片的多倍图更推荐用后文的 `srcset`；背景图也可以用 `image-set()`。

## 移动优先与断点策略

**移动优先**指先写窄屏下的基础样式，再用 `min-width` 媒体查询逐步为更宽的屏幕增强：

```css
/* 基础：单列 */
.grid { display: grid; gap: 16px; }

@media (min-width: 640px) {
  .grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .grid { grid-template-columns: repeat(4, 1fr); }
}
```

这样做的好处：窄屏的样式通常更简单，作为基础层更不容易被覆盖；增强式的写法比"先写桌面再层层撤销"的 `max-width` 写法覆盖关系更清楚。

断点的选择：

- **按内容定断点，不按设备型号定**。把浏览器窗口从窄拉到宽，哪里排版开始难看（行太长、卡片太挤），就在哪里加断点。设备尺寸每年都在变，围绕具体机型写断点很快就会过时。
- 断点数量保持少量，团队内统一成几个命名档位（比如 sm / md / lg / xl）。CSS 变量不能用在媒体查询条件里，断点值通常借助预处理器变量或工具类框架的配置统一管理。
- 能不用断点就不用：`flex-wrap`、`repeat(auto-fill, minmax(...))`、`clamp()` 这些手段本身就能在一个范围内连续适配，媒体查询只处理结构性变化。
- 媒体查询中的 `em` / `rem` 相对的是浏览器的初始字号，而不是页面根元素设置的字号。用 `em` 写断点时，用户调大浏览器默认字号后断点会随之移动，布局能跟着字号变化。

## 相对单位

| 单位 | 相对于 | 典型用途 |
| --- | --- | --- |
| `%` | 父元素对应的尺寸（具体依属性而定） | 流式宽度 |
| `em` | 当前元素的字号（用在 `font-size` 上时是父元素字号） | 随文字缩放的间距、图标 |
| `rem` | 根元素 `<html>` 的字号 | 全局字号、间距体系 |
| `ch` | 当前字体中"0"的宽度 | 控制文本行宽，如 `max-width: 65ch` |
| `vw` / `vh` | 视口宽 / 高的 1% | 全屏区块 |
| `vmin` / `vmax` | 视口宽高中较小 / 较大者的 1% | |
| `svh` / `lvh` / `dvh` | 小 / 大 / 动态视口高度的 1% | 移动端全屏高度 |

几点说明：

- `em` 会层层叠乘：嵌套三层都设 `font-size: 1.2em`，最里层是 1.728 倍。字号体系用 `rem` 更好控制，组件内部希望随组件字号缩放的间距用 `em`。
- `rem` 跟随用户在浏览器里设置的默认字号，比写死 `px` 更利于无障碍。过去为了换算方便，常把根字号设为 `62.5%`（默认 16px 时等于 10px），或者用 JS 根据屏幕宽度动态设置根字号来做"等比缩放"适配。后者在视口单位普及后已不必要，可以直接用 `vw` 配合 `clamp()`。
- 移动浏览器的地址栏、工具栏会随滚动收起和展开，视口高度因此变化。`100vh` 在不少移动浏览器中按工具栏收起后的"大视口"计算，导致页面打开时底部被遮住。`svh` 按工具栏展开时的小视口计算，`lvh` 按收起时的大视口计算，`dvh` 随工具栏实时变化。全屏首屏通常用 `100svh` 或 `100dvh`；`dvh` 会随滚动变化，可能引起布局跳动，按需选择。

配合 `clamp(最小值, 首选值, 最大值)` 可以做流式字号，不需要断点：

```css
h1 {
  font-size: clamp(1.5rem, 1rem + 2vw, 2.5rem);
}
```

首选值里加上一个 `rem` 部分，是为了让用户放大字号时标题仍然跟着变大；只写 `vw` 的话，浏览器的字号设置对它无效。

## 响应式图片

### srcset 与 sizes：同一张图，不同尺寸

```html
<img
  src="photo-800.jpg"
  srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1600.jpg 1600w"
  sizes="(min-width: 1024px) 50vw, 100vw"
  width="1600"
  height="900"
  alt="山间湖泊"
  loading="lazy"
>
```

- `srcset` 中的 `w` 描述符告诉浏览器每个文件的实际像素宽度。
- `sizes` 告诉浏览器这张图在页面上会显示多宽：宽屏下占视口一半，其余情况占满视口。浏览器在下载图片时还没有完成布局，所以需要这个提示。
- 浏览器根据 `sizes`、设备像素比，以及网络状况等因素，自行挑选最合适的文件。开发者描述条件，选择权在浏览器。
- `src` 是不支持 `srcset` 时的回退。

图片显示尺寸固定、只需要区分屏幕密度时，可以用更简单的 `x` 描述符：

```html
<img src="avatar.png" srcset="avatar.png 1x, avatar@2x.png 2x" width="48" height="48" alt="用户头像">
```

### width、height 与懒加载

- 给 `<img>` 写上 `width` 和 `height` 属性（填图片的固有尺寸），浏览器就能在图片下载前按宽高比预留空间，避免图片加载后内容跳动。配合 CSS 的 `max-width: 100%; height: auto;`，图片仍然可以自适应缩放。
- `loading="lazy"` 让屏幕外的图片延迟加载。首屏的主图不要加，否则会拖慢首屏显示。

### picture：不同场景用不同的图

`<picture>` 解决两类 `srcset` 处理不了的问题：

```html
<!-- 美术设计：窄屏换一张裁切过的竖图 -->
<picture>
  <source media="(max-width: 600px)" srcset="hero-portrait.jpg">
  <img src="hero-landscape.jpg" alt="产品展示" width="1600" height="900">
</picture>

<!-- 格式回退：优先现代格式，不支持时用 JPEG -->
<picture>
  <source type="image/avif" srcset="photo.avif">
  <source type="image/webp" srcset="photo.webp">
  <img src="photo.jpg" alt="风景" width="1200" height="800">
</picture>
```

浏览器按顺序选第一个 `media` 和 `type` 都匹配的 `<source>`，都不匹配时用 `<img>`。`<img>` 必须存在，`alt`、尺寸、`loading` 等属性也写在 `<img>` 上，实际渲染的始终是这个 `<img>` 元素。

| 需求 | 用什么 |
| --- | --- |
| 同一张图，按显示尺寸或屏幕密度选分辨率 | `<img srcset sizes>` |
| 不同屏幕显示内容或裁切不同的图 | `<picture>` + `<source media>` |
| 按浏览器支持情况选图片格式 | `<picture>` + `<source type>` |

## 容器查询

媒体查询看的是视口，但组件真正关心的是"自己被放在多宽的地方"。同一个卡片组件，放在主栏里宽、放在侧栏里窄，用媒体查询无法区分。容器查询解决的就是这个问题：

```css
.card-wrapper {
  container-type: inline-size; /* 声明为查询容器，按行内方向（通常是宽度）查询 */
  container-name: card;        /* 可选，给容器命名 */
}

.card {
  display: grid;
  gap: 12px;
}

@container card (min-width: 400px) {
  .card {
    grid-template-columns: 120px 1fr; /* 容器够宽时改为左图右文 */
  }
}
```

要点：

- 必须先在**祖先元素**上用 `container-type` 声明容器，查询的是最近的匹配容器，元素不能查询自己。
- `container-type: inline-size` 只查询宽度，最常用；`size` 同时查询宽高，但要求容器高度不能由内容决定，否则会形成循环依赖，一般很少用。
- 声明为容器会给该元素加上尺寸隔离（containment），`inline-size` 容器的宽度不能再由其子元素撑开，放在 `inline-block`、浮动等收缩包裹的场景下可能塌成 0。
- 不写名字时 `@container (min-width: 400px)` 匹配最近的容器；嵌套多层容器时用名字指定目标。
- 容器查询单位 `cqw`、`cqi`（容器宽度 / 行内尺寸的 1%）等可以让字号、间距随容器尺寸变化。

```css
.card-title {
  font-size: clamp(1rem, 4cqi, 1.5rem);
}
```

尺寸容器查询已在主流浏览器的较新版本中可用。按容器上 CSS 变量取值进行判断的"样式查询"（`@container style(...)`）支持程度不一，使用前需确认目标浏览器。

分工上可以这样理解：页面整体框架（导航折叠、栏数变化）用媒体查询，可复用组件的内部布局用容器查询，用户偏好（主题、动画、对比度）只能用媒体查询。

## 小结

- 响应式页面必须声明 `width=device-width, initial-scale=1` 的 viewport，且不要禁止缩放。
- `@media` 由媒体类型和媒体特性组成；范围语法 `(600px <= width < 900px)` 能避免边界重叠。
- 除了宽度，还要用 `prefers-color-scheme`、`prefers-reduced-motion` 尊重用户偏好，用 `hover` / `pointer` 而不是屏幕宽度判断交互方式。
- 采用移动优先、按内容定断点；优先用 `rem` 构建尺寸体系，移动端全屏高度用 `svh` / `dvh`，流式字号用 `clamp()`。
- 图片用 `srcset` + `sizes` 让浏览器选分辨率，`<picture>` 处理换图和格式回退，并写上 `width` / `height` 避免布局跳动。
- 组件内部布局用容器查询，在祖先上声明 `container-type: inline-size`，用 `@container` 按容器宽度适配。

## 参考

- [MDN：使用媒体查询](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_media_queries/Using_media_queries)
- [MDN：@media](https://developer.mozilla.org/zh-CN/docs/Web/CSS/@media)
- [MDN：Viewport meta 标签](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Viewport_meta_tag)
- [MDN：CSS 值与单位](https://developer.mozilla.org/zh-CN/docs/Learn/CSS/Building_blocks/Values_and_units)
- [MDN：响应式图片](https://developer.mozilla.org/zh-CN/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images)
- [MDN：CSS 容器查询](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_containment/Container_queries)
