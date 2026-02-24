---
title: 浏览器工作原理
description: 浏览器的多进程架构、从输入 URL 到页面显示的完整过程、渲染流水线各阶段，以及重排重绘的成因与优化、JS 和 CSS 对解析与渲染的阻塞。
---

前端写下的 HTML、CSS、JS，最终都要经过浏览器的一系列处理才变成屏幕上的像素。理解这条流水线，才能解释"为什么改 `transform` 比改 `top` 流畅""为什么脚本要加 `defer`"这类问题。这篇以 Chromium 为主要参照（其他浏览器整体思路相近，细节不同），依次讲浏览器的进程架构、导航过程、渲染流水线、重排重绘和资源阻塞。

## 浏览器引擎

浏览器由多个部分组成，其中与前端最相关的是**渲染引擎**（负责 HTML/CSS 解析、布局、绘制）和 **JavaScript 引擎**。

| 浏览器 | 渲染引擎 | JS 引擎 |
| --- | --- | --- |
| Chrome、Edge、Opera 等 Chromium 系 | Blink | V8 |
| Safari | WebKit | JavaScriptCore |
| Firefox | Gecko | SpiderMonkey |

Blink 是 Chromium 从 WebKit 分支出来的。IE 使用的 Trident 已随 IE 停止支持而退出历史，新版 Edge 改用 Chromium 内核。iOS 上的浏览器长期以来都要求使用系统的 WebKit。

## 多进程架构

早期浏览器是单进程的：一个页面崩溃或卡死，整个浏览器跟着出问题。现代 Chromium 采用多进程架构，主要进程有：

| 进程 | 职责 |
| --- | --- |
| 浏览器进程（Browser） | 地址栏、书签、前进后退等界面；管理其他进程；协调导航；处理存储、权限等需要高权限的操作 |
| 渲染进程（Renderer） | 运行渲染引擎和 JS 引擎，负责一个或多个页面的解析、布局、绘制、执行脚本；运行在沙箱中 |
| GPU 进程 | 统一处理来自各渲染进程和浏览器进程的 GPU 绘制任务 |
| 网络服务（Network Service） | 处理网络请求，现在以独立的工具进程运行 |
| 其他工具进程 | 音视频解码、存储等服务 |
| 扩展进程、插件进程 | 运行浏览器扩展等 |

多进程的好处：

- **稳定**：一个标签页的渲染进程崩溃，不影响其他标签页和浏览器本身。
- **安全**：渲染进程在沙箱中运行，即使被恶意网页利用漏洞，也难以直接访问系统资源。配合站点隔离（Site Isolation），不同站点的页面（包括跨站 iframe）放在不同的渲染进程，减少跨站数据泄露的风险。
- **流畅**：一个页面的脚本死循环不会卡住浏览器界面。

代价是内存占用更多，所以浏览器会根据内存情况决定是否让同站点的多个标签页共用一个渲染进程。

渲染进程内部也有多个线程：**主线程**负责解析、样式、布局、执行 JS；**合成线程**负责图层合成和处理部分滚动；**光栅线程**负责把绘制指令转成像素。"JS 会阻塞渲染"说的就是 JS 和样式布局都在主线程上执行。

## 从输入 URL 到页面展示

### 1. 处理输入

浏览器进程判断地址栏输入的是 URL 还是搜索关键词。如果是关键词，拼接成搜索引擎的 URL。如果当前页面注册了 `beforeunload` 事件，会先询问是否离开。

### 2. 查缓存

如果资源命中强缓存（`Cache-Control: max-age` 未过期），直接使用缓存，不发请求。如果有 Service Worker 控制该页面，请求会先交给 Service Worker 处理。

### 3. DNS 解析

把域名解析成 IP 地址。依次查找浏览器 DNS 缓存、操作系统缓存（包括 hosts 文件）、本地 DNS 服务器，本地 DNS 服务器再向根域名服务器、顶级域名服务器、权威域名服务器递归查询。页面中可以用 `<link rel="dns-prefetch">` 提前解析其他域名。

### 4. 建立连接

- **TCP 三次握手**：客户端与服务器确认双方的收发能力。
- **TLS 握手**（HTTPS）：协商加密算法、验证服务器证书、交换密钥。TLS 1.3 把握手往返次数减少到 1 次，恢复会话时还能做到 0-RTT。
- HTTP/3 基于 QUIC（运行在 UDP 上），把传输握手和加密握手合在一起，减少了建连耗时。

`<link rel="preconnect">` 可以提前完成到某个源的 DNS、TCP、TLS 过程。连接建立后会被复用：HTTP/1.1 用 keep-alive 复用连接；HTTP/2 在一个连接上多路复用多个请求。

### 5. 发送 HTTP 请求与接收响应

浏览器发送请求行、请求头（包括 Cookie）和请求体。服务器返回状态码、响应头和响应体。

- 3xx 重定向：浏览器读取 `Location` 头，重新发起导航。
- 304：协商缓存命中，使用本地缓存。
- 根据 `Content-Type` 决定如何处理响应：`text/html` 交给渲染流程，下载类型交给下载管理器。

### 6. 提交导航

浏览器进程选择（或创建）一个渲染进程，把响应数据交给它，地址栏和历史记录随之更新。此后渲染进程开始解析和渲染页面。

### 7. 解析与渲染

渲染进程边接收 HTML 边解析，构建 DOM、加载子资源、执行脚本、计算样式和布局并绘制，下一节详细展开。页面所有资源加载完成后触发 `load` 事件；DOM 解析完成、`defer` 脚本执行完后触发 `DOMContentLoaded`。

## 渲染流水线

渲染引擎把 HTML/CSS/JS 变成像素，大致经过以下阶段：

```text
HTML → DOM ┐
           ├→ 样式计算 → 布局 → 分层 → 绘制 → 分块/光栅化 → 合成 → 显示
CSS → CSSOM┘
```

### 构建 DOM

HTML 解析器把字节流按编码转成字符，再经过分词（tokenize）得到开始标签、结束标签、文本等 token，最后构建出 DOM 树。HTML 解析器的容错性很强，标签没闭合等错误也能处理。

解析器在等待脚本下载时，会有一个**预加载扫描器（preload scanner）**提前扫描后续 HTML，发现 `<img>`、`<link>`、`<script>` 就先发起下载，减少等待。

### 构建 CSSOM 与样式计算

CSS（外链样式表、`<style>`、内联 `style`）被解析成 CSSOM。之后进入**样式计算**：根据选择器匹配、层叠规则、继承和默认样式，计算出每个 DOM 节点最终的计算样式（computed style），可以用 `getComputedStyle` 查看。

### 布局（Layout）

根据 DOM 和计算样式生成**布局树**，只包含可见元素：

- `display: none` 的元素不进入布局树；`visibility: hidden` 的元素会进入（它占位置，只是不可见）。
- `::before`、`::after` 伪元素虽然不在 DOM 中，但会生成布局对象。
- `<head>`、`<script>` 等不显示的元素不进入布局树。

然后计算每个元素的几何信息：位置和尺寸。旧资料常说的"渲染树"（render tree）就是这一步的结构，"布局"在 Firefox 中称为"回流"（reflow）。

### 分层（Layer）

页面并不是画在一张纸上，而是分成多个图层，最后叠在一起。满足某些条件的元素会被提升为单独的合成层，常见情况：

- 有 3D 变换或 `will-change: transform`、`will-change: opacity`。
- 正在执行 `transform`、`opacity` 动画。
- `<video>`、`<canvas>`、iframe 等。
- `position: fixed` 元素、需要单独滚动的区域等（具体规则由浏览器决定）。

在 Chrome DevTools 的 Layers 面板可以查看页面的分层情况。

### 绘制（Paint）

主线程为每个图层生成**绘制指令列表**（先画背景、再画边框、再画文字……），这一步并不直接产生像素，只是记录"怎么画"。

### 分块、光栅化与合成

- **分块**：合成线程把大图层切成小块（tile），优先处理视口附近的块。
- **光栅化**：把绘制指令变成位图，通常借助 GPU 加速完成。
- **合成**：合成线程把各图层的位图按位置、变换、透明度组合成一帧，交给 GPU 进程显示到屏幕上。

关键点：**合成在合成线程上进行，不需要主线程参与**。所以只改 `transform` 和 `opacity` 的动画，可以跳过布局和绘制，直接在合成阶段完成，即使主线程正忙于执行 JS，动画也能保持流畅。

渲染在事件循环中何时发生、`requestAnimationFrame` 的执行时机，见[执行机制与事件循环](/notes/fronted/language/javascript/eventLoop.html)，这里不展开。

## 重排与重绘

| 概念 | 触发条件 | 需要重新执行的阶段 |
| --- | --- | --- |
| 重排（reflow / relayout） | 元素几何信息变化：宽高、边距、位置、字体大小、内容增删、窗口尺寸变化 | 布局 → 绘制 → 合成 |
| 重绘（repaint） | 只改变外观，不影响布局：颜色、背景、阴影、`visibility` | 绘制 → 合成 |
| 只合成 | 合成层上的 `transform`、`opacity` 变化 | 合成 |

重排一定会导致重绘，重绘不一定需要重排。重排的代价和受影响的范围有关，改一个元素的尺寸可能导致其父元素、兄弟元素都要重新布局。

### 强制同步布局

浏览器通常会把多次样式修改攒起来，在下一帧统一计算。但如果修改样式后**立即读取布局信息**，浏览器必须马上计算布局才能返回准确值，这叫强制同步布局。会触发它的属性和方法包括：

- `offsetTop/Left/Width/Height`
- `clientTop/Left/Width/Height`
- `scrollTop/Left/Width/Height`
- `getBoundingClientRect()`、`getComputedStyle()`

在循环里交替读写，会让每次迭代都触发一次布局，称为布局抖动（layout thrashing）：

```js
// 不好：每次循环都先写后读，反复触发布局
for (const el of items) {
  el.style.width = box.offsetWidth + 'px';
}

// 好：先统一读，再统一写
const width = box.offsetWidth;
for (const el of items) {
  el.style.width = width + 'px';
}
```

### 优化建议

- **读写分离**：把读取布局信息的操作集中在一起，再集中修改样式。
- **批量修改**：用切换 `class` 代替逐条改 `style`；大量插入节点时先在 `DocumentFragment` 中构建好再一次插入。
- **动画用 `transform` 和 `opacity`**，避免对 `top`、`left`、`width` 做动画。
- **合理使用 `will-change`**：只对确实要动画的元素提前声明，不要大面积使用，每个合成层都占用内存。
- **限制影响范围**：对独立的组件使用 `contain: layout paint` 等，告诉浏览器其内部变化不影响外部。`content-visibility: auto` 可以跳过屏幕外内容的渲染工作。
- **动画相关的 DOM 读写放在 `requestAnimationFrame` 中**，与浏览器的渲染节奏对齐。
- 用 Chrome DevTools 的 Performance 面板录制，找出耗时的 Layout、Paint 任务。

## JS 与 CSS 对解析和渲染的阻塞

### CSS

- CSS **不阻塞 DOM 解析**，HTML 解析器可以继续工作。
- CSS **阻塞渲染**：在 `<head>` 中的样式表加载完成之前，浏览器不会渲染页面，以免出现无样式内容闪烁。
- CSS **阻塞其后脚本的执行**：脚本可能读取样式信息，所以浏览器要等前面的 CSS 加载并解析完，才执行后面的同步脚本。这意味着一个慢的 CSS 文件会间接阻塞 DOM 解析。

优化：关键 CSS 内联，非关键 CSS 延迟加载；用 `media` 属性标注只在特定条件下需要的样式表（如 `media="print"`），它们不会阻塞首次渲染。

### JS

普通的 `<script>`（无 `async`、`defer`）会**阻塞 HTML 解析**：解析器遇到它就停下来，下载（外链时）并执行完才继续。原因是脚本可能用 `document.write` 改变后续内容，也可能读取 DOM。

`async` 和 `defer` 改变了这一行为：

| 写法 | 下载 | 执行时机 | 执行顺序 |
| --- | --- | --- | --- |
| `<script>` | 阻塞解析 | 下载完立即执行 | 按出现顺序 |
| `<script async>` | 与解析并行 | 下载完立即执行，执行时会暂停解析 | 谁先下载完谁先执行，不保证顺序 |
| `<script defer>` | 与解析并行 | HTML 解析完成后、`DOMContentLoaded` 之前 | 按出现顺序 |
| `<script type="module">` | 与解析并行 | 默认与 `defer` 相同；加 `async` 则下载完即执行 | 默认按顺序 |

选用建议：

- 依赖 DOM 或彼此有依赖关系的业务脚本，用 `defer` 或 `type="module"`。
- 独立的第三方脚本（统计、广告），用 `async`。
- `async` 和 `defer` 只对外链脚本有效，内联脚本上不起作用（模块脚本除外）。
- 以前常见的"把脚本放到 `<body>` 末尾"也能避免阻塞解析，但下载开始得晚；放在 `<head>` 中加 `defer` 可以更早开始下载。

此外，可以用 `<link rel="preload">` 提前加载关键资源，`<link rel="modulepreload">` 预加载模块脚本。

## 小结

- 现代浏览器是多进程架构：浏览器进程负责界面和协调，渲染进程在沙箱中解析和执行页面，GPU 进程负责绘制，网络单独成服务；站点隔离提升了安全性。
- 导航过程：处理输入 → 缓存 → DNS → TCP/TLS（或 QUIC）→ HTTP 请求响应 → 提交给渲染进程 → 解析渲染。
- 渲染流水线：DOM、CSSOM → 样式计算 → 布局 → 分层 → 绘制 → 光栅化 → 合成；合成不占用主线程。
- 改几何属性触发重排，改外观触发重绘，`transform`/`opacity` 可以只走合成；避免交替读写布局属性。
- CSS 阻塞渲染和其后脚本执行，普通脚本阻塞解析；用 `defer`、`async`、模块脚本减少阻塞。

## 参考

- [Chrome Developers：Inside look at modern web browser](https://developer.chrome.com/blog/inside-browser-part1)
- [web.dev：渲染性能](https://web.dev/articles/rendering-performance)
- [MDN：浏览器如何工作](https://developer.mozilla.org/zh-CN/docs/Web/Performance/How_browsers_work)
- [MDN：script 元素](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/script)
- [MDN：CSS contain](https://developer.mozilla.org/zh-CN/docs/Web/CSS/contain)
