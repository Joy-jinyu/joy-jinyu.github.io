---
title: 用 webpack 搭建 Vue 项目
description: 用 Vue 3、webpack 5 和 vue-loader 从零搭一个可用的单页应用：处理 .vue、样式、静态资源和 Babel/TypeScript，并拆分开发与生产配置。
---

这篇从零搭一个 Vue 3 + webpack 5 的单页应用，目标是一份能直接用于开发和生产构建的最小配置：`vue-loader` 处理单文件组件，样式、图片、Babel 或 TypeScript 各有对应规则，开发和生产配置拆开。读完能看懂脚手架背后的 webpack 配置在做什么，也能在需要时自己维护一份。

:::tip
现在新建 Vue 项目更推荐用 Vite（`npm create vue@latest`），开发启动和热更新都更快，配置也少得多，见 [Vue 3 项目搭建](/notes/fronted/language/vue/createProject.html)。本文适用于必须使用 webpack 的场景：已有 webpack 体系的项目、依赖只有 webpack 版本的 loader / 插件、或者需要把 Vue 组件嵌进现有 webpack 构建里。
:::

webpack 各配置项的含义见 [webpack 配置详解](/notes/fronted/projectBuild/webpack/configuration.html)，资源模块、缓存、代码分离等通用做法见 [webpack 实践指南](/notes/fronted/projectBuild/webpack/guide.html)，这里只讲与 Vue 相关的部分。

## 安装依赖

```bash
npm i vue
npm i -D webpack webpack-cli webpack-dev-server webpack-merge \
  vue-loader html-webpack-plugin mini-css-extract-plugin \
  css-loader style-loader \
  babel-loader @babel/core @babel/preset-env
```

按需追加：

```bash
# 使用 Sass
npm i -D sass sass-loader
# 使用 TypeScript
npm i -D typescript ts-loader
```

和 Vue 2 时代相比的变化：

| Vue 2 + webpack 4 | Vue 3 + webpack 5 |
| --- | --- |
| `vue-loader` 15，需要配套 `vue-template-compiler`，且版本必须与 `vue` 一致 | `vue-loader` 16 起支持 Vue 3（当前为 17.x），模板编译器由 `vue` 包提供，不再安装 `vue-template-compiler` |
| `require('vue-loader/lib/plugin')` | `const { VueLoaderPlugin } = require('vue-loader')` |
| `url-loader` / `file-loader` 处理图片字体 | 资源模块 `type: 'asset'` |
| `webpack-dev-server` 的 `contentBase` | 改名为 `static` |
| `new Vue({ render: h => h(App) }).$mount('#app')` | `createApp(App).mount('#app')` |

## 目录结构

```text
vue-webpack-demo
├─ package.json
├─ babel.config.js
├─ webpack.common.js
├─ webpack.styles.js
├─ webpack.dev.js
├─ webpack.prod.js
├─ public
│  └─ index.html
└─ src
   ├─ main.js
   ├─ App.vue
   └─ assets
      └─ logo.png
```

## 入口与组件

```html
<!-- public/index.html -->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vue + webpack</title>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

```js
// src/main.js
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
```

```vue
<!-- src/App.vue -->
<template>
  <img :src="logo" alt="logo" />
  <button type="button" @click="count++">点击了 {{ count }} 次</button>
</template>

<script setup>
import { ref } from 'vue';
import logo from './assets/logo.png';

const count = ref(0);
</script>

<style scoped>
button {
  padding: 8px 16px;
}
</style>
```

## 公共配置

```js
// webpack.common.js
const path = require('path');
const { DefinePlugin } = require('webpack');
const { VueLoaderPlugin } = require('vue-loader');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
    clean: true,
  },
  resolve: {
    extensions: ['.js', '.ts', '.vue', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
      {
        test: /\.(png|jpe?g|gif|webp|svg)$/i,
        type: 'asset',
      },
      {
        test: /\.(woff2?|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new VueLoaderPlugin(),
    new HtmlWebpackPlugin({ template: './public/index.html' }),
    new DefinePlugin({
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    }),
  ],
};
```

几处需要解释：

**`VueLoaderPlugin` 必须加。** `vue-loader` 会把一个 `.vue` 文件拆成 template、script、style 几个"虚拟模块"。插件的作用是把你为 `.js`、`.css`、`.scss` 等写的规则复制一份应用到这些块上。也就是说，`<script>` 会经过上面的 `babel-loader` 规则，`<style lang="scss">` 会经过 `.scss` 规则。所以不需要在 `vue-loader` 里单独配置各语言，只要为对应文件类型写好普通规则即可。漏掉这个插件，构建会直接报错提示。

**`DefinePlugin` 里的特性开关。** Vue 3 面向打包工具的构建版本会读取这几个编译期常量：

- `__VUE_OPTIONS_API__`：是否支持 Options API。项目完全使用组合式 API 时可以设为 `false`，减小体积。
- `__VUE_PROD_DEVTOOLS__`：生产环境是否支持 Vue Devtools。
- `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__`：生产环境 SSR 水合不匹配时是否输出详细信息，较新的 Vue 3 版本才有。

不定义时 Vue 会使用默认值并在控制台给出警告，显式定义可以消除警告，也让体积优化生效。注意值要写成字符串形式的 JS 表达式。

**图片走资源模块。** 模板里写的静态路径 `<img src="./assets/logo.png">` 会被 `vue-loader` 转成 `import` 请求，同样由 `type: 'asset'` 规则处理。用 `@` 别名时写成 `src="@/assets/logo.png"`。

## 样式规则放在哪

样式规则开发和生产不同：开发用 `style-loader` 注入，支持热更新；生产用 `MiniCssExtractPlugin.loader` 抽成独立文件。写一个小函数生成规则，两个环境各自调用：

```js
// webpack.styles.js
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = function styleRules(isProd) {
  const first = isProd ? MiniCssExtractPlugin.loader : 'style-loader';
  return [
    { test: /\.css$/i, use: [first, 'css-loader'] },
    { test: /\.s[ac]ss$/i, use: [first, 'css-loader', 'sass-loader'] },
  ];
};
```

这个函数不要挂到 `webpack.common.js` 导出的配置对象上：webpack 5 会校验配置结构，出现未知字段会直接报错。

Vue 2 时代常见的 `vue-style-loader` 主要用于服务端渲染场景，普通单页应用用 `style-loader` 即可。`<style scoped>` 的作用域处理由 `vue-loader` 完成，与选用哪个 style loader 无关。

## 开发配置

```js
// webpack.dev.js
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const styleRules = require('./webpack.styles.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'eval-cheap-module-source-map',
  output: {
    filename: '[name].js',
  },
  module: {
    rules: styleRules(false),
  },
  devServer: {
    port: 8080,
    hot: true,
    historyApiFallback: true, // Vue Router 使用 history 模式时刷新页面不 404
  },
});
```

`webpack-merge` 合并时，数组会拼接，所以这里的 `module.rules` 会追加到公共规则后面。

## 生产配置

```js
// webpack.prod.js
const { merge } = require('webpack-merge');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const common = require('./webpack.common.js');
const styleRules = require('./webpack.styles.js');

module.exports = merge(common, {
  mode: 'production',
  devtool: 'source-map',
  output: {
    filename: 'js/[name].[contenthash:8].js',
    chunkFilename: 'js/[name].[contenthash:8].js',
    assetModuleFilename: 'assets/[name].[contenthash:8][ext]',
  },
  module: {
    rules: styleRules(true),
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/[name].[contenthash:8].css',
    }),
  ],
  optimization: {
    runtimeChunk: 'single',
    splitChunks: { chunks: 'all' },
  },
});
```

生产模式默认启用 JS 压缩（`terser-webpack-plugin`）。CSS 压缩需要额外加 `css-minimizer-webpack-plugin`：

```js
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

// 写在 optimization 中
// '...' 表示保留默认的 JS 压缩器
minimizer: ['...', new CssMinimizerPlugin()],
```

`package.json` 脚本：

```json
{
  "scripts": {
    "dev": "webpack serve --config webpack.dev.js",
    "build": "webpack --config webpack.prod.js"
  }
}
```

## Babel 与 TypeScript

### Babel

```js
// babel.config.js
module.exports = {
  presets: ['@babel/preset-env'],
};
```

目标浏览器写在 `package.json` 的 `browserslist` 字段（或 `.browserslistrc`）里，`@babel/preset-env` 和 PostCSS 的 Autoprefixer 会共用这份配置：

```json
{
  "browserslist": ["> 0.5%", "last 2 versions", "not dead"]
}
```

需要按需引入 polyfill 时，给 `preset-env` 加 `useBuiltIns: 'usage'` 和 `corejs` 选项并安装 `core-js`。

### TypeScript

在公共配置里加一条规则：

```js
{
  test: /\.ts$/,
  loader: 'ts-loader',
  options: {
    appendTsSuffixTo: [/\.vue$/], // 让 <script lang="ts"> 块被当作 .ts 处理
    transpileOnly: true,          // 只转译不做类型检查，加快构建
  },
},
```

`transpileOnly: true` 后，类型检查需要另外做。`.vue` 文件的类型检查推荐用 Vue 官方的 `vue-tsc`，在 `package.json` 加一条 `"type-check": "vue-tsc --noEmit"`，放进提交前检查或 CI。

还要给 `.vue` 文件写类型声明，让 TS 认识 `import App from './App.vue'`：

```ts
// src/shims-vue.d.ts
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
```

也可以不用 `ts-loader`，改用 `babel-loader` 配合 `@babel/preset-typescript` 只做转译，类型检查同样交给 `vue-tsc`。

## 把组件嵌进已有页面

另一种常见场景是：页面不是 Vue 单页应用，只想在某个区块里挂一个 Vue 组件，Vue 本身由页面通过 `<script>` 引入。这时把 `vue` 设为外部依赖，并给每个区块一个入口：

```js
module.exports = {
  entry: {
    recommend: './src/widgets/recommend.js',
  },
  externals: {
    vue: 'Vue', // import { createApp } from 'vue' 会取全局变量 window.Vue
  },
};
```

```js
// src/widgets/recommend.js
import { createApp } from 'vue';
import Recommend from './Recommend.vue';

createApp(Recommend).mount('#recommend');
```

要保证页面里 Vue 的 `<script>` 在组件脚本之前加载完成。用 `setInterval` 轮询 `window.Vue` 是否存在虽然能用，但不可靠也不好维护，更好的做法是调整脚本顺序（普通 `<script>` 按顺序执行，`defer` 脚本也按文档顺序执行），或者直接把 Vue 打进 bundle、去掉 `externals`。

## 小结

- 新项目优先用 Vite；需要 webpack 时，Vue 3 配 `vue-loader` 17、webpack 5，不再需要 `vue-template-compiler`。
- `VueLoaderPlugin` 必加，它让 `.vue` 文件里的各个块复用 `.js`、`.css`、`.ts` 等普通规则。
- 用 `DefinePlugin` 显式定义 `__VUE_OPTIONS_API__`、`__VUE_PROD_DEVTOOLS__` 等特性开关，消除警告并缩小体积。
- 样式开发用 `style-loader`，生产用 `mini-css-extract-plugin` 抽取并配合 `css-minimizer-webpack-plugin` 压缩；图片字体用资源模块。
- TypeScript 用 `ts-loader`（`appendTsSuffixTo` + `transpileOnly`）或 Babel 转译，类型检查交给 `vue-tsc`。
- 配置拆成 common / dev / prod，用 `webpack-merge` 合并。

## 参考

- [Vue Loader 文档](https://vue-loader.vuejs.org/)
- [Vue：工具链](https://cn.vuejs.org/guide/scaling-up/tooling.html)
- [Vue：编译时标志（Compile-Time Flags）](https://cn.vuejs.org/api/compile-time-flags.html)
- [webpack：Production](https://webpack.js.org/guides/production/)
- [webpack：TypeScript](https://webpack.js.org/guides/typescript/)
