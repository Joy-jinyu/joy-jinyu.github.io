---
title: Node.js 异步与并发
description: 讲清 Node.js 单线程如何做到非阻塞 I/O、libuv 线程池的作用和调优、CPU 密集任务的三种拆分方式、并发控制的写法，以及流与背压。
---

Node.js 常被描述为"单线程、异步、非阻塞"，但这几个词背后有不少细节：哪些操作真的不占线程、哪些操作会挤占线程池、CPU 计算怎么办、异步调用发得太多会出什么问题。这篇把这些问题逐个讲清楚，并给出可以直接使用的并发控制和流处理写法。架构层面的背景见 [Node.js 架构与运行机制](/notes/fronted/language/node/introduction.html)，事件循环的阶段细节见[执行机制与事件循环](/notes/fronted/language/javascript/eventLoop.html)。

## 单线程如何实现非阻塞 I/O

先区分两个概念：

- **阻塞 / 非阻塞**：调用发起后，当前线程要不要停下来等结果。
- **同步 / 异步**：结果是调用直接返回，还是之后通过回调、Promise 通知。

Node 的"单线程"指的是执行 JS 代码的只有一个线程，Node 本身也没有提供让一段 JS 在多个线程间共享执行的能力（`worker_threads` 是另起独立的 JS 线程，后文再说）。但整个进程里并不只有一个线程：libuv 有线程池，V8 有垃圾回收等后台线程。

一次异步 I/O 的完整过程：

1. JS 调用 `fs.readFile` 或 `socket.write`，经过 bindings 交给 libuv，**立即返回**，JS 继续往下执行。
2. libuv 根据操作类型选择路径：
   - 网络 I/O：把 socket 设为非阻塞，注册到操作系统的事件通知机制（epoll、kqueue、IOCP 等），不需要额外线程等待。
   - 文件读写等：放到线程池，由池里的线程执行阻塞的系统调用。
3. 操作完成后，libuv 把对应回调放进事件循环的队列。
4. JS 线程空闲时，事件循环取出回调执行。

所以"非阻塞"并不是说没有任何东西在等待，而是**等待的工作不在 JS 线程上**。JS 线程只负责发起请求和处理结果，中间的空闲时间可以处理别的请求。

由此得出 Node 并发编程的核心约束：**不要阻塞事件循环**。任何在 JS 线程上长时间运行的代码，都会让所有请求一起变慢。常见的阻塞来源：

- 同步 API：`fs.readFileSync`、`child_process.execSync`、`crypto.pbkdf2Sync` 等。启动阶段读配置可以用，请求处理路径上不要用。
- 大 JSON 的 `JSON.parse` / `JSON.stringify`。
- 复杂度高的正则表达式，特别是可能发生灾难性回溯的写法（ReDoS）。
- 对大数组做同步的排序、遍历、计算。

## libuv 线程池

### 哪些操作走线程池

根据 Node 官方文档，使用线程池的主要是以下几类异步 API：

| 类别 | 操作 |
| --- | --- |
| 文件系统 | 除 `fs.watch` 相关和显式同步版本以外的 `fs` 异步 API |
| DNS | `dns.lookup()`、`dns.lookupService()` |
| 加密 | `crypto.pbkdf2()`、`crypto.scrypt()`、`crypto.randomBytes()`、`crypto.randomFill()`、`crypto.generateKeyPair()` 的异步版本 |
| 压缩 | `zlib` 的异步 API |

不走线程池的：

- TCP、UDP、HTTP 等网络 I/O，使用操作系统的事件通知机制。
- `dns.resolve*()` 系列，由 c-ares 处理，不占线程池。

一个容易忽略的点：`http.get('http://example.com')` 这类按主机名发起的请求，默认会先调用 `dns.lookup()` 解析域名，而 `dns.lookup()` 走线程池。所以大量并发的出站 HTTP 请求，也会和文件读写、加密操作争抢线程池。

### 线程池大小

线程池默认 4 个线程，可以通过环境变量 `UV_THREADPOOL_SIZE` 调整（libuv 文档给出的上限是 1024）。

```bash
UV_THREADPOOL_SIZE=16 node server.js
```

注意变量名是 `UV_THREADPOOL_SIZE`，不是一些旧资料里拼错的 `UV_THERADPOOL_SIZE`，拼错不会报错，只是不生效。

线程池在第一次被使用时创建，大小在创建时确定。在代码里写 `process.env.UV_THREADPOOL_SIZE = '16'` 只有在线程池创建之前执行才有效，而且受加载顺序影响，不可靠。推荐在启动命令或部署配置里设置环境变量。

### 什么时候需要调大

线程池满了之后，新的任务只能排队。症状是：CPU 不高，但文件读写、`dns.lookup`、加密等操作的耗时明显变长。例如服务同时处理很多 `bcrypt`、`pbkdf2` 哈希，或者大量读写文件，4 个线程很快就会排满。

调大线程池时要考虑：

- 线程数超过 CPU 核数后，CPU 密集的任务（如哈希）不会因此变快，只会增加上下文切换。
- 文件 I/O 类任务等待磁盘为主，适当调大有帮助。
- 先确认瓶颈确实在线程池，再调。

### 线程池和 JS 线程的关系

线程池里的线程**不执行 JS**，只执行 libuv 和 Node 内部的 C/C++ 代码。想在别的线程上跑自己的 JS 代码，需要 `worker_threads`。

## CPU 密集任务的处理

CPU 密集任务的问题不在于慢，而在于它占住 JS 线程，导致其他所有请求都无法被处理。解决方向是把计算挪出 JS 主线程。

### 方案一：worker_threads

`worker_threads` 在同一个进程里启动新的 JS 线程。每个 worker 有自己的 V8 实例和事件循环，和主线程之间通过消息通信。

```js
// main.mjs
import { Worker } from 'node:worker_threads';

function runFib(n) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./fib-worker.mjs', import.meta.url), {
      workerData: n,
    });
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`worker 退出码 ${code}`));
    });
  });
}

console.log(await runFib(40));
```

```js
// fib-worker.mjs
import { parentPort, workerData } from 'node:worker_threads';

function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

parentPort.postMessage(fib(workerData));
```

要点：

- 消息默认通过结构化克隆复制。大块二进制数据可以用 `transferList` 转移 `ArrayBuffer` 的所有权，避免复制；需要真正共享内存时用 `SharedArrayBuffer` 配合 `Atomics`。
- 创建 worker 有开销（独立的 V8 实例），不要每个请求都新建。实际项目中通常维护一个固定大小的 worker 池，任务排队分发，可以使用社区成熟的 worker 池库。
- worker 适合 CPU 计算。I/O 本来就是异步的，放进 worker 不会更快。

### 方案二：child_process

`child_process` 启动独立的操作系统进程，内存完全隔离。

| 方法 | 用途 |
| --- | --- |
| `spawn` | 启动任意命令，以流的方式读写 stdin / stdout，适合输出量大或长时间运行的命令 |
| `exec` | 通过 shell 执行命令，输出一次性缓冲后返回，适合输出较小的命令 |
| `execFile` | 直接执行可执行文件，不经过 shell，比 `exec` 更安全 |
| `fork` | 专门启动 Node 子进程，自带 IPC 通道，可以 `process.send` 互发消息 |

```js
import { spawn } from 'node:child_process';

const child = spawn('ffmpeg', ['-i', 'input.mp4', 'output.webm']);
child.stderr.on('data', (chunk) => process.stderr.write(chunk));
child.on('close', (code) => console.log('退出码', code));
```

`exec` 会经过 shell 解析，如果命令字符串里拼接了用户输入，就存在命令注入风险。有用户输入时用 `spawn` 或 `execFile`，参数以数组形式传入。

适用场景：调用外部程序（ffmpeg、git、图像处理工具）、运行需要完全隔离的任务、子任务崩溃不能影响主进程的场合。

### 方案三：cluster

`cluster` 让一个主进程 fork 出多个工作进程，**共享同一个监听端口**，把连接分发给各个工作进程。它解决的是"一个 Node 进程只能用满一个 CPU 核来跑 JS"的问题，属于横向扩展，而不是把单个计算任务拆开。

```js
import cluster from 'node:cluster';
import http from 'node:http';
import { availableParallelism } from 'node:os';

if (cluster.isPrimary) {
  for (let i = 0; i < availableParallelism(); i++) cluster.fork();
  cluster.on('exit', (worker) => {
    console.log(`进程 ${worker.process.pid} 退出，重新启动`);
    cluster.fork();
  });
} else {
  http
    .createServer((req, res) => res.end(`pid ${process.pid}\n`))
    .listen(3000);
}
```

工作进程之间不共享内存，会话、缓存等状态需要放到 Redis 之类的外部存储。现在更常见的做法是用 PM2 这类进程管理器，或者在容器编排层面直接起多个实例，由负载均衡分发流量，效果相同，运维上更统一。

### 三者对比

| 方案 | 隔离级别 | 通信方式 | 开销 | 适合 |
| --- | --- | --- | --- | --- |
| `worker_threads` | 线程，同进程 | 消息、可共享内存 | 较小 | 单个 CPU 密集计算 |
| `child_process` | 独立进程 | stdio、IPC | 较大 | 调用外部程序、强隔离任务 |
| `cluster` | 多个独立进程 | IPC | 较大 | 用满多核处理更多请求 |

:::tip
如果计算本身很重、调用频繁，也可以考虑用 Rust、C++ 写成原生扩展或 WebAssembly 模块，或者把这部分拆成单独的服务。Node 擅长编排，不必所有计算都在 JS 里完成。
:::

## 并发控制

全部使用异步调用，并不代表可以不管并发数。异步只意味着不阻塞 JS 线程，并不意味着下游资源无限：

- 一次性发出上万个 HTTP 请求，可能被对方限流、耗尽本机端口和文件描述符。
- 同时打开太多文件，会遇到 `EMFILE: too many open files`。
- 数据库连接池只有几十个连接，多出来的请求只是在排队，还会占用内存。
- 线程池只有几个线程，大量文件或加密操作同时提交，后面的只能等。

所以批量任务需要**限制同时进行的数量**。

### Promise 并发池

下面是一个不依赖第三方库的并发池：最多同时执行 `limit` 个任务，结果顺序与输入一致。

```js
/**
 * 以最多 limit 个并发执行 tasks，返回与输入顺序一致的结果
 * @param {Array<() => Promise<any>>} tasks
 * @param {number} limit
 */
async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

// 使用
const urls = Array.from({ length: 100 }, (_, i) => `https://example.com/item/${i}`);
const tasks = urls.map((url) => () => fetch(url).then((res) => res.status));
const statuses = await runWithConcurrency(tasks, 5);
```

原理是启动 `limit` 个"工人"，每个工人循环从共享的任务下标里取下一个任务执行。因为 JS 单线程，`next++` 不会出现竞争。

几点说明：

- 任务要以**函数**形式传入（`() => fetch(url)`），而不是直接传 Promise。Promise 一创建，请求就已经发出去了，再控制并发也来不及。
- 上面的实现遇到一个任务失败就会让整体 reject，但其他工人还会继续执行剩余任务。需要"失败不中断"时，在任务内部 `catch`，或者参照 `Promise.allSettled` 记录每个结果的状态。
- 生产环境可以直接使用 `p-limit`、`p-queue` 等成熟的库，它们还支持优先级、超时、暂停等功能。

### 限流

并发控制限制的是"同时在途的数量"；限流（rate limiting）限制的是"单位时间内的数量"，比如每秒最多 10 次。两者常常一起用：对方 API 规定每秒 10 次，同时自己也不想超过 5 个并发连接。

一个最简单的实现是按固定间隔放行请求（更灵活的方案有令牌桶、滑动窗口等算法）：

```js
function createRateLimiter(ratePerSecond) {
  const interval = 1000 / ratePerSecond;
  let nextAvailable = Date.now();

  return async function acquire() {
    const now = Date.now();
    const wait = Math.max(0, nextAvailable - now);
    nextAvailable = Math.max(now, nextAvailable) + interval;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  };
}

const acquire = createRateLimiter(10);
for (const url of urls) {
  await acquire();
  fetch(url).catch((err) => console.error(url, err)); // 每秒最多发出 10 个；不 await，但要处理失败
}
```

服务端对外提供接口时，也应该做限流，防止单个调用方占满资源。多实例部署时，计数需要放到 Redis 等共享存储里，单进程内存计数只对单个实例有效。

## 流（Stream）与背压

### 为什么需要流

处理一个 2 GB 的文件，如果用 `fs.readFile` 一次性读进内存再处理，内存占用就是 2 GB 以上，还可能超出限制。流把数据切成小块（chunk），读一块、处理一块、写一块，内存占用和文件大小无关。

Node 中的流有四种：

| 类型 | 说明 | 例子 |
| --- | --- | --- |
| Readable | 可读流，数据来源 | `fs.createReadStream`、HTTP 请求体（服务端的 `req`） |
| Writable | 可写流，数据去向 | `fs.createWriteStream`、HTTP 响应（服务端的 `res`） |
| Duplex | 可读可写，两端独立 | TCP socket |
| Transform | 可读可写，输出由输入变换而来 | `zlib.createGzip()`、加解密流 |

### 背压

当数据生产得比消费快时，比如从高速磁盘读、往慢速网络写，没被消费的数据会在内存中堆积。背压（backpressure）就是让消费方告诉生产方"先停一下"的机制。

Writable 流内部有一个缓冲区，大小阈值由 `highWaterMark` 决定。`write()` 的返回值就是背压信号：

- 返回 `true`：缓冲区还没满，可以继续写。
- 返回 `false`：缓冲区已超过阈值，应该停止写入，等 `'drain'` 事件再继续。

手动处理背压的写法：

```js
import { createReadStream, createWriteStream } from 'node:fs';

const reader = createReadStream('big.log');
const writer = createWriteStream('copy.log');

reader.on('data', (chunk) => {
  const ok = writer.write(chunk);
  if (!ok) {
    reader.pause(); // 写不过来，先暂停读取
    writer.once('drain', () => reader.resume());
  }
});
reader.on('end', () => writer.end());
```

如果忽略 `write()` 的返回值一直写，数据不会丢失，但会全部堆在内存里，流就失去了意义。

### 用 pipeline 组合流

实际开发中不需要手写上面的逻辑。`stream/promises` 中的 `pipeline` 会自动处理背压，并且在任意一个环节出错时销毁所有流、把错误传出来：

```js
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';

await pipeline(
  createReadStream('access.log'),
  createGzip(),
  createWriteStream('access.log.gz'),
);
console.log('压缩完成');
```

相比 `a.pipe(b).pipe(c)`，`pipeline` 的优势在于错误处理：`.pipe()` 不会在流之间传递错误，某个环节出错时其他流不会被关闭，容易造成文件句柄和内存泄漏。

### 可读流与异步迭代

可读流实现了异步迭代协议，可以用 `for await...of` 按块读取，`await` 本身就形成了天然的背压：上一块处理完之前不会读取下一块。

```js
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const rl = createInterface({ input: createReadStream('access.log') });

let errors = 0;
for await (const line of rl) {
  if (line.includes(' 500 ')) errors++;
}
console.log('500 错误数', errors);
```

在 HTTP 服务中，把文件直接流式返回给客户端，也是流的典型用法：

```js
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

http
  .createServer(async (req, res) => {
    res.setHeader('Content-Type', 'video/mp4');
    try {
      await pipeline(createReadStream('video.mp4'), res);
    } catch (err) {
      // 客户端中途断开等情况会走到这里
      console.error('传输中断', err.code);
    }
  })
  .listen(3000);
```

慢速客户端会让 `res` 的缓冲区填满，`pipeline` 自动暂停文件读取，服务端内存不会因为客户端慢而膨胀。

## 小结

- 单线程指执行 JS 的只有一个线程；I/O 等待由操作系统或 libuv 线程池完成，所以要避免在 JS 线程上做同步阻塞操作。
- 文件系统、`dns.lookup`、部分 `crypto` 和 `zlib` 异步 API 走线程池；网络 I/O 和 `dns.resolve*` 不走。线程池默认 4 个线程，用 `UV_THREADPOOL_SIZE` 在启动时调整。
- CPU 密集计算用 `worker_threads` 拆到其他线程；调用外部程序或需要强隔离用 `child_process`；用满多核处理请求用 `cluster` 或多实例部署。
- 异步不等于资源无限，批量任务要控制并发数，对外调用还要考虑速率限制；任务以函数形式传入并发池。
- 大数据处理用流，`write()` 返回 `false` 是背压信号；优先用 `stream/promises` 的 `pipeline` 组合流，它同时处理背压和错误清理。

## 参考

- [Node.js：Don't Block the Event Loop (or the Worker Pool)](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)
- [libuv 文档：Thread pool work scheduling](https://docs.libuv.org/en/v1.x/threadpool.html)
- [Node.js：Worker threads](https://nodejs.org/api/worker_threads.html)
- [Node.js：Child process](https://nodejs.org/api/child_process.html)
- [Node.js：Cluster](https://nodejs.org/api/cluster.html)
- [Node.js：Stream](https://nodejs.org/api/stream.html)
- [Node.js：Backpressuring in Streams](https://nodejs.org/en/learn/modules/backpressuring-in-streams)
