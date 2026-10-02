---
title: webpack 常用 Loader 与 Plugin
description: 按用途分类整理 webpack 生态里常见的 loader 和 plugin，说明各自作用，以及在 webpack 5 下是否仍然需要、该用什么替代。
---

这是一份速查表：按用途把 webpack 生态里常见的 loader 和 plugin 分成几类，每项写清作用，并标注在 webpack 5 下的状态。很多 webpack 4 时代的"标配"已经被内置功能取代，老项目升级或看旧教程时可以对照这里判断哪些依赖可以删掉。

loader 和 plugin 的区别与写法见 [webpack Loader 与 Plugin 开发](/notes/fronted/projectBuild/webpack/api.html)，具体配置示例见 [webpack 实践指南](/notes/fronted/projectBuild/webpack/guide.html)。

表中"webpack 5 下"一列的含义：

- **需要**：仍是常规做法，按需安装。
- **内置**：webpack 自带，不用单独安装或很少需要单独配置。
- **已被取代**：有内置功能或更好的替代品，新项目不要再用。
- **按需**：只在特定场景使用。

## 脚本转译

| 名称 | 作用 | webpack 5 下 |
| --- | --- | --- |
| `babel-loader` | 用 Babel 转译 JS，把新语法转成目标浏览器支持的代码 | 需要 |
| `ts-loader` | 用 TypeScript 编译器处理 `.ts` / `.tsx`，可开启 `transpileOnly` 只转译 | 需要（或用 Babel 的 `@babel/preset-typescript` 替代） |
| `fork-ts-checker-webpack-plugin` | 在独立进程中做 TypeScript 类型检查，配合 `transpileOnly` 使用 | 按需 |
| `esbuild-loader` / `swc-loader` | 用 esbuild / SWC 代替 Babel 转译，速度快很多 | 按需，大型项目提速时考虑 |
| `thread-loader` | 把放在它后面的 loader 放到 worker 池里并行执行 | 按需，只对耗时的 loader 有收益，worker 启动本身有开销 |
| `happypack` | 多进程执行 loader | 已被取代，用 `thread-loader` |
| `eslint-loader` | 构建时运行 ESLint | 已被取代，用 `eslint-webpack-plugin` |

## 样式

| 名称 | 作用 | webpack 5 下 |
| --- | --- | --- |
| `css-loader` | 解析 CSS 中的 `@import` 和 `url()`，支持 CSS Modules | 需要 |
| `style-loader` | 运行时把 CSS 注入 `<style>` 标签，支持热更新 | 需要，通常用于开发环境 |
| `mini-css-extract-plugin` | 把 CSS 抽成独立文件，提供配套的 loader | 需要，通常用于生产环境 |
| `postcss-loader` | 用 PostCSS 处理 CSS，如 Autoprefixer 加前缀 | 需要，见 [PostCSS 简介](/notes/fronted/projectBuild/postcss/introduction.html) |
| `sass-loader` / `less-loader` / `stylus-loader` | 把预处理器语法编译成 CSS | 需要，另需安装 `sass` / `less` / `stylus` |
| `style-resources-loader` | 向每个样式文件自动注入全局变量、mixin 文件 | 按需；`sass-loader` / `less-loader` 的 `additionalData` 选项也能做到，不必额外依赖 |
| `vue-style-loader` | Vue 版的样式注入，支持服务端渲染 | 按需，只在 SSR 场景需要，普通 Vue 3 项目用 `style-loader` |
| `extract-text-webpack-plugin` | 抽取 CSS 到文件 | 已被取代，用 `mini-css-extract-plugin` |

webpack 5 还提供了实验性的原生 CSS 支持（`experiments.css`），可以不经过 `css-loader` 处理 CSS。目前仍是实验特性，生产项目继续用上面的 loader 组合更稳妥。

## 静态资源

| 名称 | 作用 | webpack 5 下 |
| --- | --- | --- |
| `file-loader` | 把文件复制到输出目录，导入得到 URL | 已被取代，用 `type: 'asset/resource'` |
| `url-loader` | 小文件转成 data URL 内联，大文件交给 `file-loader` | 已被取代，用 `type: 'asset/inline'` 或 `type: 'asset'`（按体积自动选择） |
| `raw-loader` | 导入文件的原始文本 | 已被取代，用 `type: 'asset/source'` |
| `copy-webpack-plugin` | 把不经过模块系统的文件（如 `robots.txt`、第三方静态库）原样复制到输出目录 | 需要（开发服务器下也可用 `devServer.static` 提供） |
| `image-minimizer-webpack-plugin` | 压缩图片，可转换格式 | 按需 |
| `@svgr/webpack` | 把 SVG 转成 React 组件 | 按需，React 项目常用 |
| `csv-loader` / `xml-loader` | 导入 CSV、XML 数据 | 按需；YAML、TOML、JSON5 可用 `type: 'json'` 加自定义 `parser.parse`，不需要 loader |

## HTML

| 名称 | 作用 | webpack 5 下 |
| --- | --- | --- |
| `html-webpack-plugin` | 生成 HTML 并自动注入打包产物，支持模板和多页 | 需要 |
| `html-loader` | 把 HTML 文件作为模块导入，并解析其中的 `<img src>` 等资源引用 | 按需 |
| `vue-loader` | 处理 Vue 单文件组件，需配合 `VueLoaderPlugin` | 需要（Vue 项目），见 [用 webpack 搭建 Vue 项目](/notes/fronted/projectBuild/webpack/vueProject.html) |

## 优化与压缩

| 名称 | 作用 | webpack 5 下 |
| --- | --- | --- |
| `terser-webpack-plugin` | 压缩 JS | 内置；生产模式默认启用，只在需要自定义压缩选项时显式安装并配置 |
| `uglifyjs-webpack-plugin` | 压缩 JS | 已被取代，它不支持 ES2015+ 语法，用 `terser-webpack-plugin` |
| `css-minimizer-webpack-plugin` | 压缩 CSS | 需要，加到 `optimization.minimizer`，并用 `'...'` 保留默认 JS 压缩器 |
| `optimize-css-assets-webpack-plugin` | 压缩 CSS | 已被取代，用 `css-minimizer-webpack-plugin` |
| `SplitChunksPlugin` | 提取公共模块、拆分 chunk | 内置，通过 `optimization.splitChunks` 配置 |
| `CommonsChunkPlugin` | 提取公共模块 | 已移除（webpack 4 起），用 `splitChunks` |
| `DefinePlugin` | 在编译期替换常量，如环境变量、特性开关 | 内置 |
| `ProvidePlugin` | 遇到某个自由变量时自动引入模块，如把 `$` 指向 `jquery` | 内置，按需 |
| `IgnorePlugin` | 忽略匹配的模块，如去掉库里用不到的语言包 | 内置，按需 |
| `compression-webpack-plugin` | 预先生成 gzip / brotli 压缩文件，交给服务器直接返回 | 按需，也可以交给服务器或 CDN 实时压缩 |
| `DllPlugin` / `DllReferencePlugin` | 把不常变的依赖预先单独打包，加快重复构建 | 内置但基本不再需要，用持久化缓存 `cache: { type: 'filesystem' }` |
| `cache-loader` / `hard-source-webpack-plugin` | 缓存编译结果加速二次构建 | 已被取代，用 `cache: { type: 'filesystem' }` |
| `clean-webpack-plugin` | 构建前清空输出目录 | 已被取代，用 `output.clean: true` |

## 分析

| 名称 | 作用 | webpack 5 下 |
| --- | --- | --- |
| `webpack-bundle-analyzer` | 以可缩放的树状图展示每个 chunk 包含的模块和体积 | 按需，排查产物体积时常用 |
| `webpack --json` | 输出完整构建信息 `stats.json`，可交给各种分析工具 | 内置 |
| `ProgressPlugin` | 显示构建进度 | 内置；命令行 `--progress` 即启用，本身有少量开销 |
| `speed-measure-webpack-plugin` | 统计每个 loader 和 plugin 的耗时 | 按需；它会包装其他插件，在 webpack 5 下可能与部分插件不兼容，结果仅作参考 |
| `duplicate-package-checker-webpack-plugin` | 检测同一个包被打进了多个版本 | 按需 |

## 开发体验

| 名称 | 作用 | webpack 5 下 |
| --- | --- | --- |
| `webpack-dev-server` | 开发服务器，内存构建、热更新、代理 | 需要；4 及以上版本配置项有较大变化，如 `contentBase` 改为 `static` |
| `webpack-dev-middleware` | 把构建挂到已有的 Express 等服务上 | 按需 |
| `webpack-hot-middleware` | 配合 `webpack-dev-middleware` 提供热更新 | 按需 |
| `@pmmmwh/react-refresh-webpack-plugin` | React 组件热更新，保留组件状态 | 需要（React 项目） |
| `eslint-webpack-plugin` | 构建时运行 ESLint 并报告问题 | 按需；也可以只在编辑器和提交前检查中运行，不放进构建 |
| `stylelint-webpack-plugin` | 构建时运行 Stylelint | 按需 |

## 配置组织

| 名称 | 作用 | webpack 5 下 |
| --- | --- | --- |
| `webpack-merge` | 合并多份配置，常用于拆分 common / dev / prod | 需要；新版本用 `const { merge } = require('webpack-merge')` 具名导入 |
| `webpack-chain` | 用链式 API 修改配置，Vue CLI 内部用它暴露配置修改入口 | 按需；直接维护配置文件的项目一般用不到 |
| `cross-env` | 跨平台设置环境变量，如 `cross-env NODE_ENV=production webpack` | 按需；也可以改用 `webpack --env` 或 `--mode` 传参 |

## 升级时的检查清单

从 webpack 4 升级到 5，先对照上面的"已被取代"项清理依赖：

- `file-loader` / `url-loader` / `raw-loader` 改成资源模块的 `type`。迁移期间如果暂时保留旧 loader，规则上要加 `type: 'javascript/auto'`，防止和资源模块重复处理。
- `clean-webpack-plugin` 改成 `output.clean: true`。
- `optimize-css-assets-webpack-plugin` 改成 `css-minimizer-webpack-plugin`。
- `cache-loader`、`hard-source-webpack-plugin`、`DllPlugin` 改成 `cache: { type: 'filesystem' }`。
- 自己维护的 loader 用 `this.getOptions()` 代替 `loader-utils` 的 `getOptions`；插件改用 `processAssets` 钩子处理产物。
- webpack 5 不再自动为 Node.js 核心模块（如 `buffer`、`path`、`crypto`）注入浏览器 polyfill。代码或依赖用到它们时，要么在 `resolve.fallback` 里显式配置替代包，要么设为 `false` 并确认确实用不到。

## 小结

- 资源类 loader（`file-loader`、`url-loader`、`raw-loader`）在 webpack 5 中都被资源模块取代。
- 样式仍是 `css-loader` + `style-loader`（开发）/ `mini-css-extract-plugin`（生产）+ 预处理器 loader 的组合。
- JS 压缩内置且生产模式默认开启，CSS 压缩要加 `css-minimizer-webpack-plugin`。
- 清理输出目录用 `output.clean`，构建缓存用 `cache: { type: 'filesystem' }`，旧的清理和缓存插件可以删掉。
- 体积问题先用 `webpack-bundle-analyzer` 看产物构成，再决定拆分和替换策略。

## 参考

- [webpack：Loaders 列表](https://webpack.js.org/loaders/)
- [webpack：Plugins 列表](https://webpack.js.org/plugins/)
- [webpack：Asset Modules](https://webpack.js.org/guides/asset-modules/)
- [webpack：To v5 from v4](https://webpack.js.org/migrate/5/)
