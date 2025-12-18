# 指南

## 管理资源

### 加载`CSS`

### 加载Images

### 加载fonts字体

### 加载数据

### 自定义`JSON`模块parser

### 全局资源

### 延伸阅读

- [加载字体](https://survivejs.com/webpack/loading/fonts/) on `SurviveJS`

### Code

**project**

```diff
  webpack-demo
  |- package.json
  |- package-lock.json
  |- webpack.config.js
  |- /dist
    |- bundle.js
    |- index.html
  |- /src
-   |- data.csv
-   |- data.json5
-   |- data.toml
-   |- data.xml
-   |- data.yaml
-   |- icon.png
-   |- my-font.woff
-   |- my-font.woff2
-   |- style.css
    |- index.js
  |- /node_modules
```

**webpack.config.js**

```diff
 const path = require('path');
-const toml = require('toml');
-const yaml = require('yamljs');
-const json5 = require('json5');

 module.exports = {
   entry: './src/index.js',
   output: {
     filename: 'bundle.js',
     path: path.resolve(__dirname, 'dist'),
   },
-  module: {
-    rules: [
-      {
-        test: /\.css$/i,
-        use: ['style-loader', 'css-loader'],
-      },
-      {
-        test: /\.(png|svg|jpg|jpeg|gif)$/i,
-        type: 'asset/resource',
-      },
-      {
-        test: /\.(woff|woff2|eot|ttf|otf)$/i,
-        type: 'asset/resource',
-      },
-      {
-        test: /\.(csv|tsv)$/i,
-        use: ['csv-loader'],
-      },
-      {
-        test: /\.xml$/i,
-        use: ['xml-loader'],
-      },
-      {
-        test: /\.toml$/i,
-        type: 'json',
-        parser: {
-          parse: toml.parse,
-        },
-      },
-      {
-        test: /\.yaml$/i,
-        type: 'json',
-        parser: {
-          parse: yaml.parse,
-        },
-      },
-      {
-        test: /\.json5$/i,
-        type: 'json',
-        parser: {
-          parse: json5.parse,
-        },
-      },
-    ],
-  },
 };
```

**src/index.js**

```diff
 import _ from 'lodash';
-import './style.css';
-import Icon from './icon.png';
-import Data from './data.xml';
-import Notes from './data.csv';
-import toml from './data.toml';
-import yaml from './data.yaml';
-import json from './data.json5';
-
-console.log(toml.title); // output `TOML Example`
-console.log(toml.owner.name); // output `Tom Preston-Werner`
-
-console.log(yaml.title); // output `YAML Example`
-console.log(yaml.owner.name); // output `Tom Preston-Werner`
-
-console.log(json.title); //  `JSON5 Example`
-console.log(json.owner.name); // output `Tom Preston-Werner`

 function component() {
   const element = document.createElement('div');

-  // lodash，现在通过 script 标签导入
   element.innerHTML = _.join(['Hello', 'webpack'], ' ');
-  element.classList.add('hello');
-
-  // Add the image to our existing div.
-  const myIcon = new Image();
-  myIcon.src = Icon;
-
-  element.appendChild(myIcon);
-
-  console.log(Data);
-  console.log(Notes);

   return element;
 }

 document.body.appendChild(component());
```

And remove those dependencies we added before:

```bash
npm uninstall css-loader csv-loader json5 style-loader toml xml-loader yamljs
```

---

## 管理输出

### 预先准备

### 设置`HtmlWebpackPlugin`

### 清理/dist文件夹

### manifest

你可能会很感兴趣，webpack 和 webpack 插件似乎“知道”应该生成哪些文件。答案是，webpack 通过 manifest，可以追踪所有模块到输出 bundle 之间的映射。如果你想要知道如何以其他方式来控制 webpack [`输出`](https://webpack.docschina.org/configuration/output)，了解 manifest 是个好的开始。

通过 [`WebpackManifestPlugin`](https://github.com/shellscape/webpack-manifest-plugin) 插件，可以将 manifest 数据提取为一个 json 文件以供使用。

我们不会在此展示一个如何在项目中使用此插件的完整示例，你可以在 [manifest](https://webpack.docschina.org/concepts/manifest) 概念页面深入阅读，以及在 [缓存](https://webpack.docschina.org/guides/caching) 指南中，了解它与长效缓存有何关系。

---

## 开发环境

### 使用`source map`

### 选择一个开发工具

+ `webpack`自带的watch mode
+ 使用`webpack-dev-server`插件 (基于`webpack-dev-middle`)
+ 使用`webpack-dev-middle`插件

### 文本编辑器safe write(安全写入)

---

## 代码分离

### 入口起点

- 如果入口 chunk 之间包含一些重复的模块，那些重复模块都会被引入到各个 bundle 中。
- 这种方法不够灵活，并且不能动态地将核心应用程序逻辑中的代码拆分出来。

**project**

```diff
webpack-demo
|- package.json
|- package-lock.json
|- webpack.config.js
|- /dist
|- /src
  |- index.js
+ |- another-module.js
|- /node_modules
```

**another-module.js**

```js
import _ from 'lodash';

console.log(_.join(['Another', 'module', 'loaded!'], ' '));
```

**webpack.config.js**

```diff
 const path = require('path');

 module.exports = {
-  entry: './src/index.js',
+  mode: 'development',
+  entry: {
+    index: './src/index.js',
+    another: './src/another-module.js',
+  },
   output: {
-    filename: 'main.js',
+    filename: '[name].bundle.js',
     path: path.resolve(__dirname, 'dist'),
   },
 };
```

### 防止重复

#### 入口依赖

如果我们要在一个 HTML 页面上使用多个入口时，还需设置 `optimization.runtimeChunk: 'single'`，否则还会遇到[这里](https://bundlers.tooling.report/code-splitting/multi-entry/)所述的麻烦。

**webpack.config.js**

```diff
 const path = require('path');

 module.exports = {
   mode: 'development',
   entry: {
     index: {
       import: './src/index.js',
+      dependOn: 'shared',
     },
     another: {
       import: './src/another-module.js',
+      dependOn: 'shared',
     },
+    shared: 'lodash',
   },
   output: {
     filename: '[name].bundle.js',
     path: path.resolve(__dirname, 'dist'),
   },
+  optimization: {
+    runtimeChunk: 'single',
+  },
 };
```

#### `SplitChunksPlugin`

**webpack.config.js**

```diff
  const path = require('path');

  module.exports = {
    mode: 'development',
    entry: {
      index: './src/index.js',
      another: './src/another-module.js',
    },
    output: {
      filename: '[name].bundle.js',
      path: path.resolve(__dirname, 'dist'),
    },
+   optimization: {
+     splitChunks: {
+       chunks: 'all',
+     },
+   },
  };
```

### 动态导入

```diff
function getComponent() {
+async function getComponent() {
   const element = document.createElement('div');
+  const { default: _ } = await import('lodash');

-  return import('lodash')
-    .then(({ default: _ }) => {
-      const element = document.createElement('div');
+  element.innerHTML = _.join(['Hello', 'webpack'], ' ');

-      element.innerHTML = _.join(['Hello', 'webpack'], ' ');
-
-      return element;
-    })
-    .catch((error) => 'An error occurred while loading the component');
+  return element;
 }

 getComponent().then((component) => {
   document.body.appendChild(component);
 });
```

### `prefetch`/`preload` modules

- **prefetch**(预获取)：将来某些导航下可能需要的资源
- **preload**(预加载)：当前导航下可能需要资源

>###### Tip
>
>不正确地使用 `webpackPreload` 会有损性能，请谨慎使用。

### bundle分析

 [官方分析工具](https://github.com/webpack/analyse) 是一个不错的开始。还有一些其他社区支持的可选项：

- [webpack-chart](https://alexkuz.github.io/webpack-chart/): webpack stats 可交互饼图。
- [webpack-visualizer](https://chrisbateman.github.io/webpack-visualizer/): 可视化并分析你的 bundle，检查哪些模块占用空间，哪些可能是重复使用的。
- [webpack-bundle-analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)：一个 plugin 和 CLI 工具，它将 bundle 内容展示为一个便捷的、交互式、可缩放的树状图形式。
- [webpack bundle optimize helper](https://webpack.jakoblind.no/optimize)：这个工具会分析你的 bundle，并提供可操作的改进措施，以减少 bundle 的大小。
- [bundle-stats](https://github.com/bundle-stats/bundle-stats)：生成一个 bundle 报告（bundle 大小、资源、模块），并比较不同构建之间的结果。

### 延伸阅读

- [webpack 中的 ](https://medium.com/webpack/link-rel-prefetch-preload-in-webpack-51a52358f84c)
- [Chrome 中的预加载、预获取和优先级(Preload, Prefetch And Priorities)](https://medium.com/reloading/preload-prefetch-and-priorities-in-chrome-776165961bbf)
- [使用用  预加载内容](https://developer.mozilla.org/en-US/docs/Web/HTML/Preloading_content)

---

## 缓存

### 输出文件的文件名

+ name
+ `contenthash`

### 提取引导模板

+ `runtimeChunk`: 'single' 

### 模块标识符

+ `moduleIds`: 'deterministic'

### Code

**webpack.config.js**

```diff
  const path = require('path');
  const HtmlWebpackPlugin = require('html-webpack-plugin');

  module.exports = {
    entry: './src/index.js',
    plugins: [
      new HtmlWebpackPlugin({
      title: 'Caching',
      }),
    ],
    output: {
+     filename: '[name].[contenthash].js',
      path: path.resolve(__dirname, 'dist'),
+     clean: true,
    },
    optimization: {
+     moduleIds: 'deterministic',
+     runtimeChunk: 'single',
+     splitChunks: {
+       cacheGroups: {
+         vendor: {
+           test: /[\\/]node_modules[\\/]/,
+           name: 'vendors',
+           chunks: 'all',
+         },
+       },
+     },
    },
  };
```

### 延伸阅读

- [Issue 652](https://github.com/webpack/webpack.js.org/issues/652)

---

## 创建library

### 创建一个library

### `webpack`配置

### Expose the Library

```diff
 const path = require('path');

 module.exports = {
   entry: './src/index.js',
   output: {
     path: path.resolve(__dirname, 'dist'),
     filename: 'webpack-numbers.js',
-    library: 'webpackNumbers',
+    library: {
+      name: 'webpackNumbers',
+      type: 'umd',
+    },
   },
 };
```

现在 webpack 将打包一个库，其可以与 CommonJS、AMD 以及 script 标签使用。

Tip

### 外部化`lodash`

```diff
  const path = require('path');

  module.exports = {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'webpack-numbers.js',
      library: {
        name: "webpackNumbers",
        type: "umd"
      },
    },
+   externals: {
+     lodash: {
+       commonjs: 'lodash',
+       commonjs2: 'lodash',
+       amd: 'lodash',
+       root: '_',
+     },
+   },
  };
```

#### 外部化的限制

### 最终步骤

>###### Tip
>
>为了暴露和 library 关联着的样式表，你应该使用 [`MiniCssExtractPlugin`](https://webpack.docschina.org/plugins/mini-css-extract-plugin)。然后，用户可以像使用其他样式表一样使用和加载这些样式表。

---

## 环境变量

---

## 构建性能

### 通用环境

+ `Webpack`更新到最新的版本
+ Loader 使用`include` 字段去覆盖需要编译的目录
+ 尽量少地使用 loader/`plugin`(每个都有其启动时间)
+ 解析
  - 减少 `resolve.modules`, `resolve.extensions`, `resolve.mainFiles`, `resolve.descriptionFiles` 中条目数量，因为他们会增加文件系统调用的次数。
  - 如果你不使用 `symlinks`（例如 `npm link` 或者 `yarn link`），可以设置 `resolve.symlinks: false`。
  - 如果你使用自定义 resolve `plugin` 规则，并且没有指定 context 上下文，可以设置 `resolve.cacheWithContext: false`。
+ 使用 `DllPlugin` 为更改不频繁的代码生成单独的编译结果
+ 减少编译结果的整体大小，以提高构建性能
  - 使用数量更少/体积更小的 library。
  - 在多页面应用程序中使用 `SplitChunksPlugin`。
  - 在多页面应用程序中使用 `SplitChunksPlugin `，并开启 `async` 模式。
  - 移除未引用代码。
  - 只编译你当前正在开发的那些代码。
+ 将非常消耗资源的 loader 分流给一个 worker pool(`thread-loader`)
+ 持久化缓存
+ 对自定义 `plugin`/loader进行概要分析
+ 将 `ProgressPlugin` 从 `webpack` 中删除，可以缩短构建时间

### 开发环境

+ 使用 `webpack` 的 watch mode(监听模式)。而不使用其他工具来 watch 文件和调用 `webpack`

+ 在内存中编译

  下面几个工具通过在内存中（而不是写入磁盘）编译和 serve 资源来提高性能：

  - `webpack-dev-server`
  - `webpack-hot-middleware`
  - `webpack-dev-middleware`

+ 避免获取 `stats` 对象的部分内容

  webpack 4 默认使用 `stats.toJson()` 输出大量数据

+ 不同的 `devtool` 设置，会导致性能差异

  - `"eval"` 具有最好的性能，但并不能帮助你转译代码。
  - 如果你能接受稍差一些的 map 质量，可以使用 `cheap-source-map` 变体配置来提高性能
  - 使用 `eval-source-map` 变体配置进行增量编译。

+ 避免在生产环境下才会用到的工具

  通常在开发环境下，应该排除以下这些工具：

  - `TerserPlugin`
  - `[fullhash]`/`[chunkhash]`/`[contenthash]`
  - `AggressiveSplittingPlugin`
  - `AggressiveMergingPlugin`
  - `ModuleConcatenationPlugin`

+ 最小化 entry chunk

  确保在生成 entry chunk 时，尽量减少其体积以提高性能。下面的配置为运行时代码创建了一个额外的 chunk，所以它的生成代价较低

  ```js
  module.exports = {
    // ...
    optimization: {
      runtimeChunk: true,
    },
  };
  ```

+ 避免额外的优化步骤

  这些优化适用于小型代码库，但是在大型代码库中却非常耗费性能：

  ```js
  module.exports = {
    // ...
    optimization: {
      removeAvailableModules: false,
      removeEmptyChunks: false,
      splitChunks: false,
    },
  };
  ```

+ `options.output.pathinfo` 设置中关闭，使输出结果不携带路径信息

+ `Node.js v8.9.10 - v9.11.1` 中的 `ES2015` `Map` 和 `Set` 实现，存在 [性能回退](https://github.com/nodejs/node/issues/19769)

+  loader 传入 `transpileOnly` 选项，以缩短使用 `ts-loader` 时的构建时间

### 生产环境

+ 禁用source Map

### 工具相关问题

##### Babel

- 最小化项目中的 preset/`plugin` 数量。

##### `TypeScript`

- 在单独的进程中使用 `fork-ts-checker-webpack-plugin` 进行类型检查。
- 配置 loader 跳过类型检查。
- 使用 `ts-loader` 时，设置 `happyPackMode: true` / `transpileOnly: true`。

##### Sass

- `node-sass` 中有个来自 `Node.js` 线程池的阻塞线程的 bug。 当使用 `thread-loader` 时，需要设置 `workerParallelJobs: 2`

---

## 内容安全策略

`Webpack` 能够为其加载的所有脚本添加 `nonce`

### 启用`CSP`

### Trusted Types

### 延伸阅读

- [解释 nonce 设计目的](https://stackoverflow.com/questions/42922784/what-s-the-purpose-of-the-html-nonce-attribute-for-script-and-style-elements)
- [白名单的不安全性和内容安全政策的未来](https://ai.google/research/pubs/pub45542)
- [使用 CSP, Hash, Nonce 和 Report URI 锁定你的网站脚本](https://www.troyhunt.com/locking-down-your-website-scripts-with-csp-hashes-nonces-and-report-uri/)
- [MDN 的 CSP 文档](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Trusted Types](https://web.dev/trusted-types)

---

## 开发 - Vagrant

---

## 依赖管理

### 带表达式的require语句

### `require.context`

---

## 安装

---

## 模块热替换

启动`HMR`

通过`Node.js Api`

`HMR`加载样式

---

## Tree Shaking

它依赖于 ES2015 模块语法的 [静态结构](http://exploringjs.com/es6/ch_modules.html#static-module-structure) 特性，例如 [`import`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import) 和 [`export`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)

通过 `package.json` 的 `"sideEffects"` 属性作为标记项目中的哪些文件是 "pure(纯正 ES2015 模块)"

### 将文件标记为`Side-effect-free`

### 解释`tree shaking` 和 `sideEffects`

+ [`sideEffects`](https://webpack.docschina.org/configuration/optimization/#optimizationsideeffects) 和 [`usedExports`](https://webpack.docschina.org/configuration/optimization/#optimizationusedexports)（更多被认为是 tree shaking）是两种不同的优化方式。

+ **`sideEffects` 更为有效** 是因为它允许跳过整个模块/文件和整个文件子树。

+ `usedExports` 依赖于 [terser](https://github.com/terser-js/terser) 去检测语句中的副作用。

---

## 生产环境

- [配置](https://webpack.docschina.org/guides/production/#setup)
- [NPM Scripts](https://webpack.docschina.org/guides/production/#npm-scripts)
- [指定 mode](https://webpack.docschina.org/guides/production/#specify-the-mode)
- [压缩(Minification)](https://webpack.docschina.org/guides/production/#minification)
- [源码映射(Source Mapping)](https://webpack.docschina.org/guides/production/#source-mapping)
- [压缩 CSS](https://webpack.docschina.org/guides/production/#minimize-css)
- [CLI 替代选项](https://webpack.docschina.org/guides/production/#cli-alternatives)

---

## 懒加载

---

## `ECMAScript`模块

- [导出](https://webpack.docschina.org/guides/ecma-script-modules/#exporting)
- [导入](https://webpack.docschina.org/guides/ecma-script-modules/#importing)
- [将模块标记为 ESM](https://webpack.docschina.org/guides/ecma-script-modules/#flagging-modules-as-esm)

---

## Shimming预置依赖

- [Shimming 预置全局变量](https://webpack.docschina.org/guides/shimming/#shimming-globals)

  `ProvidePlugin`

- [细粒度 Shimming](https://webpack.docschina.org/guides/shimming/#granular-shimming)

- [全局 Exports](https://webpack.docschina.org/guides/shimming/#global-exports)

- [加载 Polyfills](https://webpack.docschina.org/guides/shimming/#loading-polyfills)

- [进一步优化](https://webpack.docschina.org/guides/shimming/#further-optimizations)

- [Node 内置](https://webpack.docschina.org/guides/shimming/#node-built-ins)

- [其他工具](https://webpack.docschina.org/guides/shimming/#other-utilities)

---

## [TypeScript](https://webpack.docschina.org/guides/typescript/)

- [基础配置](https://webpack.docschina.org/guides/typescript/#basic-setup)
- [Loader](https://webpack.docschina.org/guides/typescript/#loader)
- [Source Maps](https://webpack.docschina.org/guides/typescript/#source-maps)
- [Client types](https://webpack.docschina.org/guides/typescript/#client-types)
- [使用第三方类库](https://webpack.docschina.org/guides/typescript/#using-third-party-libraries)
- [导入其他资源](https://webpack.docschina.org/guides/typescript/#importing-other-assets)
- [构建性能](https://webpack.docschina.org/guides/typescript/#build-performance)

---

## [Web Workers](https://webpack.docschina.org/guides/web-workers/)

- [语法](https://webpack.docschina.org/guides/web-workers/#syntax)
- [示例](https://webpack.docschina.org/guides/web-workers/#example)
- [Node.js](https://webpack.docschina.org/guides/web-workers/#nodejs)

---

## [渐进式网络应用程序](https://webpack.docschina.org/guides/progressive-web-application/)

- [现在，我们并没有运行在离线环境下](https://webpack.docschina.org/guides/progressive-web-application/#we-dont-work-offline-now)
- [添加 Workbox](https://webpack.docschina.org/guides/progressive-web-application/#adding-workbox)
- [注册 Service Worker](https://webpack.docschina.org/guides/progressive-web-application/#registering-our-service-worker)
- [结论](https://webpack.docschina.org/guides/progressive-web-application/#conclusion)

---

## [`publicPath`](https://webpack.docschina.org/configuration/output/#outputpublicpath)

---

## 集成

- [NPM Scripts](https://webpack.docschina.org/guides/integrations/#npm-scripts)
- [Grunt](https://webpack.docschina.org/guides/integrations/#grunt)
- [Gulp](https://webpack.docschina.org/guides/integrations/#gulp)
- [Mocha](https://webpack.docschina.org/guides/integrations/#mocha)
- [Karma](https://webpack.docschina.org/guides/integrations/#karma)

---

## 资源模块

- Resource 资源
  - [自定义输出文件名](https://webpack.docschina.org/guides/asset-modules/#custom-output-filename)
- inline 资源(inlining asset)
  - [自定义 data URI 生成器](https://webpack.docschina.org/guides/asset-modules/#custom-data-uri-generator)
- [source 资源(source asset)](https://webpack.docschina.org/guides/asset-modules/#source-assets)
- [URL 资源](https://webpack.docschina.org/guides/asset-modules/#url-资源)
- [通用资源类型](https://webpack.docschina.org/guides/asset-modules/#general-asset-type)
- [变更内联 loader 的语法](https://webpack.docschina.org/guides/asset-modules/#replacing-inline-loader-syntax)

---

## entry高级用法

+ 每个入口使用多种文件类型

---

## package exports

---