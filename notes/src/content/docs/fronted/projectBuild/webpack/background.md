---
title: webpack 的由来
description: 从 script 标签、IIFE 到 CommonJS、AMD 和 ES Modules，梳理前端模块化的演进，以及 webpack 用依赖图解决了哪些问题。
---

webpack 不是凭空出现的，它是前端模块化长期演进的产物。这篇按时间顺序梳理浏览器端组织代码的几种方式，看每一种解决了什么、留下了什么问题，最后说明 webpack 的核心思路：从入口出发构建依赖图，把一切资源都当作模块。

## 没有模块的年代：script 标签

最早的网页用多个 `<script>` 标签加载脚本，所有脚本共享同一个全局作用域：

```html
<script src="jquery.js"></script>
<script src="utils.js"></script>
<script src="app.js"></script>
```

```js
// utils.js
var count = 0;
function formatDate(date) { /* ... */ }

// app.js
formatDate(new Date()); // 直接使用全局函数
```

这种方式的问题很明显：

- **全局污染与命名冲突**：顶层 `var` 和函数声明都会挂到 `window` 上，两个文件都定义了 `count` 就会互相覆盖。
- **依赖关系是隐式的**：`app.js` 依赖 `utils.js`，但代码里看不出来，只能靠标签顺序保证。顺序错了就报 `ReferenceError`。
- **加载性能差**：脚本越多请求越多，而且传统 `<script>` 会阻塞 HTML 解析。
- **无法按需加载**：不管页面用不用得到，所有脚本都得提前加载。

## 命名空间与 IIFE

第一步改进是把变量收到一个对象下面，减少全局变量的数量，这就是命名空间模式：

```js
var MyApp = MyApp || {};
MyApp.utils = {
  formatDate: function (date) { /* ... */ },
};
```

但对象属性仍然可以被任意修改，没有真正的私有状态。于是出现了 IIFE（立即执行函数表达式）配合闭包的模块模式：

```js
var Counter = (function () {
  var count = 0; // 外部无法直接访问

  function increment() {
    count += 1;
    return count;
  }

  return { increment: increment };
})();

Counter.increment(); // 1
```

IIFE 利用函数作用域实现了私有变量，只暴露需要公开的接口，闭包的原理见 [作用域与闭包](/notes/fronted/language/javascript/theJavaScriptYouDontKonw/scopeAndClosure_01.html)。依赖也可以通过参数显式传入，例如 `(function ($) { ... })(jQuery)`。

不过 IIFE 只解决了"作用域隔离"，依赖加载顺序仍然要手动维护，每个模块也还是要占用一个全局名字。

## CommonJS：服务端的模块规范

2009 年前后，社区为服务端 JavaScript 制定了 CommonJS 规范，Node.js 采用了它：

```js
// math.js
function add(a, b) {
  return a + b;
}
module.exports = { add };

// main.js
const { add } = require('./math');
console.log(add(1, 2));
```

CommonJS 的特点：

- 每个文件是一个独立作用域，不会污染全局。
- 依赖通过 `require` 显式声明。
- `require` 是**同步**的，执行到这一行才去加载并执行目标模块，返回它的 `module.exports`。
- 导出的是值的拷贝（准确说是 `module.exports` 对象的引用，基本类型属性在导出后不会随原模块变化）。
- `require` 可以出现在任意位置，路径也可以是运行时计算出来的表达式。

同步加载在服务端没问题，因为模块文件就在本地磁盘上。但在浏览器里，每个 `require` 都要发网络请求，同步等待会卡住页面，所以 CommonJS 不能直接用于浏览器。

Browserify 是较早的解决方案：在构建阶段分析 `require` 调用，把所有模块合并成一个文件，再附上一段实现 `require` 的运行时代码。这个"构建时打包 + 运行时模拟模块系统"的思路，后来被 webpack 继承并扩展。

## AMD 与 CMD：浏览器端的异步模块

为了在浏览器里直接异步加载模块，社区提出了 AMD（Asynchronous Module Definition）规范，代表实现是 RequireJS：

```js
// math.js
define([], function () {
  return {
    add: function (a, b) { return a + b; },
  };
});

// main.js
require(['./math'], function (math) {
  console.log(math.add(1, 2));
});
```

AMD 要求在 `define` 时声明全部依赖，加载器并行下载这些依赖，全部就绪后再执行回调。它解决了浏览器端的异步加载问题，但写法比较繁琐，依赖多了回调参数会很长。国内还出现过 CMD 规范（代表实现 SeaJS），主张"就近依赖"，在用到时才 `require`，写法更接近 CommonJS。

为了让同一份代码既能在 Node.js 里用、也能被 AMD 加载器加载、还能直接通过 `<script>` 挂到全局，又出现了 UMD（Universal Module Definition）。它本质上是一段判断当前环境的包装代码，现在很多库的发行版仍会提供 UMD 格式。

AMD 和 CMD 现在基本已退出主流，了解它们主要是为了读懂老项目。

## ES Modules：语言层面的标准

ES2015 在语言层面引入了模块语法，也就是 ES Modules（ESM）：

```js
// math.js
export function add(a, b) {
  return a + b;
}

// main.js
import { add } from './math.js';
console.log(add(1, 2));
```

和 CommonJS 相比，ESM 最重要的特点是**静态结构**：

| 方面 | CommonJS | ES Modules |
| --- | --- | --- |
| 语法 | `require` / `module.exports` | `import` / `export` |
| 依赖确定时机 | 运行时，`require` 可以写在条件分支里 | 编译时，`import` 声明只能在顶层，路径必须是字符串字面量 |
| 导出绑定 | 导出对象，导入方拿到的是当时的值 | 实时绑定（live binding），导出方修改变量，导入方能看到新值 |
| 加载方式 | 同步 | 规范层面支持异步加载 |
| 动态加载 | `require(expr)` | `import(expr)`，返回 Promise |
| 顶层 `this` | `module.exports` | `undefined` |

静态结构意味着不需要执行代码，就能知道一个模块导入了什么、导出了什么。这是 Tree Shaking 能够成立的前提：构建工具可以确定某个导出没有被任何地方引用，然后把它删掉。

现代浏览器已经原生支持 `<script type="module">`，但正如 [前端构建工具概览](/notes/fronted/projectBuild/introduction.html) 里说的，裸模块名解析、CommonJS 依赖、请求数量、语法降级等问题仍然需要构建工具处理。更多 ES2015 语法见 [ES2015+ 核心特性](/notes/fronted/language/javascript/es6.html)。

## webpack 解决的问题

webpack 最初在 2012 年前后发布。它出现时，前端同时存在 CommonJS、AMD 和全局变量等多种模块写法，而 Grunt / Gulp 这类任务运行器又不理解模块依赖。webpack 想解决的问题可以归纳为几点：

1. **统一各种模块规范**：同一个项目里，ESM、CommonJS、AMD 写的模块都能被正确解析和打包。
2. **代码分割**：这是 webpack 早期最重要的卖点。大型单页应用不应该把所有代码打成一个巨大的文件，而应该按需拆分，在用到时再异步加载。
3. **一切皆模块**：不仅 JS，CSS、图片、字体都可以通过 `import` 引入，成为依赖关系的一部分。组件和它用到的样式、图片放在一起管理，删除组件时相关资源也一并不再打包。
4. **可扩展的转换管线**：通过 loader 把任意类型的文件转换成模块，通过 plugin 介入构建流程的各个环节。

## 依赖图思想

webpack 的核心数据结构是依赖图（dependency graph）。它从配置的入口文件出发，解析其中的 `import` / `require` / CSS `@import` / `url()` 等依赖声明，找到对应文件，再递归处理这些文件的依赖，最终得到一张包含应用所需全部模块的图。

```js
// src/index.js
import { render } from './view.js';
import './style.css';

render();

// src/view.js
import logo from './logo.png';
export function render() {
  document.body.innerHTML = `<img src="${logo}">`;
}
```

上面代码对应的依赖图是：

```text
src/index.js
├── src/view.js
│   └── src/logo.png
└── src/style.css
```

有了这张图，webpack 才能做后续的事：

- 只打包图里存在的模块，没被引用的文件不会进入产物。
- 根据动态 `import()` 的位置把图切成多个 chunk，实现按需加载。
- 找出多个 chunk 共同依赖的模块，提取成公共 chunk。
- 根据 ESM 的导入导出信息标记未使用的导出，在压缩阶段删除。

打包后的产物里，webpack 会注入一段运行时代码，用来在浏览器中注册模块、按 ID 查找模块并执行。去掉细节后，它的结构大致如下：

```js
(() => {
  // 所有模块按 ID 存在一个对象里，每个模块被包装成函数
  const modules = {
    './src/view.js': (module, exports, require) => {
      exports.render = () => { /* ... */ };
    },
    './src/index.js': (module, exports, require) => {
      const { render } = require('./src/view.js');
      render();
    },
  };

  const cache = {};

  // 简化版的模块加载函数：执行一次后缓存结果
  function require(id) {
    if (cache[id]) return cache[id].exports;
    const module = { exports: {} };
    cache[id] = module;
    modules[id](module, module.exports, require);
    return module.exports;
  }

  require('./src/index.js');
})();
```

真实产物里加载函数叫 `__webpack_require__`，还包含处理 ESM 导出、异步 chunk 加载等辅助逻辑。生产模式下，webpack 还会在条件允许时把多个 ESM 模块直接拼接到同一个作用域（Scope Hoisting），减少这层包装。

从这个结构也能看出 webpack 的本质：在构建阶段静态分析出模块关系，在运行阶段用一个很小的模块系统把它们重新组织起来。具体的概念和流程见 [webpack 核心概念](/notes/fronted/projectBuild/webpack/concept.html)。

## 小结

- `<script>` 标签共享全局作用域，依赖靠顺序维护；IIFE 实现了作用域隔离，但依赖管理仍是手动的。
- CommonJS 是同步加载的服务端规范，不能直接在浏览器使用；AMD 以异步回调的方式解决浏览器加载，现已基本退出主流。
- ES Modules 是语言标准，静态结构让构建工具能在编译时分析依赖，这是 Tree Shaking 的前提。
- webpack 的出发点是统一模块规范、支持代码分割、把各类资源都当作模块，并通过 loader 和 plugin 提供扩展能力。
- webpack 的核心是依赖图：从入口递归收集模块，构建时组织成 chunk，运行时用 `__webpack_require__` 这类小型模块系统加载。

## 参考

- [MDN：JavaScript 模块](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Modules)
- [Node.js：CommonJS modules](https://nodejs.org/api/modules.html)
- [webpack 文档：Modules](https://webpack.js.org/concepts/modules/)
- [webpack 文档：Dependency Graph](https://webpack.js.org/concepts/dependency-graph/)
