---
title: webpack 实践指南
description: 以 webpack 5 为准，串起资源模块、HTML 生成、输出清理、source map 与开发服务器、代码分离、长效缓存、Tree Shaking 和库打包这些日常配置。
---

这篇把 webpack 5 日常最常用的配置按"从能跑到上生产"的顺序串起来：先处理 CSS、图片、字体等资源，再生成 HTML、配开发环境，然后做代码分离和长效缓存，最后讲 Tree Shaking 和打包库。每一节给出可以直接用的配置片段，并说明它取代了 webpack 4 时代的哪种做法。

概念层面（entry、output、loader、plugin、chunk 是什么）见 [webpack 核心概念](/notes/fronted/projectBuild/webpack/concept.html)，各配置项的完整含义见 [webpack 配置详解](/notes/fronted/projectBuild/webpack/configuration.html)。

## 起点

```bash
npm i -D webpack webpack-cli
```

```text
webpack-demo
├─ package.json
├─ webpack.config.js
└─ src
   └─ index.js
```

```js
// webpack.config.js
const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
};
```

在 `package.json` 里加 `"build": "webpack"`，`npm run build` 就会把 `src/index.js` 及其依赖打包到 `dist/main.js`（不写入口名时默认 chunk 名是 `main`）。

## 资源管理

### CSS

webpack 本身只理解 JS 和 JSON，CSS 需要 loader：

```bash
npm i -D style-loader css-loader
```

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
};
```

- `css-loader` 解析 CSS 里的 `@import` 和 `url()`，把它们变成模块依赖。
- `style-loader` 在运行时把样式插入 `<style>` 标签。

生产环境通常改用 `mini-css-extract-plugin` 把 CSS 抽成独立文件，以便并行加载和单独缓存，写法见后文。用 Sass / Less 时在链条末尾加 `sass-loader` / `less-loader`；需要自动加浏览器前缀时加 `postcss-loader`，见 [PostCSS 简介](/notes/fronted/projectBuild/postcss/introduction.html)。

### 资源模块：图片、字体与其他文件

webpack 5 内置了**资源模块（asset modules）**，用 `type` 字段声明，不再需要 `file-loader`、`url-loader`、`raw-loader`：

| type | 行为 | 取代 |
| --- | --- | --- |
| `asset/resource` | 把文件输出到产物目录，导入得到它的 URL | `file-loader` |
| `asset/inline` | 把文件转成 data URL 内联，导入得到 data URL 字符串 | `url-loader` |
| `asset/source` | 导入得到文件的原始文本 | `raw-loader` |
| `asset` | 按体积自动选择：小于阈值内联，否则输出文件（默认阈值 8KB） | `url-loader` 的 `limit` |

```js
module.exports = {
  output: {
    // asset/resource 的默认输出文件名模板
    assetModuleFilename: 'assets/[name].[contenthash:8][ext]',
  },
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif|webp)$/i,
        type: 'asset',
        parser: {
          dataUrlCondition: { maxSize: 4 * 1024 }, // 4KB 以下内联
        },
      },
      {
        test: /\.svg$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(woff2?|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: { filename: 'fonts/[name].[contenthash:8][ext]' },
      },
      {
        test: /\.txt$/i,
        type: 'asset/source',
      },
    ],
  },
};
```

使用：

```js
import logoUrl from './logo.png';

const img = new Image();
img.src = logoUrl;
```

CSS 里的 `url(./font.woff2)` 经 `css-loader` 解析后同样会走这些规则。在 JS 里还可以不写 `import`，直接用 `new URL('./logo.png', import.meta.url)`，webpack 5 会识别并按资源模块处理。

:::caution
如果在 webpack 5 里同时保留了旧的 `url-loader` / `file-loader` 规则，又让资源模块生效，同一个文件可能被处理两次，出现重复文件或导入得到奇怪的模块对象。迁移时要么全部换成 `type`，要么在旧规则上加 `type: 'javascript/auto'` 阻止资源模块介入。
:::

### 数据文件

JSON 内置支持，可以直接 `import data from './data.json'`。CSV、XML 需要对应 loader（如 `csv-loader`、`xml-loader`）。TOML、YAML、JSON5 这类能解析成 JSON 的格式，可以用 `type: 'json'` 加自定义解析器，不需要 loader：

```js
const yaml = require('yaml');

module.exports = {
  module: {
    rules: [
      {
        test: /\.ya?ml$/i,
        type: 'json',
        parser: { parse: yaml.parse },
      },
    ],
  },
};
```

## 输出管理

### HtmlWebpackPlugin

产物文件名带上 hash 后，手写 `index.html` 引用脚本就不现实了。`html-webpack-plugin` 会生成 HTML 并自动插入所有入口用到的 JS 和 CSS：

```bash
npm i -D html-webpack-plugin
```

```js
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  plugins: [
    new HtmlWebpackPlugin({
      title: 'webpack demo',
      template: './public/index.html', // 不传则使用插件自带的默认模板
    }),
  ],
};
```

多页应用就实例化多次，用 `filename` 区分输出文件，用 `chunks` 指定每个页面引入哪些入口。

### 清理输出目录

webpack 5 用 `output.clean` 在每次构建前清空输出目录，不再需要 `clean-webpack-plugin`：

```js
module.exports = {
  output: {
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
};
```

### manifest

webpack 运行时需要知道"模块 ID 对应哪段代码、chunk ID 对应哪个文件"，这份映射叫 manifest，默认内嵌在运行时代码里。如果服务端需要知道产物文件名（比如由后端模板注入脚本），可以用 `webpack-manifest-plugin` 把映射导出成 JSON；自己写一个的方法见 [webpack Loader 与 Plugin 开发](/notes/fronted/projectBuild/webpack/api.html)。

## 开发环境

### source map

打包后的代码和源码对不上，报错时需要 source map 才能定位到原始文件和行号。由 `devtool` 控制，取值很多，常用的几种：

| devtool | 适用场景 | 说明 |
| --- | --- | --- |
| `eval-cheap-module-source-map` | 开发 | 重新构建快，能映射到原始源码的行，不精确到列 |
| `eval-source-map` | 开发 | 映射到行和列，初次构建较慢 |
| `source-map` | 生产 | 生成独立的 `.map` 文件，质量最高，构建最慢 |
| `hidden-source-map` | 生产 | 生成 `.map` 但不在产物里加引用注释，适合只上传给错误监控平台 |
| `false` | 生产 | 不生成 |

带 `eval` 的值把每个模块包在 `eval()` 里，不适合生产环境。生产环境是否对外暴露 `.map` 文件要按项目情况决定，不想公开源码就用 `hidden-source-map` 并且不部署 `.map` 文件。

### 三种开发方式

| 方式 | 做法 | 特点 |
| --- | --- | --- |
| watch 模式 | `webpack --watch` | 文件变化自动重新构建，要手动刷新浏览器 |
| webpack-dev-server | `webpack serve` | 自带静态服务器、内存构建、热更新，最常用 |
| webpack-dev-middleware | 挂到已有的 Node 服务上 | 适合需要自定义服务端逻辑的场景 |

```bash
npm i -D webpack-dev-server
```

```js
module.exports = {
  mode: 'development',
  devtool: 'eval-cheap-module-source-map',
  devServer: {
    static: './public', // 额外提供的静态文件目录
    port: 8080,
    hot: true,
    historyApiFallback: true, // 前端路由使用 history 模式时需要
    proxy: [
      { context: ['/api'], target: 'http://localhost:3000' },
    ],
  },
};
```

```json
{
  "scripts": {
    "dev": "webpack serve",
    "build": "webpack --mode production"
  }
}
```

几点需要注意：

- dev server 的构建结果在内存里，`dist` 目录不会被写入。
- webpack-dev-server 4 起，旧配置项 `contentBase` 改为 `static`；`proxy` 在 5 版本中改为数组写法。从老项目迁移时按当前版本文档核对配置项。
- 热更新的原理见 [webpack Loader 与 Plugin 开发](/notes/fronted/projectBuild/webpack/api.html)。

部分编辑器的"安全写入"（先写临时文件再改名）可能让 watch 检测不到变化；遇到改了文件不触发构建时，可以检查编辑器设置。

### 区分开发和生产配置

两套环境的配置差别很大，常见做法是拆成三个文件，用 `webpack-merge` 合并：

```js
// webpack.prod.js
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'production',
  devtool: 'source-map',
});
```

也可以让配置导出一个函数，根据命令行参数决定：

```js
// webpack --env analyze --mode production
module.exports = (env, argv) => ({
  mode: argv.mode,
  devtool: argv.mode === 'production' ? 'source-map' : 'eval-cheap-module-source-map',
});
```

`mode: 'production'` 会自动把业务代码里的 `process.env.NODE_ENV` 替换成 `"production"`，并开启压缩、Tree Shaking 等优化。其他编译期常量用 `DefinePlugin` 注入。

## 代码分离

把代码拆成多个文件，目的是让首屏只加载必须的部分，并让不常变化的代码独立缓存。有三种手段。

### 多入口

```js
module.exports = {
  entry: {
    index: './src/index.js',
    another: './src/another-module.js',
  },
  output: {
    filename: '[name].bundle.js',
  },
};
```

问题是：两个入口都引用了 `lodash`，它会被打进两个 bundle 里。可以用 `dependOn` 声明共享：

```js
module.exports = {
  entry: {
    index: { import: './src/index.js', dependOn: 'shared' },
    another: { import: './src/another-module.js', dependOn: 'shared' },
    shared: 'lodash',
  },
  optimization: {
    runtimeChunk: 'single', // 同一页面加载多个入口时需要共用一份运行时
  },
};
```

### splitChunks

更通用的做法是交给 `SplitChunksPlugin`（webpack 内置，通过 `optimization.splitChunks` 配置）自动提取公共模块：

```js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
  },
};
```

默认只对异步 chunk 生效，设成 `'all'` 后同步引入的公共模块也会被提取。默认规则会把来自 `node_modules` 的模块和被多个 chunk 共用的模块拆出去，并有最小体积等限制，避免拆出大量碎文件。webpack 4 之前的 `CommonsChunkPlugin` 已经移除。

### 动态 import

用 `import()` 引入的模块会被拆成单独的 chunk，运行到这里时才去加载：

```js
async function showChart(el) {
  const { default: Chart } = await import(
    /* webpackChunkName: "chart" */ './chart.js'
  );
  new Chart(el);
}
```

`webpackChunkName` 这类"魔法注释"用来控制 chunk 名称和加载方式：

- `webpackChunkName`：产物文件名。
- `webpackPrefetch: true`：浏览器空闲时预先获取，用于"接下来可能用到"的资源，比如用户大概率会点开的弹窗。
- `webpackPreload: true`：与父 chunk 并行加载，用于"当前页面马上就要用"的资源。用错会和关键资源抢带宽，要谨慎。

路由级懒加载就是这个机制，React 的 `lazy` 和 Vue Router 的异步组件底层都依赖 `import()`。

### 分析产物

拆得是否合理要看产物构成。`webpack --json > stats.json` 导出构建信息，再用 `webpack-bundle-analyzer` 查看每个 chunk 里有哪些模块、各占多大。常见的发现有：某个大库被整包引入、同一个库出现多个版本、某个页面的代码进了公共 chunk。

## 长效缓存

浏览器缓存的理想状态是：内容没变的文件一直命中缓存，内容变了的文件 URL 也跟着变。webpack 里靠三件事做到。

### contenthash

```js
module.exports = {
  output: {
    filename: '[name].[contenthash:8].js',
    chunkFilename: '[name].[contenthash:8].js',
  },
};
```

`[contenthash]` 根据文件内容计算，内容不变 hash 就不变。对比另外两种：`[fullhash]` 是整个构建的 hash，任何改动都会让所有文件名变化；`[chunkhash]` 按 chunk 计算，但 JS 和从中抽出的 CSS 会互相影响。抽取 CSS 时同样使用 `[contenthash]`：

```js
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  module: {
    rules: [{ test: /\.css$/i, use: [MiniCssExtractPlugin.loader, 'css-loader'] }],
  },
  plugins: [new MiniCssExtractPlugin({ filename: '[name].[contenthash:8].css' })],
};
```

开发环境不要用 hash 文件名，会拖慢构建且没有意义。

### runtimeChunk

webpack 的运行时代码（模块加载、chunk 映射）默认内嵌在入口 chunk 里。只要任何一个异步 chunk 的文件名变了，运行时里的映射就变，入口 chunk 的 hash 也会跟着变。把运行时单独拆出来，影响就只落在这个很小的文件上：

```js
module.exports = {
  optimization: {
    runtimeChunk: 'single',
  },
};
```

### moduleIds 与第三方库单独打包

模块 ID 如果按引入顺序递增，新增一个模块就可能让其他模块的 ID 全部错位，导致 `vendors` 这类本该不变的 chunk 内容变化。`moduleIds: 'deterministic'` 根据模块路径生成稳定的短 ID。webpack 5 在生产模式下 `moduleIds` 和 `chunkIds` 默认就是 `'deterministic'`，写出来是为了明确意图。

```js
module.exports = {
  optimization: {
    moduleIds: 'deterministic',
    runtimeChunk: 'single',
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
};
```

把所有第三方库打成一个 `vendors` 适合依赖不多的项目；依赖很多时这个文件会很大，任何一个库升级都会让整个文件失效，可以再按库拆分几组。

:::note
这里的"缓存"指浏览器缓存。另一种缓存是构建缓存：`cache: { type: 'filesystem' }` 把编译结果写到磁盘，二次构建时复用，能明显缩短冷启动时间。它取代了 webpack 4 时代的 `cache-loader`、`hard-source-webpack-plugin` 等方案。
:::

## Tree Shaking 与 sideEffects

Tree Shaking 指去掉"导出了但没被使用"的代码。它依赖 ES 模块 `import` / `export` 的静态结构：编译时就能确定谁用了谁。`mode: 'production'` 下默认开启。

webpack 里其实是两种优化配合：

| 优化 | 作用 | 粒度 |
| --- | --- | --- |
| `usedExports` | 标记模块里哪些导出没被使用，再由压缩工具（Terser）删掉 | 模块内的语句 |
| `sideEffects` | 如果一个模块没有副作用，且它的导出都没被用到，整个模块直接跳过 | 整个文件及其依赖子树 |

`sideEffects` 效果更明显，因为它能跳过整个文件，而 `usedExports` 依赖压缩工具判断语句有没有副作用，判断不了就只能保留。

在 `package.json` 中声明哪些文件有副作用：

```json
{
  "sideEffects": ["*.css", "./src/polyfills.js"]
}
```

写 `false` 表示所有文件都没有副作用。注意 CSS 文件（`import './style.css'`）只为了副作用而引入，如果被标成无副作用就会被删掉，所以要写进数组。

让 Tree Shaking 生效的条件：

- 使用 ES 模块语法。CommonJS 的 `require` / `module.exports` 是动态的，效果很差。
- Babel 不要把 ES 模块转成 CommonJS。`@babel/preset-env` 的 `modules` 默认是 `auto`，配合 `babel-loader` 会保留 ES 模块，不要手动改成 `'commonjs'`。
- 依赖库本身提供 ES 模块版本，并正确声明了 `sideEffects`。比如 `lodash` 是 CommonJS，要用 `lodash-es`。
- 有副作用的函数调用（如 `const a = createSomething()`）压缩工具不敢删，可以在调用前加 `/*#__PURE__*/` 注释告诉它这个调用是纯的。

## 打包库

用 webpack 打包一个给别人用的库，主要配置 `output.library` 和 `externals`：

```js
const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'my-lib.js',
    library: {
      name: 'MyLib',
      type: 'umd',
    },
    globalObject: 'this', // 让 UMD 产物在浏览器和 Node 中都能找到全局对象
  },
  externals: {
    lodash: {
      commonjs: 'lodash',
      commonjs2: 'lodash',
      amd: 'lodash',
      root: '_',
    },
  },
};
```

- `library.type` 决定产物的模块格式：`umd` 能同时用于 CommonJS、AMD 和 `<script>` 标签；`commonjs2` 只给 Node / 打包工具用；`module` 输出 ES 模块，需要同时开启 `experiments.outputModule: true`。
- `externals` 把依赖排除在产物之外，由使用者自己安装。对象形式分别指定在各种模块系统下怎么引用，`root` 是 `<script>` 引入时的全局变量名。
- 被 `externals` 排除的只能是精确匹配的模块名；如果代码里引用了 `lodash/debounce` 这类子路径，需要单独列出或用正则 / 函数形式匹配。
- 在 `package.json` 里用 `main`（以及 `module`、`exports`）指向产物。

库需要附带样式时，用 `mini-css-extract-plugin` 输出独立 CSS 文件，让使用者自行引入。

现在打包纯 JS / TS 库，Rollup 或基于它的 Vite 库模式更常见，产物更干净、ES 模块输出更直接；webpack 适合需要复用现有 webpack 配置（如特定 loader）的场景。工具对比见[前端构建工具概览](/notes/fronted/projectBuild/introduction.html)。

## 小结

- webpack 5 用资源模块（`asset/resource`、`asset/inline`、`asset/source`、`asset`）处理图片字体等文件，取代 `file-loader`、`url-loader`、`raw-loader`。
- `html-webpack-plugin` 生成 HTML 并自动注入产物，`output.clean: true` 取代 `clean-webpack-plugin`。
- 开发用 `eval-cheap-module-source-map` 加 `webpack serve`，生产按需选择 `source-map`、`hidden-source-map` 或关闭；配置按环境拆分。
- 代码分离靠多入口、`splitChunks: { chunks: 'all' }` 和动态 `import()`，用 bundle 分析工具检查结果。
- 长效缓存靠 `[contenthash]`、`runtimeChunk: 'single'` 和稳定的模块 ID；构建缓存用 `cache: { type: 'filesystem' }`。
- Tree Shaking 需要 ES 模块、不被 Babel 转成 CommonJS，并正确声明 `sideEffects`；打包库用 `output.library` 加 `externals`。

## 参考

- [webpack：Asset Modules](https://webpack.js.org/guides/asset-modules/)
- [webpack：Output Management](https://webpack.js.org/guides/output-management/)
- [webpack：Development](https://webpack.js.org/guides/development/)
- [webpack：Devtool](https://webpack.js.org/configuration/devtool/)
- [webpack：Code Splitting](https://webpack.js.org/guides/code-splitting/)
- [webpack：Caching](https://webpack.js.org/guides/caching/)
- [webpack：Tree Shaking](https://webpack.js.org/guides/tree-shaking/)
- [webpack：Authoring Libraries](https://webpack.js.org/guides/author-libraries/)
- [webpack：SplitChunksPlugin](https://webpack.js.org/plugins/split-chunks-plugin/)
