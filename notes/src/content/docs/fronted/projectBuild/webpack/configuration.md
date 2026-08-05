---
title: webpack 配置详解
description: 以 webpack 5 为准，讲解配置方式、entry 与 output、module.rules、resolve、devServer、devtool、optimization、环境区分与持久化缓存，以及常见报错。
---

[webpack 核心概念](/notes/fronted/projectBuild/webpack/concept.html) 讲了各部分"是什么"，这篇讲"怎么配"。内容按一份配置文件的结构展开：先看配置的几种写法，再逐项说明常用字段的取值和取舍，最后给出开发、生产环境拆分的完整示例。所有内容以 webpack 5、webpack-cli 5、webpack-dev-server 4/5 为准，与 webpack 4 不同的地方会单独指出。

## 配置方式

### 命令行

webpack-cli 支持直接用参数构建，适合临时调试：

```bash
npx webpack --mode development --devtool source-map
npx webpack --entry ./src/main.js --output-path ./build
```

参数一多就不好维护，所以实际项目基本都用配置文件，命令行只传少量开关。

### 配置文件

默认读取项目根目录的 `webpack.config.js`，导出一个对象：

```js
// webpack.config.js
const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
  },
};
```

用 `--config` 指定其他文件，常见于按环境拆分配置：

```bash
npx webpack --config webpack.prod.js
```

配置文件就是普通的 Node.js 模块，可以 `require` 其他文件、使用变量和函数，但要保证结果是确定的：同样的输入两次构建应该得到同样的输出。配置文件也可以用 TypeScript 等语言编写，前提是安装了对应的注册器（如 `ts-node`）。

### 函数式配置

导出一个函数时，webpack-cli 会传入两个参数：`env`（来自 `--env`）和 `argv`（命令行参数）。

```js
module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';
  return {
    mode: isProd ? 'production' : 'development',
    devtool: isProd ? 'source-map' : 'eval-cheap-module-source-map',
    // ...
  };
};
```

```bash
npx webpack --mode production --env analyze
# env 为 { WEBPACK_BUNDLE: true, WEBPACK_BUILD: true, analyze: true }
```

函数还可以返回 Promise，用于在构建前异步读取远程配置等场景。

需要读取外部参数时，应该通过 `--env` 传入，而不是在配置文件里直接解析 `process.argv`。

### 多配置

导出一个数组时，webpack 会依次（或并行）执行多次构建，常用于同一份源码输出多个 target 或多种格式：

```js
const base = { entry: './src/index.js' };

module.exports = [
  {
    ...base,
    name: 'browser',
    target: 'web',
    output: { filename: 'index.browser.js' },
  },
  {
    ...base,
    name: 'node',
    target: 'node',
    output: { filename: 'index.node.js' },
  },
];
```

每个配置可以设置 `name`，配合 `dependencies` 字段声明构建先后顺序；数组导出上的 `parallelism` 属性可以限制并行构建的数量。

## entry

| 写法 | 生成的 chunk |
| --- | --- |
| `'./src/index.js'` | 一个，名为 `main` |
| `['./a.js', './b.js']` | 一个，名为 `main`，两个文件按顺序执行 |
| `{ app: './app.js', admin: './admin.js' }` | 多个，名称为对象的 key |
| `{ app: { import: './app.js', dependOn: 'shared' } }` | 描述对象，可设置依赖、单独文件名等 |
| `() => ({ ... })` | 函数（可异步），返回以上任一形式 |

`context` 字段指定解析 entry 和 loader 的基础目录，默认是 webpack 启动时的工作目录，建议设为绝对路径，避免从不同目录执行命令时结果不同：

```js
module.exports = {
  context: path.resolve(__dirname),
  entry: './src/index.js',
};
```

数组形式的 entry 如果配合 `output.library` 导出库，只有数组最后一个模块的导出会作为库的导出。

## output

### 常用字段

| 字段 | 作用 |
| --- | --- |
| `path` | 输出目录，必须是绝对路径 |
| `filename` | 入口 chunk 的文件名 |
| `chunkFilename` | 非入口 chunk（动态 `import()`、拆分出的 chunk）的文件名，默认根据 `filename` 推导 |
| `assetModuleFilename` | 资源模块（`type: 'asset/resource'`）的文件名 |
| `publicPath` | 浏览器访问资源时的 URL 前缀 |
| `clean` | 构建前清空输出目录（webpack 5.20 起） |
| `library` | 把产物作为库导出 |
| `crossOriginLoading` | 动态加载 chunk 时 `<script>` 标签的 `crossorigin` 属性 |

### 文件名占位符

| 占位符 | 含义 |
| --- | --- |
| `[name]` | chunk 名称，没有名称时用 ID |
| `[id]` | chunk ID |
| `[contenthash]` | 该文件内容的哈希 |
| `[chunkhash]` | 整个 chunk 内容的哈希 |
| `[fullhash]` | 整次构建的哈希（webpack 4 中叫 `[hash]`，webpack 5 中 `[hash]` 已废弃） |
| `[ext]` / `[base]` / `[query]` | 用于资源文件名：扩展名、带扩展名的文件名、查询串 |

哈希可以截取长度，例如 `[contenthash:8]`。

三种哈希的区别：

- `[fullhash]`：任何文件变化都会改变，所有文件名一起变，不适合做长缓存。
- `[chunkhash]`：同一个 chunk 产出的 JS 和 CSS 共享同一个哈希，只改 CSS 也会让 JS 文件名变化。
- `[contenthash]`：按每个输出文件自己的内容计算，最精确。生产环境的 JS、CSS 都推荐用它。

```js
module.exports = {
  output: {
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[contenthash:8].chunk.js',
    assetModuleFilename: 'assets/[name].[contenthash:8][ext]',
    clean: true,
  },
};
```

注意 `assetModuleFilename` 里的 `[ext]` 自带点号，所以写成 `[contenthash][ext]`，不要再加一个 `.`。

开发环境建议直接用 `[name].js`：开发时不需要长缓存，带哈希反而会增加计算量，也可能与热更新产生冲突。

webpack 3 及更早抽取 CSS 用 `extract-text-webpack-plugin`（webpack 4 起官方已改为推荐 `mini-css-extract-plugin`），它提出 `[contenthash]` 正是因为抽取出的 CSS 内容和所在 chunk 的 JS 内容不同，不该共享 `[chunkhash]`。现在抽取 CSS 用 `mini-css-extract-plugin`，文件名同样推荐 `[contenthash]`。

### publicPath

`publicPath` 决定运行时加载异步 chunk、资源文件时拼接的 URL 前缀：

```js
module.exports = {
  output: {
    // 资源部署在 CDN 上
    publicPath: 'https://cdn.example.com/assets/',
  },
};
```

| 取值 | 场景 |
| --- | --- |
| `'auto'` | webpack 5 在 web 环境下的默认值，运行时根据当前脚本的地址推断 |
| `'/'` | 站点部署在域名根路径 |
| `'/sub/'` | 部署在子路径下 |
| `'https://cdn.example.com/'` | 静态资源放在 CDN 上 |
| `''`（空字符串） | 使用相对路径 |

如果前缀在构建时无法确定（比如同一份产物部署到多个环境），可以在入口最前面给 `__webpack_public_path__` 赋值，在运行时动态设置。

### crossOriginLoading

webpack 通过动态插入 `<script>` 标签加载异步 chunk。当 chunk 部署在其他域名时，可以设置这个字段给标签加上 `crossorigin` 属性：

| 取值 | 效果 |
| --- | --- |
| `false`（默认） | 不添加 `crossorigin` 属性 |
| `'anonymous'` | 跨域请求不携带 Cookie 等凭据 |
| `'use-credentials'` | 跨域请求携带凭据 |

一个实际用途是错误监控：跨域脚本出错时，`window.onerror` 默认只能拿到 `Script error.`，看不到具体信息。给标签加上 `crossorigin`，同时服务端返回正确的 CORS 响应头，才能拿到完整的错误信息和堆栈。

### library

把产物打包成库给别人使用时配置。webpack 5 推荐用对象形式：

```js
module.exports = {
  output: {
    library: {
      name: 'MyLib',  // 全局变量名（umd、var 等类型需要）
      type: 'umd',    // 导出方式：umd、commonjs2、module、var 等
      export: 'default', // 只导出入口模块的 default 导出
    },
    globalObject: 'this', // umd 在 Node.js 和浏览器中都能找到全局对象
  },
};
```

webpack 4 的 `libraryTarget`、`libraryExport` 对应现在的 `library.type`、`library.export`。打包库的完整流程见 [webpack 实践指南](/notes/fronted/projectBuild/webpack/guide.html)；如果主要目标是发布 npm 库，也可以考虑 Rollup，参考 [前端构建工具概览](/notes/fronted/projectBuild/introduction.html)。

## module.rules

### 规则的组成

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,                         // 匹配条件
        include: path.resolve(__dirname, 'src'),   // 只处理 src 目录
        use: [
          {
            loader: 'babel-loader',
            options: { cacheDirectory: true },
          },
        ],
      },
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader'], // 从右到左执行
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        type: 'asset',
        parser: { dataUrlCondition: { maxSize: 8 * 1024 } }, // 小于 8KB 内联
      },
    ],
    noParse: /jquery|lodash/, // 不解析这些模块内部的依赖，加快构建
  },
};
```

| 字段 | 作用 |
| --- | --- |
| `test` / `include` / `exclude` | 匹配条件，可以是正则、字符串（绝对路径）、函数或数组 |
| `resourceQuery` | 按 import 路径的查询串匹配，例如 `import url from './a.svg?url'` |
| `use` | loader 列表，执行顺序从后往前 |
| `type` | 模块类型，资源模块用 `asset/resource`、`asset/inline`、`asset/source`、`asset` |
| `parser` / `generator` | 资源模块的解析与生成选项，比如内联阈值、单独的输出文件名 |
| `enforce` | `'pre'` 或 `'post'`，调整 loader 的执行阶段 |
| `oneOf` | 子规则列表，只使用第一个匹配的规则 |
| `sideEffects` | 声明匹配到的模块是否有副作用，影响 Tree Shaking |

`include` 比 `exclude` 更精确，两者都能缩小 loader 的处理范围。`noParse` 只适合完全不包含 `import` / `require` 的模块，否则这些依赖不会被打包。

### oneOf

同一个文件可能匹配多条规则，默认每条匹配的规则都会生效。用 `oneOf` 可以让文件只命中第一条：

```js
module.exports = {
  module: {
    rules: [
      {
        oneOf: [
          { resourceQuery: /raw/, type: 'asset/source' },   // a.svg?raw 得到源码
          { test: /\.svg$/, type: 'asset/resource' },        // 其他 svg 输出文件
        ],
      },
    ],
  },
};
```

常用 loader 的介绍见 [webpack 常用 Loader 与 Plugin](/notes/fronted/keyword/webpackDependencies.html)。

## resolve

```js
module.exports = {
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    extensions: ['.tsx', '.ts', '.js', '.json'],
    modules: [path.resolve(__dirname, 'src'), 'node_modules'],
  },
};
```

| 字段 | 作用 |
| --- | --- |
| `alias` | 路径别名，`import Button from '@/components/Button'` 解析到 `src/components/Button` |
| `extensions` | 省略扩展名时依次尝试的扩展名，默认 `['.js', '.json', '.wasm']` |
| `modules` | 解析模块路径时查找的目录，默认 `['node_modules']` |
| `mainFields` | 读取包的 `package.json` 时优先使用的入口字段 |
| `fallback` | 模块找不到时的替代，常用于给 Node.js 核心模块指定浏览器实现 |
| `symlinks` | 是否把软链接解析到真实路径，默认 `true`，monorepo 中有时需要关注 |

几点建议：

- `extensions` 不宜列太多，且把最常用的放前面。每次省略扩展名的导入都要按顺序尝试，列表越长，失败尝试越多。
- 别名要同步配置到 TypeScript 的 `tsconfig.json`（`compilerOptions.paths`）和 ESLint 等工具，否则编辑器会报找不到模块。
- 在 `alias` 中键名末尾加 `$` 表示精确匹配，例如 `vue$` 只匹配 `import 'vue'`，不匹配 `import 'vue/dist/xxx'`。

webpack 5 不再自动为 `crypto`、`buffer` 等 Node.js 核心模块提供浏览器 polyfill，需要时用 `fallback` 显式配置，不需要则设为 `false`：

```js
module.exports = {
  resolve: {
    fallback: {
      buffer: require.resolve('buffer/'),
      fs: false,
    },
  },
};
```

## devServer

webpack-dev-server 提供本地开发服务器、热更新和请求代理，通过 `npx webpack serve` 启动（webpack-cli 4 起的命令，取代了以前的 `webpack-dev-server` 命令）。

```js
module.exports = {
  devServer: {
    port: 8080,
    open: true,
    hot: true,                       // v4 起默认就是 true
    historyApiFallback: true,        // 单页应用：未匹配的路径都返回 index.html
    static: {
      directory: path.join(__dirname, 'public'), // 额外提供的静态文件目录
    },
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    ],
    client: {
      overlay: { errors: true, warnings: false }, // 页面上只浮层显示错误
    },
  },
};
```

| 字段 | 作用 |
| --- | --- |
| `port` / `host` | 监听端口和地址；局域网真机调试可设 `host: '0.0.0.0'` |
| `hot` | 开启模块热替换 |
| `historyApiFallback` | 配合前端路由的 history 模式，刷新页面不 404 |
| `static` | 提供不经过 webpack 处理的静态文件（v4 起取代 `contentBase`） |
| `proxy` | 把接口请求转发到后端服务，解决开发时的跨域问题 |
| `server` | 使用 `'https'` 启动 HTTPS 服务（v4 后期版本引入，取代旧的 `https` 字段） |
| `client.overlay` | 编译出错时在页面上显示浮层 |

开发服务器的产物放在内存里，不写入磁盘，所以运行期间 `dist` 目录不会更新。webpack-dev-server 各大版本之间字段变化较多，比如 `proxy` 在 v5 中只接受数组形式，升级时以对应版本的文档为准。

## devtool

`devtool` 控制 source map 的生成方式，影响构建速度、调试体验和产物安全性。取值由几个关键词组合而成，顺序固定为 `[inline-|hidden-|eval-][nosources-][cheap-[module-]]source-map`：

| 关键词 | 含义 |
| --- | --- |
| `eval` | 每个模块用 `eval` 包裹执行。单独的 `eval` 只在模块末尾加 `//# sourceURL`，不生成 source map；`eval-*source-map` 系列才把 source map 以 data URL 附在模块末尾。重新构建最快 |
| `inline` | source map 以 data URL 内联在产物文件末尾，不单独生成 `.map` 文件 |
| `hidden` | 生成 `.map` 文件，但产物里不加 `sourceMappingURL` 注释，浏览器不会自动加载 |
| `nosources` | source map 里不包含源码内容，能看到文件名和行号，但看不到源码 |
| `cheap` | 只映射到行，不映射到列，速度更快 |
| `module` | 映射到 loader 处理前的源码（比如 TS、Babel 转换前），而不是转换后的代码 |

常用取值对比：

| 取值 | 构建速度 | 重新构建 | 映射质量 | 适用 |
| --- | --- | --- | --- | --- |
| `false`（不设置） | 最快 | 最快 | 无 | 生产环境不需要调试时 |
| `eval` | 快 | 最快 | 只能看到转换后的代码 | `development` 模式默认值 |
| `eval-cheap-module-source-map` | 中 | 快 | 原始源码，只到行 | 开发环境推荐 |
| `eval-source-map` | 慢 | 中 | 原始源码，精确到列 | 开发环境需要列级定位时 |
| `source-map` | 最慢 | 最慢 | 原始源码，精确到列 | 生产环境需要完整 source map |
| `hidden-source-map` | 最慢 | 最慢 | 同上，但浏览器不加载 | 生产环境，只把 `.map` 上传到错误监控平台 |
| `nosources-source-map` | 最慢 | 最慢 | 只有行列位置，没有源码 | 生产环境，能看堆栈但不暴露源码 |

建议：

- 开发环境用 `eval-cheap-module-source-map`，在速度和可读性之间平衡较好。
- 生产环境不要用带 `eval` 或 `inline` 的取值：前者影响执行性能，后者会让产物体积大幅增加。
- 生产环境如果需要排查线上错误，用 `hidden-source-map` 并只把 `.map` 文件上传到错误监控平台，不要部署到公网，避免源码泄露。

## optimization

`optimization` 控制构建的优化行为。`mode: 'production'` 已经提供了合理的默认值，多数项目只需调整其中几项。

### splitChunks

`splitChunks` 负责把公共模块和第三方库拆成独立 chunk。默认配置只拆分异步 chunk（`chunks: 'async'`），并内置两个缓存组：

- `defaultVendors`：来自 `node_modules` 的模块；
- `default`：被至少两个 chunk 共享的模块。

拆分还受体积和请求数限制，比如模块太小就不值得单独拆出。常见的调整是把入口 chunk 也纳入拆分：

```js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all', // 同步和异步 chunk 都参与拆分
      cacheGroups: {
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
          name: 'react-vendor',
          priority: 20, // 优先级高于默认的 vendors 组
        },
      },
    },
  },
};
```

| 字段 | 作用 |
| --- | --- |
| `chunks` | 哪些 chunk 参与拆分：`'async'`、`'initial'`、`'all'` 或函数 |
| `minSize` | 拆出的 chunk 最小体积，小于它不拆 |
| `maxSize` | 尝试把大于这个体积的 chunk 继续拆小 |
| `minChunks` | 模块至少被几个 chunk 共享才拆 |
| `cacheGroups` | 自定义拆分分组，`test` 匹配模块，`priority` 决定一个模块同时满足多个组时归哪个组 |
| `name` | 拆出 chunk 的名称；固定名称会把同组模块全部合并到一个 chunk |

正则里写 `[\\/]` 是为了同时兼容 Windows 和类 Unix 系统的路径分隔符。

拆分不是越细越好：chunk 太多会增加请求数量，太少又会让一处改动导致大文件缓存失效。是否合适可以用 `webpack-bundle-analyzer` 分析产物后再决定。webpack 4 中的 `CommonsChunkPlugin` 早已被 `splitChunks` 取代。

### runtimeChunk

```js
module.exports = {
  optimization: {
    runtimeChunk: 'single', // 所有入口共享一个 runtime chunk
  },
};
```

把 webpack runtime 和 manifest 单独拆出后，业务代码变化时只有体积很小的 runtime 文件哈希会变，入口 chunk 和 vendor chunk 的缓存可以保留。多入口页面同时加载时，`'single'` 还能保证它们共用同一个模块实例。原理见 [webpack 核心概念](/notes/fronted/projectBuild/webpack/concept.html) 中的 runtime 与 manifest 部分。

### minimizer

生产模式默认用内置的 `TerserPlugin` 压缩 JS。要压缩 CSS 需要额外加 `css-minimizer-webpack-plugin`。覆盖 `minimizer` 时要用 `'...'` 保留默认的 JS 压缩器，否则 JS 不会再被压缩：

```js
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  optimization: {
    minimizer: [
      '...', // 保留默认的 TerserPlugin
      new CssMinimizerPlugin(),
    ],
  },
};
```

如果需要自定义 Terser 选项（比如删除 `console`），就显式写 `new TerserPlugin({ ... })` 代替 `'...'`。webpack 4 常用的 `optimize-css-assets-webpack-plugin` 已被 `css-minimizer-webpack-plugin` 取代。

### 其他常用项

| 字段 | 作用 |
| --- | --- |
| `minimize` | 是否压缩，生产模式默认 `true` |
| `moduleIds` / `chunkIds` | ID 生成方式；生产模式默认 `'deterministic'`，内容不变时 ID 稳定 |
| `usedExports` | 标记未使用的导出，配合压缩器删除，是 Tree Shaking 的一部分 |
| `sideEffects` | 读取 `package.json` 的 `sideEffects` 字段，跳过无副作用且未被使用的模块 |
| `concatenateModules` | 作用域提升，把 ESM 模块合并到同一个函数作用域 |

Tree Shaking 要真正生效，还需要代码以 ESM 形式交给 webpack：如果 Babel 把 `import` 转成了 `require`，静态分析就失效了。`@babel/preset-env` 在 babel-loader 中默认会保留 ESM，通常不需要额外设置。

## 环境区分

### mode 与环境变量

`mode` 设置后，业务代码里的 `process.env.NODE_ENV` 会被替换成对应字符串。其他自定义的编译期常量用 `DefinePlugin` 注入：

```js
const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      __API_BASE__: JSON.stringify('https://api.example.com'),
      __DEV__: JSON.stringify(false),
    }),
  ],
};
```

`DefinePlugin` 是文本替换，字符串值必须用 `JSON.stringify` 包一层，否则会被当成代码插入。

配置文件本身如果需要知道当前环境，可以用函数式配置读取 `argv.mode`，或者使用 webpack-cli 的 `--node-env production` 参数（较新版本的 webpack-cli 可能调整了这个参数名，以 `npx webpack --help` 的输出为准），它会设置 `process.env.NODE_ENV`，配置里没有写 `mode` 时也会用这个值作为 `mode`。

### 拆分与合并配置

开发和生产环境的差异主要在 devtool、devServer、文件名哈希、CSS 抽取和压缩。通常把公共部分放在 `webpack.common.js`，再用 `webpack-merge` 合并：

```js
// webpack.common.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
    extensions: ['.ts', '.tsx', '.js'],
  },
  module: {
    rules: [
      { test: /\.[jt]sx?$/, include: path.resolve(__dirname, 'src'), use: 'babel-loader' },
      { test: /\.(png|jpe?g|gif|svg)$/i, type: 'asset' },
    ],
  },
  plugins: [new HtmlWebpackPlugin({ template: './public/index.html' })],
};
```

```js
// webpack.dev.js
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'eval-cheap-module-source-map',
  output: { filename: '[name].js' },
  module: {
    rules: [{ test: /\.css$/i, use: ['style-loader', 'css-loader'] }],
  },
  devServer: { hot: true, historyApiFallback: true },
});
```

```js
// webpack.prod.js
const { merge } = require('webpack-merge');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'production',
  devtool: 'hidden-source-map',
  output: {
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[contenthash:8].chunk.js',
  },
  module: {
    rules: [{ test: /\.css$/i, use: [MiniCssExtractPlugin.loader, 'css-loader'] }],
  },
  plugins: [new MiniCssExtractPlugin({ filename: '[name].[contenthash:8].css' })],
  optimization: {
    splitChunks: { chunks: 'all' },
    runtimeChunk: 'single',
    minimizer: ['...', new CssMinimizerPlugin()],
  },
});
```

```json
{
  "scripts": {
    "dev": "webpack serve --config webpack.dev.js",
    "build": "webpack --config webpack.prod.js"
  }
}
```

`merge` 对数组是拼接、对对象是深度合并，所以 `module.rules` 和 `plugins` 会在公共配置的基础上追加。`webpack-merge` 从 v5 起改为具名导出 `merge`，旧写法 `const merge = require('webpack-merge')` 在新版本中不可用。

完整的项目搭建示例见 [用 webpack 搭建 Vue 项目](/notes/fronted/projectBuild/webpack/vueProject.html)。

## 缓存

### 持久化缓存

webpack 5 新增了文件系统缓存，把模块构建结果写入磁盘，第二次启动时可以跳过没有变化的模块，大型项目的冷启动时间能明显缩短：

```js
module.exports = {
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename], // 配置文件变化时让缓存失效
    },
  },
};
```

- 默认缓存目录是 `node_modules/.cache/webpack`。
- `buildDependencies.config` 一定要配置。否则修改了 webpack 配置或 loader 选项，缓存可能不会失效，构建出旧结果。
- 不同环境（开发 / 生产）应使用不同的缓存，可以通过 `cache.name` 区分。
- 默认值：`development` 模式是内存缓存（`type: 'memory'`），`production` 模式不缓存。
- 依赖版本变化通过 `package.json` 和锁文件检测；如果遇到构建结果异常，删除缓存目录是最直接的排查手段。

webpack 4 时代常用 `cache-loader`、`hard-source-webpack-plugin` 实现类似效果，在 webpack 5 中应改用内置的 `cache: { type: 'filesystem' }`。`babel-loader` 自身的 `cacheDirectory` 选项仍然可以使用。

### 浏览器缓存

构建缓存解决的是"构建快"，浏览器缓存解决的是"加载快"。后者依赖前面提到的几项配置组合：

1. 文件名使用 `[contenthash]`；
2. `runtimeChunk: 'single'` 拆出 runtime；
3. 第三方库通过 `splitChunks` 拆到独立 chunk；
4. 生产模式默认的 `deterministic` 模块 ID。

这样业务代码改动只影响少数文件名，服务器可以对带哈希的文件设置长期缓存，只让 `index.html` 走协商缓存。

## 常见问题

### Path variable [contenthash] not implemented in this context

这条报错的意思是：当前这个文件名模板所处的上下文不支持 `[contenthash]` 占位符。它在较早的 webpack 版本中比较常见，那时 `output.filename` 等位置还不支持 `[contenthash]`（webpack 3 及 webpack 4 的早期版本中，基本只有抽取 CSS 的插件支持它），把 `[contenthash]` 写进 JS 文件名就会报错。

当时流传的一种绕过办法是改成 `[md5:contenthash:hex:8]` 这种写法。这其实是 `file-loader`、`css-loader` 等 loader 内部的文件名插值语法（`[<hashType>:contenthash:<digestType>:<length>]`），只在这些 loader 的 `name`、`localIdentName` 等选项中有效，并不是 webpack `output` 的通用语法，不建议照搬。

在 webpack 5 中：

- `output.filename`、`output.chunkFilename`、`output.assetModuleFilename` 以及 `mini-css-extract-plugin` 的 `filename` 都直接支持 `[contenthash]`，不需要任何绕过写法。
- 资源文件不再需要 `file-loader`，用资源模块配合 `assetModuleFilename` 或规则里的 `generator.filename` 即可。
- 开发环境建议直接使用 `[name].js`，只在生产配置中使用 `[contenthash]`，既减少不必要的哈希计算，也避免和热更新相关的文件名问题。

### 升级到 webpack 5 后提示找不到 Node.js 核心模块

报错形如 "Module not found: Error: Can't resolve 'crypto'"，并提示 "webpack < 5 used to include polyfills for node.js core modules by default"。原因见上文 resolve 一节：webpack 5 不再自动提供这些 polyfill。按提示用 `resolve.fallback` 指定替代包，或设为 `false` 表示不需要。更好的做法是检查是哪个依赖引入了核心模块，换用面向浏览器的版本。

## 小结

- 配置可以写成对象、函数（接收 `env`、`argv`）、Promise 或数组（多配置）；参数通过 `--env` 传入，不要直接解析 `process.argv`。
- 生产环境文件名用 `[contenthash]`，开发环境用 `[name].js`；webpack 5 中 `[hash]` 改名为 `[fullhash]`，`output.clean` 取代了清理插件，`publicPath` 默认 `'auto'`。
- `module.rules` 用 `include` 缩小范围，资源文件用 `type: 'asset'` 系列取代 `file-loader` / `url-loader`；`resolve.alias` 要与 TS 配置同步。
- 开发环境 devtool 推荐 `eval-cheap-module-source-map`，生产环境用 `hidden-source-map` 或 `nosources-source-map`，不要用 `eval` 和 `inline` 系列。
- `splitChunks: { chunks: 'all' }`、`runtimeChunk: 'single'`、`minimizer: ['...', new CssMinimizerPlugin()]` 是生产配置的常见组合。
- 用 `webpack-merge` 拆分环境配置，用 `cache: { type: 'filesystem' }` 加速重复构建，并配置 `buildDependencies` 保证缓存正确失效。

## 参考

- [webpack 文档：Configuration](https://webpack.js.org/configuration/)
- [webpack 文档：Output](https://webpack.js.org/configuration/output/)
- [webpack 文档：Devtool](https://webpack.js.org/configuration/devtool/)
- [webpack 文档：DevServer](https://webpack.js.org/configuration/dev-server/)
- [webpack 文档：Optimization](https://webpack.js.org/configuration/optimization/)
- [webpack 文档：SplitChunksPlugin](https://webpack.js.org/plugins/split-chunks-plugin/)
- [webpack 文档：Cache](https://webpack.js.org/configuration/cache/)
- [webpack 文档：Production](https://webpack.js.org/guides/production/)
- [webpack 文档：To v5 from v4](https://webpack.js.org/migrate/5/)
