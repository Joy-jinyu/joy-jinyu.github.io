---
title: PostCSS 简介
description: PostCSS 是什么、和 Sass/Less 的区别、常用插件、配置文件写法，以及在 webpack 和 Vite 中如何接入。
---

PostCSS 经常和 Sass、Less 放在一起提，但它不是同一类东西：它是一个把 CSS 解析成语法树、交给插件处理、再输出 CSS 的平台。这篇讲清 PostCSS 的定位、常用插件、配置写法，以及在 webpack 和 Vite 里怎么接入。实现原理和插件开发见 [PostCSS 工作原理](/notes/fronted/projectBuild/postcss/translate.html)。

## PostCSS 是什么

PostCSS 本身只做三件事：

1. 把 CSS 字符串解析成 AST（抽象语法树）。
2. 依次把 AST 交给插件，插件读取、修改这棵树。
3. 把修改后的 AST 重新输出成 CSS 字符串，并可生成 source map。

PostCSS 核心不带任何"功能"。加浏览器前缀、压缩、支持新语法、合并 `@import`，全部由插件完成。不装插件时，PostCSS 输入什么就输出什么。

```text
CSS 源码 → Parser → AST → 插件1 → 插件2 → … → Stringifier → CSS + source map
```

所以准确的说法是：PostCSS 是 CSS 的 AST 转换平台，类似 JavaScript 世界里 Babel 的角色。关于 AST 的通用概念可以参考 [AST 与代码转换](/notes/fronted/language/javascript/ast.html)。

:::note
常见误解是把 PostCSS 叫成"后处理器"，和"预处理器"对立。名字里的 Post 有历史原因，但它能做的事情不限于"处理之后"：用 `postcss-preset-env` 写未来的 CSS 语法再降级，本质上就是在做预处理。按用途区分比按"前/后"区分更准确。
:::

## 与 Sass / Less 的关系

| 对比项 | Sass / Less | PostCSS |
| --- | --- | --- |
| 本质 | 一门扩展了 CSS 的语言，有自己的语法和编译器 | 一个处理 CSS AST 的工具平台 |
| 能力来源 | 内置：变量、嵌套、mixin、函数、循环等 | 全部来自插件 |
| 输入 | `.scss` / `.less` 等非标准语法 | 标准 CSS（借助自定义语法插件也能解析 SCSS 等） |
| 典型用途 | 写样式时的编程能力 | 前缀补全、语法降级、压缩、规范检查 |

两者不冲突，常见组合是先用 Sass 编译出 CSS，再交给 PostCSS 做前缀补全和压缩。

随着原生 CSS 支持了自定义属性（`--color`）、嵌套（CSS Nesting）、`@layer` 等能力，不少项目选择直接写标准 CSS，再用 PostCSS 插件对旧浏览器做降级，不再引入预处理器。是否保留 Sass，取决于是否还依赖它的 mixin、函数、循环这类原生 CSS 没有的能力。

## 常用插件

| 插件 | 作用 |
| --- | --- |
| `autoprefixer` | 根据目标浏览器自动添加或删除厂商前缀（如 `-webkit-`），数据来自 Can I Use |
| `postcss-preset-env` | 把较新的 CSS 特性转换成目标浏览器能识别的写法，内部已包含 autoprefixer |
| `cssnano` | 压缩 CSS：去空白和注释、合并规则、缩短颜色值等 |
| `postcss-import` | 在构建阶段把 `@import` 的文件内联进来，减少请求 |
| `postcss-nesting` | 按 CSS Nesting 规范展开嵌套写法 |
| `postcss-px-to-viewport` 一类 | 把 `px` 换算成 `vw` / `rem`，用于移动端适配 |
| `stylelint` | CSS 规范检查工具，基于 PostCSS 解析，通常单独运行 |

Tailwind CSS 早期版本也以 PostCSS 插件的形式接入，这也说明 PostCSS 只是一个载体，插件可以做非常不同的事情。

### autoprefixer 与 browserslist

autoprefixer 和 postcss-preset-env 都不自己决定"要支持哪些浏览器"，而是读取项目的 browserslist 配置。这个配置通常写在 `package.json` 里，或单独的 `.browserslistrc` 文件中：

```json
{
  "browserslist": ["> 0.5%", "last 2 versions", "not dead"]
}
```

输入：

```css
.box {
  user-select: none;
}
```

如果目标浏览器中有需要前缀的版本，输出会变成：

```css
.box {
  -webkit-user-select: none;
  user-select: none;
}
```

反过来，如果目标浏览器都已原生支持，autoprefixer 还会删掉源码中多余的前缀。手写前缀不仅容易漏，也容易过时，交给工具更可靠。可以用 `npx browserslist` 查看当前配置实际命中了哪些浏览器。

### postcss-preset-env

它按特性的标准化阶段（`stage` 选项）决定启用哪些转换，也可以用 `features` 单独开关某个特性：

```js
// postcss.config.js
module.exports = {
  plugins: [
    require('postcss-preset-env')({
      stage: 2,
      features: {
        'nesting-rules': true,
      },
    }),
  ],
};
```

转换只能做到"语法层面能等价表达"的程度。比如自定义属性在不支持的浏览器里，只能对能静态求值的部分生成回退值，运行时用 JS 修改变量的效果无法降级。

## 配置文件

构建工具通常通过 `postcss-load-config` 自动查找配置，支持 `postcss.config.js`、`postcss.config.cjs`、`postcss.config.mjs`、`.postcssrc` 等文件名，以及 `package.json` 中的 `postcss` 字段。

数组写法，插件按顺序执行：

```js
// postcss.config.js
module.exports = {
  plugins: [
    require('postcss-import'),
    require('postcss-preset-env')({ stage: 2 }),
    require('cssnano')({ preset: 'default' }),
  ],
};
```

对象写法，键是插件包名，值是选项：

```js
// postcss.config.mjs
export default {
  plugins: {
    'postcss-import': {},
    'postcss-preset-env': { stage: 2 },
  },
};
```

配置也可以导出成函数，按环境区分，比如只在生产构建时压缩：

```js
// postcss.config.js
module.exports = (ctx) => ({
  plugins: [
    require('postcss-preset-env'),
    ctx.env === 'production' ? require('cssnano') : false,
  ].filter(Boolean),
});
```

插件顺序需要注意：

- `postcss-import` 放最前面，后续插件才能看到被内联进来的内容。
- 压缩插件（cssnano）放最后，否则后面的插件还要处理被压缩的代码。
- 在 Vite 中，生产构建的 CSS 压缩由 Vite 自己处理，一般不需要再加 cssnano。

## 在构建工具中集成

### webpack

webpack 通过 `postcss-loader` 接入。loader 从右往左执行，`postcss-loader` 要放在 `css-loader` 之后（数组里写在它右边）、`sass-loader` 之前：

```js
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          { loader: 'css-loader', options: { importLoaders: 1 } },
          'postcss-loader',
        ],
      },
      {
        test: /\.s[ac]ss$/,
        use: [
          'style-loader',
          { loader: 'css-loader', options: { importLoaders: 2 } },
          'postcss-loader',
          'sass-loader',
        ],
      },
    ],
  },
};
```

`importLoaders` 表示 `css-loader` 处理 `@import` 进来的文件时，还要先经过它后面的几个 loader。不设置的话，被 `@import` 的文件会跳过 PostCSS 处理。`postcss-loader` 会自动读取项目根目录的 PostCSS 配置，也可以在 `options.postcssOptions` 里直接写插件。生产环境通常把 `style-loader` 换成 `MiniCssExtractPlugin.loader`，把 CSS 提取成单独文件。更多 loader 配置见 [webpack 常用 Loader 与 Plugin](/notes/fronted/keyword/webpackDependencies.html)。

### Vite

Vite 内置了 PostCSS 支持：项目里存在 PostCSS 配置文件时会自动应用到所有 CSS（包括 Vue 单文件组件里的 `<style>`、CSS Modules、Sass 编译后的结果），不需要额外安装 loader。

也可以直接写在 Vite 配置里，此时不再读取外部配置文件：

```js
// vite.config.js
import { defineConfig } from 'vite';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  css: {
    postcss: {
      plugins: [autoprefixer()],
    },
  },
});
```

Vite 还支持把 CSS 处理交给 Lightning CSS（通过 `css.transformer` 配置），它用 Rust 实现了前缀补全、语法降级和压缩，覆盖了一部分常见 PostCSS 插件的能力。依赖特定 PostCSS 插件的项目仍需要 PostCSS。Vite 的整体机制见 [Vite 原理与使用](/notes/fronted/language/vue/vite/introduction.html)。

## 小结

- PostCSS 是 CSS 的 AST 转换平台，核心只负责解析和输出，所有功能来自插件。
- 它和 Sass / Less 不是替代关系，常见做法是预处理器编译后再交给 PostCSS。
- autoprefixer 和 postcss-preset-env 依据 browserslist 决定输出，目标浏览器要在配置里写清楚。
- 配置文件按顺序执行插件：`postcss-import` 放前面，压缩放最后。
- webpack 用 `postcss-loader`，注意 `importLoaders`；Vite 内置支持，放好配置文件即可。

## 参考

- [webpack：postcss-loader](https://webpack.js.org/loaders/postcss-loader/)
- [Vite：CSS 处理 - PostCSS](https://vitejs.dev/guide/features.html#postcss)
- [MDN：CSS 嵌套](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_nesting)
