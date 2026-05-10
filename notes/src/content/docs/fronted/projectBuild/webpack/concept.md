---
title: webpack 核心概念
description: 以 webpack 5 为准，讲清 entry、output、loader、plugin、mode，module、chunk 与 bundle 的区别，模块解析、构建流程、Tapable 钩子以及 target 与 browserslist。
---

webpack 的配置项很多，但背后的概念并不多：从入口出发构建依赖图，用 loader 转换模块，把模块组织成 chunk，再输出为文件，plugin 则通过钩子介入整个过程。这篇按这个顺序梳理 webpack 5 的核心概念和内部构建流程，读完应该能看懂一份 webpack 配置每一部分在做什么，也能为后续编写 loader 和 plugin 打下基础。具体配置写法见 [webpack 配置详解](/notes/fronted/projectBuild/webpack/configuration.html)。

## 整体模型

webpack 是一个静态模块打包器。"静态"指它在构建阶段分析代码，而不是在浏览器运行时才去找依赖。整体可以概括为：

```text
entry ──> 解析依赖 ──> loader 转换 ──> 依赖图（module graph）
                                            │
                                            v
                         按入口和异步边界划分 chunk ──> 优化 ──> 输出 bundle（output）

plugin：通过钩子介入上面任意一个环节
```

依赖图的来龙去脉见 [webpack 的由来](/notes/fronted/projectBuild/webpack/background.html)。下面逐个看各部分。

## entry：入口

entry 指定 webpack 从哪个模块开始构建依赖图。webpack 5 在零配置时默认入口是 `./src/index.js`。

### 写法

```js
module.exports = {
  // 1. 字符串：单入口，生成名为 main 的 chunk
  entry: './src/index.js',
};
```

```js
module.exports = {
  // 2. 数组：多个文件合并进同一个 chunk（main），按顺序执行
  entry: ['./src/polyfills.js', './src/index.js'],
};
```

```js
module.exports = {
  // 3. 对象：多入口，key 就是 chunk 名称
  entry: {
    app: './src/app.js',
    admin: './src/admin.js',
  },
};
```

对象写法里，每个入口还可以是一个描述对象，常用字段有：

| 字段 | 作用 |
| --- | --- |
| `import` | 入口模块，可以是字符串或数组 |
| `dependOn` | 当前入口依赖的其他入口，被依赖入口里的模块不会重复打包进来 |
| `filename` | 单独指定这个入口的输出文件名 |
| `runtime` | 指定运行时 chunk 的名字 |

```js
module.exports = {
  entry: {
    shared: ['react', 'react-dom'],
    app: { import: './src/app.js', dependOn: 'shared' },
  },
};
```

entry 也可以是一个返回上述值（或返回 Promise）的函数，适合入口列表需要动态计算的场景，比如扫描目录生成多页面入口。

### 常见场景

- **单页应用**：一个入口即可，第三方库的拆分交给 `optimization.splitChunks`，比手写 vendor 入口更省心。
- **多页应用**：每个页面一个入口，页面之间的公共代码再由 `splitChunks` 提取。

早期常见"把 vendor 单独写成一个入口"的做法，在 webpack 4 引入 `splitChunks` 之后已不推荐，除非确实需要精确控制。

## output：输出

output 决定产物写到哪、叫什么名字。默认输出到 `./dist/main.js`。

```js
const path = require('path');

module.exports = {
  entry: { app: './src/app.js', admin: './src/admin.js' },
  output: {
    path: path.resolve(__dirname, 'dist'), // 必须是绝对路径
    filename: '[name].[contenthash].js',   // 多入口时用 [name] 区分
    clean: true,                           // 构建前清空输出目录
  },
};
```

几个要点：

- 多入口时 `filename` 必须带 `[name]` 之类的占位符，否则多个 chunk 会写到同一个文件名，构建报错。
- `[contenthash]` 根据文件内容计算，内容不变哈希就不变，适合配合 CDN 和浏览器长缓存。
- `publicPath` 指定资源在浏览器中的访问前缀，部署到 CDN 时设为 CDN 地址。webpack 5 在 web 环境下默认是 `'auto'`，运行时根据当前脚本地址自动推断。
- `clean: true` 是 webpack 5 新增的选项，以前需要 `clean-webpack-plugin`。

占位符和更多字段见 [webpack 配置详解](/notes/fronted/projectBuild/webpack/configuration.html)。

## loader：转换非 JS 模块

webpack 开箱只理解 JavaScript 和 JSON。要让它处理 CSS、TypeScript、Vue 单文件组件等，需要 loader 把这些文件转换成 webpack 能处理的模块。

### 配置方式

loader 在 `module.rules` 中配置（注意是 `module.rules`，不是顶层的 `rules`）：

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/i,               // 匹配哪些文件
        use: ['style-loader', 'css-loader'], // 用哪些 loader 处理
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: { presets: ['@babel/preset-env', '@babel/preset-typescript'] },
        },
      },
    ],
  },
};
```

- `test` 一般写正则字面量。写成字符串 `'/\.txt$/'` 就不再是正则，而是一个路径字符串，匹配结果完全不同。
- `include` / `exclude` 用于缩小处理范围，排除 `node_modules` 能明显减少构建时间。
- 参数通过 `options` 传入。旧写法 `query` 已废弃。

### 执行顺序

同一条规则里的多个 loader 按**从右到左**（数组从后往前）执行，前一个 loader 的输出是后一个 loader 的输入：

```text
style.css ──> css-loader ──> style-loader ──> 最终模块
            （解析 @import 和 url()）（生成把 CSS 插入页面的 JS）
```

这其实是函数组合：`style(css(source))`。如果需要强制调整顺序，可以用 `enforce: 'pre'` 或 `enforce: 'post'`。

除了配置方式，loader 还可以在 `import` 语句里内联指定，例如 `import styles from 'style-loader!css-loader!./style.css'`。内联写法把构建细节耦合进业务代码，一般只在特殊场景使用，日常应该用配置方式。

### loader 的特性

- loader 运行在 Node.js 环境中，本质是一个导出函数的模块，接收源码（或上一个 loader 的结果），返回新的结果。
- 可以是同步的，也可以是异步的。
- 支持链式调用，每个 loader 最好只做一件事。
- 可以产出额外文件。
- 解析规则与普通模块相同，默认从 `node_modules` 查找，也可以通过 `resolveLoader` 单独配置。按约定命名为 `xxx-loader`。

### 资源模块（webpack 5）

webpack 4 时代处理图片、字体要用 `file-loader`、`url-loader`、`raw-loader`。webpack 5 内置了资源模块（asset modules），通过 `type` 字段直接声明：

| type | 效果 | 替代的 loader |
| --- | --- | --- |
| `asset/resource` | 输出为单独文件，导入得到 URL | `file-loader` |
| `asset/inline` | 内联为 data URL | `url-loader` |
| `asset/source` | 导入得到文件原始内容字符串 | `raw-loader` |
| `asset` | 按文件大小自动在 resource 和 inline 之间选择 | `url-loader` 的 limit 用法 |

```js
module.exports = {
  module: {
    rules: [
      { test: /\.(png|jpe?g|gif|svg)$/i, type: 'asset' },
      { test: /\.(woff2?|ttf)$/i, type: 'asset/resource' },
    ],
  },
};
```

编写 loader 的细节见 [webpack Loader 与 Plugin 开发](/notes/fronted/projectBuild/webpack/api.html)，常用 loader 见 [webpack 常用 Loader 与 Plugin](/notes/fronted/keyword/webpackDependencies.html)。

## plugin：介入构建流程

loader 只负责"把某类文件转换成模块"，作用范围是单个文件。打包优化、资源管理、注入环境变量、生成 HTML 这类涉及整个构建过程的工作由 plugin 完成。

### 插件的结构

插件是一个带有 `apply` 方法的对象（通常是类的实例）。webpack 创建 compiler 后会调用每个插件的 `apply(compiler)`，插件在里面订阅自己关心的钩子：

```js
const pluginName = 'ConsoleLogOnBuildWebpackPlugin';

class ConsoleLogOnBuildWebpackPlugin {
  apply(compiler) {
    // run 钩子的回调参数是 compiler 本身
    compiler.hooks.run.tap(pluginName, (compiler) => {
      console.log('webpack 构建正在启动');
    });
  }
}

module.exports = ConsoleLogOnBuildWebpackPlugin;
```

`tap` 的第一个参数是插件名，建议定义成常量，在多个钩子里复用。不少资料里这个示例把 `run` 钩子的回调参数写成 `compilation`，实际上 `run` 钩子传入的是 `compiler`，需要拿 `compilation` 应该订阅 `compilation` 或 `thisCompilation` 钩子。

### 使用方式

插件可以带参数，所以在配置中传入的是 `new` 出来的实例：

```js
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.ProgressPlugin(),
    new HtmlWebpackPlugin({ template: './src/index.html' }),
  ],
};
```

使用 Node API 时，也可以手动调用 `apply`：

```js
const webpack = require('webpack');
const config = require('./webpack.config.js');

const compiler = webpack(config);
new webpack.ProgressPlugin().apply(compiler);

compiler.run((err, stats) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(stats.toString({ colors: true }));
  compiler.close(() => {});
});
```

webpack 5 的 Node API 要求在 `run` 结束后调用 `compiler.close()`，让持久化缓存等资源有机会写入和释放。

## mode：模式

`mode` 告诉 webpack 使用哪一套内置优化，可选 `development`、`production`、`none`。不设置时按 `production` 处理，并输出一条警告。

| 方面 | development | production |
| --- | --- | --- |
| `process.env.NODE_ENV`（代码中） | `'development'` | `'production'` |
| 默认 `devtool` | `eval` | 不生成 source map |
| 代码压缩 | 否 | 是（内置 Terser） |
| 模块 / chunk ID | 可读的名称，便于调试 | 稳定的短数字 ID（deterministic），利于缓存 |
| Tree Shaking 相关优化 | 关闭大部分 | 开启（标记未使用导出、副作用分析、模块合并） |
| 默认缓存 | 内存缓存 | 不缓存 |

`none` 则不启用任何默认优化。`mode` 设置的 `process.env.NODE_ENV` 只作用于被打包的业务代码（通过 `DefinePlugin` 替换），不会修改 webpack 配置文件所在的 Node.js 进程的环境变量，这是一个常见误解。

## module、chunk 与 bundle

这三个词经常混用，但在 webpack 里含义不同：

| 概念 | 含义 | 出现阶段 |
| --- | --- | --- |
| module | 依赖图中的一个节点，通常对应一个源文件（经过 loader 转换后） | 构建阶段 |
| chunk | 一组 module 的集合，是 webpack 内部用来组织输出的单位 | 优化阶段 |
| bundle | 最终输出的文件，也常叫 asset | 输出阶段 |

chunk 的来源有三类：

- **入口 chunk**：每个入口生成一个 initial chunk，包含入口模块及其同步依赖。
- **异步 chunk**：每个动态 `import()` 形成一个 non-initial chunk，运行时按需加载。
- **拆分出的 chunk**：`optimization.splitChunks` 把公共模块或第三方库提取出来形成新的 chunk，`runtimeChunk` 可以把运行时代码单独拆出。

一个 chunk 通常对应一个 JS bundle，但不一定一一对应。比如使用 `mini-css-extract-plugin` 时，同一个 chunk 会同时产出一个 JS 文件和一个 CSS 文件；开启 source map 时还会多出 `.map` 文件。

异步 chunk 默认用 ID 命名，可以用魔法注释指定名称：

```js
import(/* webpackChunkName: "settings" */ './pages/Settings.js').then((mod) => {
  mod.mount(document.getElementById('root'));
});
```

输出文件名由 `output.filename`（入口 chunk）和 `output.chunkFilename`（非入口 chunk）决定。代码分割的实践见 [webpack 实践指南](/notes/fronted/projectBuild/webpack/guide.html)。

## 模块解析

遇到 `import foo from 'xxx'` 时，webpack 要先把 `'xxx'` 解析成一个确定的文件路径。这个工作由 [enhanced-resolve](https://github.com/webpack/enhanced-resolve) 完成，规则和 Node.js 的模块查找相近，但可以通过 `resolve` 配置定制。

### 三类路径

- **绝对路径**：`import '/home/me/file'`，直接使用。
- **相对路径**：`import '../src/file'`，以当前文件所在目录为基准拼接。
- **模块路径**：`import 'lodash'`，在 `resolve.modules` 指定的目录中查找，默认是逐级向上查找 `node_modules`。也可以先命中 `resolve.alias` 的别名。

### 路径指向文件还是目录

- 如果路径有扩展名，直接按文件处理。
- 如果没有扩展名，依次尝试 `resolve.extensions` 中的扩展名，默认是 `['.js', '.json', '.wasm']`。所以默认情况下 `import './App'` 找不到 `App.tsx`，需要把 `.tsx` 加进去。
- 如果是目录：模块路径会读取目录下 `package.json` 中由 `resolve.mainFields` 指定的字段（web 环境下依次是 `browser`、`module`、`main`），如果包声明了 `exports` 字段，则优先按 `exports` 解析；都没有时再查找 `resolve.mainFiles`（默认 `index`）。

loader 的解析也遵循同样的规则，只是使用 `resolveLoader` 这一份独立配置。

解析结果会被缓存，同一个请求不会重复访问文件系统。watch 模式下只有发生变化的文件对应的缓存会失效。

### webpack 5 移除了 Node.js 核心模块的自动 polyfill

webpack 4 遇到前端代码里引用 `crypto`、`buffer`、`path` 等 Node.js 核心模块时，会自动打包浏览器版本的替代实现。webpack 5 不再这样做，构建会报 "Module not found"。如果确实需要，用 `resolve.fallback` 显式指定替代包，或者为该依赖换一个面向浏览器的版本。

## 构建流程

webpack 一次构建可以分成三个大阶段：初始化、编译、输出。

### 1. 初始化

1. 合并参数：读取配置文件，合并命令行参数，再填充默认值，得到最终配置。
2. 创建 `Compiler` 对象。它在整个 webpack 进程中只有一个，代表完整的构建环境（配置、文件系统、钩子）。
3. 注册插件：依次调用用户插件的 `apply`，然后 webpack 根据配置注册内置插件。比如 `entry` 配置会被转换成 `EntryPlugin`，`optimization` 配置会被转换成对应的优化插件。可以说 webpack 自身的大部分功能也是以插件形式实现的。

### 2. 编译

1. 调用 `compiler.run()`（watch 模式下是 `compiler.watch()`），开始一次编译，创建一个 `Compilation` 对象。`Compilation` 代表一次具体的构建，watch 模式下每次文件变动都会生成新的 `Compilation`。
2. 触发 `make` 钩子，`EntryPlugin` 把入口模块加入编译。
3. **构建模块**，对每个模块：
   - 解析出文件的绝对路径，确定要使用的 loader；
   - 依次执行 loader，得到 JavaScript 代码；
   - 用解析器（基于 acorn）把代码转成 AST，找出其中的 `import`、`require`、`import()` 等依赖；
   - 对每个依赖重复上述过程。
4. 所有模块构建完成后，得到完整的模块依赖图（`ModuleGraph`）。

### 3. 封装与输出

1. **seal**：根据入口和异步边界生成 chunk，建立 `ChunkGraph`。
2. **优化**：标记未使用的导出、合并模块（Scope Hoisting）、执行 `splitChunks` 拆分、生成模块和 chunk 的 ID、计算哈希。
3. **生成代码**：为每个模块生成最终代码，用模板把 chunk 渲染成 asset。webpack 5 的插件一般在 `processAssets` 钩子上对产物做压缩、追加注释等处理。
4. **输出**：触发 `emit` 钩子（这是修改产物的最后机会），把 asset 写入 `output.path`，最后触发 `done` 钩子。

```text
初始化                    编译                                  输出
合并配置 → 创建 Compiler → run → compilation → make → 构建模块 → seal → 优化 → 生成代码 → emit → done
         → 注册插件                          ↑_____递归依赖____|
```

## Tapable：钩子机制

webpack 的插件体系建立在 [Tapable](https://github.com/webpack/tapable) 这个库之上。`Compiler` 和 `Compilation` 都暴露了大量钩子，每个钩子是一个 Tapable 实例：插件通过 `tap` 注册回调，webpack 在构建的特定时刻调用 `call` 触发它们。本质是一个发布订阅模型。

```js
const { SyncHook, AsyncSeriesHook } = require('tapable');

class Car {
  constructor() {
    this.hooks = {
      accelerate: new SyncHook(['speed']),
      calculateRoutes: new AsyncSeriesHook(['source', 'target']),
    };
  }
}

const car = new Car();

car.hooks.accelerate.tap('LoggerPlugin', (speed) => {
  console.log(`加速到 ${speed}`);
});

car.hooks.calculateRoutes.tapPromise('RoutePlugin', async (source, target) => {
  console.log(`计算 ${source} 到 ${target} 的路线`);
});

car.hooks.accelerate.call(60);
car.hooks.calculateRoutes.promise('A', 'B').then(() => console.log('路线计算完成'));
```

### 钩子类型

钩子名称由两个维度组合而成：

| 维度 | 取值 | 含义 |
| --- | --- | --- |
| 同步 / 异步 | `Sync` | 只能用 `tap` 注册同步回调 |
| | `AsyncSeries` | 异步，回调依次执行，可用 `tap`、`tapAsync`、`tapPromise` |
| | `AsyncParallel` | 异步，回调并行执行 |
| 执行逻辑 | 基础（无后缀） | 依次调用每个回调，忽略返回值 |
| | `Bail` | 某个回调返回非 `undefined` 的值时，停止执行后续回调 |
| | `Waterfall` | 上一个回调的返回值作为下一个回调的第一个参数 |
| | `Loop` | 某个回调返回非 `undefined` 时，从头再执行一轮 |

例如 `SyncBailHook`、`AsyncSeriesWaterfallHook`。写插件前查一下目标钩子的类型很重要：在异步钩子上用 `tap` 注册同步逻辑可以，但在同步钩子上无法用 `tapAsync` / `tapPromise`。

### 常用钩子

| 对象 | 钩子 | 时机 |
| --- | --- | --- |
| Compiler | `environment` / `afterEnvironment` | 配置处理完成，准备环境 |
| Compiler | `run` / `watchRun` | 开始一次构建 |
| Compiler | `thisCompilation` / `compilation` | 创建 Compilation 后，可以在这里订阅 Compilation 的钩子 |
| Compiler | `make` | 开始从入口构建模块 |
| Compiler | `emit` | 输出文件前 |
| Compiler | `done` / `failed` | 构建结束 / 失败 |
| Compilation | `buildModule` / `succeedModule` | 单个模块开始构建 / 构建成功 |
| Compilation | `seal` | 开始封装 chunk |
| Compilation | `processAssets` | 处理产物，分多个阶段（stage），压缩一般在优化阶段 |

插件开发的完整内容见 [webpack Loader 与 Plugin 开发](/notes/fronted/projectBuild/webpack/api.html)。

## runtime 与 manifest

一个 webpack 应用的产物里有三类代码：

1. 业务源码；
2. 第三方库代码；
3. webpack 的 runtime 和 manifest。

runtime 是在浏览器中连接各模块的代码，包括 `__webpack_require__`、异步 chunk 的加载逻辑等。manifest 是 runtime 用来查找模块和 chunk 的映射数据，比如"chunk ID 对应哪个文件名"。

这带来一个缓存问题：异步 chunk 的文件名（含哈希）记录在 manifest 里，manifest 默认又被打进入口 chunk。于是只改了某个异步模块，入口文件的哈希也会跟着变，导致浏览器缓存失效。常见做法是：

- 设置 `optimization.runtimeChunk: 'single'`，把 runtime 拆成独立的小文件；
- 使用 webpack 5 生产模式默认的 `deterministic` 模块 ID 和 chunk ID，避免新增一个模块导致其他模块 ID 整体漂移。

webpack 4 时代需要手动配置 `HashedModuleIdsPlugin` 才能获得稳定 ID，webpack 5 已内置。

## 模块热替换（HMR）

HMR 让应用在运行时替换修改过的模块，而不刷新整个页面，从而保留页面状态。它的工作过程大致是：

1. 文件变化后，webpack 重新编译，产出一份更新 manifest（JSON）和一个或多个更新后的 chunk。
2. 开发服务器通过 WebSocket 通知浏览器有更新。
3. 浏览器中的 HMR runtime 下载更新，检查哪些模块受影响。
4. 如果模块声明了自己能处理更新（通过 `module.hot.accept`），就执行替换；没有声明的话，更新会沿依赖关系向上冒泡，直到找到能处理的模块。冒泡到入口仍无人处理，则整页刷新。

日常开发中很少需要手写 `module.hot.accept`：`style-loader` 已经实现了 CSS 的热替换，React Fast Refresh、`vue-loader` 等工具也为组件实现了热更新。webpack-dev-server 从 v4 起默认开启 `hot`。

## 模块联邦

模块联邦（Module Federation）是 webpack 5 引入的功能，允许多个独立构建、独立部署的应用在运行时共享模块：一个应用可以把部分模块暴露出去（remote），另一个应用在运行时远程加载使用（host），并且可以声明共享依赖（如 React），避免重复加载。它是实现微前端的一种方案，原理和实践见 [微前端方案与实践](/notes/fronted/optimization/microFronted/practise.html)。

## 浏览器兼容与 target

### target

`target` 告诉 webpack 产物运行在什么环境，影响 runtime 代码的写法、chunk 加载方式和模块解析规则。常见取值：

| 取值 | 含义 |
| --- | --- |
| `web` | 浏览器环境 |
| `webworker` | Web Worker |
| `node` | Node.js 环境，用 `require` 加载 chunk |
| `electron-main` / `electron-renderer` | Electron 主进程 / 渲染进程 |
| `browserslist` | 从 browserslist 配置推断环境和支持的语法 |
| `['web', 'es5']` | 数组形式，组合环境与语法版本 |

webpack 5 的默认值是：如果项目中能找到 browserslist 配置，就用 `browserslist`，否则用 `web`。

也可以导出多个配置，分别构建不同 target 的产物，比如同一个库同时输出 Node.js 和浏览器版本。

### browserslist

browserslist 是前端工具链共享的"目标浏览器"配置，通常写在 `package.json` 的 `browserslist` 字段或项目根目录的 `.browserslistrc` 中：

```text
> 0.5%
last 2 versions
not dead
```

同一份配置会被多个工具读取：

- webpack 用它决定 **runtime 代码**能用哪些语法（比如能否用箭头函数、`const`）；
- Babel（`@babel/preset-env`）、SWC 用它决定**业务代码**要转译哪些语法、注入哪些 polyfill；
- Autoprefixer（PostCSS）用它决定 CSS 要加哪些前缀。

要分清职责：`target` 只影响 webpack 自己生成的代码，不会转译你写的源码。源码里的新语法要靠 `babel-loader` 或 `swc-loader` 处理。如果只配置了 `target: ['web', 'es5']` 却没有转译业务代码，产物里依然会有箭头函数。

### 兼容性底线

- webpack 支持所有符合 ES5 的浏览器，IE8 及以下不支持。
- `import()` 和 `require.ensure()` 依赖 `Promise`。如果要支持没有原生 `Promise` 的浏览器（如 IE11），需要提前加载 polyfill。
- 现在主流项目已不再支持 IE。如果仍有这类需求，记得同时调整 `target`、转译配置和 polyfill，三者缺一不可。

## 运行环境

webpack 5 需要 Node.js 10.13.0 及以上版本，但实际项目中 loader、plugin 和 webpack-cli 往往要求更高的 Node.js 版本，建议使用当前仍在维护的 LTS 版本。

## 小结

- entry 决定依赖图从哪开始，output 决定产物写到哪、叫什么；loader 按从右到左的顺序转换单个模块，plugin 通过钩子介入整个构建流程。
- module 是依赖图的节点，chunk 是模块的分组，bundle 是最终输出的文件；一个 chunk 可能产出多个文件。
- 构建流程分为初始化（合并配置、创建 Compiler、注册插件）、编译（make、递归构建模块）、输出（seal、优化、生成代码、emit）。
- 插件机制基于 Tapable，钩子按同步/异步和 Bail、Waterfall、Loop 等执行逻辑分类。
- webpack 5 内置资源模块，移除了 Node.js 核心模块的自动 polyfill，默认 `target` 会读取 browserslist；`target` 只影响 webpack 生成的代码，业务代码转译仍需 Babel 或 SWC。

## 参考

- [webpack 文档：Concepts](https://webpack.js.org/concepts/)
- [webpack 文档：Under The Hood](https://webpack.js.org/concepts/under-the-hood/)
- [webpack 文档：Module Resolution](https://webpack.js.org/concepts/module-resolution/)
- [webpack 文档：Asset Modules](https://webpack.js.org/guides/asset-modules/)
- [webpack 文档：Compiler Hooks](https://webpack.js.org/api/compiler-hooks/)
- [webpack 文档：Target](https://webpack.js.org/configuration/target/)
- [webpack 文档：Module Federation](https://webpack.js.org/concepts/module-federation/)
