---
title: 浏览器兼容性问题汇总
description: 整理 IE 与旧版 Edge 的历史兼容问题、仍然常见的 Safari / iOS WebKit 问题，以及用 Can I Use、browserslist、Babel、PostCSS、特性检测和 polyfill 处理兼容性的方法。
---

浏览器兼容性问题的重心这些年变化很大：IE 和旧版 Edge 已经退出历史舞台，桌面端的 Chromium 系浏览器和 Firefox 对标准的实现越来越一致，现在最常遇到的差异集中在 Safari，尤其是 iOS 上的 WebKit。这篇先简要记录 IE、旧版 Edge 的历史问题，再详细整理 Safari / iOS 的常见问题，最后讲系统性处理兼容性的方法。

## 历史问题：IE 与旧版 Edge

### 背景

- **IE**：微软已于 2022 年 6 月停止对大多数 Windows 版本上 IE 11 桌面应用的支持，访问时会被引导到 Edge。新项目不需要再兼容 IE；仍需支持 IE 的通常是只在特定内网环境运行的旧系统。
- **旧版 Edge**：最初的 Edge 使用微软自己的 EdgeHTML 内核。2020 年起微软发布了基于 Chromium 的新版 Edge 并逐步替换，旧版 Edge 已于 2021 年停止支持。现在说的 Edge，渲染行为与 Chrome 基本一致。

下面这些条目只作为历史记录，帮助理解老代码里的兼容写法，以及在维护旧系统时排查问题。

### IE 中 flex 布局表现不一致

IE 10/11 对 Flexbox 的实现早于规范定稿，有不少已知缺陷，常见的两类：

- **`flex` 简写解析不同**：`flex: 1` 中省略的 `flex-basis` 在 IE 中的解析结果与规范不一致，导致子项尺寸和现代浏览器不同。当时的做法是写全三个值，例如 `flex: 1 1 0%` 或 `flex: 1 1 auto`，不依赖简写的默认展开。
- **`min-height` 容器中子项无法撑开或居中**：给 flex 容器设置 `min-height` 而不设置 `height` 时，IE 11 中子项的对齐和伸展不按 `min-height` 计算。常见的绕过方式是在外层再包一层 flex 容器（`display: flex; flex-direction: column;`）。

### IE 中用 ActiveXObject 操作本地文件

老系统里能看到 `new ActiveXObject('Scripting.FileSystemObject')` 这样的代码，用来在 IE 中读写本地文件。它只在 IE 中、并且需要降低安全设置才能运行，属于 IE 专有能力。

现代浏览器出于安全原因不允许网页随意访问本地文件系统，替代方案：

- 读取用户选择的文件：`<input type="file">` 配合 `File` / `FileReader`，或 `file.text()`、`file.arrayBuffer()`。
- 让用户保存文件：生成 `Blob` 后通过带 `download` 属性的链接下载（见下一条）。
- 需要持续读写某个目录时，部分 Chromium 系浏览器支持 File System Access API（`showOpenFilePicker` 等），使用前要做特性检测，Safari 和 Firefox 不支持其中的文件选择器方法。

### IE / 旧版 Edge 无法通过 Blob URL 下载文件

**现象**：用 `URL.createObjectURL(blob)` 生成链接并设置 `download` 属性，在 IE 和旧版 Edge 中点击后不会下载。

**当时的做法**：使用微软私有的 `navigator.msSaveOrOpenBlob`：

```js
if ('msSaveOrOpenBlob' in navigator) {
  navigator.msSaveOrOpenBlob(blob, filename); // 仅 IE 10+ / 旧版 Edge
}
```

**现在的写法**：所有现代浏览器都支持 `download` 属性，直接使用即可，用完记得释放 URL：

```js
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

注意 `download` 属性只对同源链接或 `blob:`、`data:` URL 生效，跨域链接会被当作普通跳转。

### 旧版 Edge 无法访问本机地址

**现象**：在 Windows 10 上，旧版 Edge 访问本地启动的开发服务器失败。

**原因**：旧版 Edge 是 UWP 应用，UWP 应用默认受网络隔离限制，不能访问本机回环地址。

**当时的做法**：以管理员身份运行命令，为旧版 Edge 添加回环豁免：

```bash
CheckNetIsolation LoopbackExempt -a -n=Microsoft.MicrosoftEdge_8wekyb3d8bbwe
```

基于 Chromium 的新版 Edge 是普通桌面应用，不存在这个问题。

## Safari 与 iOS WebKit 的常见问题

iOS 上的浏览器（包括 iOS 版 Chrome、Firefox）长期以来都必须使用系统的 WebKit 内核（近年仅在欧盟地区有所放开），App 里的 WebView 也是 WebKit，所以下面的问题在 iOS 上基本是普遍存在的。

### 100vh 比可视区域高

**现象**：移动端页面设置 `height: 100vh`，在 iOS Safari 中底部内容被浏览器工具栏挡住，或者页面出现多余的滚动。

**原因**：移动浏览器的地址栏、工具栏会随滚动收起和展开，可视区域高度是变化的。`vh` 按工具栏收起时的最大视口高度计算，工具栏展开时，`100vh` 就比实际可见区域高。

**解决**：使用 CSS 新增的动态视口单位：

| 单位 | 含义 |
| --- | --- |
| `svh` | 小视口高度：工具栏展开时的可视高度，始终不会被遮挡 |
| `lvh` | 大视口高度：工具栏收起时的可视高度，相当于移动端的 `vh` |
| `dvh` | 动态视口高度：随工具栏展开收起实时变化 |

```css
.full-screen {
  height: 100vh;  /* 不支持新单位的浏览器回退到这里 */
  height: 100dvh;
}
```

`dvh` 会随滚动变化，可能导致布局跟着跳动；对于不希望跳动的全屏区域，用 `svh` 更稳妥。另一种做法是让 `html`、`body` 及外层容器都设 `height: 100%`，用百分比高度代替 `vh`。

### 日期字符串解析得到 Invalid Date

**现象**：`new Date('2024-01-02 10:30:00')` 在 Chrome 中正常，在 Safari 中得到 `Invalid Date`，后续计算出现 `NaN`。

**原因**：ECMAScript 规范要求所有引擎都能解析的格式，是 ISO 8601 的简化格式（另外还有 `toString()` / `toUTCString()` 的输出格式），日期和时间之间用 `T` 分隔，例如 `2024-01-02T10:30:00`。用空格分隔的格式不在规范之内，能不能解析由各引擎自行决定，Chrome 能解析，Safari 不能。

原记录写的是"传入 `yyyy-MM-dd` 会返回 NaN"，这一点需要更正：只有日期部分的 `2024-01-02` 属于规范格式，各浏览器都能解析；出问题的是带时间且用空格分隔的写法。

**解决**：

```js
// 1. 使用规范格式
new Date('2024-01-02T10:30:00');

// 2. 自己拆分字段，用数字参数构造（月份从 0 开始）
const [datePart, timePart = '00:00:00'] = '2024-01-02 10:30:00'.split(' ');
const [y, m, d] = datePart.split('-').map(Number);
const [hh, mm, ss] = timePart.split(':').map(Number);
new Date(y, m - 1, d, hh, mm, ss);
```

网上常见的把 `-` 替换成 `/`（`'2024/01/02 10:30:00'`）在主流浏览器里通常能解析，但同样不是规范格式，不建议依赖。

还要注意时区：规范规定只有日期的 ISO 字符串（`2024-01-02`）按 UTC 解析，带时间但不带时区偏移的（`2024-01-02T10:30:00`）按本地时间解析。处理大量日期逻辑时，使用 day.js、date-fns 这类库更省心。

### 输入框聚焦时页面自动放大

**现象**：在 iOS Safari 中点击输入框，页面自动放大，失焦后不会自动恢复，布局看起来错乱。

**原因**：iOS Safari 在聚焦字号小于 16px 的输入框时会自动缩放页面，以便看清输入内容。

**解决**：让输入框（`input`、`select`、`textarea`）的字号不小于 16px：

```css
input,
select,
textarea {
  font-size: 16px;
}
```

也有人在 viewport 里加 `maximum-scale=1` 或 `user-scalable=no` 来阻止缩放，但这会影响用户主动放大页面，损害可访问性，不推荐。

### position: fixed 元素与软键盘

**现象**：底部固定的输入栏（如评论框），在 iOS 上弹出软键盘后被键盘挡住，或者随页面滚动发生错位。

**原因**：iOS Safari 弹出键盘时，不会缩小布局视口（layout viewport），而是缩小可视视口（visual viewport），并可能滚动页面让输入框可见。`position: fixed` 是相对布局视口定位的，所以 `bottom: 0` 的元素实际位于键盘后面。Android 上的 Chrome 默认行为则不同，键盘弹出时会调整视口大小，两端表现不一致。

**解决**：用 Visual Viewport API 获取实际可见区域，手动调整位置：

```js
const bar = document.querySelector('.input-bar');

function syncPosition() {
  const vv = window.visualViewport;
  const offset = window.innerHeight - vv.height - vv.offsetTop;
  bar.style.transform = `translateY(${-Math.max(offset, 0)}px)`;
}

window.visualViewport?.addEventListener('resize', syncPosition);
window.visualViewport?.addEventListener('scroll', syncPosition);
```

在 App 的 WebView 中，也可以由原生层处理键盘高度后通知页面。这类问题的表现与系统版本、WebView 配置相关，务必在真机上测试。

### 刘海屏与底部安全区域

**现象**：在有圆角屏幕和底部横条的 iPhone 上，页面底部的固定按钮被横条遮挡，或者内容被刘海挡住。

**解决**：在 viewport 中声明 `viewport-fit=cover`，让页面延伸到整个屏幕，再用 `env()` 读取安全区域的边距：

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

```css
.bottom-bar {
  position: fixed;
  bottom: 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

### 视频无法自动播放或自动全屏

**现象**：`<video autoplay>` 在 iOS 上不播放，或者一播放就进入全屏。

**原因**：移动端浏览器普遍限制带声音的自动播放；iOS 上视频默认全屏播放，内联播放需要显式声明。

**解决**：需要自动播放的视频设为静音，并加上 `playsinline`：

```html
<video src="intro.mp4" autoplay muted loop playsinline></video>
```

需要声音时，只能在用户手势（点击等）的事件处理函数里调用 `video.play()`，并处理它返回的 Promise 可能被拒绝的情况。

### 图片缩放后出现锯齿

**现象**：图片在 Safari 中缩放显示时边缘有明显锯齿。

**原因**：样式里设置了 `image-rendering: pixelated` 或 `crisp-edges` 等值。这些值的作用就是用最近邻算法缩放，保持像素边缘锐利，适合像素画和二维码，用在普通照片上就会出现锯齿。

**解决**：去掉这个属性，或者设为默认值 `auto`，让浏览器用平滑算法缩放。

### 补充：修改输入框光标颜色

原记录里还有一条：用 `caret-color` 设置输入框光标颜色。这本身不是兼容性问题，现代浏览器都支持：

```css
input {
  caret-color: #1677ff;
}
```

## 处理兼容性的方法

零散地记住每个问题不如建立一套流程：先确定要支持哪些浏览器，再让工具自动处理语法和前缀，最后对 API 做特性检测，必要时加 polyfill。

### 查询支持情况：Can I Use 与 MDN

- [Can I Use](https://caniuse.com/) 按浏览器版本列出 CSS、JS API、HTML 特性的支持情况，并标注已知问题。
- MDN 每个 API 页面底部都有"浏览器兼容性"表格，数据来自 browser-compat-data 项目。MDN 页面顶部还会标注 Baseline 状态，表示该特性是否已在主流浏览器中普遍可用。

使用一个新特性前先查一下，是最低成本的预防方式。

### 声明目标浏览器：browserslist

browserslist 用一份配置统一描述"项目要支持哪些浏览器"，Babel、Autoprefixer、PostCSS 等工具都会读取它，避免各工具各配一套。

在 `package.json` 中配置：

```json
{
  "browserslist": ["defaults", "iOS >= 15"]
}
```

或使用单独的 `.browserslistrc` 文件：

```text
# 生产环境
> 0.5%
last 2 versions
not dead
```

`defaults` 是官方提供的一组适合多数项目的默认查询。可以用命令查看当前配置实际覆盖了哪些浏览器：

```bash
npx browserslist
```

查询条件要结合项目的真实用户数据来定，比如面向国内移动端的项目需要关注 iOS 版本分布和 App 内 WebView 的内核版本。

### 自动处理语法与前缀：Babel 与 PostCSS

**JavaScript**：`@babel/preset-env` 根据 browserslist 决定要把哪些新语法转换成旧语法。配合 `useBuiltIns: 'usage'` 和 `core-js`，还可以只为代码中实际用到、且目标浏览器不支持的 API 注入 polyfill：

```json title="babel.config.json"
{
  "presets": [
    ["@babel/preset-env", { "useBuiltIns": "usage", "corejs": "3.40" }]
  ]
}
```

`corejs` 的值要写到小版本号，并与项目实际安装的 `core-js` 版本一致（上面的版本号仅为示例）。需要区分两件事：Babel 转换的是**语法**（如可选链、类字段），而 `Promise`、`Array.prototype.at` 这类**新 API** 只能靠 polyfill 补齐。

Vite、webpack 等构建工具对这部分有各自的集成方式，见 [前端构建工具概览](/notes/fronted/projectBuild/introduction.html)。

**CSS**：PostCSS 的 Autoprefixer 插件根据 browserslist 自动添加需要的厂商前缀，源码里只写标准属性即可。`postcss-preset-env` 还能把部分新 CSS 语法转换成旧浏览器能理解的写法。详见 [PostCSS 简介](/notes/fronted/projectBuild/postcss/introduction.html)。

```js
// postcss.config.js
export default {
  plugins: {
    autoprefixer: {},
  },
};
```

### 特性检测

特性检测是判断"浏览器是否支持某项能力"，而不是判断"这是什么浏览器"。通过 `navigator.userAgent` 判断浏览器类型很脆弱：UA 字符串经常变化、可以被伪造，而且同一浏览器的不同版本支持情况也不同。

**CSS：`@supports`**

```css
.layout {
  display: flex;
}

@supports (display: grid) {
  .layout {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }
}

@supports (height: 100dvh) {
  .full-screen {
    height: 100dvh;
  }
}
```

**JavaScript：检测对象或方法是否存在**

```js
if ('IntersectionObserver' in window) {
  // 用 IntersectionObserver 做懒加载
} else {
  // 降级：直接加载全部图片
}

if (typeof navigator.share === 'function') {
  // 使用系统分享
}

// 在 JS 中检测 CSS 支持情况
if (CSS.supports('backdrop-filter', 'blur(4px)')) {
  document.body.classList.add('has-backdrop');
}
```

### polyfill 策略

polyfill 用 JS 实现浏览器缺少的 API。常见的引入方式：

| 方式 | 说明 |
| --- | --- |
| 构建时按需注入 | 用 `@babel/preset-env` + `core-js` 的 `useBuiltIns: 'usage'`，只打包目标浏览器需要的部分。最常用。 |
| 手动引入单个 polyfill | 只缺少个别 API 时，单独安装对应的 polyfill 包，在入口处引入。 |
| 运行时按条件加载 | 先做特性检测，不支持时再动态 `import()` polyfill，现代浏览器不用为此多下载代码。 |

```js
if (!('IntersectionObserver' in window)) {
  await import('intersection-observer');
}
```

:::caution
不要依赖来路不明的第三方 polyfill CDN。2024 年曾发生过一个广泛使用的 polyfill 服务域名易主后被用来投放恶意代码的事件。polyfill 应当作为项目依赖安装、随项目一起构建和发布。
:::

也要明确 polyfill 的边界：不是所有能力都能被模拟。比如 CSS 新布局特性、部分涉及渲染和硬件的 API，旧浏览器里只能做降级处理，而不是完全补齐。

### 渐进增强与真机测试

- **渐进增强**：先保证基础功能在所有目标浏览器可用，再为支持新特性的浏览器增强体验。上面 `@supports` 的写法就是这个思路。
- **真机测试**：模拟器和桌面浏览器的设备模式无法完全复现软键盘、工具栏、安全区域等行为。iOS 相关的问题一定要在真机上验证，可以用 Mac 上的 Safari 远程调试 iPhone 上的页面。

## 小结

- IE 和旧版 Edge 都已停止支持，相关兼容代码只在维护旧系统时需要理解；Blob 下载等场景直接使用标准的 `download` 属性。
- 现在最主要的兼容性差异来自 Safari / iOS WebKit：视口高度、日期解析、输入框缩放、软键盘与 fixed 定位、安全区域、视频自动播放。
- 日期字符串只依赖规范格式（`YYYY-MM-DDTHH:mm:ss`），全屏高度用 `svh` / `dvh` 并保留 `vh` 回退。
- 用 browserslist 统一声明目标浏览器，Babel 处理语法、core-js 补齐 API、Autoprefixer 处理前缀。
- 用 `@supports`、`in` 检测、`CSS.supports()` 做特性检测，不要依赖 UA 判断；polyfill 作为项目依赖按需引入。

## 参考

- [MDN：Date.parse() 与日期时间字符串格式](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Date/parse)
- [MDN：length 单位（含视口单位）](https://developer.mozilla.org/zh-CN/docs/Web/CSS/length)
- [MDN：Visual Viewport API](https://developer.mozilla.org/zh-CN/docs/Web/API/Visual_Viewport_API)
- [MDN：env()](https://developer.mozilla.org/zh-CN/docs/Web/CSS/env)
- [MDN：@supports](https://developer.mozilla.org/zh-CN/docs/Web/CSS/@supports)
- [MDN：实现特性检测](https://developer.mozilla.org/zh-CN/docs/Learn/Tools_and_testing/Cross_browser_testing/Feature_detection)
- [MDN：&lt;a&gt; 元素的 download 属性](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/a)
- [Can I Use](https://caniuse.com/)
- [browserslist](https://github.com/browserslist/browserslist)
- [Babel：@babel/preset-env](https://babeljs.io/docs/babel-preset-env)
- [Autoprefixer](https://github.com/postcss/autoprefixer)
