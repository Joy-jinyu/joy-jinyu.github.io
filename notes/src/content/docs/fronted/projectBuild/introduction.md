---
title: 前端构建工具概览
description: 为什么前端需要构建，任务运行器与打包器的区别，webpack、Rollup、esbuild、Vite、Parcel 等工具的定位对比与选型思路。
---

前端源码很少能原样交给浏览器运行，中间要经过模块合并、语法转译、资源处理和体积优化，这一整套过程就是"构建"。这篇先讲清构建到底在解决什么问题，再区分任务运行器和打包器两类工具，最后对比主流工具的定位，给出选型时可以参考的判断依据。

## 为什么需要构建

### 模块化

现代前端代码按模块组织：一个组件一个文件，通过 `import` 引用工具函数和第三方包。直接把这样的代码交给浏览器会遇到几个问题：

- 浏览器不认识裸模块名。`import { debounce } from 'lodash-es'` 里的 `lodash-es` 不是 URL，浏览器不知道去哪找（Import Maps 能解决一部分，但需要手动维护映射）。
- npm 上大量包仍是 CommonJS 格式（`require` / `module.exports`），浏览器原生不支持。
- 依赖层级很深时，原生 ESM 会触发大量串行请求，首屏加载慢。

打包器从入口出发分析 `import` / `require`，把用到的模块找出来、合并成少量文件，并生成一小段运行时代码负责模块之间的加载和调用。模块化的演进过程见 [webpack 的由来](/notes/fronted/projectBuild/webpack/background.html)。

### 转译

源码里使用的语法和语言，目标环境未必支持：

- **新语法**：可选链、类字段等，需要按目标浏览器降级。常用 Babel、SWC、esbuild 完成。
- **TypeScript / JSX / Vue SFC**：浏览器不能直接执行，需要先转成 JavaScript。
- **CSS 预处理与后处理**：Sass / Less 编译成 CSS，再用 PostCSS 补前缀、转换新特性，详见 [PostCSS 简介](/notes/fronted/projectBuild/postcss/introduction.html)。

转译的底层原理是"源码 → AST → 修改 AST → 生成代码"，可参考 [AST 与代码转换](/notes/fronted/language/javascript/ast.html)。

需要注意，语法转换（把箭头函数变成普通函数）和 API 补齐（给旧浏览器加上 `Promise`、`Array.prototype.includes`）是两件事。后者靠 polyfill，比如 core-js，转译器本身不会凭空提供缺失的 API。

### 资源处理

在模块化的构建体系里，图片、字体、样式、JSON 都可以被 `import`。构建工具负责：

- 把小图片内联成 data URL，大图片复制到输出目录并改写引用路径。
- 把 CSS 抽成独立文件，或在开发时注入 `<style>` 标签。
- 给输出文件名加上内容哈希，配合 HTTP 长缓存使用。

### 优化

生产环境构建还要关心产物体积和加载性能：

| 优化手段 | 作用 |
| --- | --- |
| 压缩（minify） | 去掉空白和注释、缩短变量名，常用 Terser、esbuild、SWC |
| Tree Shaking | 基于 ESM 的静态结构，删除没有被使用的导出 |
| 作用域提升（Scope Hoisting） | 把多个模块合并到同一个函数作用域，减少包裹代码 |
| 代码分割 | 按路由或按需拆分 chunk，首屏只加载必要代码 |
| 内容哈希 | 文件内容不变时文件名不变，浏览器可以长期缓存 |

更完整的性能话题见 [前端性能优化总览](/notes/fronted/optimization/introduction.html)。

### 开发体验

开发阶段还需要本地服务器、文件监听、自动刷新、模块热替换（HMR）、source map 等能力。这部分往往决定了日常开发的手感，也是近几年构建工具竞争最激烈的地方。

## 任务运行器与打包器

早期前端构建工具大致分成两类，它们解决的问题不同。

### 任务运行器

Grunt、Gulp 属于任务运行器（task runner）。它们本身不理解模块依赖，只负责按顺序或并行地执行一个个任务：编译 Sass、压缩 JS、合并文件、复制图片、启动 livereload。

- **Grunt**：以配置为中心，每个任务读写磁盘上的临时文件，任务多了配置会很长。
- **Gulp**：以代码为中心，用 Node.js 流（stream）把多个处理步骤串起来，中间结果在内存里传递，比 Grunt 少了很多磁盘 I/O。

```js
// gulpfile.js：把 Sass 编译、加前缀、压缩串成一个任务
const { src, dest } = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const cleanCSS = require('gulp-clean-css');

function styles() {
  return src('src/styles/*.scss')
    .pipe(sass())
    .pipe(postcss([autoprefixer()]))
    .pipe(cleanCSS())
    .pipe(dest('dist/css'));
}

exports.styles = styles;
```

任务运行器的问题在于：它按"文件"处理，而不是按"模块依赖"处理。`concat` 合并 JS 时，文件顺序需要手动保证；某个工具函数有没有被用到，它也不知道。要做模块化，还得再引入 RequireJS、Browserify 之类的方案。

现在任务运行器的大部分工作已被打包器和 npm scripts 取代。简单的流程编排直接写在 `package.json` 的 `scripts` 里即可。

### 打包器

webpack、Rollup、esbuild、Parcel 属于打包器（bundler）。它们从入口文件出发，递归解析依赖，构建出一张依赖图，再根据依赖图输出产物。因为掌握了完整的依赖关系，打包器能做任务运行器做不到的事：

- 自动确定模块的加载顺序。
- 发现没有被使用的代码并删除（Tree Shaking）。
- 按依赖关系拆分出公共代码和异步 chunk。
- 让非 JS 资源也成为依赖图的一部分。

### 转译器不是打包器

Babel、`tsc`、SWC 主要是转译器：一个文件进、一个文件出，只做语法层面的转换，不负责把多个模块合并起来。它们通常作为打包器的一个环节被调用，比如 webpack 里的 `babel-loader`。其中 esbuild 和 SWC 既能转译也能打包，边界比较模糊，但在大多数项目里主要被当作转译器或压缩器使用。

| 类别 | 代表 | 处理单位 | 是否理解模块依赖 |
| --- | --- | --- | --- |
| 任务运行器 | Grunt、Gulp | 文件与任务 | 否 |
| 转译器 | Babel、tsc、SWC | 单个文件 | 否 |
| 打包器 | webpack、Rollup、esbuild、Parcel | 依赖图 | 是 |
| 开发服务器 + 构建整合 | Vite | 开发时按模块，构建时按依赖图 | 是 |

## 主流工具定位对比

| 工具 | 实现语言 | 定位 | 优势 | 局限 |
| --- | --- | --- | --- | --- |
| webpack | JavaScript | 通用应用打包器 | 生态最成熟，loader / plugin 几乎覆盖所有场景；代码分割、模块联邦等能力完整 | 配置复杂；大项目冷启动和重新构建偏慢 |
| Rollup | JavaScript | 偏库打包 | 基于 ESM 设计，产物干净，Tree Shaking 和作用域提升效果好；能输出 ESM、CJS、UMD、IIFE 等多种格式 | 自身不带开发服务器和 HMR；处理 CommonJS 依赖需要插件 |
| esbuild | Go | 极速转译与打包 | 构建速度快一到两个数量级；内置 TS、JSX 转换和压缩 | 不做类型检查；插件生态和代码分割能力较弱；不适合把代码降级到 ES5 |
| Vite | JavaScript（调用原生工具） | 开发服务器 + 构建工具 | 开发时基于浏览器原生 ESM 按需编译，启动快；生产构建开箱即用 | 开发与生产使用不同的打包路径，偶尔出现行为差异 |
| Parcel | JavaScript + Rust | 零配置打包器 | 几乎无需配置，自动识别资源类型；内置缓存 | 深度定制能力不如 webpack，社区规模较小 |
| Rspack | Rust | 兼容 webpack 的高性能打包器 | 配置和大部分 loader / plugin 与 webpack 兼容，构建速度明显更快 | 与 webpack 生态并非完全兼容，个别插件需要替代方案 |

几点补充：

- **Rollup 已经支持代码分割。** 一些较早的资料说 Rollup "不支持代码拆分"，这是早期版本的情况，现在多入口和动态 `import()` 都能拆分出共享 chunk。它的插件也已迁移到 `@rollup/plugin-*` 命名空间，例如 `@rollup/plugin-commonjs`、`@rollup/plugin-node-resolve`、`@rollup/plugin-terser`。
- **Vite 的生产构建基于 Rollup 的插件体系**，开发时用 esbuild 预构建依赖、转换 TS。官方正在推进用 Rust 编写的 Rolldown 统一开发和生产两条路径，具体以所用版本的文档为准。Vite 的原理见 [Vite 原理与使用](/notes/fronted/language/vue/vite/introduction.html)。
- **webpack 仍然是很多存量项目的基础**，理解它的模块、chunk、loader、plugin 这套模型，对理解其他工具也有帮助。后续文章依次介绍 [webpack 核心概念](/notes/fronted/projectBuild/webpack/concept.html) 和 [webpack 配置详解](/notes/fronted/projectBuild/webpack/configuration.html)。

### 开发模式的两种思路

传统打包器（webpack）在开发时也要先把整个应用打包一遍，再启动服务；改动文件后重新构建受影响的部分。项目越大，冷启动越慢。

Vite 换了一个思路：开发时不打包源码，浏览器请求哪个模块，服务器就即时转换哪个模块并返回，利用浏览器原生 ESM 完成模块加载。第三方依赖则提前用 esbuild 预构建，合并成少量文件，避免请求瀑布。所以冷启动时间与项目规模关系不大。

两种思路没有绝对的优劣：原生 ESM 方案在模块数量极多时会产生大量请求，首次打开页面可能比较慢；打包方案的增量构建在做了缓存优化后也能很快。Rspack、Turbopack 一类工具走的是"保留打包模型，用原生语言提速"的路线。

## 如何选型

可以按项目类型来判断：

| 场景 | 推荐 | 理由 |
| --- | --- | --- |
| 新建单页应用（React / Vue） | Vite | 官方脚手架默认推荐，开发体验好，配置少 |
| 存量 webpack 项目，构建慢 | 先优化 webpack 配置（持久化缓存、缩小 loader 范围），仍不够再评估迁移到 Rspack | 迁移到 Rspack 改动最小；迁到 Vite 需要重写配置和部分插件 |
| 需要模块联邦、复杂自定义构建流程 | webpack 或 Rspack | 相关能力和插件生态最完整 |
| 发布 npm 库 | Rollup，或基于 Rollup / esbuild 的库构建工具 | 需要多格式输出、干净的产物和类型声明 |
| 脚本、CLI、服务端代码的快速打包 | esbuild | 速度快，配置简单 |
| 原型、小型站点，不想写配置 | Parcel 或 Vite | 零配置或接近零配置 |

选型时还要考虑这些因素：

- **框架绑定**：Next.js、Nuxt、Angular CLI 等框架自带构建链，通常跟随框架选择即可，不必单独选打包器。
- **团队熟悉度和存量插件**：一个项目里如果有大量自定义 webpack loader / plugin，迁移成本往往比预期高。
- **目标环境**：需要兼容很旧的浏览器时，要确认工具链的降级能力。esbuild 不能把所有新语法降级到 ES5，这类场景一般要配合 Babel 或 SWC。
- **开发与生产一致性**：开发和生产走不同构建路径的工具，上线前要用生产构建做一次完整验证。

## 小结

- 构建主要解决四件事：模块化、转译、资源处理、产物优化，另外还要提供开发服务器和 HMR。
- 任务运行器（Grunt、Gulp）按文件和任务工作，不理解模块依赖；打包器从入口出发构建依赖图，能做 Tree Shaking 和代码分割。
- Babel、tsc、SWC 是转译器，通常作为打包器的一个环节使用；语法转译和 polyfill 是两回事。
- webpack 生态最完整，Rollup 适合打包库，esbuild 主打速度，Vite 在开发时利用原生 ESM 实现快速启动，Rspack 提供兼容 webpack 的高性能替代。
- 新项目优先跟随框架官方推荐；存量项目先优化再评估迁移，迁移成本主要来自自定义插件。

## 参考

- [webpack 文档：Concepts](https://webpack.js.org/concepts/)
- [Rollup 文档](https://rollupjs.org/introduction/)
- [esbuild 文档](https://esbuild.github.io/)
- [Vite 文档：为什么选 Vite](https://vitejs.dev/guide/why.html)
- [Parcel 文档](https://parceljs.org/docs/)
- [Rspack 文档](https://rspack.dev/guide/start/introduction)
