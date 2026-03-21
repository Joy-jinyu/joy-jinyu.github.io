---
title: 执行机制与事件循环
description: 从调用栈、任务队列讲到宏任务与微任务、渲染时机、async/await 的展开方式，以及浏览器与 Node.js 事件循环的差异。
---

JavaScript 代码"按什么顺序执行"，由运行时的事件循环决定。这篇从单线程模型讲起，梳理宏任务和微任务的划分、一轮循环里渲染发生在哪、`async/await` 如何拆成微任务，再对比 Node.js 的事件循环阶段。读完应该能独立推出一段异步代码的输出顺序，并知道背后的规则来自哪里。

## 单线程与运行时结构

JavaScript 引擎在一个线程上执行代码：同一时刻只有一段 JS 在跑，不会被另一段 JS 打断。这是"单线程"的确切含义。但浏览器和 Node.js 本身是多线程的：网络请求、定时器计时、文件读写都由宿主环境在别处完成，完成后把"该执行哪个回调"交回 JS 线程。

运行时可以拆成几个部分：

| 组成 | 作用 |
| --- | --- |
| 调用栈（call stack） | 记录当前正在执行的函数。每调用一个函数压入一个执行上下文，返回时弹出。 |
| 堆（heap） | 存放对象等动态分配的数据。 |
| 任务队列（task queue） | 存放等待执行的回调，比如定时器到期、事件触发、I/O 完成后的回调。 |
| 微任务队列（microtask queue） | 存放 Promise 回调等，优先级高于任务队列。 |
| 事件循环（event loop） | 不断检查调用栈是否为空，为空就从队列里取回调来执行。 |

基本流程：

1. 同步代码依次压入调用栈执行。
2. 遇到异步 API（如 `setTimeout`、`fetch`、事件监听），把工作交给宿主环境，JS 继续往下执行，不等结果。
3. 异步工作完成后，宿主把对应回调放进队列。
4. 调用栈清空后，事件循环从队列取出回调执行，如此往复。

一个直接推论：队列里的回调必须等当前调用栈清空才能执行。如果同步代码跑了 2 秒，`setTimeout(fn, 0)` 也至少要等 2 秒。

## 宏任务与微任务

"宏任务"是社区叫法，HTML 规范里叫 task（任务），微任务叫 microtask。两者的区别不在于"是不是在别的线程完成"，而在于**进入哪个队列、什么时候被清空**。

### 常见来源

| 类型 | 浏览器 | Node.js |
| --- | --- | --- |
| 宏任务 | 整段 `<script>` 的执行、`setTimeout` / `setInterval`、用户交互事件（click、keydown 等）、网络请求回调、`MessageChannel` 消息 | `setTimeout` / `setInterval`、`setImmediate`、I/O 回调 |
| 微任务 | `Promise.then/catch/finally`、`queueMicrotask`、`MutationObserver` 回调、`await` 之后的代码 | `Promise` 回调、`queueMicrotask`、`await` 之后的代码；另有优先级更高的 `process.nextTick` 队列 |

注意 `requestAnimationFrame` 不属于以上两类，它在渲染步骤里执行，后面单独讲。`setImmediate` 是 Node.js 的 API，浏览器里没有标准实现。

### 执行顺序

浏览器一轮事件循环可以简化为：

1. 从某个任务队列取出**一个**宏任务执行（浏览器有多个任务队列，取哪个由浏览器决定，比如可能优先处理用户输入）。
2. 执行完后进行微任务检查点：**清空**微任务队列。执行微任务过程中新加入的微任务，也会在这一步被执行完。
3. 如果到了渲染时机，执行渲染相关步骤。
4. 回到第 1 步。

关键是"一个宏任务、一整批微任务"。正因为微任务会被清空到底，如果微任务里不断递归地添加新微任务，页面会卡死，渲染和后续宏任务都无法执行：

```js
function loop() {
  queueMicrotask(loop); // 永远清不空，页面失去响应
}
loop();
```

而用 `setTimeout` 递归则不会卡死，因为每次只执行一个宏任务，中间有机会处理渲染和其他事件。

### queueMicrotask 与 MutationObserver

`queueMicrotask(fn)` 直接把函数放进微任务队列，不需要借 `Promise.resolve().then(fn)` 绕一层，也不会产生多余的 Promise 对象。它适合"在当前同步代码结束后、浏览器渲染前统一处理一次"的场景，比如合并多次状态修改。

`MutationObserver` 的回调也以微任务方式触发：同一段同步代码里对 DOM 做了多次修改，回调只会在之后被调用一次，拿到这一批变更记录。

```js
const target = document.createElement('div');
const observer = new MutationObserver((records) => {
  console.log('变更数量', records.length);
});
observer.observe(target, { attributes: true });

target.setAttribute('a', '1');
target.setAttribute('b', '2');
console.log('同步代码结束');
// 同步代码结束
// 变更数量 2
```

它的前身是 DOM3 定义的 Mutation Events（`DOMNodeInserted` 等），那套事件同步触发、性能差，已被废弃，现在应使用 `MutationObserver`。

## 渲染时机与 requestAnimationFrame

浏览器不会在每个宏任务后都渲染。渲染频率通常跟随显示器刷新率，页面不可见时还可能暂停。在一轮循环中如果有渲染机会，"更新渲染"这一步大致按以下顺序进行：

1. 处理 resize、scroll 等事件。
2. 执行 `requestAnimationFrame` 回调。
3. 计算样式、布局。
4. 绘制。

因此 `requestAnimationFrame` 的回调总在下一次绘制之前执行，适合做动画：在里面修改样式，修改结果会体现在这一帧里。

几个推论：

- 同一个宏任务里对 DOM 改了很多次，屏幕上只会看到最终结果，因为渲染发生在宏任务和微任务都执行完之后。
- 微任务在渲染之前被清空，所以在微任务里改 DOM，同样会在这一帧生效。
- `setTimeout(fn, 0)` 和 `requestAnimationFrame(fn)` 谁先执行不确定，取决于当时离下一次渲染还有多久。不要依赖它们的先后。
- `requestAnimationFrame` 的回调里如果再调用 `requestAnimationFrame`，新回调会在下一帧执行，而不是本帧。

```js
// 先把元素放到起点，下一帧再触发过渡
box.style.transform = 'translateX(0)';
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    box.style.transition = 'transform 0.3s';
    box.style.transform = 'translateX(100px)';
  });
});
```

这里套两层，是为了确保起点状态已经被渲染过一次，过渡才有起点。浏览器渲染流程的细节可以参考[浏览器工作原理](/notes/system/browser/basic.html)。

## async/await 在事件循环中的展开

`async` 函数可以理解为基于 Promise 的语法糖：

- 调用 `async` 函数时，函数体**同步**开始执行，直到遇到第一个 `await`。
- `await x` 会把 `x` 转成 Promise（相当于 `Promise.resolve(x)`），然后暂停函数，把"剩余部分"注册为这个 Promise 的回调。
- 当这个 Promise 完成，剩余部分作为微任务继续执行。
- `async` 函数总是返回一个 Promise，函数体的 `return` 值就是它的完成值，抛出的异常变成拒绝原因。

下面两段代码的执行时机大致等价：

```js
async function foo() {
  console.log('A');
  await bar();
  console.log('B');
}

// 近似展开
function foo() {
  console.log('A');
  return Promise.resolve(bar()).then(() => {
    console.log('B');
  });
}
```

"近似"是因为细节上有差别：`await` 一个原生 Promise 时，现代引擎会直接复用它，恢复执行只需一个微任务；早期实现会多包几层，需要更多微任务轮次。所以一些较老的资料给出的输出顺序和现在的运行结果不一致，以当前引擎实际运行为准。

另一个容易误会的点：`await` 后面即使是一个普通值（如 `await 1`），也会让出执行权，后续代码进入微任务，不会同步继续。

## 分析示例

### 示例一：Promise 与 setTimeout

```js
console.log('script start');

setTimeout(() => {
  console.log('setTimeout');
}, 0);

Promise.resolve()
  .then(() => console.log('promise1'))
  .then(() => console.log('promise2'));

console.log('script end');
```

逐步分析：

1. 整段脚本本身是一个宏任务。同步输出 `script start`。
2. `setTimeout` 的回调交给定时器，到期后进入任务队列。
3. `Promise.resolve()` 已经是完成状态，第一个 `then` 的回调直接进入微任务队列。第二个 `then` 依赖第一个返回的 Promise，暂时不入队。
4. 同步输出 `script end`。脚本这个宏任务结束。
5. 清空微任务：执行 `promise1`，它返回后第二个 `then` 的回调入队，紧接着在同一轮清空中执行 `promise2`。
6. 下一轮循环取出定时器回调，输出 `setTimeout`。

输出：

```text
script start
script end
promise1
promise2
setTimeout
```

### 示例二：async/await 混合

```js
async function async1() {
  console.log('async1 start');
  await async2();
  console.log('async1 end');
}

async function async2() {
  console.log('async2');
}

console.log('script start');

setTimeout(() => console.log('setTimeout'), 0);

async1();

new Promise((resolve) => {
  console.log('promise1');
  resolve();
}).then(() => console.log('promise2'));

console.log('script end');
```

逐步分析：

1. 输出 `script start`。
2. 注册定时器，回调稍后进入任务队列。
3. 调用 `async1`：同步输出 `async1 start`；接着调用 `async2`，同步输出 `async2`，`async2` 返回一个已完成的 Promise。`await` 暂停 `async1`，把"输出 `async1 end`"注册为该 Promise 的回调，因为 Promise 已完成，这个回调进入微任务队列（记为 M1）。
4. `new Promise` 的执行器函数是同步执行的，输出 `promise1`，随后 `resolve()`，`then` 回调进入微任务队列（记为 M2）。
5. 输出 `script end`。
6. 清空微任务：先 M1 输出 `async1 end`，再 M2 输出 `promise2`。
7. 下一个宏任务输出 `setTimeout`。

输出：

```text
script start
async1 start
async2
promise1
script end
async1 end
promise2
setTimeout
```

如果在较老的引擎里运行，`async1 end` 可能排在 `promise2` 之后，原因见上一节。

### 示例三：同一次点击的两个监听器

```html
<button id="btn">点我</button>
<script>
  const btn = document.getElementById('btn');
  btn.addEventListener('click', () => {
    Promise.resolve().then(() => console.log('micro 1'));
    console.log('listener 1');
  });
  btn.addEventListener('click', () => {
    Promise.resolve().then(() => console.log('micro 2'));
    console.log('listener 2');
  });
</script>
```

用户真实点击时，输出是：

```text
listener 1
micro 1
listener 2
micro 2
```

因为浏览器分发事件时，每个监听器回调执行完、调用栈清空，就会做一次微任务检查点。

如果改成在脚本里调用 `btn.click()`，输出变成：

```text
listener 1
listener 2
micro 1
micro 2
```

此时两个监听器是在 `btn.click()` 这次调用内部同步执行的，调用栈上始终还有外层脚本，微任务要等外层脚本执行完才会清空。这个例子说明：微任务清空的时机是"调用栈为空"，而不是简单的"一个宏任务结束"。

## Node.js 的事件循环

Node.js 的事件循环由 libuv 实现，一轮循环分为若干阶段，每个阶段有自己的回调队列：

| 阶段 | 执行内容 |
| --- | --- |
| timers | 到期的 `setTimeout` / `setInterval` 回调 |
| pending callbacks | 部分被推迟到下一轮的系统操作回调（如某些 TCP 错误） |
| idle, prepare | Node 内部使用 |
| poll | 获取新的 I/O 事件，执行 I/O 相关回调；没有其他任务时会在这里等待 I/O |
| check | `setImmediate` 回调 |
| close callbacks | 关闭事件回调，如 `socket.on('close')` |

### process.nextTick 与微任务

`process.nextTick` 有一个独立的队列，不属于上表任何阶段。规则是：每当一个回调执行完（无论在哪个阶段），先清空 `nextTick` 队列，再清空 Promise 微任务队列，然后才继续。

```js
// CommonJS 模块中运行
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));
console.log('sync');
// sync
// nextTick
// promise
```

`nextTick` 递归调用同样会饿死事件循环，I/O 回调将永远得不到执行。官方文档建议在大多数场景下优先使用 `setImmediate` 或 `queueMicrotask`。

:::caution
上面的顺序针对 CommonJS。在 ES 模块里，模块顶层代码本身是在一个异步流程里执行的，Promise 回调可能先于 `nextTick` 执行。分析顺序时要先确认代码运行在哪种模块系统下。
:::

### setTimeout 与 setImmediate

在主模块里直接写：

```js
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
```

两者的先后**不确定**。Node 会把 0 毫秒的延迟按 1 毫秒处理，进入事件循环时如果 1 毫秒已经过去，timers 阶段先执行 `timeout`；否则先走到 check 阶段执行 `immediate`。这取决于进程当时的性能状况。

但放进 I/O 回调里就是确定的：

```js
const fs = require('fs');

fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
  process.nextTick(() => console.log('nextTick'));
});
// nextTick
// immediate
// timeout
```

分析：`readFile` 的回调在 poll 阶段执行。回调结束后先清空 `nextTick` 队列，输出 `nextTick`。poll 之后是 check 阶段，输出 `immediate`。下一轮循环才回到 timers 阶段，输出 `timeout`。

### 与浏览器的差异

| 方面 | 浏览器 | Node.js |
| --- | --- | --- |
| 规范来源 | HTML 标准 | libuv 实现与 Node 文档 |
| 宏任务组织 | 多个任务队列，由浏览器调度 | 按固定阶段顺序轮转 |
| 渲染 | 有渲染步骤和 `requestAnimationFrame` | 没有渲染 |
| 额外队列 | 无 | `process.nextTick` 队列，优先于 Promise 微任务 |
| `setImmediate` | 非标准，不应使用 | 在 check 阶段执行 |

早期 Node.js（11 之前）在同一阶段里会先把一批定时器回调全部执行完，再统一清微任务，与浏览器行为不一致。从 Node.js 11 起改为每执行完一个 `setTimeout` / `setImmediate` 回调就清空一次微任务，与浏览器对齐。旧资料里关于这一点的结论不要照搬。更多 Node.js 运行机制可参考 [Node.js 架构与运行机制](/notes/fronted/language/node/introduction.html)和 [Node.js 异步与并发](/notes/fronted/language/node/problem.html)。

## 常见误区

- **"微任务不参与事件循环"**：微任务是事件循环的一部分，它在每次调用栈清空时被执行，只是不像宏任务那样一轮取一个。
- **"宏任务是在别的线程里执行的"**：所有 JS 回调都在 JS 线程执行。在别的线程完成的是计时、网络、I/O 等底层工作，完成后回调仍要回到 JS 线程排队。
- **"requestAnimationFrame 是宏任务"**：它属于渲染步骤，执行频率跟随渲染，而不是像任务队列那样逐个取出。
- **"setTimeout(fn, 0) 会立即执行"**：它至少要等当前同步代码和所有微任务执行完。HTML 规范还规定，嵌套层级较深（超过 5 层）的定时器最小延迟会被限制为 4 毫秒；后台标签页中的定时器也可能被浏览器进一步降频。
- **"Promise 的执行器是异步的"**：`new Promise(executor)` 里的 `executor` 是同步执行的，只有 `then` / `catch` / `finally` 的回调才是微任务。
- **"await 之后的代码是同步继续的"**：无论 `await` 的是什么，后续代码都会进入微任务。
- **"一个宏任务执行完才清微任务"**：准确说法是调用栈为空时清微任务，事件分发场景下两者会有差别（见示例三）。

## 小结

- JS 在单线程上执行，异步工作由宿主环境完成，回调通过任务队列和微任务队列回到 JS 线程。
- 一轮循环执行一个宏任务，随后在调用栈为空时清空全部微任务，再视情况进行渲染。
- `requestAnimationFrame` 在渲染步骤中、绘制之前执行，既不是宏任务也不是微任务。
- `await` 把函数剩余部分变成微任务；现代引擎里 `await` 原生 Promise 只需一个微任务轮次。
- Node.js 按 timers、poll、check 等阶段轮转，`process.nextTick` 队列优先于 Promise 微任务；主模块中 `setTimeout(0)` 与 `setImmediate` 的先后不确定，I/O 回调中 `setImmediate` 一定先执行。

## 参考

- [HTML 标准：Event loops](https://html.spec.whatwg.org/multipage/webappapis.html#event-loops)
- [MDN：在 JavaScript 中通过 queueMicrotask() 使用微任务](https://developer.mozilla.org/zh-CN/docs/Web/API/HTML_DOM_API/Microtask_guide)
- [MDN：queueMicrotask()](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/queueMicrotask)
- [MDN：MutationObserver](https://developer.mozilla.org/zh-CN/docs/Web/API/MutationObserver)
- [MDN：requestAnimationFrame()](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestAnimationFrame)
- [Node.js：The Node.js Event Loop](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick)
