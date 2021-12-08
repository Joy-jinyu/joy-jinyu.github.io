### 核心概念

#### [入口 - Entry](https://webpack.docschina.org/concepts/entry-points/)

##### 概览

+ 默认值是 `./src/index.js`
+ 可以指定一个（或多个）不同的入口起点

##### 单个入口（简写）语法

##### 对象语法

##### 常见场景

+ 分离 app(应用程序) 和 vendor(第三方库) 入口
+ 多页面应用程序

---

#### 输出 - Output

##### 概览

+ 输出文件的默认值是 `./dist/main.js`
+ 其他生成文件默认放置在 `./dist` 文件夹中 （可通过path来进行配置）

##### 多个入口起点

##### 对资源使用CDN和hash

---

#### Loader

##### 概览

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

##### 使用方式

+ 配置方式（推荐）
+ 内联模式

##### Loader特性

+ 支持链式调用
+ 支持同步或者异步
+ 是运行在Node.js中
+ 通过options对象配置（任然支持query来配置，但是已经废弃）
+ 除了常见的通过 `package.json` 的 `main` 来将一个 npm 模块导出为 loader，还可以在 module.rules 中使用 `loader` 字段直接引用一个模块。
+ 插件(plugin)可以为 loader 带来更多特性。
+ loader 能够产生额外的任意文件。

##### 解析Loader

>loader 遵循标准 [模块解析](https://webpack.docschina.org/concepts/module-resolution/) 规则。多数情况下，loader 将从 [模块路径](https://webpack.docschina.org/concepts/module-resolution/#module-paths) 加载（通常是从 `npm install`, `node_modules` 进行加载）。
>
>我们预期 loader 模块导出为一个函数，并且编写为 Node.js 兼容的 JavaScript。通常使用 npm 进行管理 loader，但是也可以将应用程序中的文件作为自定义 loader。按照约定，loader 通常被命名为 `xxx-loader`（例如 `json-loader`）。更多详细信息，请查看 [编写一个 loader](https://webpack.docschina.org/contribute/writing-a-loader/)。

#### 插件 - Plugin

打包优化，资源管理，注入环境变量等等 - （**loader 用于转换某些类型的模块，而插件则可以用于执行范围更广的任务**）

##### 剖析

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

##### 用法

由于**插件**可以携带参数/选项，你必须在 webpack 配置中，向 `plugins` 属性传入一个 `new` 实例。

##### 配置方式

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

##### Api方式

```javascript
const webpack = require('webpack'); // 访问 webpack 运行时(runtime)
const configuration = require('./webpack.config.js');

let compiler = webpack(configuration);

new webpack.ProgressPlugin().apply(compiler);

compiler.run(function (err, stats) {
  // ...
});
```

#### 模式 - Mode

+ 默认值为 `production`

  > 取值有 `development`, `production` 或 `none` 

#### 浏览器兼容 - Browser Compatibility

+ Webpack 支持所有符合 [ES5 标准](https://kangax.github.io/compat-table/es5/) 的浏览器（不支持 IE8 及以下版本）

+ webpack 的 `import()` 和 `require.ensure()` 需要 `Promise`

  > 想要支持旧版本浏览器，在使用这些表达式之前，还需要 [提前加载 polyfill](https://webpack.docschina.org/guides/shimming/)

#### 环境 - Environment

+ Webpack 5 运行于 Node.js v10.13.0+ 的版本

---

### 高级概念

#### 配置 - Configuration

##### 基本配置

###### 建议

- 通过 `require(...)` 引入其他文件
- 通过 `require(...)` 使用 npm 下载的工具函数
- 使用 JavaScript 控制流表达式，例如 `?:` 操作符
- 对 value 使用常量或变量赋值
- 编写并执行函数，生成部分配置

###### 避免

- 当使用 webpack CLI 工具时，访问 CLI 参数（应编写自己的 CLI 工具替代，或者[使用 `--env`](https://webpack.docschina.org/api/cli/#env)）
- 导出不确定的结果（两次调用 webpack 应产生相同的输出文件）
- 编写超长的配置（应将配置文件拆分成多个

##### [多个target](https://webpack.docschina.org/configuration/configuration-types/#exporting-multiple-configurations)

##### [其它语言进行配置](https://webpack.docschina.org/configuration/configuration-languages/)

+ Typescript
+ CoffeScript
+ Babel and jsx

#### 模块 - Module

模块, 一切皆模块， 一个模块对应一个文件。

#### 模块解析 - Module Resolution

#### 模块联邦 - Module Federation

#### 依赖图 - Dependency graph

#### target

#### manifest

#### 模块热替换 - Hot module replacement