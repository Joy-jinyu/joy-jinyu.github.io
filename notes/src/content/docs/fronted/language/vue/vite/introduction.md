---
title: Vite 原理与使用
description: Vite 为什么快（原生 ESM 按需编译、依赖预构建）、与 webpack 开发模式的区别、生产构建、常用配置、环境变量、插件机制和 HMR。
---

Vite 是一个前端构建工具，由开发服务器和生产构建两部分组成。它的特点是开发时启动快、热更新快，而且不随项目变大明显变慢。这篇先解释它快在哪里、和 webpack 的开发模式有什么本质区别，然后讲生产构建、常用配置、环境变量、插件机制和热更新。读完应该能看懂和修改一份 `vite.config.ts`，并在遇到"开发正常、构建出问题"之类情况时知道往哪里查。

## 为什么需要 Vite

以 webpack 为代表的传统打包工具，开发模式下也要先把整个应用打包：从入口开始解析所有模块、经过 loader 转换、合并成 bundle，然后才能启动服务器。项目越大，冷启动越慢；改一个文件后，即使只重新构建受影响的部分，也要处理模块图中的一部分并重新生成 bundle，热更新的速度同样会随项目规模下降。

Vite 的出发点是：现代浏览器已经原生支持 ES 模块（`<script type="module">` 和 `import`），开发时没必要先打包，可以把"打包"这件事交给浏览器的模块加载机制。webpack 的背景和概念可以参考 [webpack 的由来](/notes/fronted/projectBuild/webpack/background.html) 和 [webpack 核心概念](/notes/fronted/projectBuild/webpack/concept.html)。

## 开发模式：基于原生 ESM 按需编译

Vite 把项目里的模块分成两类，分别处理。

### 源码：按需编译

业务源码（`.ts`、`.tsx`、`.vue`、`.css` 等）经常修改，而且需要转换。Vite 的做法是：

1. 浏览器请求 `index.html`，里面有 `<script type="module" src="/src/main.ts">`。
2. 浏览器请求 `/src/main.ts`，开发服务器在收到请求时才编译这个文件（比如去掉 TS 类型），返回 JS。
3. 浏览器解析返回的代码，遇到 `import` 语句，再发起新的请求，服务器继续按需编译。

所以启动服务器几乎不需要时间，只有当前页面实际用到的模块才会被编译。没有访问到的路由页面，在打开之前都不会被处理。

编译时 Vite 只做单文件的转换，TypeScript 只去掉类型、不做类型检查，这也是它快的原因之一。类型检查需要另外运行 `tsc --noEmit`（Vue 项目用 `vue-tsc`），通常放在构建脚本或 CI 里。

### 依赖：预构建

`node_modules` 中的第三方依赖如果也按需逐个请求，会有两个问题：

- **格式问题**：不少包只提供 CommonJS 或 UMD 格式，浏览器不能直接作为 ES 模块加载。
- **请求数量问题**：有的 ESM 包内部由数百个小模块组成，比如 `lodash-es`。浏览器导入一次就要发出几百个请求，严重拖慢页面加载。

因此 Vite 在首次启动时会进行依赖预构建：扫描源码找出导入的第三方依赖，把它们转换成 ESM，并把内部模块很多的包合并成少数几个文件。历史上 Vite 使用 esbuild 完成这一步，速度很快；新版本的底层工具在演进，具体以官方文档为准。

预构建的结果缓存在 `node_modules/.vite` 目录下，只有依赖列表、锁文件或相关配置变化时才会重新预构建。浏览器请求这些依赖时，开发服务器会返回强缓存头，避免重复请求。

如果手动修改了 `node_modules` 里的代码想立即生效，可以用 `vite --force` 强制重新预构建，或者删除 `node_modules/.vite`。

源码中的裸模块导入（`import { debounce } from 'lodash-es'`）浏览器不认识，Vite 会把它重写成预构建产物的实际路径。

## 与 webpack 开发模式对比

| | webpack 开发模式 | Vite 开发模式 |
| --- | --- | --- |
| 启动方式 | 先构建整个应用的 bundle，再启动服务器 | 先启动服务器，浏览器请求时再编译 |
| 冷启动耗时 | 随项目规模增长 | 主要取决于依赖预构建，有缓存后很快 |
| 模块加载 | 浏览器加载打包后的 bundle | 浏览器通过原生 ESM 逐个加载源码模块 |
| 热更新 | 重新构建受影响的部分并更新 bundle | 只重新编译改动的模块，速度基本与项目规模无关 |
| 转换工具 | loader（如 babel-loader、ts-loader） | Vite 插件，内置对 TS、JSX、CSS 的支持 |

Vite 开发模式的一个代价是：首次打开页面时，如果模块很多，浏览器要发出大量请求，页面首次加载可能比打包后的版本慢一些。这一般只影响开发体验，不影响线上。

另一个需要注意的地方是，开发环境（按需编译、不打包）和生产环境（打包）的处理流程不同，偶尔会出现"开发正常、构建后出问题"的情况，比如 CommonJS 依赖的导入方式、动态导入路径等。上线前用 `vite preview` 在本地预览构建产物，可以提前发现这类问题。

## 生产构建

生产环境仍然需要打包。原因是即使浏览器支持 ESM，大量未打包的模块会带来过多的网络请求和瀑布式加载（加载完一个模块才知道要加载下一个），还无法做充分的 tree-shaking 和代码压缩。

`vite build` 会：

- 以 `index.html` 为入口打包，处理其中引用的脚本、样式和资源；
- 基于 Rollup 的打包能力完成模块打包、tree-shaking 和代码分割（新版本的底层打包器有所变化，具体以官方文档为准）；
- 压缩 JS 和 CSS，为文件名加上内容 hash，方便长期缓存；
- 对动态 `import()` 自动拆分代码块，并在加载异步代码块时预加载它依赖的公共代码块，减少瀑布请求；
- 小于一定大小的资源会被内联为 base64，其余资源输出为单独文件。

默认产物输出到 `dist` 目录，静态资源放在 `dist/assets` 下。

默认构建目标是支持原生 ESM 和动态导入的现代浏览器。需要支持不支持原生 ESM 的旧浏览器时，可以使用官方的 `@vitejs/plugin-legacy` 插件，它会额外生成一套兼容的产物和必要的 polyfill。

## 常用配置

配置文件是项目根目录的 `vite.config.ts`，用 `defineConfig` 包裹可以获得类型提示：

```ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 部署的公共基础路径，部署在子路径下时修改，例如 '/admin/'
  base: '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // 转发前去掉 /api 前缀
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
```

几个配置项的说明：

- **`resolve.alias`**：路径别名。使用 TypeScript 时还要在 tsconfig 的 `paths` 中配置相同的映射，否则类型检查和编辑器跳转会找不到模块。
- **`server.proxy`**：开发服务器代理，用来解决开发时的跨域问题。它只在 `vite` 开发服务器中生效，构建产物里不存在这个代理，线上需要由网关或 Nginx 处理。`changeOrigin` 会把请求头中的 `Host` 改成目标地址。
- **`base`**：影响产物中资源的引用路径，部署到非根路径时必须设置，否则资源会 404。
- **`build.outDir`**：产物输出目录，默认 `dist`。
- **`build.assetsDir`**：静态资源在输出目录下的子目录，默认 `assets`。

配置也可以导出为函数，根据命令和模式返回不同的配置：

```ts
export default defineConfig(({ command, mode }) => ({
  // command 为 'serve'（开发）或 'build'（构建）
  base: command === 'build' ? '/admin/' : '/',
}));
```

## 环境变量与模式

### import.meta.env

Vite 通过 `import.meta.env` 暴露环境变量，内置的有：

| 变量 | 含义 |
| --- | --- |
| `import.meta.env.MODE` | 当前模式，开发默认 `development`，构建默认 `production` |
| `import.meta.env.DEV` | 是否开发环境 |
| `import.meta.env.PROD` | 是否生产环境 |
| `import.meta.env.BASE_URL` | 等于配置中的 `base` |
| `import.meta.env.SSR` | 是否在服务端渲染中运行 |

构建时这些表达式会被静态替换成具体值，配合条件判断可以让开发专用的代码在生产产物中被移除。

### .env 文件

Vite 会从项目根目录加载以下文件：

```text
.env                # 所有模式都加载
.env.local          # 所有模式都加载，应被 git 忽略
.env.[mode]         # 只在指定模式加载，如 .env.production
.env.[mode].local   # 只在指定模式加载，应被 git 忽略
```

指定模式的文件优先级高于通用文件，`.local` 文件优先级高于对应的非 `.local` 文件。运行时已经存在的环境变量（比如命令行中设置的）优先级最高。

只有以 `VITE_` 开头的变量会暴露给客户端代码，这是为了避免把服务器上的敏感变量意外打进前端产物：

```bash
# .env.staging
VITE_API_BASE=https://staging.example.com
DB_PASSWORD=xxx   # 不会暴露给客户端
```

```bash
vite build --mode staging   # 加载 .env.staging
```

`--mode` 可以定义任意模式，适合区分测试、预发等环境。

在 TypeScript 中为自定义变量补充类型：

```ts
// src/vite-env.d.ts 或 env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

在 `vite.config.ts` 里，`.env` 文件中的变量不会自动注入 `process.env`，需要用 `loadEnv` 手动读取：

```ts
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: { proxy: { '/api': { target: env.API_TARGET, changeOrigin: true } } },
  };
});
```

第三个参数是要加载的变量前缀，传空字符串表示加载所有变量（只在配置文件中使用，不会暴露给客户端）。

:::caution
`VITE_` 变量最终会以明文出现在 JS 产物中，任何访问页面的人都能看到。不要用它存放密钥或私有 token。
:::

## 插件机制

Vite 的插件接口扩展自 Rollup 的插件接口。一个插件就是一个带 `name` 和若干钩子函数的对象：

```ts
import type { Plugin } from 'vite';

export function buildTime(): Plugin {
  const virtualId = 'virtual:build-time';
  const resolvedId = '\0' + virtualId;

  return {
    name: 'build-time',
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId) {
        return `export default ${JSON.stringify(new Date().toISOString())}`;
      }
    },
  };
}
```

这个插件提供了一个虚拟模块，业务代码中 `import time from 'virtual:build-time'` 就能拿到构建时间。`\0` 前缀是 Rollup 生态的约定，表示虚拟模块，其他插件看到后会跳过处理。

常用的钩子分为两类：

- **Rollup 兼容钩子**：`resolveId`（解析模块路径）、`load`（加载模块内容）、`transform`（转换模块代码）等。开发服务器会模拟 Rollup 的插件容器调用这些钩子，所以同一个插件在开发和构建时都能工作。
- **Vite 独有钩子**：`config`（修改配置）、`configResolved`（读取最终配置）、`configureServer`（给开发服务器添加中间件）、`transformIndexHtml`（转换 `index.html`）、热更新相关的钩子等。

两个控制插件行为的属性：

- `enforce: 'pre' | 'post'`：调整插件相对于 Vite 核心插件的执行顺序。
- `apply: 'serve' | 'build'`：让插件只在开发或只在构建时生效。

很多现成的 Rollup 插件可以直接在 Vite 中使用。框架支持也是通过插件实现的，如 `@vitejs/plugin-react`、`@vitejs/plugin-vue`。

## 热更新（HMR）

开发服务器和浏览器之间通过 WebSocket 通信。修改文件后的流程大致是：

1. 服务器监听到文件变化，在模块依赖图中找到该模块。
2. 沿着导入关系向上查找"HMR 边界"，也就是声明了自己能接收更新的模块。
3. 通过 WebSocket 通知浏览器，浏览器重新请求受影响的模块（URL 带上时间戳以绕过缓存），由边界模块执行替换逻辑。
4. 如果一直找到入口都没有遇到边界，就整页刷新。

因为只需要重新编译和加载改动的模块，热更新的速度基本不受项目规模影响。

HMR 的接口是 `import.meta.hot`：

```ts
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    // 用新模块替换旧模块的逻辑
  });
  import.meta.hot.dispose(() => {
    // 清理旧模块留下的副作用，如定时器、事件监听
  });
}
```

日常开发几乎不需要手写这些。React 插件（基于 React Refresh）和 Vue 插件已经为组件实现了 HMR：修改组件后只替换该组件，并尽量保留组件的状态。CSS 文件的修改会直接替换样式，不刷新页面。

React 项目中，如果一个组件文件除了导出组件还导出了普通函数或常量，React Refresh 可能无法安全地只替换组件，会退化为整页刷新或更新范围变大。`eslint-plugin-react-refresh` 就是用来提示这类问题的。

## 小结

- Vite 开发时不打包：源码在浏览器请求时按需编译，依赖提前预构建并缓存，因此启动和热更新都很快。
- 依赖预构建解决两个问题：把 CommonJS 等格式转成 ESM，把内部模块很多的包合并以减少请求。
- Vite 只做转译不做类型检查，类型检查要用 `tsc` 或 `vue-tsc` 另外执行。
- 生产环境仍然打包（基于 Rollup 的能力），自动拆分代码、加 hash、预加载公共代码块；上线前用 `vite preview` 验证产物。
- 环境变量通过 `import.meta.env` 读取，只有 `VITE_` 前缀的变量会暴露给客户端；配置文件中用 `loadEnv` 读取。
- 插件接口兼容 Rollup 并增加了 Vite 专属钩子；HMR 基于 WebSocket 和模块依赖图，按边界模块精确替换。

## 参考

- [Vite：为什么选 Vite](https://vitejs.dev/guide/why)
- [Vite：依赖预构建](https://vitejs.dev/guide/dep-pre-bundling)
- [Vite：配置](https://vitejs.dev/config/)
- [Vite：环境变量和模式](https://vitejs.dev/guide/env-and-mode)
- [Vite：插件 API](https://vitejs.dev/guide/api-plugin)
- [Vite：HMR API](https://vitejs.dev/guide/api-hmr)
