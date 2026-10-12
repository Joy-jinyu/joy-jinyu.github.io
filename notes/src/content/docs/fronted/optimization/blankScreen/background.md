---
title: 白屏问题分析
description: 白屏的定义与分类、从页面加载流程看白屏的常见成因，以及如何检测、监控和排查白屏。
---

"白屏"是用户最直接感知到的故障：打开页面后长时间什么都看不到，或者干脆一直空白。这篇从页面加载流程出发，分析白屏的常见成因，再讲怎么在线上检测和监控白屏、出现问题后按什么思路排查。具体的优化手段见[白屏优化方案](/notes/fronted/optimization/blankScreen/case.html)。

## 什么是白屏

白屏可以分成两类，处理方式完全不同：

| 类型 | 表现 | 本质 |
| --- | --- | --- |
| 慢白屏（白屏时间长） | 页面最终能正常显示，但前几秒是空白 | 性能问题，关注首次内容绘制的耗时 |
| 真白屏（页面异常） | 页面一直空白，刷新也可能不恢复 | 稳定性问题，通常是资源加载失败或运行时报错 |

慢白屏一般用 FCP（First Contentful Paint，首次内容绘制）来衡量，即从开始导航到页面第一次渲染出文本、图片等内容的时间。指标体系见[前端性能优化总览](/notes/fronted/optimization/introduction.html)。真白屏则需要专门的检测手段，因为性能指标在页面异常时可能根本采集不到，或者采集到了也正常（比如渲染出了一个空的根节点）。

## 从加载流程看白屏

从输入地址到页面显示，大致经过以下阶段，每一步都可能拖慢或阻断首屏：

1. **DNS 解析、建立 TCP 连接、TLS 握手**：网络差或跨地域访问时耗时明显。
2. **发送请求、等待响应**：先检查本地缓存（强缓存命中则不发请求，协商缓存需要向服务器确认）；服务端处理慢直接表现为 TTFB 高。
3. **解析 HTML、构建 DOM**：遇到同步 `<script>` 会暂停解析，等脚本下载并执行完。
4. **加载 CSS、构建 CSSOM**：CSS 会阻塞渲染，CSSOM 构建完成前页面不会绘制。
5. **生成渲染树、布局、绘制**：此时页面才第一次出现内容。

浏览器渲染流程的细节见[浏览器工作原理](/notes/system/browser/basic.html)。

### 为什么 SPA 更容易白屏

传统服务端输出的页面，HTML 本身带有内容，走完上面的流程就能显示。单页应用（SPA）的 HTML 通常只有一个空容器：

```html
<body>
  <div id="app"></div>
  <script type="module" src="/assets/index-3f2a1c.js"></script>
</body>
```

在第 5 步完成时，页面上什么都没有。之后还要：

1. 下载 JS（首屏往往是体积最大的那个包）。
2. 解析、编译、执行 JS，框架初始化。
3. 很多页面还要请求接口拿到数据。
4. 框架生成 DOM，浏览器再次布局和绘制。

这几步全部完成之前，用户看到的都是空白。任何一步出问题，白屏时间就会被拉长，或者变成真白屏。

## 常见成因

### JS 或 CSS 阻塞渲染

- `<head>` 中的同步脚本会阻塞 HTML 解析，脚本下载慢就一直白屏。
- 体积过大的 CSS 文件需要完整下载解析后才开始渲染。
- 同步加载的第三方脚本（统计、广告等）所在服务器响应慢，会拖住整个页面。

### 资源加载失败

- JS 主包或 CSS 因 CDN 故障、网络劫持、跨域配置错误等原因加载失败，SPA 直接无法渲染。
- 发布后用户还在用旧的 HTML，它引用的旧版本 chunk 已从服务器删除，懒加载路由时返回 404。这在 SPA 发版时很常见，表现为"切换某个页面时白屏"。
- 资源被缓存了错误版本：HTML 被长时间强缓存，导致引用的资源与服务器不匹配。

### 运行时报错

- 浏览器不支持代码中使用的语法或 API（比如未经转译的新语法跑在旧版 WebView 中），脚本解析阶段就报 `SyntaxError`，整个文件都不会执行。
- 渲染过程中抛出未捕获的异常。React 中，渲染期间未被错误边界捕获的错误会导致整棵组件树被卸载，页面变成空白。
- 接口返回的数据结构与预期不符，访问 `undefined` 的属性报 `TypeError`。

### 首屏依赖接口

- 首屏内容依赖一个慢接口，在数据返回前页面只有空容器。
- 多个接口串行请求，耗时叠加。
- 接口失败后没有处理，页面停在空白或一直加载中的状态。

### 设备与网络

- 低端设备上 JS 解析和执行耗时可能是高端设备的数倍，同样的包体积，体验差距很大。
- 弱网环境下资源下载时间长。

## 检测与监控

### 采样点检测

思路：页面加载一段时间后，在屏幕上取若干个点，检查这些点上最上层的元素是什么。如果大部分点上都只是 `html`、`body` 或应用根容器这类"容器元素"，说明页面没有渲染出实际内容。

```js
const CONTAINER_SELECTORS = ['html', 'body', '#app'];

function isContainer(el) {
  return !el || CONTAINER_SELECTORS.some((selector) => el.matches(selector));
}

/** 在屏幕中心的十字线上采样，返回空白点的占比 */
function detectBlank() {
  const samples = 9;
  const points = [];
  for (let i = 1; i <= samples; i++) {
    points.push([(window.innerWidth * i) / (samples + 1), window.innerHeight / 2]);
    points.push([window.innerWidth / 2, (window.innerHeight * i) / (samples + 1)]);
  }

  const emptyCount = points.filter(([x, y]) => {
    const [top] = document.elementsFromPoint(x, y);
    return isContainer(top);
  }).length;

  return emptyCount / points.length;
}

window.addEventListener('load', () => {
  // 给框架留出渲染时间，具体延迟根据业务设定
  setTimeout(() => {
    const ratio = detectBlank();
    if (ratio > 0.9) {
      reportBlankScreen({ ratio, url: location.href });
    }
  }, 3000);
});
```

需要注意的地方：

- **骨架屏会造成误判**：如果页面先显示骨架屏，骨架屏元素也要算作"容器"，否则一直停在骨架屏的页面不会被识别为白屏。
- **检测时机**：固定延迟检测一次可能太早或太晚。可以在检测为空白时间隔一段时间重试几次，连续多次空白才上报。
- **判定阈值**：页面本身留白多（比如居中的小表单）时，阈值和采样点要结合页面布局调整。

除采样点外，还有其他检测方式：用 `MutationObserver` 监听根容器在一段时间内是否有子节点挂载；或者在测试和巡检环境中对页面截图，比较像素是否几乎全是同一颜色。截图方式准确但成本高，一般不在用户端使用。

### 错误监控

白屏背后通常有报错，把错误和白屏事件关联起来，才能知道原因：

```js
// 资源加载失败：资源的 error 事件不冒泡，必须在捕获阶段监听
window.addEventListener(
  'error',
  (event) => {
    const target = event.target;
    if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
      report('resource_error', { url: target.src || target.href });
    } else {
      report('js_error', { message: event.message, stack: event.error?.stack });
    }
  },
  true,
);

// 未处理的 Promise 拒绝
window.addEventListener('unhandledrejection', (event) => {
  report('promise_error', { reason: String(event.reason) });
});
```

框架层面也要接入错误处理：Vue 使用 `app.config.errorHandler`，React 使用错误边界组件（Error Boundary）。跨域加载的脚本报错时，`window.onerror` 只能拿到 `Script error.`，需要给 `<script>` 加 `crossorigin` 属性，同时资源服务器返回正确的 CORS 响应头，才能拿到错误详情。线上代码是压缩过的，还需要上传 source map 到监控平台用于还原堆栈。

### 性能指标

慢白屏通过性能数据监控：

- 用 `web-vitals` 等方式采集 FCP、LCP、TTFB，按页面、地区、设备、网络类型分组，看第 75 百分位的变化趋势。
- 通过 `PerformanceObserver` 采集资源加载耗时，找出首屏关键资源中最慢的那几个。
- 发版前后对比指标，及时发现某次发布引入的退化。

## 排查思路

出现白屏反馈或告警时，可以按以下顺序缩小范围：

1. **确定范围**：是所有用户还是特定用户？集中在某个浏览器、系统版本、App 内 WebView、地区或运营商？是否和某次发布时间吻合？
2. **看资源是否加载成功**：在 DevTools 的 Network 面板中检查 HTML、主 JS、CSS 的状态码和耗时。404 往往是发版后旧 chunk 被删除，或路径配置错误；加载超时要看 CDN 和网络。
3. **看 Console 是否报错**：`SyntaxError` 优先怀疑兼容性（检查构建的目标浏览器配置是否覆盖了出问题的环境）；`TypeError` 多和数据结构有关，回溯对应接口返回。
4. **看接口**：首屏接口是否超时、报错，前端对失败是否做了处理。
5. **看缓存**：HTML 是否被强缓存、Service Worker 是否返回了旧版本资源。可以用无痕模式或清除站点数据后对比。
6. **复现慢白屏**：在 Performance 面板中开启 CPU 降速和网络限速录制，看首次绘制前的时间都花在哪：是在等 HTML、等 JS 下载，还是 JS 执行时间过长。
7. **结合监控数据**：把白屏上报、错误日志、资源加载日志按会话关联起来看，找到白屏发生前最后一个错误。

:::tip
移动端 App 内嵌页面的白屏要额外关注 WebView 的版本和内核差异，以及 App 自身的离线包、拦截请求等机制。条件允许时，用真机连接桌面浏览器的远程调试功能直接查看 Network 和 Console，比只看日志效率高很多。
:::

## 小结

- 白屏分两类：慢白屏是性能问题，用 FCP 等指标衡量；真白屏是稳定性问题，需要专门检测。
- SPA 首屏要等 JS 下载、执行，甚至接口返回后才有内容，天然更容易白屏。
- 常见成因：阻塞渲染的资源、资源加载失败（含发版后旧 chunk 失效）、运行时报错、首屏依赖慢接口、低端设备和弱网。
- 检测用采样点法判断页面是否渲染出内容，配合资源错误、JS 错误、Promise 错误的监控定位原因。
- 排查按"范围 → 资源 → 报错 → 接口 → 缓存 → 性能"的顺序逐步缩小。

## 参考

- [MDN：Document.elementsFromPoint()](https://developer.mozilla.org/zh-CN/docs/Web/API/Document/elementsFromPoint)
- [MDN：Window：error 事件](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/error_event)
- [MDN：Window：unhandledrejection 事件](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/unhandledrejection_event)
- [Vue：app.config.errorHandler](https://vuejs.org/api/application.html#app-config-errorhandler)
- [React：使用错误边界捕获渲染错误](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
