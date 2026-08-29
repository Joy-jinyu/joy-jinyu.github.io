---
title: 错误类型与异常处理
description: JavaScript 内置错误类型与触发场景、Error 对象的属性、try/catch/finally 语义、自定义错误，以及 Promise、async 和全局层面的错误处理。
---

程序出错时，JavaScript 会抛出一个错误对象，沿调用栈向上传播，直到被 `catch` 住或者到达顶层。这篇先认识内置的错误类型和 `Error` 对象的结构，再讲同步代码、Promise、`async/await` 各自怎么捕获错误，最后是浏览器和 Node.js 的全局兜底以及实践建议。

## 内置错误类型

所有内置错误类型都继承自 `Error`，可以用 `instanceof` 区分：

| 类型 | 含义 | 典型触发场景 |
| --- | --- | --- |
| `Error` | 所有错误的基类 | 业务代码手动 `throw new Error('...')` |
| `TypeError` | 值的类型不符合操作要求 | 读取 `null` / `undefined` 的属性、调用非函数、给 `const` 变量重新赋值 |
| `ReferenceError` | 引用了不存在的变量 | 使用未声明的变量、在暂时性死区内访问 `let` / `const` |
| `RangeError` | 数值超出允许范围 | `new Array(-1)`、`(1).toFixed(101)`、`'a'.repeat(-1)` |
| `SyntaxError` | 代码或数据的语法不合法 | 解析源码时出错、`JSON.parse('{')`、`new Function('a b')` |
| `URIError` | URI 编解码函数收到非法参数 | `decodeURIComponent('%')` |
| `EvalError` | 与 `eval` 相关的错误 | 当前规范已不会主动抛出，保留只为兼容 |
| `AggregateError` | 把多个错误打包成一个 | `Promise.any` 的所有 Promise 都拒绝时 |

逐个看触发代码：

```js
null.foo;                 // TypeError: Cannot read properties of null
undefined();              // TypeError: undefined is not a function
const a = 1; a = 2;       // TypeError: Assignment to constant variable.

notDefined;               // ReferenceError: notDefined is not defined
{ console.log(x); let x = 1; } // ReferenceError: 初始化前不能访问 x

new Array(-1);            // RangeError: Invalid array length
JSON.parse('{');          // SyntaxError
decodeURIComponent('%');  // URIError: URI malformed
```

几个容易混淆的点：

- **写在源码里的语法错误无法被同一段代码 catch。** 整个脚本在解析阶段就失败了，一行都不会执行。只有在运行时解析字符串（`JSON.parse`、`eval`、`new Function`）产生的 `SyntaxError` 才能被捕获。
- **栈溢出的错误类型因引擎而异。** 无限递归在 V8（Chrome、Node.js）里是 `RangeError: Maximum call stack size exceeded`，在 Firefox 里是非标准的 `InternalError: too much recursion`。
- **严格模式会把一些静默失败变成 `TypeError`**，比如给只读属性赋值、给冻结对象添加属性。非严格模式下这些操作什么也不发生，也不报错。

`AggregateError` 的 `errors` 属性保存了全部子错误：

```js
try {
  await Promise.any([
    Promise.reject(new Error('A 失败')),
    Promise.reject(new Error('B 失败')),
  ]);
} catch (e) {
  console.log(e instanceof AggregateError); // true
  console.log(e.errors.map((err) => err.message)); // ['A 失败', 'B 失败']
}
```

## Error 对象的结构

```js
const err = new Error('请求失败', { cause: originalError });
```

| 属性 | 说明 |
| --- | --- |
| `message` | 错误描述，构造时传入的字符串 |
| `name` | 错误类型名，定义在原型上，如 `'Error'`、`'TypeError'`；自定义错误应覆盖它 |
| `stack` | 调用栈字符串，不在 ECMAScript 规范里，但主流引擎都支持，格式各不相同 |
| `cause` | 构造时通过第二个参数 `{ cause }` 传入，表示"这个错误是由哪个错误引起的" |

`String(err)` 或 `err.toString()` 得到的是 `"name: message"`，不包含栈。打日志时要单独输出 `stack`，否则丢失定位信息。

`cause` 解决的是"包装错误时丢掉原始错误"的问题。以前常见的写法是把原始错误信息拼进新的 `message`，原始的栈就没了：

```js
async function loadUser(id) {
  try {
    return await fetchJSON(`/api/users/${id}`);
  } catch (err) {
    // 给出业务上下文，同时保留原始错误
    throw new Error(`加载用户 ${id} 失败`, { cause: err });
  }
}
```

上层拿到的错误既有可读的业务描述，又能通过 `err.cause` 一路追到底层原因。

另外，`throw` 可以抛出任何值（字符串、数字、普通对象），但这些值没有 `stack`，也无法用 `instanceof Error` 判断。始终抛出 `Error` 或其子类的实例。

## try / catch / finally

### 基本语义

```js
try {
  // 可能出错的代码
} catch (err) {
  // try 块抛错时执行，err 是被抛出的值
} finally {
  // 无论是否出错、是否 return，都会执行
}
```

- `try` 必须搭配 `catch` 或 `finally` 中的至少一个。
- 如果用不到错误对象，可以省略绑定：`catch { ... }`。
- `catch` 只能捕获**同步执行期间**抛出的错误。`try` 里注册的回调稍后执行时抛错，已经不在这个 `try` 的调用栈里了：

```js
try {
  setTimeout(() => {
    throw new Error('捕获不到');
  }, 0);
} catch (err) {
  // 不会进入这里
}
```

### finally 的执行时机

`finally` 在 `try` / `catch` 中的 `return`、`throw`、`break`、`continue` 生效之前执行：

```js
function f() {
  try {
    return 'try';
  } finally {
    console.log('finally 先执行');
  }
}
f(); // 打印 "finally 先执行"，返回 'try'
```

如果 `finally` 里自己写了 `return` 或 `throw`，会**覆盖**前面的返回值或异常：

```js
function g() {
  try {
    throw new Error('原始错误');
  } finally {
    return 'finally 的返回值'; // 原始错误被吞掉
  }
}
g(); // 'finally 的返回值'，没有任何报错
```

所以 `finally` 只用来做清理（关闭连接、释放锁、隐藏 loading），不要在里面 `return`。

### 按类型分别处理

`catch` 不能像某些语言那样按类型写多个分支，需要在一个 `catch` 里判断，处理不了的重新抛出：

```js
try {
  const config = JSON.parse(text);
  apply(config);
} catch (err) {
  if (err instanceof SyntaxError) {
    showMessage('配置格式不正确');
  } else {
    throw err; // 不认识的错误交给上层
  }
}
```

"只处理自己认识的错误"是一条重要原则。把所有错误都 catch 住再打一行日志，等于把 bug 藏了起来。

## 自定义错误类

业务中常需要区分"参数不合法""未登录""资源不存在"等情况，自定义错误类可以让调用方用 `instanceof` 精确判断，并携带额外字段：

```js
class AppError extends Error {
  constructor(message, options) {
    super(message, options); // 把 cause 传给父类
    this.name = new.target.name; // 子类也能自动得到正确的 name
  }
}

class HttpError extends AppError {
  constructor(status, message, options) {
    super(message, options);
    this.status = status;
  }
}

class ValidationError extends AppError {
  constructor(field, message) {
    super(message);
    this.field = field;
  }
}

try {
  throw new HttpError(404, '用户不存在');
} catch (err) {
  console.log(err.name);                 // 'HttpError'
  console.log(err instanceof AppError);  // true
  console.log(err.status);               // 404
}
```

要点：

- 一定要调用 `super(message, options)`，否则 `message`、`stack`、`cause` 都不完整。
- 设置 `name`，否则日志里所有自定义错误都显示为 `Error`。
- 用一个公共基类（如 `AppError`）把"预期内的业务错误"和"程序 bug"区分开，上层可以只对前者做友好提示。

V8 还提供了非标准的 `Error.captureStackTrace(obj, fn)`，用于给任意对象挂上栈并隐藏某些调用帧，只在 Node.js 和 Chromium 系浏览器中可用。用 `class extends Error` 时不需要它。

## Promise 与 async 的错误处理

### Promise 链

Promise 的执行器和 `then` 回调中抛出的错误，会变成拒绝（reject），沿链传给下一个 `catch`：

```js
fetch('/api/data')
  .then((res) => {
    if (!res.ok) throw new HttpError(res.status, '请求失败');
    return res.json();
  })
  .then((data) => render(data))
  .catch((err) => showError(err))   // 捕获前面任何一步的错误
  .finally(() => hideLoading());
```

注意 `fetch` 只在网络层失败时拒绝，HTTP 404、500 仍然是成功的响应，需要自己检查 `res.ok`。

`then(onFulfilled, onRejected)` 的第二个参数和 `.catch` 有区别：第二个参数捕获不到同一个 `then` 里 `onFulfilled` 抛出的错误，`.catch` 写在后面则可以。一般统一用 `.catch`。

### async / await

`await` 一个被拒绝的 Promise，会在当前位置抛出异常，所以可以直接用 `try/catch`：

```js
async function init() {
  try {
    const user = await loadUser(1);
    render(user);
  } catch (err) {
    showError(err);
  }
}
```

常见陷阱：

- **漏写 `await`。** `try { loadUser(1) } catch {}` 里，Promise 的拒绝发生在 `try` 结束之后，根本不会进 `catch`。
- **`return` 和 `return await` 不一样。** 在 `try` 块里 `return promise` 时，函数直接把这个 Promise 交出去，它之后的拒绝不经过本函数的 `catch`；写成 `return await promise` 才能在本地捕获。
- **并发时的错误。** `Promise.all` 只要有一个拒绝就整体拒绝，其他结果拿不到；需要每个结果都知道时用 `Promise.allSettled`：

```js
const results = await Promise.allSettled([loadA(), loadB(), loadC()]);
for (const r of results) {
  if (r.status === 'rejected') report(r.reason);
}
```

Promise 回调的执行时机（微任务）可以参考[执行机制与事件循环](/notes/fronted/language/javascript/eventLoop.html)。

### 未处理的拒绝

一个被拒绝的 Promise 如果没有任何地方处理（没有 `catch`、没有被 `await` 在 `try` 中），就是"未处理的拒绝"。

浏览器会在 `window` 上触发 `unhandledrejection` 事件：

```js
window.addEventListener('unhandledrejection', (event) => {
  report(event.reason);   // 拒绝原因，通常是 Error 对象
  // event.promise 是被拒绝的那个 Promise
  // event.preventDefault() 可以阻止浏览器在控制台输出默认报错
});
```

如果之后又给这个 Promise 补上了处理函数，浏览器会再触发一次 `rejectionhandled` 事件。

Node.js 对应的是 `process.on('unhandledRejection', handler)`。从 Node.js 15 起，未处理的拒绝默认会让进程以错误退出，旧版本只打印警告。服务端代码更要保证每个 Promise 都有人处理。

## 全局错误监听

全局监听是兜底手段，用来上报漏网的错误，不能代替局部的错误处理。

### window.onerror 与 error 事件

同步代码或回调中抛出、未被捕获的错误，会触发 `window` 上的 `error` 事件。有两种注册方式：

```js
window.onerror = (message, source, lineno, colno, error) => {
  report({ message, source, lineno, colno, stack: error?.stack });
  return true; // 返回 true 会阻止浏览器的默认报错输出
};

window.addEventListener('error', (event) => {
  // event 是 ErrorEvent，event.error 是原始错误对象
  report(event.error);
});
```

### 资源加载失败

`<img>`、`<script>`、`<link>` 加载失败时，`error` 事件在元素自身上触发且**不冒泡**，`window.onerror` 收不到。要在全局捕获，需要在捕获阶段监听：

```js
window.addEventListener(
  'error',
  (event) => {
    if (event.target !== window) {
      // 资源加载错误：event 是普通 Event，没有 message 和 error
      report({ type: 'resource', url: event.target.src || event.target.href });
    }
  },
  true, // 捕获阶段
);
```

### 跨域脚本的 "Script error."

从其他域加载的脚本出错时，出于安全考虑，浏览器只给出 `"Script error."`，没有行号和栈。解决办法是两边配合：`<script>` 标签加 `crossorigin="anonymous"`，脚本所在服务器返回允许当前域的 `Access-Control-Allow-Origin` 响应头。

### 汇总

| 错误来源 | 捕获方式 |
| --- | --- |
| 同步代码 | `try/catch` |
| Promise 链 | `.catch` |
| `async` 函数 | `try/catch` + `await` |
| 漏掉的同步/回调错误 | `window` 的 `error` 事件 / `window.onerror` |
| 漏掉的 Promise 拒绝 | `unhandledrejection` 事件 |
| 资源加载失败 | 捕获阶段监听 `error` 事件 |
| React 组件渲染错误 | 错误边界（Error Boundary） |
| Node.js 进程级 | `process.on('uncaughtException')` / `process.on('unhandledRejection')` |

Node.js 里 `uncaughtException` 触发后进程状态可能已经不一致，官方文档建议只在其中做同步的清理和日志，然后退出进程，由进程管理器重启，而不是继续运行。

## 实践建议

- **只抛 `Error` 实例**，需要区分场景就写自定义错误类，并设置 `name`。
- **包装错误时用 `cause`** 保留原始错误，而不是把原始信息拼进字符串。
- **只 catch 能处理的错误**，其余的重新抛出。禁止空的 `catch {}`，至少要记录。
- **区分预期错误和程序 bug。** 参数校验失败、权限不足这类预期错误，给用户友好提示；`TypeError`、`ReferenceError` 这类通常是代码缺陷，应该上报并修复。
- **在边界处统一处理。** 接口请求层统一转换 HTTP 错误，UI 层统一展示，全局监听统一上报，中间层大多数时候让错误自然向上传播即可。
- **上报时带上下文**：`stack`、页面 URL、用户操作、版本号。生产环境的代码经过压缩，需要配合 source map 还原栈。
- **不要把内部细节暴露给用户。** 错误详情写进日志，界面上只给通用提示。

## 小结

- 内置错误类型都继承自 `Error`，常见的是 `TypeError`、`ReferenceError`、`RangeError`、`SyntaxError`，`AggregateError` 用于打包多个错误。
- `Error` 对象的关键属性是 `message`、`name`、`stack`、`cause`；`stack` 非标准但普遍可用，`cause` 用来串起错误链。
- `try/catch` 只捕获同步错误；`finally` 总会执行，里面的 `return` 会覆盖原有结果，应避免。
- Promise 用 `.catch`，`async` 函数用 `try/catch` 配合 `await`；未处理的拒绝会触发 `unhandledrejection`，Node.js 默认会因此退出。
- 全局 `error`、`unhandledrejection` 监听只做兜底上报，资源加载错误要在捕获阶段监听。

## 参考

- [MDN：Error](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Error)
- [MDN：try...catch](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Statements/try...catch)
- [MDN：AggregateError](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/AggregateError)
- [MDN：Window: unhandledrejection 事件](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/unhandledrejection_event)
- [MDN：Window: error 事件](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/error_event)
- [Node.js：Process 事件](https://nodejs.org/api/process.html#process-events)
