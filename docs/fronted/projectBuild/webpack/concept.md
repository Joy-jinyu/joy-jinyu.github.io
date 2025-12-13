# 核心概念

## [入口 - Entry](https://webpack.docschina.org/concepts/entry-points/)

### 概览

+ 默认值是 `./src/index.js`
+ 可以指定一个（或多个）不同的入口起点

### 单个入口（简写）语法

### 对象语法

### 常见场景

+ 分离 app(应用程序) 和 vendor(第三方库) 入口
+ 多页面应用程序

---

## 输出 - Output

### 概览

+ 输出文件的默认值是 `./dist/main.js`
+ 其他生成文件默认放置在 `./dist` 文件夹中 （可通过path来进行配置）

### 多个入口起点

### 对资源使用CDN和hash

---

## Loader

### 概览

+ **loader** 让 webpack 能够去处理其他类型的文件，并将它们转换为有效 [模块](https://webpack.docschina.org/concepts/modules)，以供应用程序使用，以及被添加到依赖图中

  >webpack 只能理解 JavaScript 和 JSON 文件，这是 webpack 开箱可用的自带能力

+ `rules` 属性，里面包含两个必须属性：`test` 和 `use`

  > **Tips:**
  >
  > `test` 属性，识别出哪些文件会被转换。
  >
  > `use` 属性，定义出在进行转换时，应该使用哪个 loader。
  >
  > **Warning:**
  >
  > 配置中定义 rules 时，要定义在 `module.rules` 而不是 `rules` 中
  >
  > 使用正则表达式匹配文件时，你不要为它添加引号(`/\.txt$/` 与 `'/\.txt$/'` 或 `"/\.txt$/"` 不一样。前者指示 webpack 匹配任何以 .txt 结尾的文件，后者指示 webpack 匹配具有绝对路径 '.txt' 的单个文件)

### 使用方式

+ 配置方式（推荐）
+ 内联模式

### Loader特性

+ 支持链式调用
+ 支持同步或者异步
+ 是运行在Node.js中
+ 通过options对象配置（任然支持query来配置，但是已经废弃）
+ 除了常见的通过 `package.json` 的 `main` 来将一个 npm 模块导出为 loader，还可以在 module.rules 中使用 `loader` 字段直接引用一个模块。
+ 插件(plugin)可以为 loader 带来更多特性。
+ loader 能够产生额外的任意文件。

### 解析Loader

>loader 遵循标准 [模块解析](https://webpack.docschina.org/concepts/module-resolution/) 规则。多数情况下，loader 将从 [模块路径](https://webpack.docschina.org/concepts/module-resolution/#module-paths) 加载（通常是从 `npm install`, `node_modules` 进行加载）。
>
>我们预期 loader 模块导出为一个函数，并且编写为 Node.js 兼容的 JavaScript。通常使用 npm 进行管理 loader，但是也可以将应用程序中的文件作为自定义 loader。按照约定，loader 通常被命名为 `xxx-loader`（例如 `json-loader`）。更多详细信息，请查看 [编写一个 loader](https://webpack.docschina.org/contribute/writing-a-loader/)。

## 插件 - Plugin

打包优化，资源管理，注入环境变量等等 - （**loader 用于转换某些类型的模块，而插件则可以用于执行范围更广的任务**）

### 剖析

>webpack **插件**是一个具有 [`apply`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply) 方法的 JavaScript 对象。`apply` 方法会被 webpack compiler 调用，并且在 **整个** 编译生命周期都可以访问 compiler 对象。
>
>**ConsoleLogOnBuildWebpackPlugin.js**
>
>```javascript
>const pluginName = 'ConsoleLogOnBuildWebpackPlugin';
>
>class ConsoleLogOnBuildWebpackPlugin {
>  apply(compiler) {
>    compiler.hooks.run.tap(pluginName, (compilation) => {
>      console.log('webpack 构建正在启动！');
>    });
>  }
>}
>
>module.exports = ConsoleLogOnBuildWebpackPlugin;
>```
>
>compiler hook 的 tap 方法的第一个参数，应该是驼峰式命名的插件名称。建议为此使用一个常量，以便它可以在所有 hook 中重复使用。

### 用法

由于**插件**可以携带参数/选项，你必须在 webpack 配置中，向 `plugins` 属性传入一个 `new` 实例。

### 配置方式

```javascript
const HtmlWebpackPlugin = require('html-webpack-plugin'); // 通过 npm 安装
const webpack = require('webpack'); // 访问内置的插件
const path = require('path');

module.exports = {
  entry: './path/to/my/entry/file.js',
  output: {
    filename: 'my-first-webpack.bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        use: 'babel-loader',
      },
    ],
  },
  plugins: [
    new webpack.ProgressPlugin(),
    new HtmlWebpackPlugin({ template: './src/index.html' }),
  ],
};
```

### Api方式

```javascript
const webpack = require('webpack'); // 访问 webpack 运行时(runtime)
const configuration = require('./webpack.config.js');

let compiler = webpack(configuration);

new webpack.ProgressPlugin().apply(compiler);

compiler.run(function (err, stats) {
  // ...
});
```

## 模式 - Mode

+ 默认值为 `production`

  > 取值有 `development`, `production` 或 `none` 

## 浏览器兼容 - Browser Compatibility

+ Webpack 支持所有符合 [ES5 标准](https://kangax.github.io/compat-table/es5/) 的浏览器（不支持 IE8 及以下版本）

+ webpack 的 `import()` 和 `require.ensure()` 需要 `Promise`

  > 想要支持旧版本浏览器，在使用这些表达式之前，还需要 [提前加载 polyfill](https://webpack.docschina.org/guides/shimming/)

## 环境 - Environment

+ Webpack 5 运行于 Node.js v10.13.0+ 的版本

---

# 高级概念

## 配置 - Configuration

### 基本配置

#### 建议

- 通过 `require(...)` 引入其他文件
- 通过 `require(...)` 使用 npm 下载的工具函数
- 使用 JavaScript 控制流表达式，例如 `?:` 操作符
- 对 value 使用常量或变量赋值
- 编写并执行函数，生成部分配置

#### 避免

- 当使用 webpack CLI 工具时，访问 CLI 参数（应编写自己的 CLI 工具替代，或者[使用 `--env`](https://webpack.docschina.org/api/cli/#env)）
- 导出不确定的结果（两次调用 webpack 应产生相同的输出文件）
- 编写超长的配置（应将配置文件拆分成多个

### [多个target](https://webpack.docschina.org/configuration/configuration-types/#exporting-multiple-configurations)

### [其它语言进行配置](https://webpack.docschina.org/configuration/configuration-languages/)

+ Typescript
+ CoffeScript
+ Babel and jsx

## 模块 - Module

模块, 一切皆模块， 一个模块对应一个文件。

### 何为 webpack 模块

与 [Node.js 模块](https://nodejs.org/api/modules.html)相比，webpack *模块* 能以各种方式表达它们的依赖关系。下面是一些示例：

- [ES2015 `import`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import) 语句
- [CommonJS](http://www.commonjs.org/specs/modules/1.0/) `require()` 语句
- [AMD](https://github.com/amdjs/amdjs-api/blob/master/AMD.md) `define` 和 `require` 语句
- css/sass/less 文件中的 [`@import` 语句](https://developer.mozilla.org/en-US/docs/Web/CSS/@import)。
- stylesheet `url(...)` 或者 HTML `<img src=...>` 文件中的图片链接。

### 支持的模块类型

Webpack 天生支持如下模块类型：

- [ECMAScript 模块](https://webpack.docschina.org/guides/ecma-script-modules)
- CommonJS 模块
- AMD 模块
- [Assets](https://webpack.docschina.org/guides/asset-modules)
- WebAssembly 模块

> [JavaScript Module Systems Showdown](https://auth0.com/blog/javascript-module-systems-showdown/)

## 模块解析 - Module Resolution

resolver 是一个帮助寻找模块绝对路径的库。 一个模块可以作为另一个模块的依赖模块，然后被后者引用，如下：

```js
import foo from 'path/to/module';
// 或者
require('path/to/module');
```

所依赖的模块可以是来自应用程序的代码或第三方库。 resolver 帮助 webpack 从每个 `require`/`import` 语句中，找到需要引入到 bundle 中的模块代码。 当打包模块时，webpack 使用 [enhanced-resolve](https://github.com/webpack/enhanced-resolve) 来解析文件路径。

### 解析规则（通过enhanced-resolve）

#### 绝对路径

#### 相对路径

#### 模块路径

### 解析loader

loader 的解析规则也遵循特定的规范。但是 [`resolveLoader`](https://webpack.docschina.org/configuration/resolve/#resolveloader) 配置项可以为 loader 设置独立的解析规则。

### 缓存

每次文件系统访问文件都会被缓存，以便于更快触发对同一文件的多个并行或串行请求。在 [watch 模式](https://webpack.docschina.org/configuration/watch/#watch) 下，只有修改过的文件会被从缓存中移出。如果关闭 watch 模式，则会在每次编译前清理缓存。

## 模块联邦 - Module Federation

### 背景

多个独立的构建可以组成一个应用程序，这些独立的构建之间不应该存在依赖关系，因此可以单独开发和部署它们。

### 底层概念

### 高级概念

### 构建块

### 概念目标

### 用例

### 动态远程容器

### 基于promise得动态remote

### 动态publicPath

### 故障排除

## 依赖图 - Dependency graph

每当一个文件依赖另一个文件时，webpack 都会将文件视为直接存在 *依赖关系*。这使得 webpack 可以获取非代码资源，如 images 或 web 字体等。并会把它们作为 *依赖* 提供给应用程序。

当 webpack 处理应用程序时，它会根据命令行参数中或配置文件中定义的模块列表开始处理。 从 [*入口*](https://webpack.docschina.org/concepts/entry-points/) 开始，webpack 会递归的构建一个 *依赖关系图*，这个依赖图包含着应用程序中所需的每个模块，然后将所有模块打包为少量的 *bundle* —— 通常只有一个 —— 可由浏览器加载。

>对于 *HTTP/1.1* 的应用程序来说，由 webpack 构建的 bundle 非常强大。当浏览器发起请求时，它能最大程度的减少应用的等待时间。而对于 *HTTP/2* 来说，你还可以使用[代码分割](https://webpack.docschina.org/guides/code-splitting/)进行进一步优化。

## target

### 用法

**[target 可用值](https://webpack.docschina.org/configuration/target/)。**

### 多taget

## manifest

webpack使用场景有三种代码类型：

1. 你或你的团队编写的源码。
2. 你的源码会依赖的任何第三方的 library 或 "vendor" 代码。
3. webpack 的 runtime 和 **manifest**，管理所有模块的交互。

### runtime

### manifest

### 问题

+ 即使某些内容明显没有修改，某些 hash 还是会改变 （因为注入的 runtime 和 manifest 在每次构建后都会发生变化）

  >- [分离 manifest](https://survivejs.com/webpack/optimizing/separating-manifest/)
  >- [使用 webpack 提供可预测的长效缓存](https://medium.com/webpack/predictable-long-term-caching-with-webpack-d3eee1d3fa31)
  >- [缓存](https://webpack.docschina.org/guides/caching/)

## 模块热替换 - Hot module replacement

通过以下几种方式，来显著加快开发速度：

- 保留在完全重新加载页面期间丢失的应用程序状态。
- 只更新变更内容，以节省宝贵的开发时间。
- 在源代码中 CSS/JS 产生修改时，会立刻在浏览器中进行更新，这几乎相当于在浏览器 devtools 直接更改样式。

### 运行原理

#### 应用程序

1. 应用程序要求 HMR runtime 检查更新。
2. HMR runtime 异步地下载更新，然后通知应用程序。
3. 应用程序要求 HMR runtime 应用更新。
4. HMR runtime 同步地应用更新。

#### complier

除了普通资源，compiler 需要发出 "update"，将之前的版本更新到新的版本。"update" 由两部分组成：

1. 更新后的 [manifest](https://webpack.docschina.org/concepts/manifest) (JSON)
2. 一个或多个 updated chunk (JavaScript)

#### 模块

+ HMR 是可选功能，只会影响包含 HMR 代码的模块
+ 在一个模块中实现了 HMR 接口,更新就会冒泡(bubble up),整组依赖模块都会被重新加载

>HMR 是可选功能，只会影响包含 HMR 代码的模块。举个例子，通过 [`style-loader`](https://github.com/webpack-contrib/style-loader) 为 style 追加补丁。为了运行追加补丁，`style-loader` 实现了 HMR 接口；当它通过 HMR 接收到更新，它会使用新的样式替换旧的样式。
>
>类似的，当在一个模块中实现了 HMR 接口，你可以描述出当模块被更新后发生了什么。然而在多数情况下，不需要在每个模块中强行写入 HMR 代码。如果一个模块没有 HMR 处理函数，更新就会冒泡(bubble up)。这意味着某个单独处理函数能够更新整个模块树。如果在模块树的一个单独模块被更新，那么整组依赖模块都会被重新加载。

#### runtime

对于模块系统运行时(module system runtime)，会发出额外代码，来跟踪模块 `parents` 和 `children` 关系。在管理方面，runtime 支持两个方法 `check` 和 `apply`。

## 为什么选择webpack

## 内部原理

### 主要部分

+ 项目中使用的每个文件都是一个 [模块](https://webpack.docschina.org/concepts/modules/)
+ 通过互相引用，这些模块会形成一个图(`ModuleGraph`)数据结构。

### chunk

chunk 有两种形式：

- `initial(初始化)` 是入口起点的 main chunk。此 chunk 包含为入口起点指定的所有模块及其依赖项。

- `non-initial` 是可以延迟加载的块。可能会出现在使用 [动态导入(dynamic imports)](https://webpack.docschina.org/guides/code-splitting/#dynamic-imports) 或者 [SplitChunksPlugin](https://webpack.docschina.org/plugins/split-chunks-plugin/) 时。

  > `non-initial` chunk 没有名称，因此会使用唯一 ID 来替代名称。 在使用动态导入时，我们可以通过使用 [magic comment(魔术注释)](https://webpack.docschina.org/api/module-methods/#magic-comments) 来显式指定 chunk 名称：
  >
  > ```js
  > import(
  >   /* webpackChunkName: "app" */
  >   './app.jsx'
  > ).then((App) => {
  >   ReactDOM.render(<App />, root);
  > });
  > ```

每个 chunk 都有对应的 **asset(资源)**。资源，是指输出文件（即打包结果）。

### output

输出文件的名称会受配置中的两个字段的影响：

- [`output.filename`](https://webpack.docschina.org/configuration/output/#outputfilename) - 用于 `initial` chunk 文件
- [`output.chunkFilename`](https://webpack.docschina.org/configuration/output/#outputchunkfilename) - 用于 `non-initial` chunk 文件
- 在某些情况下，使用 `initial` 和 `non-initial` 的 chunk 时，可以使用 `output.filename`。

这些字段中会有一些 [占位符](https://webpack.docschina.org/configuration/output/#template-strings)。常用的占位符如下：

- `[id]` - chunk id（例如 `[id].js` -> `485.js`）
- `[name]` - chunk name（例如 `[name].js` -> `app.js`）。如果 chunk 没有名称，则会使用其 id 作为名称
- `[contenthash]` - 输出文件内容的 md4-hash（例如 `[contenthash].js` -> `4ea6ff1de66c537eb9b2.js`）