---
title: 白屏优化方案
description: 缩短和消除白屏的常用方案：骨架屏、SSR/SSG、关键 CSS 内联、预加载与预连接、代码分割、压缩与 CDN、缓存策略、错误边界与降级兜底。
---

白屏的成因在[白屏问题分析](/notes/fronted/optimization/blankScreen/background.html)里已经梳理过。这篇按方案逐个说明：它解决哪类问题、怎么做、有什么代价。前几项主要缩短"慢白屏"，最后的错误边界与降级兜底针对"真白屏"。实际项目通常要组合使用，先用数据确认瓶颈在哪，再选方案。

## 方案速览

| 方案 | 解决的问题 | 改动成本 |
| --- | --- | --- |
| 骨架屏 | 等待期间没有任何反馈 | 低 |
| SSR / SSG | 首屏内容依赖 JS 执行和接口 | 高 |
| 关键 CSS 内联 | CSS 阻塞首次渲染 | 中 |
| 预加载 / 预连接 | 关键资源发现晚、连接建立慢 | 低 |
| 代码分割与懒加载 | 首屏 JS 体积过大 | 中 |
| 资源压缩与 CDN | 传输慢 | 低 |
| 缓存策略 | 重复访问仍要重新下载 | 低 |
| 错误边界与降级兜底 | 报错或加载失败导致页面空白 | 中 |

## 骨架屏

在真实内容出来之前，先显示一个与页面布局相近的灰色占位结构。它不会让内容更快出现，但让用户立即看到页面在加载，感知上的等待会短很多。

SPA 中最有效的做法是把骨架屏直接写进 HTML 的根容器里，这样不需要等 JS 下载执行就能显示：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <style>
      .sk-item {
        height: 16px;
        margin: 12px 16px;
        border-radius: 4px;
        background: #eee;
      }
      .sk-banner {
        height: 160px;
        margin: 16px;
        border-radius: 8px;
        background: #eee;
      }
    </style>
  </head>
  <body>
    <div id="app">
      <!-- 框架挂载时会替换根容器内的内容，骨架屏自动消失 -->
      <div class="sk-banner"></div>
      <div class="sk-item"></div>
      <div class="sk-item"></div>
      <div class="sk-item"></div>
    </div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

Vue 的 `app.mount('#app')` 和 React 的 `createRoot(container).render()` 都会替换容器内原有的内容，骨架屏会在应用首次渲染时被替换掉。

要点：

- 骨架屏的样式内联在 HTML 中，不依赖外部 CSS 文件。
- 骨架结构尽量与真实页面的布局一致，否则内容出来时会发生明显跳动，增加 CLS。
- 骨架屏只改善感知，不解决根本问题。如果页面一直停在骨架屏，本质还是白屏，监控时要把骨架屏也当作"未渲染"处理。
- 页面级骨架屏可以借助工具在构建时根据页面结构自动生成；组件级的加载占位（列表、卡片）在组件内部处理。

## SSR / SSG

服务端渲染（SSR）在服务器上执行框架代码，直接返回带有完整内容的 HTML。浏览器拿到 HTML 就能渲染首屏，之后 JS 加载完成再"激活"（hydration），绑定事件、接管交互。

静态站点生成（SSG）在构建时就生成好每个页面的 HTML，部署为静态文件，适合内容不随用户变化的页面（文档、营销页、文章）。

| 对比项 | CSR（客户端渲染） | SSR | SSG |
| --- | --- | --- | --- |
| 首屏内容出现时机 | JS 执行和接口返回后 | HTML 返回即可渲染 | HTML 返回即可渲染 |
| 服务端开销 | 只需静态托管 | 每次请求都要渲染 | 只在构建时渲染 |
| 数据实时性 | 实时 | 实时 | 构建时的数据，需要重新构建或增量再生 |
| 复杂度 | 低 | 高：需要 Node 服务，代码要兼容服务端环境 | 中 |

注意几点：

- SSR 改善的是 FCP 和 LCP，页面"看得见"后到"能交互"之间仍需等待 JS 加载和激活。JS 体积过大时，用户可能看到内容却点不动。
- 服务端渲染慢会直接推高 TTFB。可以对 HTML 做缓存，或使用流式渲染先返回页面框架。
- 代码中不能在模块顶层访问 `window`、`document` 这类浏览器对象；服务端和客户端渲染结果不一致时会产生激活不匹配的警告甚至错误。
- 一般通过 Next.js、Nuxt 这类元框架落地，不建议从零自己搭建。

## 关键 CSS 内联

外链 CSS 会阻塞渲染：在 CSS 下载并解析完成之前，浏览器不会绘制页面。把首屏所需的少量"关键 CSS"直接内联在 `<head>` 中，其余样式异步加载：

```html
<head>
  <style>
    /* 首屏关键样式：布局骨架、首屏可见区域的组件 */
    body { margin: 0; font-family: system-ui, sans-serif; }
    .header { height: 56px; display: flex; align-items: center; }
  </style>

  <!-- 非关键样式异步加载 -->
  <link rel="preload" href="/assets/main.css" as="style" onload="this.onload=null;this.rel='stylesheet'" />
  <noscript><link rel="stylesheet" href="/assets/main.css" /></noscript>
</head>
```

要点：

- 关键 CSS 需要控制体积，内联过多会让 HTML 变大，反而拖慢首个字节到首次渲染的时间。
- 手动维护关键 CSS 容易与真实样式脱节，可以在构建时用工具自动分析首屏用到的样式并内联。
- 内联的样式不能被浏览器单独缓存，每次请求 HTML 都会重复传输，这是它的代价。

## 预加载与预连接

浏览器只有在解析到资源引用时才会开始下载。有些资源发现得很晚：CSS 里引用的字体、JS 动态插入的图片、懒加载路由需要的 chunk。用资源提示（resource hints）可以提前告诉浏览器：

```html
<!-- 提前与第三方域名建立连接：DNS + TCP + TLS -->
<link rel="preconnect" href="https://cdn.example.com" crossorigin />

<!-- 只提前做 DNS 解析，开销更小，适合可能用到的域名 -->
<link rel="dns-prefetch" href="https://api.example.com" />

<!-- 当前页面一定会用到的关键资源，提前下载 -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/hero.webp" as="image" fetchpriority="high" />

<!-- 现代模块脚本的预加载 -->
<link rel="modulepreload" href="/assets/vendor-8c1d2e.js" />

<!-- 下一个页面可能用到的资源，空闲时低优先级下载 -->
<link rel="prefetch" href="/assets/detail-5b7a9f.js" />
```

要点：

- `preload` 只用于当前页面一定会用到的少数关键资源，`as` 属性必须填对，否则可能重复下载。预加载了却没使用，浏览器控制台会给出警告。
- 字体的 `preload` 必须加 `crossorigin`，即使是同源字体，因为字体总是以 CORS 模式请求。
- `preconnect` 会占用连接资源，只给 2～3 个最关键的域名使用。
- Vite 等构建工具会自动为入口依赖的 chunk 生成 `modulepreload`，一般不需要手写。

## 代码分割与懒加载

首屏只加载当前路由需要的代码，其余页面和非首屏组件按需加载，直接减少首屏 JS 的下载和执行时间。

路由级拆分，Vue Router：

```js
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./pages/Home.vue') },
    { path: '/report', component: () => import('./pages/Report.vue') },
  ],
});
```

组件级拆分，React：

```jsx
import { lazy, Suspense } from 'react';

const Chart = lazy(() => import('./Chart'));

export function Dashboard() {
  return (
    <Suspense fallback={<div className="chart-placeholder">图表加载中…</div>}>
      <Chart />
    </Suspense>
  );
}
```

要点：

- 动态 `import()` 是拆分点，构建工具会把它单独打成一个 chunk。
- 拆分不是越细越好：chunk 过多会增加请求数和调度开销。第三方依赖适合单独拆出，利用它们更新频率低的特点做长期缓存。
- 懒加载的 chunk 在用户触发时才下载，可能造成二次等待。对大概率会访问的页面，可以在空闲时 `prefetch`。
- 首屏用到的组件不要懒加载，否则反而多了一次串行请求。
- 用打包分析工具检查首屏 chunk 的构成，找出意外打进来的大依赖。

## 资源压缩与 CDN

- **代码压缩**：生产构建默认会压缩 JS 和 CSS，并做 tree shaking 删除未使用的导出。注意依赖是否以 ESM 形式发布、`package.json` 是否正确声明 `sideEffects`，否则 tree shaking 效果有限。
- **传输压缩**：文本资源开启 Brotli 或 gzip。图片、视频等已经压缩过的格式不需要再 gzip。

以 nginx 为例：

```nginx
gzip on;
gzip_comp_level 5;   # 取值 1～9，越大压缩率越高、CPU 开销越大，收益递减
gzip_min_length 1024;
gzip_types text/css application/javascript application/json image/svg+xml;
```

更好的做法是构建时生成 `.br` / `.gz` 预压缩文件，服务器直接返回，避免每次请求实时压缩。

- **图片**：使用 WebP / AVIF 格式，按显示尺寸提供合适分辨率，首屏外的图片懒加载。
- **CDN**：把静态资源部署到 CDN，用户从就近节点获取，缩短传输时间，也减轻源站压力。要注意 CDN 域名的连接成本，配合 `preconnect` 使用。

## 缓存策略

合理的缓存能让二次访问几乎不需要下载资源：

| 资源 | 文件名 | 缓存策略 |
| --- | --- | --- |
| JS、CSS、图片、字体 | 带内容哈希，如 `index-3f2a1c.js` | `Cache-Control: max-age=31536000, immutable` |
| HTML 入口 | 固定，如 `index.html` | `Cache-Control: no-cache`，每次向服务器确认 |

原理是：带哈希的文件内容一旦变化，文件名就变了，所以可以放心长期强缓存；HTML 引用了这些文件名，必须保证每次拿到最新版本。`no-cache` 不是"不缓存"，而是"使用缓存前必须向服务器验证"，未变化时服务器返回 304，开销很小。

关于强缓存和协商缓存：

- 强缓存：`Cache-Control`（HTTP/1.1 引入）和较早的 `Expires`（HTTP/1.0），命中时不发请求。两者同时存在时 `Cache-Control` 优先。
- 协商缓存：`Last-Modified` / `If-Modified-Since`（HTTP/1.0）和 `ETag` / `If-None-Match`（HTTP/1.1），需要发请求确认，未变化则返回 304。

webpack 中用 `[contenthash]` 生成带哈希的文件名，Vite 默认就会给构建产物加上哈希。

```js
// webpack.config.js
module.exports = {
  output: {
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].js',
  },
};
```

进一步可以用 Service Worker 缓存应用外壳（HTML、核心 JS、CSS），在弱网甚至离线时也能立即显示页面框架。但 Service Worker 会显著增加更新的复杂度，要设计好新版本激活和提示刷新的流程，否则用户可能长期停留在旧版本。更多缓存相关内容见[前端性能优化总览](/notes/fronted/optimization/introduction.html)。

## 错误边界与降级兜底

前面的方案缩短白屏时间，这一节防止页面因为错误变成"真白屏"。

### 框架层的错误边界

React 中，渲染期间抛出的错误如果没有被错误边界捕获，会导致整棵组件树被卸载。错误边界目前只能用类组件实现：

```jsx
import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportError({ error, componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert">
          <p>页面出了点问题</p>
          <button onClick={() => location.reload()}>重新加载</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

错误边界放在合适的粒度：根组件一层兜底，保证至少有提示；重要但非核心的区块（推荐位、图表）各自包一层，局部出错不影响整页。注意错误边界捕获不到事件处理函数和异步代码中的错误，这些仍需要 `try/catch` 和全局错误监听。

Vue 中可以用 `app.config.errorHandler` 做全局上报，用组件的 `onErrorCaptured` 钩子捕获子组件错误并渲染降级内容。

### 资源加载失败的处理

SPA 发版后，用户手里的旧页面去请求已经被删除的旧 chunk，会导致懒加载失败。处理方式：

- 部署时保留前几个版本的静态资源一段时间，不要发布即删除。
- 捕获 chunk 加载失败，提示用户或自动刷新。Vite 在预加载动态导入的依赖失败时会派发 `vite:preloadError` 事件：

```js
window.addEventListener('vite:preloadError', () => {
  // 避免反复刷新：只在本次会话中自动刷新一次
  if (!sessionStorage.getItem('reloaded-for-chunk-error')) {
    sessionStorage.setItem('reloaded-for-chunk-error', '1');
    location.reload();
  }
});
```

- 关键 CDN 资源加载失败时，可以切换到备用域名重新加载。

### HTML 层的最后兜底

如果主 JS 根本没执行起来（语法不兼容、加载失败），框架层的任何处理都不会生效。可以在 HTML 中放一段很小的内联脚本，超时后检查应用是否已挂载：

```html
<script>
  setTimeout(function () {
    if (!window.__APP_MOUNTED__) {
      var root = document.getElementById('app');
      root.innerHTML =
        '<div style="padding:24px;text-align:center">' +
        '<p>页面加载失败，请检查网络后重试</p>' +
        '<button onclick="location.reload()">重新加载</button></div>';
    }
  }, 8000);
</script>
```

应用挂载成功后设置 `window.__APP_MOUNTED__ = true`。这段脚本要用最保守的语法（不用箭头函数、模板字符串等），确保在应用代码无法运行的旧环境里也能执行。超时时间要结合真实用户的加载耗时分布设定，避免在慢网络下误伤正常加载。

### 接口失败的降级

- 首屏接口失败时展示明确的错误提示和重试按钮，而不是停留在空白或无限加载。
- 非核心数据失败时隐藏对应区块，不影响主体内容展示。
- 可以缓存上一次成功的数据，接口失败时先展示旧数据并提示。

:::caution
降级和兜底逻辑本身也要被监控。如果兜底页面频繁出现，说明有真实的问题需要修复，而不能仅仅因为"页面不再空白"就当作问题解决了。
:::

## 小结

- 骨架屏改善感知等待，写在 HTML 中才能不依赖 JS 显示；SSR / SSG 从根本上让 HTML 自带首屏内容。
- 关键 CSS 内联、`preload` / `preconnect` 让关键资源更早可用，都要控制数量，避免反效果。
- 代码分割减少首屏 JS，压缩和 CDN 减少传输时间，哈希文件名配合长期缓存、HTML 协商缓存保证更新。
- 错误边界、chunk 加载失败处理、HTML 内联兜底脚本和接口降级，防止报错或加载失败导致真白屏。
- 所有方案都要以 FCP、LCP 和白屏率数据验证效果。

## 参考

- [MDN：rel=preload](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Attributes/rel/preload)
- [MDN：HTTP 缓存](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Caching)
- [Vue：服务端渲染（SSR）](https://vuejs.org/guide/scaling-up/ssr.html)
- [React：lazy](https://react.dev/reference/react/lazy)
- [webpack：缓存](https://webpack.js.org/guides/caching/)
- [Vite：构建生产版本 - 加载报错处理](https://vitejs.dev/guide/build.html#load-error-handling)
