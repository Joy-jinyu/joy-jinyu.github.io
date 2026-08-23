---
title: 前端实时通信方案
description: 短轮询、长轮询、SSE、WebSocket 的原理与取舍，WebSocket 握手、心跳与重连的实现，以及 XMLHttpRequest、fetch、axios 的关系和 Web Worker、Service Worker 的定位。
---

聊天、通知、行情、协同编辑、AI 流式输出，这些场景都需要服务端把数据"推"给浏览器。HTTP 本身是"客户端请求、服务端响应"的模型，围绕"怎么让服务端主动发消息"出现了几种方案。这篇按演进顺序讲短轮询、长轮询、SSE 和 WebSocket 的原理和取舍，给出 WebSocket 心跳重连的实现，最后理清 XMLHttpRequest、fetch、axios 的关系。

## 短轮询

最直接的做法：客户端每隔固定时间发一次请求，问服务端有没有新数据。

```js
function startPolling(url, interval, onData) {
  let timer = null;
  let stopped = false;

  async function poll() {
    try {
      const res = await fetch(url);
      if (res.ok) onData(await res.json());
    } catch (err) {
      console.error('轮询失败', err);
    }
    if (!stopped) timer = setTimeout(poll, interval);
  }

  poll();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

const stop = startPolling('/api/messages', 5000, (data) => console.log(data));
```

这里用 `setTimeout` 递归而不是 `setInterval`：等上一次请求结束再计时，避免网络慢时请求堆积。

- **优点**：实现简单，服务端无需任何改造，兼容所有环境。
- **缺点**：实时性取决于轮询间隔，间隔短则浪费请求，间隔长则延迟高；大部分请求返回"没有新数据"，白白消耗带宽和服务端资源。
- **适用**：数据更新不频繁、对实时性要求不高的场景，比如每分钟刷新一次的统计面板、任务状态查询。

## 长轮询

长轮询是对短轮询的改进：客户端发出请求后，服务端如果没有新数据，**先不响应**，把请求挂起，直到有新数据或超时才返回。客户端收到响应后立即发起下一次请求。

```js
async function longPoll(url, onData) {
  while (true) {
    try {
      const res = await fetch(url);
      if (res.status === 200) {
        onData(await res.json());
      }
      // 204 表示服务端超时且没有数据，直接进入下一轮
    } catch (err) {
      // 网络错误时稍等再重试，避免失败后疯狂重发
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
```

- **优点**：有数据时几乎能立即送达，没有数据时也不会频繁请求；基于普通 HTTP，兼容性好。
- **缺点**：服务端要维持大量挂起的连接，对线程模型的服务端压力较大；每条消息之后都要重新建立请求，消息频繁时开销接近短轮询；超时、断线、消息在两次请求之间到达等边界情况需要处理。
- **适用**：在 WebSocket 不可用时作为降级方案。早期很多实时方案（统称 Comet）都基于长轮询或类似技术。

## SSE（Server-Sent Events）

SSE 是 HTML 标准定义的服务端推送机制。客户端发起一个普通的 HTTP 请求，服务端返回 `Content-Type: text/event-stream`，然后**保持连接不关闭**，持续往里写文本格式的事件。

### 消息格式

每条消息由若干字段行组成，以空行结束：

```text
id: 1
event: notice
data: {"title":"系统维护"}

data: 普通消息，没有 event 字段时触发 message 事件

retry: 5000
```

| 字段 | 含义 |
| --- | --- |
| `data` | 消息内容，多行 `data` 会用换行符拼接 |
| `event` | 事件名，客户端用 `addEventListener(事件名)` 监听，不写则触发 `message` |
| `id` | 消息 ID。断线重连时浏览器会通过 `Last-Event-ID` 请求头带上最后收到的 ID，服务端据此补发 |
| `retry` | 告诉浏览器断线后多少毫秒重连 |
| 以 `:` 开头的行 | 注释，常用来定时发送，防止连接被中间代理因空闲而断开 |

### 客户端

```js
const source = new EventSource('/api/stream');

source.onmessage = (e) => console.log('消息', e.data);
source.addEventListener('notice', (e) => {
  console.log('通知', JSON.parse(e.data));
});
source.onerror = () => {
  // 浏览器会自动重连；如果连接已被关闭（readyState 为 CLOSED），则不会再重连
  console.warn('连接异常，状态', source.readyState);
};

// 不再需要时主动关闭
// source.close();
```

### 服务端（Node.js）

```js
import http from 'node:http';

http
  .createServer((req, res) => {
    if (req.url !== '/api/stream') return res.end();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    let id = 0;
    const timer = setInterval(() => {
      id += 1;
      res.write(`id: ${id}\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
    }, 1000);

    req.on('close', () => clearInterval(timer));
  })
  .listen(3000);
```

### 特点与限制

- **优点**：基于 HTTP，不需要协议升级，代理和负载均衡容易支持；浏览器原生实现了自动重连和断点续传（`Last-Event-ID`）；协议是纯文本，调试方便。
- **单向**：只能服务端推给客户端。客户端要发消息，另外用普通 HTTP 请求。
- **只能传文本**：二进制数据需要编码（如 Base64）。
- **`EventSource` 的限制**：只能发 GET 请求，不能自定义请求头（无法直接带 `Authorization` 头，鉴权通常依赖 Cookie 或 URL 参数）。
- **连接数限制**：在 HTTP/1.1 下，浏览器对同一域名的并发连接数有限制（通常是 6 个），每个 SSE 连接都会长期占用一个，多开几个标签页就可能耗尽。HTTP/2 下多个流复用同一个连接，这个问题基本消失。

### 用 fetch 读取流式响应

需要 POST 请求或自定义请求头时（比如调用大模型接口的流式输出），可以不用 `EventSource`，改用 `fetch` 读取响应体的流，自己解析事件格式：

```js
async function streamChat(prompt, onChunk, signal) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt }),
    signal,
  });

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    // 一个事件以空行结束，最后一段可能还不完整，留到下一次拼接
    const events = buffer.split('\n\n');
    buffer = events.pop();
    for (const event of events) {
      const data = event
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n');
      if (data) onChunk(data);
    }
  }
}
```

这种方式失去了 `EventSource` 的自动重连，需要自己处理；`signal` 传入 `AbortController.signal`，用于中途取消。

## WebSocket

WebSocket 是独立的应用层协议（RFC 6455），在一个 TCP 连接上提供**全双工**通信：建立连接后，客户端和服务端随时都可以向对方发消息，消息可以是文本或二进制。

### 握手过程

WebSocket 连接从一次 HTTP 请求开始，通过协议升级切换过去。客户端发出：

```text
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Origin: https://example.com
```

服务端同意升级，返回：

```text
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

几个关键点：

- `Sec-WebSocket-Key` 是客户端生成的随机值，Base64 编码。
- `Sec-WebSocket-Accept` 是服务端把这个 Key 拼上协议规定的固定 GUID，计算 SHA-1，再做 Base64 编码得到的。它的作用是确认对方真的理解 WebSocket 协议，而不是一个误把请求当普通 HTTP 处理的服务器，**不是**安全认证手段。
- 状态码 101 之后，这个 TCP 连接就不再走 HTTP，而是按 WebSocket 的帧格式收发数据。
- 地址使用 `ws://` 或 `wss://`，后者基于 TLS。生产环境应使用 `wss://`，否则不仅不安全，还容易被中间代理干扰。
- 浏览器会带上 `Origin` 头，服务端应校验它，防止其他站点的页面借用户的 Cookie 建立连接（跨站 WebSocket 劫持）。

### 基本用法

```js
const ws = new WebSocket('wss://example.com/chat');

ws.addEventListener('open', () => {
  ws.send(JSON.stringify({ type: 'join', room: 'general' }));
});

ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  console.log('收到', msg);
});

ws.addEventListener('close', (e) => {
  console.log('连接关闭', e.code, e.reason);
});

ws.addEventListener('error', () => {
  // error 事件不提供具体原因，之后一定会触发 close
  console.error('连接出错');
});
```

常见的关闭码：`1000` 表示正常关闭；`1001` 表示一端离开（如页面关闭）；`1006` 表示连接异常断开、没有收到关闭帧，这个值不能主动发送，只会在异常时由浏览器报告。

### 心跳与重连

WebSocket 连接可能在双方都不知情的情况下失效：网络切换、设备休眠、中间的代理或负载均衡因为连接空闲而把它关掉。浏览器不一定能立即触发 `close`，于是出现"看起来连着，其实已经收不到消息"的情况。所以需要：

- **心跳**：定时发送一条消息，并期待对方回应。超时没回应，就认为连接已死，主动关闭并重连。
- **重连**：断开后自动重新建立连接，用指数退避控制重试间隔，避免服务端恢复时被所有客户端同时冲击。

协议本身定义了 Ping / Pong 控制帧，但浏览器的 `WebSocket` API 不允许手动发送 Ping，所以前端的心跳通常在应用层实现，约定一种消息类型，比如 `{"type":"ping"}`，服务端回 `{"type":"pong"}`。

```js
class ReconnectingSocket {
  constructor(url, { onMessage, heartbeatInterval = 15000, heartbeatTimeout = 5000 } = {}) {
    this.url = url;
    this.onMessage = onMessage;
    this.heartbeatInterval = heartbeatInterval;
    this.heartbeatTimeout = heartbeatTimeout;
    this.retries = 0;
    this.closedByUser = false;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.retries = 0;
      this.startHeartbeat();
    };

    this.ws.onmessage = (e) => {
      // 收到任何消息都说明连接是活的
      this.resetHeartbeatTimeout();
      const msg = JSON.parse(e.data);
      if (msg.type === 'pong') return;
      this.onMessage?.(msg);
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      if (!this.closedByUser) this.scheduleReconnect();
    };
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws.readyState !== WebSocket.OPEN) return;
      this.ws.send(JSON.stringify({ type: 'ping' }));
      // 发出 ping 后等待回应，超时则判定连接已死
      this.pongTimer ??= setTimeout(() => this.ws.close(), this.heartbeatTimeout);
    }, this.heartbeatInterval);
  }

  resetHeartbeatTimeout() {
    clearTimeout(this.pongTimer);
    this.pongTimer = null;
  }

  stopHeartbeat() {
    clearInterval(this.pingTimer);
    this.resetHeartbeatTimeout();
  }

  scheduleReconnect() {
    // 指数退避：1s、2s、4s……最长 30s，加随机抖动分散重连时间
    const base = Math.min(1000 * 2 ** this.retries, 30000);
    const delay = base / 2 + Math.random() * (base / 2);
    this.retries += 1;
    setTimeout(() => this.connect(), delay);
  }

  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false; // 调用方可以选择缓存消息，等重连后补发
  }

  close() {
    this.closedByUser = true;
    this.stopHeartbeat();
    this.ws.close(1000);
  }
}

const socket = new ReconnectingSocket('wss://example.com/chat', {
  onMessage: (msg) => console.log(msg),
});
```

实际项目还需要考虑：

- **页面可见性**：页面切到后台时，浏览器可能对定时器降频，心跳间隔会被拉长。可以监听 `visibilitychange` 和 `online` 事件，回到前台或网络恢复时立即检查连接状态。
- **消息补偿**：重连期间服务端发出的消息会丢失。常见做法是消息带递增序号，重连后客户端告诉服务端最后收到的序号，由服务端补发。
- **鉴权**：浏览器的 `WebSocket` 构造函数不能设置自定义请求头。通常的做法是依赖 Cookie、在 URL 上带短期有效的 token，或者连接建立后第一条消息发送凭证。
- **服务端多实例**：WebSocket 是有状态的长连接，多实例部署时，发给某个用户的消息需要路由到持有他连接的实例上，通常借助消息队列或发布订阅系统广播。

Socket.IO 这类库在 WebSocket 之上提供了自动重连、房间、消息确认和降级到长轮询等能力。要注意它有自己的协议，客户端和服务端必须配套使用，不能直接连接普通的 WebSocket 服务。

## 方案选型

| 方案 | 方向 | 实时性 | 服务端成本 | 断线重连 | 数据类型 | 典型场景 |
| --- | --- | --- | --- | --- | --- | --- |
| 短轮询 | 客户端拉取 | 取决于间隔 | 请求多，大部分是无效请求 | 天然无状态 | 任意 | 低频状态查询 |
| 长轮询 | 近似服务端推送 | 较好 | 需维持挂起的请求 | 需自行处理 | 任意 | WebSocket 不可用时的降级 |
| SSE | 服务端到客户端 | 好 | 长连接，基于普通 HTTP | 浏览器内置 | 文本 | 通知、行情、日志、AI 流式输出 |
| WebSocket | 双向 | 好 | 长连接，需要支持协议升级 | 需自行处理 | 文本与二进制 | 聊天、协同编辑、游戏、高频双向交互 |

选择思路：

1. 只需要服务端推给客户端，优先考虑 SSE，实现和运维都更简单。
2. 需要高频的双向通信，选 WebSocket。
3. 更新频率低、对实时性不敏感，短轮询就够了，不要过度设计。
4. 需要兼容无法使用长连接的网络环境时，准备长轮询作为降级。

此外还有 WebTransport，基于 HTTP/3（QUIC），支持多路流和不可靠传输，适合对延迟极其敏感的场景，但浏览器和服务端的支持仍在推进中，使用前要确认目标环境。

## XMLHttpRequest、fetch 与 axios

这三者经常被放在一起比较，但它们不在同一个层面：

- **Ajax** 是一种技术思路的统称（Asynchronous JavaScript and XML）：在不刷新页面的情况下，用 JS 异步请求数据并更新页面。它不是某个具体 API。
- **XMLHttpRequest（XHR）** 是浏览器最早提供的、实现 Ajax 的原生 API。名字里有 XML，但可以传输任何格式。
- **fetch** 是更现代的原生请求 API，基于 Promise，和 `Request`、`Response`、`Headers`、流等 API 配套。Node.js 新版本也内置了 fetch。
- **axios** 是第三方库，在浏览器中基于 XHR 封装（新版本也可以配置使用 fetch 作为底层），在 Node.js 中基于 `http` 模块。

对比：

| 方面 | XMLHttpRequest | fetch | axios |
| --- | --- | --- | --- |
| 来源 | 浏览器原生 | 浏览器与 Node 原生 | 第三方库 |
| 编程风格 | 事件回调 | Promise | Promise |
| HTTP 错误状态 | 需自己判断 `status` | 4xx / 5xx **不会** reject，需检查 `res.ok` | 默认非 2xx 都 reject |
| JSON 处理 | 手动解析或设置 `responseType` | 手动调用 `res.json()` | 自动序列化请求体、解析响应 |
| 超时 | `xhr.timeout` | 用 `AbortSignal.timeout(ms)` | `timeout` 配置项 |
| 取消请求 | `xhr.abort()` | `AbortController` | 支持 `AbortController` 的 `signal` |
| 上传进度 | 支持（`xhr.upload.onprogress`） | 不直接支持 | 支持（浏览器中基于 XHR） |
| 下载进度 / 流式读取 | 下载进度支持，流式读取不方便 | 可逐块读取 `res.body` | 浏览器中不方便流式读取 |
| 拦截器 | 无 | 无，需自行封装 | 内置请求与响应拦截器 |
| 携带 Cookie 跨域 | `withCredentials` | `credentials: 'include'` | `withCredentials` |
| 体积 | 0 | 0 | 需要引入依赖 |

fetch 最容易踩的坑是错误处理：

```js
async function request(url, options) {
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    // fetch 只在网络错误、被取消时 reject，HTTP 错误需要自己抛出
    throw new Error(`请求失败：${res.status}`);
  }
  return res.json();
}
```

选择建议：

- 新代码优先用 fetch，配合一个薄封装统一处理错误、超时、鉴权头。
- 需要上传进度、或团队已经大量依赖拦截器等功能时，axios 依然是成熟的选择。
- 直接使用 XHR 的场景已经很少，主要是需要上传进度又不想引入依赖时。

## Web Worker 与 Service Worker 的定位

早期一些资料把 Web Worker、Service Worker 和轮询、WebSocket 并列为"即时通讯方案"，这不准确。它们不是通信协议，而是浏览器提供的**在主线程之外运行脚本**的机制，可以和上面的通信方案配合使用。

| | Web Worker | Service Worker |
| --- | --- | --- |
| 定位 | 后台线程，分担主线程的计算 | 介于页面和网络之间的代理脚本 |
| 生命周期 | 随创建它的页面存在 | 独立于页面，由浏览器按需启动和终止 |
| 能否操作 DOM | 不能 | 不能 |
| 与页面通信 | `postMessage` | `postMessage`、`clients` API |
| 典型用途 | 大数据计算、解析、压缩；也可以把 WebSocket 连接放在 Worker 里处理，减轻主线程负担 | 拦截请求实现离线缓存（PWA）、接收 Web Push 推送消息、后台同步 |

和实时通信相关的两种用法：

- **SharedWorker**：同源的多个标签页可以共享一个 Worker。把 WebSocket 连接放在 SharedWorker 里，多个标签页只需要一条连接，避免每开一个页面就多一条长连接。注意 SharedWorker 的浏览器支持并不完整，使用前要确认目标环境。
- **Service Worker + Web Push**：页面关闭后仍然能收到服务端推送并展示系统通知。这依赖浏览器厂商的推送服务，需要用户授权通知权限，适合"离线也要触达"的通知类场景，不适合高频的实时数据。

## 小结

- 短轮询实现最简单但浪费请求；长轮询让服务端挂起请求，有数据才返回，主要用作降级方案。
- SSE 基于普通 HTTP 实现服务端单向推送，浏览器内置自动重连和 `Last-Event-ID` 续传；需要 POST 或自定义请求头时可以用 fetch 读取流式响应。
- WebSocket 通过 HTTP 101 协议升级建立全双工连接，适合高频双向通信；生产环境需要应用层心跳、指数退避重连、消息补偿和 Origin 校验。
- 选型原则：单向推送优先 SSE，双向高频用 WebSocket，低频更新用短轮询。
- Ajax 是技术统称，XHR 和 fetch 是原生 API，axios 是封装库；fetch 不会因 HTTP 错误状态 reject，需要检查 `res.ok`。
- Web Worker、Service Worker 是在主线程外运行脚本的机制，不是通信协议，可以承载连接或接收推送。

## 参考

- [MDN：使用服务器发送事件](https://developer.mozilla.org/zh-CN/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [MDN：WebSocket](https://developer.mozilla.org/zh-CN/docs/Web/API/WebSocket)
- [RFC 6455：The WebSocket Protocol](https://www.rfc-editor.org/rfc/rfc6455)
- [MDN：使用 Fetch](https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API/Using_Fetch)
- [MDN：XMLHttpRequest](https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest)
- [MDN：Web Workers API](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API)
- [MDN：Service Worker API](https://developer.mozilla.org/zh-CN/docs/Web/API/Service_Worker_API)
- [HTML 标准：Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
