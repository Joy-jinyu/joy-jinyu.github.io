---
title: 微前端方案与实践
description: 以 webpack 5 Module Federation 为核心的微前端实践：remote 与 host 配置、共享依赖、运行时动态加载、版本与部署问题，以及方案选型建议。
---

[微前端概念](/notes/fronted/optimization/microFronted/introduction.html)中对比了几种实现方式，这篇聚焦其中的 Module Federation（模块联邦），从一个最小可运行的 remote / host 配置开始，讲清共享依赖怎么配、远程模块怎么在运行时动态加载、上线后要注意的版本和部署问题，最后给出不同场景下的方案选型建议。

## Module Federation 的基本模型

Module Federation 由 webpack 5 引入，核心是三个角色：

| 角色 | 含义 |
| --- | --- |
| remote（远程应用） | 通过 `exposes` 暴露模块，构建时额外生成一个入口文件（通常叫 `remoteEntry.js`） |
| host（宿主应用） | 通过 `remotes` 声明要使用的远程应用，在代码中像引入普通模块一样 `import` 远程模块 |
| shared（共享依赖） | 双方都用到的库（如 React），运行时协商只加载一份 |

一个应用可以同时是 remote 和 host。运行时的过程是：

1. host 加载 remote 的 `remoteEntry.js`，得到一个"容器"对象。
2. host 用自己的共享依赖初始化这个容器，双方协商共享库使用哪个版本。
3. host 通过容器获取暴露的模块，容器再按需加载该模块所在的 chunk。

整个过程中，remote 和 host 各自独立构建、独立部署，remote 更新后无需重新构建 host，刷新页面即可拿到新版本。

## 最小示例

假设有两个 React 应用：`app_shell`（host，端口 3000）和 `app_order`（remote，端口 3001），`app_order` 暴露一个订单列表组件。

### remote 配置

```js
// app_order/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;
const deps = require('./package.json').dependencies;

module.exports = {
  entry: './src/index.js',
  output: {
    // 根据 remoteEntry.js 的实际地址推断资源路径，部署到任意域名都能正确加载 chunk
    publicPath: 'auto',
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'app_order', // 容器名，需全局唯一，必须是合法的 JS 标识符
      filename: 'remoteEntry.js',
      exposes: {
        './OrderList': './src/components/OrderList',
      },
      shared: {
        react: { singleton: true, requiredVersion: deps.react },
        'react-dom': { singleton: true, requiredVersion: deps['react-dom'] },
      },
    }),
  ],
  // 省略 module.rules（babel-loader 等）和 devServer 配置
};
```

### host 配置

```js
// app_shell/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;
const deps = require('./package.json').dependencies;

module.exports = {
  entry: './src/index.js',
  output: { publicPath: 'auto' },
  plugins: [
    new ModuleFederationPlugin({
      name: 'app_shell',
      remotes: {
        // 格式：<remote 的 name>@<remoteEntry.js 的地址>
        app_order: 'app_order@http://localhost:3001/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, requiredVersion: deps.react },
        'react-dom': { singleton: true, requiredVersion: deps['react-dom'] },
      },
    }),
  ],
};
```

### 异步启动边界

两个应用的入口都需要改成"异步启动"：

```js
// src/index.js
import('./bootstrap');
```

```jsx
// src/bootstrap.jsx
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')).render(<App />);
```

原因是共享依赖需要在运行时协商版本，协商是异步的。如果入口文件同步 `import React`，此时共享作用域还没初始化，会报 "Shared module is not available for eager consumption" 错误。把真正的应用代码放进动态 `import()` 的 `bootstrap` 文件里，webpack 就有机会在执行应用代码之前完成协商。

### 使用远程模块

```jsx
// app_shell/src/App.jsx
import { lazy, Suspense } from 'react';

const OrderList = lazy(() => import('app_order/OrderList'));

export default function App() {
  return (
    <main>
      <h1>工作台</h1>
      <Suspense fallback={<p>订单模块加载中…</p>}>
        <OrderList />
      </Suspense>
    </main>
  );
}
```

`app_order/OrderList` 中，`app_order` 对应 `remotes` 里的键，`OrderList` 对应 remote `exposes` 里的 `./OrderList`。远程模块总是异步加载，用 `lazy` + `Suspense` 处理加载状态最自然。

## 共享依赖

`shared` 是 Module Federation 区别于其他方案的关键能力，也是最容易出问题的地方。

### 常用选项

| 选项 | 作用 |
| --- | --- |
| `singleton` | 整个页面只允许存在该库的一个实例。React、Vue、状态管理库、路由库等有全局状态的库必须开启 |
| `requiredVersion` | 当前应用要求的版本范围，通常直接读 `package.json` |
| `strictVersion` | 版本不满足 `requiredVersion` 时直接报错，而不是只给警告 |
| `eager` | 把共享模块直接打进入口 chunk，不再异步加载。可以省掉异步启动边界，但会增加入口体积，且无法再与其他应用协商出更合适的版本 |
| `version` | 手动指定本应用提供的版本，默认从依赖的 `package.json` 读取 |
| `import` | 设为 `false` 时本应用不提供该模块，只使用别人提供的 |

### 版本协商规则

各应用把自己提供的版本注册到共享作用域，加载时按以下逻辑选择：

- 默认情况下，在满足 `requiredVersion` 的已注册版本里选最高的版本。
- 开启 `singleton` 后，全局只使用一个版本（通常是已注册的最高版本）。如果它不满足某个应用的 `requiredVersion`，会在控制台给出警告；开启 `strictVersion` 则直接报错。
- 不开启 `singleton` 时，版本不兼容的应用会加载自己的那一份，页面上可能同时存在多个版本。

:::caution
对 React 这类库，"页面上出现两个实例"会导致 Hooks 报错、Context 无法跨应用传递等难以排查的问题，务必配置 `singleton: true`。同时要在团队内约定这些核心库的大版本，`singleton` 只能保证只有一个实例，不能让不兼容的代码自动兼容。
:::

### 共享哪些依赖

- 必须共享：有全局状态或要求单例的库（React、ReactDOM、Vue、路由、状态管理、组件库的主题上下文）。
- 适合共享：体积较大、多个应用都在用的库（组件库、图表库）。
- 不必共享：体积小、无状态的工具库。共享会带来版本协商的约束，收益不大时不如各自打包。

## 运行时动态加载

把 remote 地址写死在 host 的构建配置里，环境切换和地址变更都要重新构建 host。更常见的做法是在运行时从配置中心获取 remote 地址再加载。webpack 文档给出了不借助额外库的写法：

```js
/** 加载 remote 的入口脚本 */
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`加载失败：${url}`));
    document.head.appendChild(script);
  });
}

/** 运行时加载远程模块 */
export async function loadRemoteModule(url, scope, module) {
  await loadScript(url);
  // 初始化 host 自己的共享作用域
  await __webpack_init_sharing__('default');
  const container = window[scope];
  // 用 host 的共享作用域初始化 remote 容器，完成依赖协商
  await container.init(__webpack_share_scopes__.default);
  const factory = await container.get(module);
  return factory();
}
```

```jsx
const OrderList = lazy(async () => {
  const { orderEntry } = await fetch('/config/remotes.json').then((res) => res.json());
  return loadRemoteModule(orderEntry, 'app_order', './OrderList');
});
```

这里 `scope` 是 remote 配置中的 `name`，它在加载入口脚本后作为全局变量挂在 `window` 上；`module` 是 `exposes` 中的键。同一个 remote 只需加载和初始化一次，实际使用时要加缓存。

Module Federation 社区后续推出了 2.0 版本的配套工具，提供独立的运行时 API（注册和加载 remote）、通过 manifest 文件描述 remote 信息、远程模块的 TypeScript 类型同步、运行时插件等能力，并支持 webpack、Rspack 等多种构建工具。新项目可以直接参考其官方文档，不必手写上面的加载逻辑。

## 版本与部署

Module Federation 让 remote 能独立发布，代价是 host 和 remote 之间形成了一个**运行时契约**，部署和版本管理要按对待 API 的方式对待它。

### 缓存策略

- `remoteEntry.js` 的文件名固定，host 每次都按同一个地址加载，所以它**不能被强缓存**，应设置 `Cache-Control: no-cache`，否则 remote 更新后用户仍会拿到旧的入口。
- remote 的其他 chunk 带内容哈希，可以长期强缓存。
- 部署时保留旧版本的 chunk 一段时间。用户的页面可能已经加载了旧的 `remoteEntry.js`，之后再按需请求旧 chunk，如果已被删除就会加载失败。

### 契约变更

- 暴露模块的 props、导出名、行为都是公共接口。破坏性变更要保持向后兼容，或者通过新的暴露名（如 `./OrderListV2`）、新的部署路径发布新版本，让 host 显式切换。
- 远程模块默认没有类型。可以由 remote 发布类型声明，或使用 Module Federation 2.0 的类型同步能力，让 host 在开发时获得类型检查。
- 共享依赖的大版本升级需要所有应用协调。比如 React 大版本升级，要先确认所有 remote 都能在新版本下运行。

### 容错

remote 是独立部署的，可能出现地址错误、服务故障、版本不兼容。host 必须为远程模块做好兜底（`ErrorBoundary` 为任意错误边界组件，可以自己实现，也可以用社区的现成实现）：

```jsx
<ErrorBoundary fallback={<p>订单模块暂时不可用</p>}>
  <Suspense fallback={<p>加载中…</p>}>
    <OrderList />
  </Suspense>
</ErrorBoundary>
```

远程模块加载失败只影响局部区域，不应让整个页面白屏。白屏相关的兜底思路见[白屏优化方案](/notes/fronted/optimization/blankScreen/case.html)。

### 环境与发布

- 不同环境（测试、预发、生产）的 remote 地址通过配置下发，不写死在构建产物里。
- 灰度发布时，可以由配置中心按用户返回不同版本的 remote 地址。
- 本地开发时，可以让 host 连接线上或测试环境的 remote，只在本地启动正在开发的那个应用。

### 样式与全局副作用

Module Federation 不提供 JS 沙箱和样式隔离，所有模块运行在同一个页面上下文中。需要通过约定避免冲突：样式使用 CSS Modules 或统一前缀，不修改全局对象，不在模块顶层产生副作用，组件卸载时清理事件监听和定时器。

## 基于 Module Federation 的上层方案

直接使用 Module Federation 需要自己处理配置、类型、地址管理等工程问题，社区因此出现了一些在它之上封装的方案。EMP 就是其中之一：它基于 webpack 5 Module Federation，在其上封装了脚手架、配置约定和一套共享模块的使用方式，目标是降低多个项目之间共享组件和页面的接入成本。这类方案本质上仍是 Module Federation，理解了上面的 remote、host、shared 和运行时加载机制，切换到具体的上层框架只是配置写法的差异。

## 方案选型建议

| 场景 | 建议 |
| --- | --- |
| 嵌入第三方系统、不受信任的页面，或隔离要求很高 | iframe |
| 整合多个已有的、技术栈不同的独立系统，希望子应用改动尽量少 | qiankun 这类提供 HTML Entry、沙箱和样式隔离的框架 |
| 技术栈基本统一，主要诉求是跨应用共享组件、页面和依赖 | Module Federation |
| 需要框架无关、标准化的组件级集成 | Web Components，可与其他方案组合 |
| 团队小、应用不大，痛点是代码复用 | 不用微前端，用 monorepo + npm 包 |

选型时再确认几点：

- **构建工具**：Module Federation 依赖构建工具支持，webpack 5 和 Rspack 支持最完整，Vite 需要借助插件；qiankun 对 Vite 构建的子应用需要额外适配。
- **隔离需求**：子应用之间是否可能互相冲突，是否需要运行时沙箱。
- **共享需求**：是需要共享依赖和组件，还是只需要把几个应用拼在一个页面里。
- **团队约定**：任何方案都离不开约定，包括核心依赖版本、样式命名、通信方式、发布流程。约定比技术选型更决定微前端能否长期维护。

## 小结

- Module Federation 让独立构建、独立部署的应用在运行时互相引用模块，由 remote 暴露、host 消费、shared 协商依赖。
- 入口需要异步启动边界，React、Vue 等有全局状态的库必须配置 `singleton`。
- remote 地址应在运行时下发，`remoteEntry.js` 不能强缓存，旧 chunk 要保留一段时间。
- 暴露的模块是运行时契约，变更要兼容或显式升级版本，host 用错误边界为远程模块兜底。
- 选型取决于隔离要求、技术栈是否统一、是否需要共享依赖；小团队优先考虑 monorepo 而不是微前端。

## 参考

- [webpack：Module Federation](https://webpack.js.org/concepts/module-federation/)
- [webpack：ModuleFederationPlugin](https://webpack.js.org/plugins/module-federation-plugin/)
- [Module Federation 官方文档](https://module-federation.io/)
