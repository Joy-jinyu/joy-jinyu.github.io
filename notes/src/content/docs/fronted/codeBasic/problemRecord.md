---
title: 开发踩坑记录
description: 日常前端开发中遇到的典型问题，按现象、原因、解决整理，涵盖正则 lastIndex、行内元素尺寸、动画、滚动条、背景与盒模型、文件编码、表单回车提交等。
---

这篇收集开发中实际遇到过的问题，每条按"现象 / 原因 / 解决"整理，方便下次遇到时对照排查。条目之间没有先后关系，可以按标题直接查。

## JavaScript

### 带 g 标志的正则，test() 结果时真时假

**现象**：同一个正则对同一个字符串反复调用 `test()`，结果交替出现 `true` 和 `false`。

```js
const re = /a/g;
console.log(re.test('abc')); // true
console.log(re.test('abc')); // false
console.log(re.test('abc')); // true
```

**原因**：带 `g`（全局）或 `y`（粘连）标志的正则对象会记录 `lastIndex`。每次 `test()` / `exec()` 从 `lastIndex` 位置开始查找，匹配成功后把 `lastIndex` 更新为匹配结束的位置；匹配失败时重置为 0。第二次调用从下标 1 开始找，找不到 `a`，于是返回 `false` 并归零，第三次又成功。

把正则存成模块级常量、在多处复用时最容易踩到。

**解决**：

1. 只判断"是否包含"时，不要加 `g`：`/a/.test(str)`。
2. 必须用 `g` 时，每次使用前手动重置：`re.lastIndex = 0`。
3. 需要取出全部匹配时，用 `String.prototype.matchAll()` 或 `match()`，它们不会受外部正则对象 `lastIndex` 状态的影响：

```js
const re = /\d+/g;
const nums = [...'a1b22c333'.matchAll(re)].map((m) => m[0]); // ['1', '22', '333']
```

### 递归没有终止条件导致栈溢出

**现象**：页面卡住后报 `RangeError: Maximum call stack size exceeded`。

**原因**：递归函数缺少终止条件，或者终止条件永远达不到（比如树形数据里存在循环引用、参数没有向终止条件收敛）。

**解决**：

- 递归函数第一件事就是判断终止条件。
- 每次递归调用，参数必须朝终止条件靠近。
- 处理可能带循环引用的数据（如图结构、某些接口返回的父子互指数据）时，用 `Set` 或 `WeakSet` 记录已访问的节点。

```js
function walk(node, visit, seen = new WeakSet()) {
  if (!node || seen.has(node)) return; // 终止条件
  seen.add(node);
  visit(node);
  (node.children ?? []).forEach((child) => walk(child, visit, seen));
}
```

层级可能非常深的数据，改用循环加显式栈，避免调用栈溢出。

### 不要用 eval 把字符串转成布尔值

**现象**：为了把 `'true'` / `'false'` 转成布尔值，写了 `eval(str)`。

**原因**：`eval` 会把字符串当作代码执行。字符串来自 URL 参数、接口、`localStorage` 等外部输入时，就是一个代码注入入口。它还会阻碍引擎优化，并且在启用了 CSP 的页面上通常会被禁止执行。另外注意 `Boolean('false')` 的结果是 `true`，因为非空字符串都是真值，也不能用它来转换。

**解决**：显式比较，或用 `JSON.parse` 并校验结果类型。

```js
// 只接受 'true'，其他一律视为 false
const enabled = str === 'true';

// 需要区分非法值时
function parseBoolean(str) {
  if (str === 'true') return true;
  if (str === 'false') return false;
  throw new Error(`无效的布尔值：${str}`);
}
```

### 用 requestAnimationFrame 写 JS 动画

**现象**：用 `setInterval(fn, 16)` 做的动画有时卡顿、跳帧，切到后台再回来后动画状态错乱。

**原因**：定时器的回调时机和浏览器渲染时机没有对齐，可能一帧里执行了两次，也可能一帧都没执行；后台标签页里定时器会被降频。

**解决**：用 `requestAnimationFrame`，回调在每次渲染前执行，频率跟随屏幕刷新率；页面不可见时浏览器会暂停调用。按时间戳计算进度，而不是按调用次数，这样在不同刷新率的屏幕上动画时长一致。

```js
function animate(el, distance, duration) {
  let start;
  function step(now) {
    start ??= now;
    const progress = Math.min((now - start) / duration, 1);
    el.style.transform = `translateX(${distance * progress}px)`;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
```

能用 CSS `transition` / `animation` 实现的动画优先用 CSS；动画属性尽量限于 `transform` 和 `opacity`，它们通常不需要重新布局。`requestAnimationFrame` 在事件循环中的位置见 [执行机制与事件循环](/notes/fronted/language/javascript/eventLoop.html)。

### Node.js 中 EventEmitter 的基本用法

**场景**：模块之间需要"发布/订阅"式通信，又不想引入额外依赖。

**用法**：Node.js 内置的 `events` 模块提供了 `EventEmitter`：

```js
import { EventEmitter } from 'node:events';

const bus = new EventEmitter();

function onLogin(user) {
  console.log('登录：', user.name);
}

bus.on('login', onLogin);                         // 持续监听
bus.once('login', () => console.log('首次登录'));  // 只触发一次
bus.emit('login', { name: 'Tom' });
bus.off('login', onLogin);                         // 移除监听
```

**容易踩的坑**：

- 触发 `'error'` 事件时如果没有任何 `'error'` 监听器，会直接抛出异常，可能导致进程退出。使用 `EventEmitter` 的对象应当监听 `'error'`。
- 同一个事件的监听器超过默认上限（10 个）时，Node.js 会打印可能存在内存泄漏的警告。通常是重复注册、忘记移除导致的，应先排查原因，而不是直接调大 `setMaxListeners`。
- `emit` 是同步调用监听器的，监听器里的耗时操作会阻塞 `emit` 的调用方。

浏览器端可以用原生的 `EventTarget` 实现同样的模式。

## HTML 与 CSS

### 行内元素设置宽高不生效

**现象**：给 `span`、`a`、`em` 等元素设置 `width`、`height` 没有效果。

**原因**：这些元素默认 `display: inline`，非替换的行内元素的宽高由内容决定，`width` / `height` 不起作用，垂直方向的 `margin` 也不会影响布局。

需要更正一个常见误解：并不是"除 `p` 以外的文本标签都是行内元素"。`h1`–`h6`、`p`、`ul`、`li`、`blockquote` 等默认都是块级元素；`img`、`input`、`video` 这类替换元素虽然默认是行内显示，但可以设置宽高。

**解决**：按需要改变显示类型：

```css
.tag {
  display: inline-block; /* 仍然和文字在同一行，但可以设宽高 */
  width: 80px;
  height: 24px;
}
```

父元素是 flex 或 grid 容器时，子元素会被"块级化"，此时也可以直接设置宽高。

### 隐藏滚动条但保留滚动

**现象**：需要横向滑动的标签栏、轮播区域，不希望显示滚动条，但仍然能滚动。`overflow: hidden` 会把滚动功能也一起去掉。

**解决**：标准写法是 `scrollbar-width`，再用 `::-webkit-scrollbar` 覆盖仍不支持标准属性的旧版 WebKit 浏览器：

```css
.scroll-x {
  overflow-x: auto;
  scrollbar-width: none; /* 标准属性 */
}

.scroll-x::-webkit-scrollbar {
  display: none; /* WebKit 内核及旧版 Chromium 浏览器 */
}
```

原记录中的两种写法已不应再使用：

- `overflow: -moz-hidden-unscrollable`：Firefox 早期的私有值，已被移除，它的效果本来也是"不可滚动"，并不是"隐藏滚动条"。
- `-ms-overflow-style: none`：只对 IE 和旧版 Edge 有效，这两个浏览器都已停止支持。

:::caution
隐藏滚动条会让用户看不出区域可以滚动，尤其是桌面端用鼠标的用户。最好配合渐隐遮罩、左右箭头等视觉提示。
:::

### 半透明边框下透出背景色

**现象**：给元素设置了 `border: 10px solid rgba(0, 0, 0, 0.2)`，期望看到浅灰色边框，结果边框颜色和背景色混在一起。

**原因**：`background-clip` 默认值是 `border-box`，背景会一直画到边框下面。边框半透明时，就透出了下面的背景色。

**解决**：把背景裁剪到内边距区域：

```css
.box {
  border: 10px solid rgba(0, 0, 0, 0.2);
  background: #fff;
  background-clip: padding-box;
}
```

`background-clip` 和 `box-sizing` 经常一起被提到，但管的是不同的事：

| 属性 | 作用 | 常用值 |
| --- | --- | --- |
| `box-sizing` | 决定 `width` / `height` 包含哪些部分 | `content-box`（默认，只含内容）、`border-box`（含内边距和边框） |
| `background-clip` | 决定背景绘制到哪个区域 | `border-box`（默认）、`padding-box`、`content-box`、`text` |

改 `box-sizing` 不会影响背景绘制范围，改 `background-clip` 也不会影响元素尺寸。多数项目会全局设置 `*, *::before, *::after { box-sizing: border-box; }`，让尺寸计算更符合直觉。盒模型细节见 [CSS 核心概念](/notes/fronted/language/css/introduction.html)。

### 文件编码导致事件属性失效

**现象**：页面上 `onclick` 写得看起来没问题，点击却没有反应；用编辑器打开源文件，发现属性名里有乱码，或者某个字符显示正常但不是普通 ASCII 字母。

**原因**：文件以 GBK 等非 UTF-8 编码保存，编辑时又用了中文/繁体输入法，属性名里混入了全角字母或无法正确解码的字节。浏览器解析后，这个属性名已经不是 `onclick`，只会被当作一个普通的未知属性，不会注册事件处理函数。页面渲染看起来正常，所以很难发现。

**解决**：

- 所有源文件统一用 UTF-8 保存，在 `.editorconfig` 里设置 `charset = utf-8`。
- HTML 文件开头声明 `<meta charset="utf-8">`，服务端响应头也带上正确的 `charset`。
- 用 `addEventListener` 绑定事件，代替行内 `onclick` 属性；拼错的方法名在 JS 里会直接报错，比 HTML 属性更容易发现。
- 可以用 `rg -n '[^\x00-\x7F]' <文件>` 之类的命令查找代码中意外出现的非 ASCII 字符。

## 表单

### 输入框按回车导致页面刷新

**现象**：页面上只有一个查询输入框，按回车后整个页面刷新，地址栏多了 `?` 和参数。在 Vue、React 单页应用里这会导致状态丢失。

**原因**：这是浏览器的"隐式提交"行为。焦点在表单内的文本输入框里按回车时，浏览器会提交表单：如果表单有提交按钮，相当于点击它；即使没有提交按钮，只要表单里只有一个会触发隐式提交的单行输入框，也会提交。表单默认提交到当前地址，于是页面刷新。另外，`form` 里没写 `type` 的 `button` 默认就是提交按钮。

**解决**：不要像原记录那样在输入框上写 `onkeypress="if(event.keyCode == 13) return false;"` 禁用回车。这样会让"回车查询"这个常用操作也失效，`keyCode` 和 `keypress` 事件也都已被废弃。正确的做法是保留回车提交，拦截 `submit` 事件：

```html
<form id="search">
  <input name="keyword" />
  <button type="submit">查询</button>
</form>

<script>
  document.querySelector('#search').addEventListener('submit', (event) => {
    event.preventDefault(); // 阻止默认提交和页面刷新
    const keyword = new FormData(event.currentTarget).get('keyword');
    search(keyword);
  });
</script>
```

Vue 里写作 `<form @submit.prevent="onSearch">`，React 里在 `onSubmit` 处理函数中调用 `event.preventDefault()`。

同时检查表单里的其他按钮：重置、清空、展开筛选等不需要提交的按钮，显式写 `type="button"`。

### 浏览器自动填充账号密码

**现象**（原记录）：在 Mac 上的浏览器保存密码后，进入页面时账号密码被自动填入，随后触发了输入框上绑定的回车或提交逻辑。

**原因**：浏览器的自动填充会修改输入框的值，并可能派发 `input` / `change` 等事件。如果代码在这些事件里做了自动提交、自动查询等操作，就会被意外触发。至于具体会派发哪些事件、什么时候派发，不同浏览器的实现不完全相同，这里不下确定结论。

**解决**：

- 不要在 `input` / `change` 事件里直接执行提交，提交只放在 `submit` 事件里处理（见上一条）。
- 用 `autocomplete` 属性告诉浏览器每个字段的用途：登录页用 `username`、`current-password`；修改密码、注册等不应填入已保存密码的字段用 `new-password`。
- 非账号类的输入框（如搜索框）不要用 `type="password"` 或 `name="password"` 之类的命名，以免被浏览器识别为登录表单。

## 工程

### 使用 npm 私有源

**场景**：公司或团队内部的包不能发布到公共 npm 仓库，需要搭建私有源（自建 Verdaccio、Nexus 等，或使用代码托管平台提供的包仓库）。

**用法**：推荐只把某个作用域（scope）的包指向私有源，其余包仍然走公共源。在项目根目录的 `.npmrc` 中配置：

```ini
@my-scope:registry=https://npm.example.com/
//npm.example.com/:_authToken=${NPM_TOKEN}
```

- 第一行：所有 `@my-scope/*` 包从私有源安装和发布。
- 第二行：认证令牌从环境变量读取，不要把令牌明文写进仓库。

发布前在包的 `package.json` 里设置 `publishConfig`，避免误发到公共仓库：

```json
{
  "name": "@my-scope/utils",
  "publishConfig": {
    "registry": "https://npm.example.com/"
  }
}
```

如果整个项目都要走私有源（私有源同时代理公共包），可以设置 `registry=https://npm.example.com/`。查看当前生效的配置用 `npm config get registry`。更多依赖管理内容见 [npm 依赖管理](/notes/fronted/language/node/node_package.html)。

## 小结

- 带 `g` 的正则有状态，只判断是否匹配时不要加 `g`，或使用前重置 `lastIndex`。
- 行内非替换元素不能设宽高，需要时改成 `inline-block` 或放进 flex 容器。
- 隐藏滚动条用 `scrollbar-width: none` 加 `::-webkit-scrollbar`，不要再用 IE、旧 Firefox 的私有写法。
- 半透明边框透出背景时，用 `background-clip: padding-box`；它和 `box-sizing` 是两回事。
- 源文件统一 UTF-8，事件用 `addEventListener` 绑定；不要用 `eval` 做类型转换。
- 表单回车刷新的根源是隐式提交，处理 `submit` 事件并 `preventDefault`，而不是禁用回车。

## 参考

- [MDN：RegExp.prototype.lastIndex](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/RegExp/lastIndex)
- [MDN：eval()](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/eval)
- [MDN：requestAnimationFrame()](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestAnimationFrame)
- [MDN：scrollbar-width](https://developer.mozilla.org/zh-CN/docs/Web/CSS/scrollbar-width)
- [MDN：background-clip](https://developer.mozilla.org/zh-CN/docs/Web/CSS/background-clip)
- [MDN：HTML autocomplete 属性](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Attributes/autocomplete)
- [HTML 标准：Implicit submission](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#implicit-submission)
- [Node.js：Events](https://nodejs.org/api/events.html)
- [npm Docs：npmrc](https://docs.npmjs.com/cli/configuring-npm/npmrc)
