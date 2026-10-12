---
title: React 项目搭建
description: 用 Vite 创建 React + TypeScript 项目，梳理目录结构，以及路由、状态管理、ESLint、Prettier、路径别名、提交前检查的配置要点。
---

这篇讲怎么从零搭一个 React + TypeScript 项目。先说明为什么不再用 create-react-app（CRA），再给出用 Vite 创建项目的步骤、生成的目录结构，最后把路由、状态管理、代码规范、路径别名、提交前检查这些常用配套逐个接上。读完可以得到一个能直接开发的工程骨架，并知道每一份配置是干什么的。

## 为什么不再用 create-react-app

CRA 曾经是官方给出的"开箱即用"脚手架：一条命令生成项目，webpack、Babel、ESLint 配置全部封装在 `react-scripts` 里。它的问题也来自这层封装：

- 想改 webpack 配置，只能 `eject`（把配置全部吐出来，此后自己维护），或者借助第三方工具打补丁。
- 基于 webpack 的开发服务器在项目变大后启动和热更新都偏慢。
- 长期缺少维护，依赖版本落后。

React 官方已经宣布弃用 CRA。现在 react.dev 的建议是：做完整应用优先考虑一个 React 框架（如 Next.js、React Router 的框架模式等），它们内置了路由、数据获取、服务端渲染等能力；如果只需要一个纯客户端的单页应用，或者想自己掌控技术栈，就用 Vite、Parcel、Rsbuild 这类构建工具起步。

下文选择 Vite + React + TypeScript，适合中后台、内部工具这类纯客户端 SPA。Vite 本身的原理见 [Vite 原理与使用](/notes/fronted/language/vue/vite/introduction.html)。

:::note
旧项目还在用 CRA 并不需要立即迁移，但新项目不要再用它起步。迁移到 Vite 时主要改动是：入口 `index.html` 移到项目根目录、环境变量从 `process.env.REACT_APP_*` 改成 `import.meta.env.VITE_*`、删掉 `react-scripts`。
:::

## 创建项目

需要先装好 Node.js（使用当前仍在维护的 LTS 版本即可，Vite 对 Node 版本有最低要求，过旧会直接报错）。

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
npm run dev
```

几点说明：

- `npm create vite@latest` 等价于执行 `create-vite` 包。用 pnpm 或 yarn 时写成 `pnpm create vite my-app --template react-ts`、`yarn create vite my-app --template react-ts`。
- npm 需要用 `--` 把后面的参数传给脚手架，否则 `--template` 会被 npm 自己吞掉。
- 模板名里 `react-ts` 是 React + TypeScript；还有 `react`（纯 JS）以及使用 SWC 编译的 `react-swc-ts` 等变体。不传 `--template` 时会进入交互式选择。

生成的 `package.json` 里有几条脚本：

| 脚本 | 作用 |
| --- | --- |
| `dev` | 启动开发服务器，带热更新 |
| `build` | 先 `tsc -b` 做类型检查，再 `vite build` 输出生产产物到 `dist` |
| `preview` | 本地起一个静态服务器预览 `dist`，用于检查构建结果 |
| `lint` | 运行 ESLint |

注意 Vite 在开发时只负责把 TS 转成 JS，**不做类型检查**。类型错误只在编辑器里提示，或在 `build` 时由 `tsc` 报出来。

## 目录结构

不同版本的模板会略有差异，大体如下：

```text
my-app/
├── index.html            # 入口 HTML，Vite 从这里开始解析依赖
├── public/               # 原样复制到产物根目录的静态文件
├── src/
│   ├── main.tsx          # 应用入口，创建 React 根节点
│   ├── App.tsx           # 根组件
│   ├── App.css
│   ├── index.css
│   └── assets/           # 会被构建处理（加 hash、内联小文件）的资源
├── eslint.config.js      # ESLint 扁平配置
├── tsconfig.json         # 只做引用，指向下面两份
├── tsconfig.app.json     # src 下业务代码的 TS 配置
├── tsconfig.node.json    # vite.config.ts 等 Node 侧代码的 TS 配置
└── vite.config.ts
```

和 CRA 最大的区别是 `index.html` 在根目录，并且通过 `<script type="module" src="/src/main.tsx">` 直接引用入口文件。

入口文件大致是：

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`createRoot` 是 React 18 引入的根节点 API，旧写法 `ReactDOM.render` 在 React 19 中已被移除。`StrictMode` 只在开发环境生效，会故意把组件函数和 Effect 多执行一次，用来暴露副作用写法上的问题。

`public/` 和 `src/assets/` 的区别：

- `public/` 里的文件不经过构建，按绝对路径引用（如 `/favicon.ico`），适合文件名必须固定的资源。
- `src/assets/` 里的文件通过 `import logo from './assets/logo.svg'` 引入，构建时会带上内容 hash，便于长期缓存。

## 路径别名

项目层级深了以后，`../../../components/Button` 这种相对路径难读也难维护。一般配一个 `@` 指向 `src`。需要改两处：Vite 负责运行时解析，TypeScript 负责类型检查和编辑器跳转，两边要一致。

`vite.config.ts`：

```ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

`tsconfig.app.json` 的 `compilerOptions` 中加：

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

`paths` 中的相对路径相对于该 tsconfig 文件所在目录解析，不需要再配 `baseUrl`。如果用到 `node:url` 时提示找不到类型，安装 `@types/node`。

除了手写别名，也可以用 `vite-tsconfig-paths` 插件让 Vite 直接读取 tsconfig 的 `paths`，只维护一份配置。

## 路由

纯客户端 SPA 通常用 React Router。从 v7 起，主包名是 `react-router`（v6 及之前用 `react-router-dom`，v7 中它仍可用，只是转发导出）。

```bash
npm install react-router
```

用数据路由（data router）的写法：

```tsx
// src/router.tsx
import { createBrowserRouter } from 'react-router';
import Layout from '@/layouts/Layout';
import Home from '@/pages/Home';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      {
        path: 'settings',
        // 按路由拆包：访问时才加载
        lazy: async () => {
          const { default: Component } = await import('@/pages/Settings');
          return { Component };
        },
      },
    ],
  },
]);
```

```tsx
// src/main.tsx
import { RouterProvider } from 'react-router';
import { router } from './router';

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
```

`Layout` 里用 `<Outlet />` 渲染子路由。部署时要注意：使用 History 模式（`createBrowserRouter`）时，服务器需要把所有未命中静态文件的请求回退到 `index.html`，否则刷新子路由会 404。如果部署环境无法配置回退，可以改用 `createHashRouter`。

## 状态管理

先分清状态的种类，再选工具：

| 状态类型 | 例子 | 常见做法 |
| --- | --- | --- |
| 组件局部状态 | 弹窗开关、输入框内容 | `useState` / `useReducer` |
| 跨组件共享的少量状态 | 主题、当前用户、语言 | Context |
| 复杂的全局客户端状态 | 多页面共用的编辑数据、购物车 | Redux Toolkit、Zustand 等 |
| 服务端数据 | 列表、详情、分页 | TanStack Query、SWR、RTK Query 等 |

服务端数据（来自接口、需要缓存和重新请求的数据）最好交给专门的库处理，它们自带缓存、去重、失效重拉和加载状态，不要手动塞进全局 store 再自己维护 loading。剩下真正的全局客户端状态往往不多。Redux 的用法和取舍见 [Redux 状态管理](/notes/fronted/language/react/redux.html)，Hooks 和 Context 见 [React 核心概念与 Hooks](/notes/fronted/language/react/notes.html)。

## ESLint 与 Prettier

### ESLint

Vite 的 React 模板已经带了 `eslint.config.js`。这是 ESLint 9 起默认的"扁平配置"（flat config）格式，旧的 `.eslintrc.*` 格式已被弃用。模板里一般包含：

- `@eslint/js` 的推荐规则；
- `typescript-eslint`：解析 TS 并提供 TS 相关规则；
- `eslint-plugin-react-hooks`：检查 Hooks 规则（只在顶层调用、依赖数组是否完整）；
- `eslint-plugin-react-refresh`：提醒组件文件的导出方式是否会让热更新失效。

`react-hooks` 插件很重要，不要关掉，它能在编码阶段发现大部分 `useEffect` 依赖遗漏问题。可以按需追加 `eslint-plugin-jsx-a11y`（可访问性检查）、`eslint-plugin-import` 等，加之前确认插件已支持扁平配置。

### Prettier

格式交给 Prettier，ESLint 只管代码质量，用 `eslint-config-prettier` 关掉 ESLint 中与格式冲突的规则：

```bash
npm install -D prettier eslint-config-prettier
```

```js
// eslint.config.js（在原有配置数组最后追加）
import prettier from 'eslint-config-prettier';

export default [
  // ...模板原有配置
  prettier,
];
```

模板的导出形式可能是 `tseslint.config(...)` 或 `defineConfig(...)` 调用，把 `prettier` 作为最后一项传进去即可，原则是让它排在最后、覆盖前面的格式类规则。

`.prettierrc`：

```json
{
  "singleQuote": true,
  "semi": true,
  "printWidth": 100,
  "trailingComma": "all"
}
```

旧教程常用 `eslint-plugin-prettier` 把 Prettier 作为 ESLint 规则运行。这样格式问题会以 ESLint 报错的形式出现，编辑器里满屏红线，而且更慢。现在更常见的做法是两者分开运行：编辑器保存时用 Prettier 格式化，ESLint 只报质量问题。

### 编辑器设置

在项目里放一个 `.vscode/settings.json`，统一团队的保存行为：

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

`codeActionsOnSave` 的值在新版 VS Code 中使用 `"explicit"` / `"always"` / `"never"`，旧的 `true` / `false` 仍兼容。

再加一份 `.editorconfig`，让不装 Prettier 插件的编辑器也遵守缩进和换行约定：

```ini
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
```

## 提交前检查

用 husky 管理 Git hooks，用 lint-staged 只检查本次暂存的文件：

```bash
npm install -D husky lint-staged
npx husky init
```

`husky init` 会创建 `.husky/pre-commit` 文件，并在 `package.json` 中加一条 `"prepare": "husky"` 脚本，保证别人 `npm install` 后 hooks 自动生效。把 `.husky/pre-commit` 的内容改成：

```bash
npx lint-staged
```

`package.json` 里配置 lint-staged：

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{css,scss,json,md,html}": ["prettier --write"]
  }
}
```

和旧资料相比有两处变化：

- 老版本 husky 把配置写在 `package.json` 的 `"husky": { "hooks": {...} }` 字段里，新版本已不支持这种写法，改为 `.husky/` 目录下的脚本文件。
- 老版本 lint-staged 需要在命令末尾加 `git add` 把修改后的文件重新暂存，新版本会自动处理，再加反而多余。

类型检查比较慢，一般不放在 pre-commit 里，而是放在 CI 中执行 `tsc -b` 或 `npm run build`。

## 环境变量与开发代理

Vite 只把以 `VITE_` 开头的变量暴露给客户端代码，通过 `import.meta.env` 读取：

```bash
# .env.development
VITE_API_BASE=/api
```

```ts
const base = import.meta.env.VITE_API_BASE;
```

开发时跨域问题用 Vite 的代理解决：

```ts
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

`.env` 文件的加载规则、`mode` 的含义以及更多配置项见 [Vite 原理与使用](/notes/fronted/language/vue/vite/introduction.html)。

:::caution
客户端环境变量最终会被打进 JS 产物，任何人都能看到。不要把密钥、私有 token 放在 `VITE_` 变量里。
:::

## 小结

- CRA 已被官方弃用；纯客户端 SPA 用 Vite 起步，需要服务端渲染、内置数据获取等能力时选 React 框架。
- `npm create vite@latest my-app -- --template react-ts` 创建项目；Vite 开发时不做类型检查，类型错误靠编辑器和 `tsc -b`。
- 路径别名要在 `vite.config.ts` 和 `tsconfig.app.json` 两处保持一致。
- 路由用 React Router（v7 主包为 `react-router`），History 模式部署要配置回退到 `index.html`。
- 服务端数据交给 TanStack Query 这类库，全局客户端状态再考虑 Redux Toolkit 或 Zustand。
- ESLint 9 使用扁平配置，Prettier 与 ESLint 分开运行；husky 新版用 `.husky/` 脚本，lint-staged 不再需要 `git add`。

## 参考

- [React：创建一个 React 应用](https://react.dev/learn/creating-a-react-app)
- [React：从零构建一个 React 应用](https://react.dev/learn/build-a-react-app-from-scratch)
- [Vite：开始](https://vitejs.dev/guide/)
- [Vite：环境变量和模式](https://vitejs.dev/guide/env-and-mode)
- [ESLint：配置文件](https://eslint.org/docs/latest/use/configure/configuration-files)
- [TypeScript：paths](https://www.typescriptlang.org/tsconfig/#paths)
