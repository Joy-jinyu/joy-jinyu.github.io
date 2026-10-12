---
title: HTML5 新特性
description: 概览 HTML5 带来的语义化标签、表单增强、音视频、Canvas 与 SVG、Web Storage、History API、拖放、Web Worker、地理定位等能力，各配最小示例。
---

"HTML5"最初指 2014 年前后定稿的那一版 HTML 规范，后来泛指同一时期出现的一整批 Web API。现在 HTML 由 WHATWG 以"活标准"（HTML Living Standard）的形式持续更新，不再有 HTML6 之类的版本号。这篇按用途梳理这批特性，每项给出最小示例；文中提到的特性除特别注明外，在主流浏览器中都已普遍可用。

## 语义化标签

HTML5 新增了一组描述页面结构的元素，替代过去满屏的 `<div class="header">`：

| 元素 | 含义 |
| --- | --- |
| `<header>` / `<footer>` | 页面或某个区块的页眉、页脚 |
| `<nav>` | 主要导航链接区域 |
| `<main>` | 页面主体内容，一个页面只应有一个可见的 `<main>` |
| `<article>` | 可以独立分发的完整内容，如一篇文章、一条评论 |
| `<section>` | 带主题的内容分组，通常带一个标题 |
| `<aside>` | 与主内容关系不大的附属内容，如侧边栏 |
| `<figure>` / `<figcaption>` | 图表、代码、插图及其说明 |
| `<time>` | 机器可读的时间，`datetime` 属性写标准格式 |
| `<mark>` | 高亮标记的文本 |
| `<details>` / `<summary>` | 原生可折叠区块，无需 JS |
| `<dialog>` | 原生对话框，`showModal()` 打开模态框 |

```html
<body>
  <header><nav><a href="/">首页</a></nav></header>
  <main>
    <article>
      <h1>标题</h1>
      <p>发布于 <time datetime="2024-01-01">1 月 1 日</time></p>
      <details>
        <summary>展开更多</summary>
        <p>折叠内容</p>
      </details>
    </article>
    <aside>相关推荐</aside>
  </main>
  <footer>版权信息</footer>
</body>
```

语义化的价值主要在于：屏幕阅读器能根据这些元素生成"地标"供用户快速跳转；搜索引擎更容易识别主体内容；代码本身也更好读。只是换了标签名而样式不变，没有任何性能收益，也不要为了"语义化"而滥用 `<section>`。

## 表单增强

### 新的 input 类型

| 类型 | 用途 |
| --- | --- |
| `email` / `url` / `tel` | 校验格式（`tel` 不校验），移动端弹出对应键盘 |
| `number` / `range` | 数字输入框、滑块 |
| `date` / `time` / `datetime-local` / `month` / `week` | 原生日期时间选择器 |
| `color` | 颜色选择器 |
| `search` | 搜索框，部分浏览器带清除按钮 |

不支持的类型会退化成普通 `text` 输入框，所以可以放心使用。原生日期选择器在不同浏览器里外观差异较大，对样式要求高的场景仍会用组件库。

### 校验与辅助属性

| 属性 | 作用 |
| --- | --- |
| `required` | 必填 |
| `pattern` | 用正则校验输入（隐式整体匹配） |
| `min` / `max` / `step` | 数值、日期范围和步长 |
| `minlength` / `maxlength` | 文本长度 |
| `placeholder` | 占位提示，不能替代 `<label>` |
| `autocomplete` | 自动填充提示，如 `email`、`current-password` |
| `autofocus` | 页面加载后自动聚焦 |
| `list` + `<datalist>` | 给输入框提供候选项 |
| `novalidate`（form 上） | 关闭原生校验，交给 JS 处理 |

```html
<form>
  <label>邮箱 <input type="email" name="email" required></label>
  <label>验证码 <input name="code" pattern="\d{6}" required></label>
  <label>城市 <input name="city" list="cities"></label>
  <datalist id="cities">
    <option value="北京"></option>
    <option value="上海"></option>
  </datalist>
  <button>提交</button>
</form>
```

提交时浏览器会自动校验，不通过就阻止提交并显示提示。JS 可以通过约束校验 API 介入：

```js
const input = document.querySelector('input[name="code"]');
input.addEventListener('input', () => {
  input.setCustomValidity(input.value === '000000' ? '验证码无效' : '');
});

const form = document.querySelector('form');
form.checkValidity();   // 返回布尔值，不显示提示
form.reportValidity();  // 返回布尔值，并显示浏览器提示
input.validity.valueMissing; // ValidityState 上的各项具体原因
```

CSS 侧可以用 `:valid`、`:invalid` 设置样式；`:user-invalid` 只在用户交互后才匹配，避免页面一打开就满屏红框。前端校验只是体验优化，服务端仍然必须校验。

## 音视频

`<video>` 和 `<audio>` 让浏览器原生播放媒体，取代了过去依赖 Flash 插件的做法。

```html
<video controls width="640" poster="cover.jpg" preload="metadata">
  <source src="movie.webm" type="video/webm">
  <source src="movie.mp4" type="video/mp4">
  <track kind="subtitles" src="zh.vtt" srclang="zh" label="中文" default>
  当前浏览器不支持 video 元素。
</video>
```

- `<source>` 可以提供多个格式，浏览器选第一个支持的。
- `<track>` 加载 WebVTT 格式的字幕或章节。
- `controls` 显示原生控制条；也可以不加，用 JS 调用 `play()`、`pause()` 自己做控件。
- 浏览器普遍有自动播放限制：带声音的 `autoplay` 通常会被拦截，静音（`muted`）的视频一般允许自动播放。`play()` 返回 Promise，被拦截时会 reject，需要处理。
- iOS Safari 上视频默认可能进入全屏播放，加 `playsinline` 可以在页面内播放。

`<embed>` 和 `<object>` 用于嵌入外部资源，过去常配合插件使用。插件时代已经结束，现在嵌入其他页面用 `<iframe>`。

## Canvas 与 SVG

两者都能画图，但模型完全不同：

| 方面 | Canvas | SVG |
| --- | --- | --- |
| 模型 | 位图，即时模式：画完就是像素，不记录"画了什么" | 矢量，保留模式：每个图形是一个 DOM 节点 |
| 缩放 | 放大会模糊，需按设备像素比处理 | 任意缩放都清晰 |
| 交互 | 需要自己算点击落在哪个图形上 | 每个元素可以直接绑事件、用 CSS 设置样式 |
| 性能特点 | 图形数量多时更快，适合频繁重绘 | 节点多时 DOM 开销大 |
| 可访问性 | 内容对辅助技术不可见，需额外处理 | 可以加 `<title>` 等文本 |
| 典型场景 | 游戏、大数据量图表、图像处理、粒子动画 | 图标、Logo、交互较多的少量图形、地图 |

Canvas 通过 `getContext()` 获取绘图上下文，`'2d'` 是二维 API，`'webgl'` / `'webgl2'` 是基于 OpenGL ES 的 3D 接口：

```html
<canvas id="c" width="200" height="100"></canvas>
<script>
  const ctx = document.getElementById('c').getContext('2d');
  ctx.fillStyle = 'steelblue';
  ctx.fillRect(10, 10, 80, 50);
  ctx.beginPath();
  ctx.arc(150, 50, 30, 0, Math.PI * 2);
  ctx.stroke();
</script>
```

注意 `width` / `height` 属性决定画布的像素尺寸，CSS 宽高只决定显示尺寸，两者不一致会导致拉伸模糊。在高清屏上，通常把画布像素尺寸设为 CSS 尺寸乘以 `devicePixelRatio`，再用 `ctx.scale()` 缩放坐标。

同样的图形用 SVG 写：

```html
<svg width="200" height="100" viewBox="0 0 200 100">
  <rect x="10" y="10" width="80" height="50" fill="steelblue" />
  <circle cx="150" cy="50" r="30" fill="none" stroke="black" />
</svg>
```

WebGL 直接调用 GPU，需要编写 GLSL 着色器，原生 API 比较底层，实际项目多用 Three.js 等库封装。更新的 WebGPU API 正在逐步普及，使用前需确认目标浏览器的支持情况。

## Web Storage

`localStorage` 和 `sessionStorage` 提供简单的键值存储，API 相同：

```js
localStorage.setItem('theme', 'dark');
localStorage.getItem('theme');      // 'dark'
localStorage.removeItem('theme');

// 只能存字符串，对象需要序列化
localStorage.setItem('user', JSON.stringify({ id: 1 }));
const user = JSON.parse(localStorage.getItem('user') ?? 'null');
```

| 方面 | `localStorage` | `sessionStorage` |
| --- | --- | --- |
| 生命周期 | 持久保存，除非手动清除 | 标签页关闭即清除 |
| 共享范围 | 同源的所有标签页 | 仅当前标签页（同源也不共享） |

几个要点：

- 只能存字符串，数字会被转成字符串，对象不序列化会变成 `"[object Object]"`。
- 容量有限，通常是每个源几 MB 级别，写满时 `setItem` 会抛异常；隐私模式下也可能受限，读写应放在 `try/catch` 里。
- API 是同步的，大量读写会阻塞主线程。大数据量用 IndexedDB。
- 同源的**其他**标签页修改了 `localStorage`，当前页面会收到 `storage` 事件，可用于跨标签页同步。
- 任何能执行 JS 的代码都能读到，不要存放令牌等敏感信息。和 Cookie 的对比见 [Cookie 详解](/notes/system/browser/cookies.html)。

## History API

`pushState` / `replaceState` 可以修改地址栏 URL 而不刷新页面，这是单页应用前端路由（history 模式）的基础：

```js
history.pushState({ page: 2 }, '', '/list?page=2'); // 新增一条历史记录
history.replaceState({ page: 2 }, '', '/list?page=2'); // 替换当前记录

window.addEventListener('popstate', (e) => {
  console.log('回到了', location.pathname, e.state);
  // 在这里根据 URL 重新渲染页面
});
```

- `pushState` 和 `replaceState` 本身**不会**触发 `popstate`，只有用户点前进后退或调用 `history.back()` 等方法才会触发。
- 新 URL 必须同源。
- 用 history 模式时，服务器需要把所有前端路由都回退到入口 HTML，否则用户刷新页面会得到 404。

更新的 Navigation API 提供了更完整的导航拦截能力，但浏览器支持还不如 History API 广泛。

## 拖放

任何元素加上 `draggable="true"` 就可以拖动，通过一组事件和 `dataTransfer` 对象传递数据：

```html
<div id="item" draggable="true">拖我</div>
<div id="zone">放到这里</div>
<script>
  item.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', 'item-1');
  });
  zone.addEventListener('dragover', (e) => {
    e.preventDefault(); // 必须阻止默认行为，否则不允许放置
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.textContent = '收到 ' + e.dataTransfer.getData('text/plain');
  });
</script>
```

从桌面拖文件进页面时，`drop` 事件的 `e.dataTransfer.files` 就是文件列表，常用于上传。原生拖放 API 在触屏设备上支持不佳，需要同时支持移动端时一般基于 Pointer Events 自己实现，或使用成熟的拖拽库。

## Web Worker

JS 主线程同时负责执行脚本和页面渲染，长时间计算会卡住页面（见 [执行机制与事件循环](/notes/fronted/language/javascript/eventLoop.html)）。Web Worker 把脚本放到后台线程运行。

### 专用 Worker

```js
// main.js
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

worker.postMessage({ n: 40 });
worker.onmessage = (e) => console.log('结果', e.data);
worker.onerror = (e) => {
  console.error(e.message, e.filename, e.lineno);
};

// 不再需要时由主线程终止
// worker.terminate();
```

```js
// worker.js
self.onmessage = (e) => {
  const result = fib(e.data.n);
  self.postMessage(result);
  // 也可以在 Worker 内部自行结束：self.close();
};

function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}
```

要点：

- 通信用 `postMessage` 发送、`message` 事件接收，数据经过结构化克隆复制，不共享内存。大块二进制数据（如 `ArrayBuffer`）可以作为第二个参数"转移"所有权，避免复制。
- Worker 内不能访问 DOM、`window`，但可以用 `fetch`、定时器、IndexedDB 等。
- 终止方式有两种：主线程调用 `worker.terminate()`，或 Worker 内部调用 `self.close()`。
- `error` 事件的 `message` 是错误信息，`filename` 是出错的脚本文件 URL，`lineno` 是行号。
- `{ type: 'module' }` 让 Worker 脚本可以使用 `import`。
- Worker 内部可以再创建 Worker（嵌套 Worker）。
- 没有单独的脚本文件时，可以把代码字符串包成 `Blob`，用 `URL.createObjectURL` 生成地址来创建 Worker。

### 其他 Worker

- **SharedWorker**：同源的多个页面共享一个 Worker 实例，通过 `port` 通信。部分移动端浏览器支持有限，使用前查兼容性。
- **Service Worker**：充当页面和网络之间的代理，可以拦截请求、配合 Cache API 实现离线缓存，也是推送通知的基础。它只能在安全上下文（HTTPS 或 localhost）中注册。

### 应用缓存已被移除

早期 HTML5 提供过应用缓存（Application Cache，通过 `manifest` 属性和 cache manifest 文件声明离线资源）。它的更新机制难以控制，已从规范和浏览器中移除。离线能力现在应使用 Service Worker 加 Cache API 实现。

## 地理定位

```js
if ('geolocation' in navigator) {
  navigator.geolocation.getCurrentPosition(
    (pos) => console.log(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
    (err) => console.warn('定位失败', err.code, err.message),
    { enableHighAccuracy: false, timeout: 10000 },
  );
}
```

- 只能在安全上下文（HTTPS 或 localhost）中使用，并且会弹出权限请求，用户可以拒绝。
- `watchPosition` 持续监听位置变化，返回的 id 交给 `clearWatch` 取消。
- 精度取决于设备和定位来源，`accuracy` 字段给出以米为单位的精度估计。

## 服务器推送：SSE

Server-Sent Events 让服务器通过一个长连接持续向浏览器推送文本消息，浏览器端用 `EventSource` 接收，断线会自动重连：

```js
const es = new EventSource('/events');
es.onmessage = (e) => console.log(e.data);
es.onerror = () => console.warn('连接异常，浏览器会尝试重连');
// es.close();
```

它是单向的（服务器到客户端），基于普通 HTTP，比 WebSocket 简单。需要双向通信时用 WebSocket。两者的详细对比见 [前端实时通信方案](/notes/fronted/instantMessage/introduction.html)。

## 小结

- "HTML5"现在由 WHATWG 以活标准形式维护，文中特性在主流浏览器中基本都已普遍可用。
- 语义化标签服务于可访问性和可读性；表单新类型和校验属性提供原生校验，配合约束校验 API 定制，服务端仍需校验。
- Canvas 是位图、即时绘制，适合大量图形和频繁重绘；SVG 是矢量 DOM，适合少量可交互图形。
- Web Storage 只存字符串、同步、容量有限；History API 支撑前端路由，`pushState` 不触发 `popstate`。
- Web Worker 把计算移出主线程，不能访问 DOM，通过 `postMessage` 通信；应用缓存已被移除，离线能力用 Service Worker。

## 参考

- [HTML Living Standard](https://html.spec.whatwg.org/multipage/)
- [MDN：HTML 元素参考](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element)
- [MDN：客户端表单验证](https://developer.mozilla.org/zh-CN/docs/Learn/Forms/Form_validation)
- [MDN：Canvas API](https://developer.mozilla.org/zh-CN/docs/Web/API/Canvas_API)
- [MDN：Web Storage API](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Storage_API)
- [MDN：History API](https://developer.mozilla.org/zh-CN/docs/Web/API/History_API)
- [MDN：使用 Web Workers](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API/Using_web_workers)
- [MDN：Geolocation API](https://developer.mozilla.org/zh-CN/docs/Web/API/Geolocation_API)
- [MDN：使用服务器发送事件](https://developer.mozilla.org/zh-CN/docs/Web/API/Server-sent_events/Using_server-sent_events)
