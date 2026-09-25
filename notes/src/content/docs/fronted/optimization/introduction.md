---
title: 前端性能优化总览
description: 用 Core Web Vitals 等指标衡量性能，用 Lighthouse、DevTools 和真实用户监控定位问题，再按网络、资源加载、渲染、JS 执行、缓存五个层面逐项优化。
---

性能优化最容易犯的错是凭感觉动手。这篇先讲怎么衡量（Core Web Vitals 等指标）、怎么测量（实验室工具和真实用户数据），再按网络与传输、资源加载、渲染、JS 执行、缓存五层整理常用手段。读完应该能形成一个"先测量、找瓶颈、再对症优化、最后回归验证"的工作流程。

## 衡量指标

### Core Web Vitals

Core Web Vitals 是一组以用户体验为中心的指标，分别对应"加载快不快、响应快不快、页面稳不稳"：

| 指标 | 全称 | 衡量什么 | 良好标准 |
| --- | --- | --- | --- |
| LCP | Largest Contentful Paint，最大内容绘制 | 视口内最大的图片或文本块渲染完成的时间，代表主要内容何时出现 | ≤ 2.5 秒 |
| INP | Interaction to Next Paint，交互到下一次绘制 | 页面生命周期内用户点击、按键等交互，到下一帧画面更新的延迟，取接近最差的一次 | ≤ 200 毫秒 |
| CLS | Cumulative Layout Shift，累积布局偏移 | 内容意外移动的程度，比如图片加载后把文字挤下去 | ≤ 0.1 |

评估时看的是真实用户数据的第 75 百分位：75% 的访问达到良好标准，才算该指标达标。

:::note
INP 已经取代 FID（First Input Delay，首次输入延迟）成为 Core Web Vitals 指标。FID 只测**第一次**交互的**输入延迟**（从操作到事件处理开始），不包括处理耗时和渲染耗时；INP 考察整个页面生命周期的所有交互，且覆盖"输入延迟 + 事件处理 + 下一帧绘制"全过程，更能反映页面实际是否卡顿。旧资料中以 FID 为核心的结论需要按 INP 重新理解。
:::

### 其他常用指标

| 指标 | 含义 | 用途 |
| --- | --- | --- |
| TTFB | Time to First Byte，从发起请求到收到响应第一个字节 | 反映网络和服务器响应速度，是所有加载指标的前提 |
| FCP | First Contentful Paint，首次渲染出文本、图片等内容 | 用户第一次看到"页面有东西了"，和白屏时间直接相关 |
| FP | First Paint，首次绘制任何像素（含背景色） | 通常早于或等于 FCP，参考价值有限 |
| TBT | Total Blocking Time，FCP 之后主线程被长任务阻塞的总时间 | 实验室指标，与 INP 相关性较高，用于在本地评估交互响应 |
| `DOMContentLoaded` | HTML 解析完成、同步脚本执行完 | 传统指标，和用户感知关系不大 |
| `load` | 页面所有资源（图片、样式等）加载完成 | 传统指标，现代页面大量内容异步加载，参考意义下降 |

TTFB 和 FCP 常用的良好标准分别是 0.8 秒和 1.8 秒以内。TTI（可交互时间）是早期常用的指标，新版 Lighthouse 已不再把它计入评分，可以不再关注。

"长任务"指在主线程上执行超过 50 毫秒的任务。长任务期间用户的输入无法得到响应，是 TBT 和 INP 变差的主要原因。

## 测量工具

测量数据分两类：

- **实验室数据（lab data）**：在固定设备、网络条件下模拟加载，结果可复现，适合调试和对比优化前后效果。
- **真实用户数据（field data / RUM）**：从真实用户的浏览器中采集，反映实际体验，但受设备、网络差异影响大。

两者经常对不上：开发机上 Lighthouse 跑满分，低端机和弱网用户依然很慢。最终以真实用户数据为准，用实验室工具定位原因。

### Lighthouse 与 PageSpeed Insights

Lighthouse 集成在 Chrome DevTools 中，也可以命令行运行。它在模拟的移动设备和限速网络下加载页面，输出性能评分、各项指标和优化建议（比如"移除阻塞渲染的资源"、"适当调整图片大小"）。

PageSpeed Insights 是在线工具，它同时给出两部分结果：基于 Lighthouse 的实验室数据，以及来自 Chrome 用户体验报告（CrUX）的真实用户数据（网站访问量足够时才有）。早年 PageSpeed 按"优化缓存、减少往返、减小请求大小"等规则清单打分的方式已经被 Lighthouse 取代。另一个早期工具 YSlow 也已停止维护。

### DevTools Performance 面板

录制一段页面加载或交互过程，可以看到：

- 主线程火焰图：哪些函数执行时间长、哪里出现长任务（右上角带红色三角标记）。
- 网络瀑布：资源的请求顺序和耗时。
- 渲染相关事件：样式计算、布局、绘制的耗时，以及强制同步布局的警告。
- LCP、CLS 等指标在时间轴上的位置，以及对应的元素。

建议在 CPU 降速（如 4 倍）和网络限速下录制，更接近普通用户设备。

### web-vitals 库与 RUM

`web-vitals` 是用于在页面中采集 Core Web Vitals 的官方小型库，计算方式与 Chrome 的标准实现保持一致：

```js
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
    id: metric.id,
  });
  // 页面关闭时也能可靠发送
  navigator.sendBeacon('/analytics', body);
}

onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

把这些数据上报到自己的监控系统，就是一个最简单的 RUM（Real User Monitoring，真实用户监控）。上报时附带页面路径、设备类型、网络类型（`navigator.connection.effectiveType`，并非所有浏览器支持）等维度，才能定位"哪类用户在哪个页面慢"。

更底层的数据可以通过 `PerformanceObserver` 获取，比如资源加载耗时（`resource`）、长任务（`longtask`）、导航耗时（`navigation`）。

## 优化方向分层

一次页面访问大致经过：建立连接 → 下载 HTML → 发现并下载 CSS/JS/图片 → 解析与渲染 → 执行 JS、响应交互。对应的优化可以分成五层。浏览器加载和渲染的完整过程见[浏览器工作原理](/notes/system/browser/basic.html)。

| 层次 | 主要影响的指标 | 核心思路 |
| --- | --- | --- |
| 网络与传输 | TTFB、LCP | 更快地建立连接、传更少的字节 |
| 资源加载 | FCP、LCP | 关键资源先加载，非关键资源推迟 |
| 渲染 | LCP、CLS | 减少阻塞渲染的内容，避免布局抖动 |
| JS 执行 | INP、TBT | 减少主线程工作量，拆分长任务 |
| 缓存 | 二次访问的所有指标 | 能不请求就不请求 |

### 网络与传输

- **使用 CDN**：静态资源分发到离用户最近的节点，缩短传输距离。
- **启用 HTTP/2 或 HTTP/3**：多路复用让多个请求共用一个连接，不再需要早年为绕开并发限制而做的域名分片、雪碧图等手段。
- **压缩传输内容**：文本资源开启 Brotli 或 gzip。构建时预压缩，避免服务器每次实时压缩。
- **减少重定向**：每次重定向都多一个完整的往返，尤其是落地页的重定向。
- **提前建立连接**：对确定会用到的第三方域名使用 `preconnect`，可能用到的使用 `dns-prefetch`：

```html
<link rel="preconnect" href="https://cdn.example.com" crossorigin />
<link rel="dns-prefetch" href="https://api.example.com" />
```

`preconnect` 会完成 DNS 解析、TCP 握手和 TLS 协商，开销比 `dns-prefetch` 大，只用于少数关键域名。注意属性值是 `preconnect`，不存在 `dns-preconnect` 这种写法。

- **降低 TTFB**：服务端渲染页面要优化接口和模板渲染耗时，可以对 HTML 做缓存或使用流式渲染。

### 资源加载

- **压缩代码体积**：生产构建开启压缩和 tree shaking，排查体积过大的依赖（可用打包分析工具查看产物构成）。
- **代码分割与懒加载**：按路由拆分 JS，首屏只加载当前页面需要的代码；弹窗、图表等非首屏组件按需加载。
- **图片优化**：
  - 使用 WebP、AVIF 等更高压缩率的格式，通过 `<picture>` 提供回退。
  - 用 `srcset` / `sizes` 按屏幕提供合适尺寸，不要给手机下发桌面端大图。
  - 首屏以外的图片加 `loading="lazy"`；但 LCP 图片不能懒加载。
- **提升关键资源优先级**：

```html
<!-- LCP 大图提前发现并提高优先级 -->
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />
<img src="/hero.webp" fetchpriority="high" width="1200" height="600" alt="活动主图" />

<!-- 字体通常在 CSS 解析后才被发现，可以预加载 -->
<link rel="preload" as="font" type="font/woff2" href="/fonts/main.woff2" crossorigin />
```

`preload` 让浏览器提前下载当前页面一定会用到、但发现得晚的资源（如 CSS 里引用的字体、JS 动态插入的图片）。滥用 `preload` 会挤占其他关键资源的带宽，只给真正的关键资源用。下一个页面可能用到的资源用 `prefetch`，以低优先级在空闲时下载。

- **脚本不阻塞解析**：普通 `<script>` 会阻塞 HTML 解析。外部脚本使用 `defer`（按顺序在解析完成后执行）或 `async`（下载完立即执行，不保证顺序）；`type="module"` 的脚本默认就是 `defer` 行为。
- **控制第三方脚本**：统计、广告、客服等脚本延迟加载，必要时放到页面空闲后再引入。

### 渲染

- **关键 CSS 内联**：首屏所需的少量 CSS 直接写进 HTML，其余样式异步加载，减少渲染阻塞。
- **字体加载策略**：`font-display: swap` 先用系统字体显示文字，自定义字体加载后再替换，避免文字长时间不可见。
- **为媒体元素预留空间**：图片、视频写上 `width` / `height` 或使用 `aspect-ratio`，广告位、异步加载的内容预留固定高度，避免 CLS。
- **避免布局抖动**：不要在循环中交替读取布局属性（`offsetHeight`、`getBoundingClientRect()`）和修改样式，这会导致强制同步布局。先批量读，再批量写。
- **动画用 `transform` 和 `opacity`**：这两个属性的变化通常只触发合成，不触发布局和绘制。
- **减少渲染工作量**：长列表使用虚拟滚动；屏幕外的大块内容可以用 `content-visibility: auto` 跳过渲染。
- **服务端渲染（SSR）或静态生成（SSG）**：HTML 直接带内容，不必等 JS 下载执行后才渲染，对 FCP、LCP 帮助明显。白屏相关的问题见[白屏问题分析](/notes/fronted/optimization/blankScreen/background.html)和[白屏优化方案](/notes/fronted/optimization/blankScreen/case.html)。

### JS 执行

- **减少执行量**：删除未使用的代码和依赖，用更轻量的库替代大而全的库，按需引入组件库。
- **拆分长任务**：一次处理大量数据时，分批执行，每批之间把控制权交还给浏览器，让它有机会响应输入和渲染：

```js
function yieldToMain() {
  // scheduler.yield 目前并非所有浏览器支持，不支持时回退到 setTimeout
  if (globalThis.scheduler?.yield) {
    return scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function processItems(items) {
  for (const item of items) {
    handle(item);
    await yieldToMain();
  }
}
```

实际使用时可以按时间切片（比如每处理 50 毫秒让出一次），而不是每项都让出。宏任务和渲染之间的关系见[执行机制与事件循环](/notes/fronted/language/javascript/eventLoop.html)。

- **计算放到 Web Worker**：数据解析、加密、图像处理等纯计算任务移出主线程。
- **优化事件处理**：滚动、输入等高频事件做节流或防抖；交互后先给出视觉反馈（如按钮状态），再执行耗时逻辑。
- **框架层面**：避免不必要的重新渲染（React 中合理拆分组件和使用 memo，Vue 中注意响应式数据的粒度），大型列表、复杂表单尤其明显。

### 缓存

- **HTTP 缓存**：
  - 带内容哈希的静态资源（如 `app.3f2a1c.js`）设置长期强缓存：`Cache-Control: max-age=31536000, immutable`。文件内容变化后哈希变化，自然会请求新文件。
  - HTML 入口文件设置 `Cache-Control: no-cache`，每次向服务器确认是否更新（协商缓存），保证能拿到最新的资源引用。
  - 协商缓存通过 `ETag` / `If-None-Match` 或 `Last-Modified` / `If-Modified-Since` 实现，未变化时服务器返回 304，省去响应体传输。
- **Service Worker**：拦截页面请求，自行决定从缓存还是网络返回，可以实现离线访问和更细的缓存策略（缓存优先、网络优先、先返回缓存再后台更新等）。手写容易出错，可以使用 Workbox 这类工具库生成。要特别注意更新机制：Service Worker 文件本身不要被长期缓存，发布新版本后要有激活和刷新策略，否则用户可能一直停留在旧版本。
- **往返缓存（bfcache）**：用户点击后退、前进时，浏览器可以直接恢复内存中的整个页面。使用 `unload` 事件、页面持有未关闭的连接等情况会让页面无法进入 bfcache，可在 DevTools 的 Application 面板中检测。
- **连接复用**：HTTP 的 keep-alive（HTTP/1.1 默认开启）让多个请求复用同一个 TCP 连接，避免重复握手；HTTP/2 进一步在一个连接上并发多个请求。
- **应用层缓存**：接口数据在内存或本地存储中缓存，配合合适的失效策略；SPA 中可以缓存组件实例，比如 Vue 的 `<KeepAlive>`，在切换路由时保留页面状态，避免重复渲染和请求。

:::tip
优化之后一定要回到指标上验证。很多手段是有代价的：过多的 `preload` 会抢带宽，过细的代码分割会增加请求数，激进的缓存可能导致用户拿不到更新。只有数据能说明一项优化是否值得保留。
:::

## 小结

- 用 Core Web Vitals（LCP、INP、CLS）衡量加载、交互、稳定性，INP 已取代 FID；TTFB、FCP 辅助定位加载问题。
- 实验室工具（Lighthouse、DevTools Performance）用于定位和对比，真实用户数据（web-vitals + RUM）用于判断实际体验。
- 网络层：CDN、HTTP/2/3、压缩、预连接；资源加载层：分割、懒加载、图片优化、关键资源优先。
- 渲染层：关键 CSS、字体策略、预留尺寸防 CLS；JS 层：减少代码量、拆分长任务、移到 Worker。
- 缓存层：哈希文件长期强缓存、HTML 协商缓存，按需引入 Service Worker，并处理好更新问题。

## 参考

- [MDN：Web 性能](https://developer.mozilla.org/zh-CN/docs/Web/Performance)
- [MDN：Largest Contentful Paint](https://developer.mozilla.org/en-US/docs/Glossary/Largest_contentful_paint)
- [MDN：Interaction to Next Paint](https://developer.mozilla.org/en-US/docs/Glossary/Interaction_to_next_paint)
- [MDN：Cumulative Layout Shift](https://developer.mozilla.org/en-US/docs/Glossary/CLS)
- [MDN：HTTP 缓存](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Caching)
- [MDN：Service Worker API](https://developer.mozilla.org/zh-CN/docs/Web/API/Service_Worker_API)
- [web.dev：Web Vitals](https://web.dev/articles/vitals)
