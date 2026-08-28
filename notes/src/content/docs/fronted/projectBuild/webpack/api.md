---
title: webpack Loader 与 Plugin 开发
description: 以 webpack 5 为准，讲清 loader 的输入输出、同步/异步/raw/pitch 四种写法，plugin 的 compiler 与 compilation 钩子，HMR 的工作原理，以及用 Node API 调用 webpack。
---

webpack 的扩展能力集中在两处：loader 负责"把一个文件转换成 webpack 能理解的模块"，plugin 负责"在构建流程的某个时刻插一脚"。这篇按 webpack 5 的接口讲两者的写法，各给一个能直接跑的最小示例，再概述模块热替换（HMR）的原理和用 Node API 调用 webpack 的方式。读完应该能看懂常见 loader / plugin 的源码，并能写出自己的版本。

loader、plugin、chunk 这些概念本身见 [webpack 核心概念](/notes/fronted/projectBuild/webpack/concept.html)，配置项的完整说明见 [webpack 配置详解](/notes/fronted/projectBuild/webpack/configuration.html)，这里只讲"怎么开发"。

## Loader

### 本质：一个转换函数

loader 就是一个导出函数的 Node.js 模块。webpack 读到某个文件，按 `module.rules` 匹配出一串 loader，然后把文件内容依次交给它们处理：

- **输入**：上一个 loader 的输出；第一个执行的 loader 拿到的是文件原始内容（默认是 UTF-8 字符串）。
- **输出**：字符串或 Buffer，可以附带 source map 和元数据传给下一个 loader。
- **最后一个执行的 loader** 必须返回一段 JavaScript 代码，因为 webpack 最终只认 JS 模块（资源模块、JSON 等内置类型除外）。

执行顺序是从右到左（数组里从后往前）：

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.scss$/,
        // 实际执行：sass-loader → css-loader → style-loader
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
    ],
  },
};
```

loader 函数签名：

```js
/**
 * @param {string|Buffer} content 文件内容或上一个 loader 的输出
 * @param {object} [map] 上一个 loader 传来的 source map
 * @param {any} [meta] 上一个 loader 传来的任意元数据
 */
module.exports = function (content, map, meta) {
  return content;
};
```

注意要用普通函数而不是箭头函数，因为 loader 的上下文 API 都挂在 `this` 上。

### 同步 loader

只返回一个值时直接 `return`；需要同时返回 source map 或元数据时用 `this.callback`：

```js
module.exports = function (content, map, meta) {
  const result = content.replace(/console\.log\(.*?\);?/g, '');
  this.callback(null, result, map, meta);
  // 用了 this.callback 后，函数应返回 undefined
};
```

`this.callback(err, content, sourceMap?, meta?)` 的第一个参数是错误对象，传了错误就会让这个模块编译失败。

### 异步 loader

需要读文件、请求网络、调用异步 API 时，先调用 `this.async()` 拿到回调，处理完再调用它：

```js
const fs = require('fs/promises');

module.exports = function (content) {
  const callback = this.async();
  const headerPath = this.getOptions().header;

  this.addDependency(headerPath); // header 文件变化时也要重新编译
  fs.readFile(headerPath, 'utf8')
    .then((header) => callback(null, header + '\n' + content))
    .catch((err) => callback(err));
};
```

同步 loader 会阻塞后续处理，能异步就异步。

### raw loader

默认情况下 webpack 把文件内容按 UTF-8 解码成字符串再交给 loader。处理图片、字体等二进制文件时要拿原始 Buffer，在导出上标记 `raw`：

```js
module.exports = function (content) {
  // content 是 Buffer
  const base64 = content.toString('base64');
  return `export default ${JSON.stringify('data:image/png;base64,' + base64)};`;
};
module.exports.raw = true;
```

这个例子只是演示 raw 的用法。webpack 5 里把文件转成 data URL 直接用资源模块 `type: 'asset/inline'` 即可，不需要自己写 loader。

### pitch 阶段

每个 loader 还可以导出一个 `pitch` 方法。一次完整的处理分两轮：

```text
use: ['a-loader', 'b-loader', 'c-loader']

a.pitch → b.pitch → c.pitch → 读取文件 → c → b → a
```

先从左到右执行各个 `pitch`，再读文件，然后从右到左执行普通函数。关键规则：**如果某个 `pitch` 返回了非 `undefined` 的值，后面的 loader 和读取文件都会被跳过**，直接回到它左边那个 loader 的普通阶段。比如 `b.pitch` 有返回值，流程就变成 `a.pitch → b.pitch → a`。

```js
module.exports = function (content) {
  // 普通阶段可以通过 this.data 拿到 pitch 阶段存的数据
  return content;
};

module.exports.pitch = function (remainingRequest, precedingRequest, data) {
  // remainingRequest：右边还没执行的 loader 加资源路径
  // precedingRequest：左边已经执行过 pitch 的 loader
  data.startTime = Date.now();
};
```

pitch 的典型用途是 `style-loader`：它在 pitch 阶段就返回一段代码，代码里用 `remainingRequest` 再去 `import` 一次"经过 css-loader 处理后的结果"，然后把样式插入页面。这样 `style-loader` 不需要拿到 CSS 字符串本身，只需要生成"运行时去引用它"的代码。

### 常用的上下文 API

| API | 作用 |
| --- | --- |
| `this.getOptions(schema?)` | 读取 loader 的 `options`，可传 JSON Schema 做校验。webpack 5 内置，取代过去 `loader-utils` 的 `getOptions` |
| `this.async()` | 声明为异步 loader，返回回调 |
| `this.callback(err, content, map, meta)` | 返回多个结果 |
| `this.resourcePath` | 当前文件的绝对路径 |
| `this.resourceQuery` | 资源路径上的查询串，例如 `?inline` |
| `this.rootContext` | 项目根目录（配置里的 `context`） |
| `this.mode` | 当前构建模式 |
| `this.sourceMap` | 是否需要生成 source map |
| `this.addDependency(file)` | 声明额外的文件依赖，watch 时它变化也会触发重新编译 |
| `this.addContextDependency(dir)` | 声明目录依赖 |
| `this.cacheable(flag)` | loader 结果默认可缓存，传 `false` 表示不可缓存 |
| `this.emitFile(name, content, sourceMap?)` | 向输出目录额外写一个文件 |
| `this.emitWarning(err)` / `this.emitError(err)` | 报告警告或错误，但不中断编译 |

### 最小 loader 示例

需求：让项目可以 `import` 一个 `.txt` 文件，得到其中的字符串，并支持把占位符替换掉。

```js
// loaders/text-loader.js
const schema = {
  type: 'object',
  properties: {
    replacements: { type: 'object' },
  },
  additionalProperties: false,
};

module.exports = function (content) {
  const { replacements = {} } = this.getOptions(schema);
  let text = content;
  for (const [key, value] of Object.entries(replacements)) {
    text = text.replaceAll(`{{${key}}}`, value);
  }
  // 最后一个 loader 必须输出 JS 模块
  return `export default ${JSON.stringify(text)};`;
};
```

```js
// webpack.config.js
const path = require('path');

module.exports = {
  module: {
    rules: [
      {
        test: /\.txt$/,
        use: {
          loader: path.resolve(__dirname, 'loaders/text-loader.js'),
          options: { replacements: { name: 'webpack' } },
        },
      },
    ],
  },
};
```

```js
// src/index.js
import hello from './hello.txt'; // 文件内容：Hello {{name}}
console.log(hello); // Hello webpack
```

本地 loader 也可以通过 `resolveLoader.modules: ['node_modules', path.resolve(__dirname, 'loaders')]` 注册，之后在配置里直接写 `loader: 'text-loader'`。

写 loader 的几条约定：

- 只做一件事，复杂处理拆成多个 loader 串起来。
- 不要在模块级变量里保存状态，同一个 loader 会被并行或重复调用。
- 用到的外部文件要 `addDependency`，否则 watch 模式下改了它不会重新编译。
- 用 `JSON.stringify` 生成字符串字面量，不要手工拼引号。

## Plugin

### 本质：带 apply 方法的类

plugin 是一个对象，必须有 `apply(compiler)` 方法。webpack 启动时会依次调用每个 plugin 的 `apply`，plugin 在里面通过 `compiler.hooks` 注册回调，等构建走到对应阶段时被调用。

```js
class HelloPlugin {
  apply(compiler) {
    compiler.hooks.done.tap('HelloPlugin', (stats) => {
      console.log('构建完成，耗时', stats.endTime - stats.startTime, 'ms');
    });
  }
}

module.exports = HelloPlugin;
```

钩子来自 webpack 团队维护的 [tapable](https://github.com/webpack/tapable) 库。钩子分同步和异步两类，注册方法不同：

| 注册方法 | 适用钩子 | 写法 |
| --- | --- | --- |
| `tap` | 同步钩子，异步钩子也可以用 | 回调直接返回 |
| `tapAsync` | 异步钩子 | 回调最后一个参数是 `callback`，完成后调用 |
| `tapPromise` | 异步钩子 | 回调返回 Promise |

一个钩子是同步还是异步，以官方文档里该钩子的类型（如 `SyncHook`、`AsyncSeriesHook`）为准。

### compiler 与 compilation

这是写 plugin 最需要分清的两个对象：

| | compiler | compilation |
| --- | --- | --- |
| 代表什么 | 整个 webpack 实例，包含完整配置 | 一次具体的构建 |
| 生命周期 | 从启动到退出只有一个 | 每次构建创建一个；watch 模式下每次文件变化都会新建 |
| 能访问的内容 | `options`、文件系统、各个阶段的钩子 | 本次的模块、chunk、生成的资源（assets）、错误和警告 |
| 典型用途 | 在启动、开始编译、输出前后做事 | 修改模块、调整 chunk、增删输出资源 |

拿到 compilation 的方式是在 compiler 的 `thisCompilation` 或 `compilation` 钩子里注册回调。两者的区别是 `compilation` 还会对子编译（比如 `html-webpack-plugin` 内部创建的子编译）触发，只想处理主编译时用 `thisCompilation`。

### 常用钩子

compiler 钩子（按触发顺序大致排列）：

| 钩子 | 时机 |
| --- | --- |
| `environment` / `afterEnvironment` | 环境准备完毕 |
| `entryOption` | 处理完 `entry` 配置 |
| `beforeRun` / `run` | 开始一次构建（`webpack` 命令） |
| `watchRun` | watch 模式下每次开始重新构建 |
| `compile` | 创建 compilation 之前 |
| `thisCompilation` / `compilation` | compilation 创建完成 |
| `make` | 开始从入口构建模块 |
| `emit` | 即将把资源写入输出目录 |
| `afterEmit` | 资源写入完成 |
| `done` | 构建结束，拿到 `stats` |
| `failed` | 构建失败 |
| `watchClose` / `shutdown` | 停止监听 / 编译器关闭 |

compilation 钩子里常用的有 `buildModule`（开始构建某个模块）、`succeedModule`、`finishModules`（所有模块构建完）、`seal`（开始封装 chunk）、`optimizeChunks`，以及 webpack 5 推荐用来处理输出资源的 `processAssets`。

:::caution
webpack 4 时代的插件常在 `compiler.hooks.emit` 里直接改 `compilation.assets`。webpack 5 里这样做会收到弃用警告，推荐改为在 `compilation.hooks.processAssets` 里，按合适的阶段（`stage`）增删或修改资源，用 `compilation.emitAsset` / `updateAsset` / `deleteAsset` 操作。
:::

`processAssets` 的 `stage` 用 `Compilation` 上的常量指定，例如 `PROCESS_ASSETS_STAGE_ADDITIONAL`（新增资源）、`PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE`（压缩）、`PROCESS_ASSETS_STAGE_SUMMARIZE`（汇总）、`PROCESS_ASSETS_STAGE_REPORT`（生成报告类资源）。阶段决定了你的处理排在压缩等内置步骤之前还是之后。

### 最小 plugin 示例：输出资源清单

需求：构建结束时额外输出一个 `asset-manifest.json`，列出每个入口用到的文件，以及所有资源的大小。服务端渲染模板或部署脚本可以读这个文件来决定注入哪些 `<script>`。

```js
// plugins/asset-manifest-plugin.js
class AssetManifestPlugin {
  constructor(options = {}) {
    this.filename = options.filename || 'asset-manifest.json';
  }

  apply(compiler) {
    const pluginName = 'AssetManifestPlugin';
    // 从 compiler 上取 webpack 实例，避免插件和项目装了两份 webpack
    const { Compilation, sources } = compiler.webpack;

    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: pluginName, stage: Compilation.PROCESS_ASSETS_STAGE_REPORT },
        (assets) => {
          const entrypoints = {};
          for (const [name, entrypoint] of compilation.entrypoints) {
            entrypoints[name] = entrypoint.getFiles();
          }

          const files = {};
          for (const [file, source] of Object.entries(assets)) {
            files[file] = source.size();
          }

          const json = JSON.stringify({ entrypoints, files }, null, 2);
          compilation.emitAsset(this.filename, new sources.RawSource(json));
        },
      );
    });
  }
}

module.exports = AssetManifestPlugin;
```

```js
// webpack.config.js
const AssetManifestPlugin = require('./plugins/asset-manifest-plugin');

module.exports = {
  plugins: [new AssetManifestPlugin()],
};
```

输出类似：

```json
{
  "entrypoints": {
    "main": ["runtime.3f2a.js", "main.8c1d.js", "main.5b7e.css"]
  },
  "files": {
    "runtime.3f2a.js": 1532,
    "main.8c1d.js": 48211,
    "main.5b7e.css": 2304
  }
}
```

选 `REPORT` 阶段是因为它在压缩之后，此时拿到的文件名和大小就是最终产物。社区已有功能更完整的 `webpack-manifest-plugin`，实际项目可以直接用。

写 plugin 的几条约定：

- 钩子名统一用插件名注册，方便调试和性能分析时定位。
- 用 `compiler.webpack` 取 `sources`、`Compilation` 等，不要在插件里自己 `require('webpack')`。
- 报错时 `compilation.errors.push(new compiler.webpack.WebpackError('...'))`，不要直接 `throw` 让进程崩溃。
- 异步钩子里要么返回 Promise，要么调用 callback，不能两样都不做，否则构建会卡住。

## HMR 原理概述

模块热替换（Hot Module Replacement）让代码修改后只替换变化的模块，页面不刷新，状态（比如表单内容、组件状态）得以保留。它和 `--watch` 的区别是：watch 只负责重新构建，浏览器要自己刷新；HMR 在重新构建后把新模块推送给正在运行的页面。

开启方式：用 `webpack-dev-server` 并设置 `devServer.hot: true`（较新版本的 dev server 默认就是开启的）。

整个流程：

1. **监听与增量构建**：dev server 以 watch 模式运行 webpack，文件变化后增量编译。构建结果保存在内存里，不写磁盘。
2. **生成更新包**：webpack 的 HMR 运行时为这次变化生成两类文件：一个描述"哪些 chunk 变了"的清单（`*.hot-update.json`），以及包含新模块代码的更新 chunk（`*.hot-update.js`）。
3. **通知浏览器**：dev server 通过 WebSocket 把新的构建 hash 推送给页面里的客户端代码。
4. **拉取并应用**：浏览器端的 HMR 运行时按 hash 请求更新清单和更新 chunk，用新模块替换旧模块。
5. **向上冒泡寻找接收者**：替换后，运行时从变化的模块开始，沿着"谁引用了它"向上找，看有没有模块声明了 `accept`。找到了就执行它的回调，让它用新模块重新渲染；一直冒泡到入口都没人接收，就退化为整页刷新。

声明接收的写法：

```js
// ES 模块中
import { render } from './render.js';

render();

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept('./render.js', () => {
    render(); // render.js 更新后重新执行
  });
}
```

CommonJS 中对应的是 `module.hot.accept`。日常开发很少需要手写这些，因为相关 loader / 插件已经替你做了：

- `style-loader` 注入的代码会接收 CSS 模块的更新，替换 `<style>` 标签内容。
- `vue-loader` 为 `.vue` 组件实现了热更新，保留组件状态。
- React 项目通过 React Refresh 的 webpack 插件实现组件级热更新。

使用 `mini-css-extract-plugin` 抽取的 CSS 在开发环境同样支持热更新，但一般还是建议开发用 `style-loader`、生产再抽取。

## 用 Node API 调用 webpack

命令行 `webpack` 本质上是对 Node API 的封装。需要在自定义脚本里构建（比如一次构建多套配置、构建前后做额外处理），可以直接调用：

```js
const webpack = require('webpack');
const config = require('./webpack.config.js');

const compiler = webpack(config);

compiler.run((err, stats) => {
  if (err) {
    // 配置错误等致命错误，没有 stats
    console.error(err.stack || err);
    return;
  }

  // 编译错误（语法错、模块找不到）不会进 err，要从 stats 里取
  console.log(stats.toString({ colors: true, modules: false }));
  if (stats.hasErrors()) {
    process.exitCode = 1;
  }

  // 关闭编译器，让持久化缓存等资源正确落盘
  compiler.close((closeErr) => {
    if (closeErr) console.error(closeErr);
  });
});
```

要点：

- 错误分两层：`err` 是 webpack 本身跑不起来的错误；编译过程中的错误在 `stats.hasErrors()` / `stats.toJson().errors` 里。两层都要检查。
- `webpack(config)` 也可以传数组（多配置），返回 `MultiCompiler`。
- watch 模式用 `compiler.watch(watchOptions, handler)`，返回一个 `Watching` 对象，调用其 `close()` 停止监听。同一个 compiler 不要同时 `run` 和 `watch`。
- `stats.toJson()` 可以拿到结构化的构建信息，命令行的 `webpack --json > stats.json` 输出的就是它，可交给 bundle 分析工具使用。

在 Node 里启动开发服务器（`webpack-dev-server` 4 及以上的写法）：

```js
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const config = require('./webpack.config.js');

const compiler = webpack(config);
const server = new WebpackDevServer({ port: 8080, hot: true }, compiler);

server.start().then(() => {
  console.log('dev server 已启动');
});
```

如果已有 Express 等服务，可以改用 `webpack-dev-middleware`（把构建产物挂到已有服务上）配合 `webpack-hot-middleware`（提供热更新通道）。

## 小结

- loader 是转换函数，输入文件内容输出新内容，按从右到左执行，最后一个必须输出 JS；用 `this.async()` 写异步，`raw = true` 拿 Buffer，`pitch` 有返回值时会跳过后续 loader。
- webpack 5 用 `this.getOptions()` 读取 loader 选项，不再需要 `loader-utils`。
- plugin 是带 `apply(compiler)` 的对象，通过 tapable 钩子介入构建；compiler 全局唯一，compilation 对应每一次构建。
- webpack 5 推荐在 `processAssets` 钩子里按阶段处理输出资源，从 `compiler.webpack` 取 `sources` 等工具类。
- HMR 由 watch 增量构建、WebSocket 通知、运行时拉取更新包、沿依赖向上找 `accept` 组成，没人接收就整页刷新。
- Node API 用 `webpack(config)` 得到 compiler，`run` / `watch` 后要同时检查 `err` 和 `stats.hasErrors()`，结束时调用 `close()`。

## 参考

- [webpack：Writing a Loader](https://webpack.js.org/contribute/writing-a-loader/)
- [webpack：Loader Interface](https://webpack.js.org/api/loaders/)
- [webpack：Writing a Plugin](https://webpack.js.org/contribute/writing-a-plugin/)
- [webpack：Compiler Hooks](https://webpack.js.org/api/compiler-hooks/)
- [webpack：Compilation Hooks](https://webpack.js.org/api/compilation-hooks/)
- [webpack：Hot Module Replacement 概念](https://webpack.js.org/concepts/hot-module-replacement/)
- [webpack：Node Interface](https://webpack.js.org/api/node/)
