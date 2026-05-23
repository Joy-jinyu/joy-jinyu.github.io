---
title: Deno 简介
description: Deno 的设计动机、默认安全的权限模型、原生 TypeScript 支持、URL / JSR / npm 三种导入方式、内置工具链，以及它与 Node.js 生态的兼容方向。
---

Deno 是一个 JavaScript / TypeScript 运行时，由 Node.js 的最初作者 Ryan Dahl 发起。它同样基于 V8，但在安全模型、模块加载和工具链上做了不同的取舍。这篇介绍 Deno 为什么出现、和 Node 有哪些关键差异，以及日常使用时会接触到的命令和配置。读完应该能判断一个项目适不适合用 Deno，以及从 Node 迁过去要注意什么。

## 设计动机

Ryan Dahl 在 2018 年 JSConf EU 的演讲中，回顾了他对 Node.js 早期设计的几处遗憾，Deno 就是在这些反思上重新设计的：

| Node.js 早期的设计 | 问题 | Deno 的做法 |
| --- | --- | --- |
| 早期 API 以回调为主，曾短暂加入 Promise 又移除 | 异步 API 风格割裂，后来才补上 Promise 版本 | API 从一开始就基于 Promise 和 `async/await` |
| 脚本默认拥有全部系统权限 | 任何依赖都可以读文件、发网络请求、读环境变量 | 默认没有权限，需要显式授权 |
| 依赖 GYP 构建原生扩展 | 构建系统复杂 | 运行时本身用 Rust 实现，原生能力通过 FFI 等方式提供 |
| `package.json` 和中心化 registry | 模块解析与包管理耦合 | 最初只用 URL 导入；现在也支持 `package.json` |
| `node_modules` | 解析规则复杂，目录庞大 | 依赖下载到全局缓存，默认不生成 `node_modules` |
| `require` 可以省略扩展名，`index.js` 作为默认入口 | 解析时需要多次猜测文件路径，和浏览器行为不一致 | 导入路径必须写完整，与浏览器的 ES 模块一致 |

从这张表可以看出 Deno 的总体思路：**尽量和 Web 标准保持一致，默认安全，开箱即用**。

## 默认安全的权限模型

Deno 程序默认不能访问文件系统、网络、环境变量，也不能启动子进程。需要哪些能力，在运行时通过参数授权：

| 参数 | 授予的能力 |
| --- | --- |
| `--allow-read` | 读文件系统 |
| `--allow-write` | 写文件系统 |
| `--allow-net` | 网络访问 |
| `--allow-env` | 读写环境变量 |
| `--allow-run` | 启动子进程 |
| `--allow-ffi` | 加载动态库 |
| `--allow-sys` | 获取系统信息 |
| `-A` / `--allow-all` | 全部权限 |

权限可以细化到具体资源：

```bash
# 只允许读 ./data 目录、只允许访问指定域名
deno run --allow-read=./data --allow-net=api.example.com main.ts
```

运行时如果代码访问了未授权的资源，在交互式终端里 Deno 会提示是否允许；在非交互环境（如 CI）中直接抛出权限错误。代码里也可以查询和请求权限：

```ts
const status = await Deno.permissions.query({ name: 'read', path: './data' });
if (status.state !== 'granted') {
  console.error('需要 ./data 的读取权限');
}
```

这个模型的价值在于限制依赖的能力范围。即使某个第三方包被投毒，只要没有给它网络权限，它就无法把数据发出去。但要注意：权限是**进程级**的，不是包级的。一旦授予了 `--allow-net`，进程里所有代码都能用网络。另外 `--allow-run` 允许启动的子进程不受 Deno 权限约束，`--allow-ffi` 加载的原生代码也不受约束，授权这两项时要格外谨慎。

## 原生支持 TypeScript

Deno 可以直接运行 `.ts` 文件，不需要额外安装 TypeScript、配置 `tsconfig.json` 或构建步骤：

```ts
// main.ts
interface User {
  name: string;
  age: number;
}

const user: User = { name: 'Tom', age: 18 };
console.log(`${user.name} is ${user.age}`);
```

```bash
deno run main.ts
```

需要了解的细节：

- `deno run` 默认只做类型擦除然后执行，**不做类型检查**，这样启动更快。需要检查类型时用 `deno check main.ts`，或者给 `run` 加上 `--check`。
- 编译选项可以写在 `deno.json` 的 `compilerOptions` 中，默认开启严格模式。
- 编辑器方面，安装官方的 Deno 扩展（VS Code 中为 denoland 发布的 Deno 扩展），它通过 Deno 内置的语言服务提供补全和诊断。早期需要安装 `typescript-deno-plugin` 这类插件的做法已经过时。

## 模块导入：URL、JSR 与 npm

Deno 只支持 ES 模块。导入路径必须写完整，包括扩展名。

### URL 导入

Deno 最初的设计是直接从 URL 导入模块：

```ts
import { assertEquals } from 'https://example.com/std/assert/mod.ts';
```

首次运行时下载并缓存，之后从缓存读取。这种方式不需要中心化的 registry，但也有明显问题：版本管理分散在各个 URL 里，同一个依赖的不同版本难以去重，依赖的服务器下线就无法安装。

### JSR

JSR（JavaScript Registry）是 Deno 团队推出的包注册中心，面向现代 JavaScript 和 TypeScript：

- 包可以直接发布 TypeScript 源码，registry 负责为不同的使用方生成类型和兼容格式。
- 支持语义化版本解析。
- 不只服务 Deno，Node、Bun 等运行时也可以通过各自的包管理器使用 JSR 上的包。

Deno 标准库现在发布在 JSR 上，位于 `@std` 作用域下：

```ts
import { assertEquals } from 'jsr:@std/assert';
```

### npm 包

Deno 可以通过 `npm:` 前缀直接使用 npm 上的包：

```ts
import express from 'npm:express';
```

Node 的内置模块用 `node:` 前缀导入：

```ts
import { readFile } from 'node:fs/promises';
```

### 用 deno.json 管理依赖

在每个文件里写完整的 `jsr:`、`npm:` 地址不方便管理版本。实际项目中通常在 `deno.json` 的 `imports` 字段集中声明（即 import map），代码里只写裸模块名：

```json
{
  "imports": {
    "@std/assert": "jsr:@std/assert@^1",
    "express": "npm:express@^4"
  },
  "tasks": {
    "dev": "deno run --watch --allow-net main.ts"
  }
}
```

```ts
import { assertEquals } from '@std/assert';
import express from 'express';
```

可以用 `deno add jsr:@std/assert` 或 `deno add npm:express` 自动写入。Deno 同样会生成 `deno.lock` 锁定依赖版本。

## 内置工具链

Node 项目通常需要分别安装格式化、检查、测试、打包等工具，Deno 把这些都内置在一个可执行文件里：

| 命令 | 作用 |
| --- | --- |
| `deno run` | 运行脚本 |
| `deno serve` | 以 HTTP 服务方式运行导出了 `fetch` 处理函数的模块 |
| `deno task` | 执行 `deno.json`（或 `package.json`）中定义的任务 |
| `deno fmt` | 格式化代码 |
| `deno lint` | 代码检查 |
| `deno check` | 类型检查 |
| `deno test` | 运行测试 |
| `deno bench` | 基准测试 |
| `deno doc` | 根据 JSDoc 生成文档 |
| `deno compile` | 把程序打包成单个可执行文件 |
| `deno add` / `deno install` | 添加和安装依赖 |
| `deno init` | 初始化项目 |

测试示例：

```ts
// math_test.ts
import { assertEquals } from 'jsr:@std/assert';

function add(a: number, b: number) {
  return a + b;
}

Deno.test('add 返回两数之和', () => {
  assertEquals(add(1, 2), 3);
});
```

```bash
deno test
```

一个最小的 HTTP 服务，使用的是和浏览器一致的 `Request` / `Response`：

```ts
// server.ts
Deno.serve({ port: 8000 }, (req) => {
  const url = new URL(req.url);
  if (url.pathname === '/hello') {
    return new Response('hello');
  }
  return new Response('not found', { status: 404 });
});
```

```bash
deno run --allow-net server.ts
```

内置工具链的好处是零配置、版本统一；代价是这些工具的可配置性通常不如 ESLint、Prettier 等专门工具丰富。

## 与 Node.js 的兼容方向

Deno 早期强调"不兼容 Node 的历史包袱"，但生态迁移成本太高，后来的版本明显转向兼容：

- 支持 `node:` 内置模块，大部分常用模块（`fs`、`path`、`http`、`crypto`、`stream` 等）都有实现。
- 支持 `npm:` 导入，可以使用绝大多数 npm 包。
- 能识别项目中的 `package.json`，读取其中的依赖和脚本；需要时也可以生成 `node_modules` 目录，以兼容依赖它的工具。
- 在 CommonJS 模块的支持上逐步完善。

因此，现在的 Deno 可以运行很多现有的 Node 项目，但兼容不是百分之百。依赖原生扩展、依赖 Node 内部实现细节或特定 API 行为的包，仍可能出问题，迁移前需要实际验证。

### 与 Node 的主要差异

| 方面 | Node.js | Deno |
| --- | --- | --- |
| 实现语言 | C++ | Rust |
| 默认权限 | 默认全部权限（新版本提供可选的权限模型，需显式开启） | 无权限，需显式授权 |
| TypeScript | 需要额外工具；较新版本可以直接运行不含特殊语法的 TS 文件 | 原生支持，类型检查需显式开启 |
| 模块系统 | CommonJS 与 ESM 并存 | 以 ESM 为主 |
| 包来源 | npm | JSR、npm、URL |
| 工具链 | 依赖第三方工具 | 内置格式化、检查、测试等 |
| Web API | 逐步补齐 | 优先实现 Web 标准 API |

:::note
选择 Deno 的典型场景：新的 TypeScript 项目、脚本和命令行工具（`deno compile` 能直接产出可执行文件）、需要限制第三方代码权限的场合，以及部署到支持 Deno 的边缘运行平台。已有的大型 Node 项目没有明确收益时，不必为迁移而迁移。
:::

## 小结

- Deno 源于对 Node.js 早期设计的反思：Promise 优先、默认安全、遵循 Web 标准、导入路径显式、去掉 `node_modules` 的复杂解析。
- 权限默认关闭，通过 `--allow-*` 参数按资源授权；权限是进程级的，`--allow-run` 和 `--allow-ffi` 需要谨慎使用。
- 可以直接运行 TypeScript，`deno run` 默认不做类型检查，需要时用 `deno check`。
- 依赖来源包括 URL、JSR（`jsr:`）和 npm（`npm:`），推荐在 `deno.json` 的 `imports` 中集中管理。
- 内置 fmt、lint、test、bench、compile 等工具，开箱即用。
- 现在的 Deno 已大幅兼容 Node 内置模块、npm 包和 `package.json`，但迁移前仍需实际验证。

## 参考

- [Deno 文档](https://docs.deno.com/)
- [Deno 文档：Security and permissions](https://docs.deno.com/runtime/fundamentals/security/)
- [Deno 文档：Modules and dependencies](https://docs.deno.com/runtime/fundamentals/modules/)
- [Deno 文档：Node and npm compatibility](https://docs.deno.com/runtime/fundamentals/node/)
- [JSR 文档](https://jsr.io/docs)
