---
title: npm 依赖管理
description: package.json 关键字段、四类依赖的区别、语义化版本与 lock 文件、npm / yarn / pnpm 的安装机制差异、npx、workspaces 与常用命令，以及常用工具包速查。
---

前端项目几乎都靠 npm 生态运转，但"装个包"背后有不少容易踩坑的地方：版本范围怎么解析、lock 文件该不该提交、为什么换了包管理器有些依赖就找不到了。这篇从 `package.json` 讲起，梳理依赖类型、版本规则、各包管理器的安装机制和 monorepo 支持，最后整理一份常用工具包速查。

## package.json 关键字段

| 字段 | 作用 |
| --- | --- |
| `name` | 包名，发布到 registry 时必须唯一。带作用域的写法如 `@scope/pkg` |
| `version` | 版本号，遵循语义化版本 |
| `private` | 设为 `true` 时禁止发布，应用项目和 monorepo 根目录建议加上，防止误发布 |
| `type` | `"module"` 表示 `.js` 文件按 ES 模块处理，不写或 `"commonjs"` 按 CommonJS 处理 |
| `main` | 包的入口文件（旧字段，在没有 `exports` 时生效） |
| `exports` | 现代入口定义。可以按 `import` / `require`、子路径分别指定文件，并限制外部只能访问声明过的路径 |
| `module` | 指向 ES 模块入口。这是打包工具约定的字段，Node 本身不读取 |
| `types` | TypeScript 类型声明入口 |
| `bin` | 声明命令行工具，安装后会在 `node_modules/.bin` 下生成可执行文件 |
| `files` | 发布时包含哪些文件，未列出的不会进入发布包 |
| `scripts` | 自定义脚本，`npm run <name>` 执行 |
| `engines` | 声明支持的 Node / npm 版本范围 |
| `sideEffects` | 告诉打包工具哪些文件有副作用，`false` 表示可以安全地 tree shaking |
| `workspaces` | 声明 monorepo 的子包目录 |
| `packageManager` | 声明项目使用的包管理器及版本，例如 `"pnpm@<版本>"` |
| `overrides` | npm 中强制替换某个间接依赖的版本；yarn 用 `resolutions`，pnpm 用 `pnpm.overrides` |

`scripts` 有几个实用的特性：

- 执行脚本时，`node_modules/.bin` 会被加入 `PATH`，所以脚本里可以直接写 `eslint .`，不需要写完整路径。
- `pre<name>` 和 `post<name>` 会在 `<name>` 前后自动执行，比如 `prebuild`、`postbuild`。
- `npm test`、`npm start` 可以省略 `run`。

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "test": "vitest"
  },
  "engines": {
    "node": ">=20"
  }
}
```

## 四类依赖的区别

| 类型 | 安装命令 | 什么时候用 | 被别人安装时 |
| --- | --- | --- | --- |
| `dependencies` | `npm i <pkg>` | 运行时需要的包 | 会一起安装 |
| `devDependencies` | `npm i -D <pkg>` | 只在开发、构建、测试时需要，如构建工具、测试框架、类型声明 | 不会安装 |
| `peerDependencies` | 手动写入 | 插件或组件库声明"需要宿主项目提供某个包" | 由使用方提供，不会重复安装一份私有副本 |
| `optionalDependencies` | `npm i -O <pkg>` | 可有可无的依赖，安装失败不影响整体 | 会尝试安装，失败则跳过 |

几点补充：

- **应用项目和库的区别**：对于最终会被打包的前端应用，依赖放在哪类主要影响语义和 `npm ci --omit=dev` 这类生产安装。对于发布到 npm 的库，分类直接影响使用者：放错进 `dependencies` 会让使用者多装无用的包，放错进 `devDependencies` 会让使用者运行时报错。
- **peerDependencies 的意义**：以 React 组件库为例，如果它把 `react` 写进 `dependencies`，使用者项目里就可能出现两份 React，导致 Hooks 报错。写进 `peerDependencies` 表示"用宿主项目那份 React"，并声明兼容的版本范围。npm 7 起默认会自动安装缺失的 peer 依赖，版本冲突时会报错，旧项目可以用 `--legacy-peer-deps` 回到旧行为（只是忽略问题，不是解决问题）。
- **可选的 peer 依赖**：用 `peerDependenciesMeta` 标记 `"optional": true`，适合"使用者用到某个功能时才需要"的情况。
- **optionalDependencies 的典型用途**：按平台分发的原生二进制包。比如一些用 Rust 或 Go 编写的构建工具，会为每个平台发布单独的包，再通过 `optionalDependencies` 加上 `os`、`cpu` 字段，让包管理器只安装匹配当前平台的那一个。

## 语义化版本

版本号格式是 `主版本.次版本.修订号`（MAJOR.MINOR.PATCH）：

- **主版本**：有不兼容的 API 修改。
- **次版本**：向后兼容地新增功能。
- **修订号**：向后兼容地修复问题。

预发布版本在后面加后缀，如 `2.0.0-beta.1`。

### 版本范围符号

| 写法 | 含义 | 示例 |
| --- | --- | --- |
| `1.2.3` | 精确版本 | 只能是 1.2.3 |
| `^1.2.3` | 不改变最左边非零位 | `>=1.2.3 <2.0.0` |
| `^0.2.3` | 同上，主版本为 0 时锁定次版本 | `>=0.2.3 <0.3.0` |
| `^0.0.3` | 同上，只允许这一个版本 | `>=0.0.3 <0.0.4` |
| `~1.2.3` | 允许修订号变化 | `>=1.2.3 <1.3.0` |
| `~1.2` | 同上 | `>=1.2.0 <1.3.0` |
| `>=1.2.0 <2.0.0` | 显式区间 | |
| `1.x` / `1` | 主版本固定 | `>=1.0.0 <2.0.0` |
| `*` | 任意版本 | 不推荐 |

`npm install` 默认写入 `^` 范围。`^0.x` 的规则需要特别注意：0.x 阶段被视为不稳定，次版本升级可能不兼容，所以 `^` 在这里只放开修订号。

语义化版本只是约定，并不能保证每个作者都严格遵守。这正是需要 lock 文件的原因。

## lock 文件

`package.json` 里写的是**范围**，同一个范围在不同时间可能解析出不同版本。lock 文件记录的是某次安装时整棵依赖树的**精确结果**：每个包的确切版本、下载地址、完整性校验值。

| 包管理器 | lock 文件 |
| --- | --- |
| npm | `package-lock.json` |
| yarn | `yarn.lock` |
| pnpm | `pnpm-lock.yaml` |

使用原则：

- **应用项目一定要提交 lock 文件**，保证所有开发者、CI、生产环境装出完全相同的依赖树。
- 一个项目只用一种包管理器，只保留一种 lock 文件。
- CI 中使用"严格按 lock 安装"的命令：`npm ci`、`yarn install --frozen-lockfile`（yarn 2+ 为 `--immutable`）、`pnpm install --frozen-lockfile`。这些命令在 lock 与 `package.json` 不一致时直接报错，而不是悄悄更新 lock。
- lock 文件出现合并冲突时，不要手动改，解决 `package.json` 的冲突后重新执行安装让工具生成。
- 发布到 npm 的库，自身的 lock 文件不会影响使用者，使用者按自己项目的 lock 解析。

## npm、yarn、pnpm 的差异

### npm 与扁平化安装

早期 npm（v2 及以前）按依赖树嵌套安装：A 依赖 B，B 就装在 `node_modules/A/node_modules/B`。问题是目录层级很深，同一个包被重复安装很多份。

npm 3 起改为尽量**扁平化（hoisting）**：把依赖提升到顶层 `node_modules`，只有版本冲突时才嵌套。体积和路径问题缓解了，但带来两个新问题：

- **幽灵依赖（phantom dependency）**：项目没有声明 B，但因为 A 依赖 B 且 B 被提升到顶层，代码里 `import 'B'` 也能用。哪天 A 不再依赖 B，项目就会突然报错。
- **不确定性**：哪个版本被提升到顶层取决于安装顺序，没有 lock 文件时不同机器的结构可能不一样。

### yarn

yarn 1（Classic）出现时主要解决了当时 npm 安装慢、没有 lock 文件的问题，带来了 `yarn.lock` 和并行下载，安装结构同样是扁平化的。npm 后来补上了 lock 文件和性能优化，两者差距变小。yarn 1 目前只做维护，不再增加新功能。

yarn 2 及之后的版本（Berry）重新设计，默认采用 Plug'n'Play（PnP）：不生成 `node_modules`，而是生成一个映射文件，告诉 Node 每个包在哪里。它严格禁止幽灵依赖，安装很快，但部分工具需要额外适配。也可以配置为传统的 `node_modules` 模式。

### pnpm：内容寻址存储与符号链接

pnpm 用不同的方式组织 `node_modules`：

1. **全局内容寻址存储**：所有包的文件按内容哈希存放在一个全局 store 中。同一个文件在一台机器上只保存一份，多个项目共用。
2. **硬链接**：项目的 `node_modules/.pnpm/<包名>@<版本>/node_modules/<包名>` 里的文件是指向全局 store 的硬链接，几乎不占额外磁盘空间。
3. **符号链接**：项目顶层 `node_modules` 里只有 `package.json` 中**直接声明**的依赖，它们是指向 `.pnpm` 目录的符号链接。每个包自己的依赖，也通过符号链接放在它旁边。

结构示意：

```text
node_modules/
├── express -> .pnpm/express@<版本>/node_modules/express
└── .pnpm/
    ├── express@<版本>/node_modules/
    │   ├── express/              # 硬链接到全局 store
    │   ├── body-parser -> ../../body-parser@<版本>/node_modules/body-parser
    │   └── ...
    └── body-parser@<版本>/node_modules/
        └── body-parser/
```

结果是：

- 项目代码只能访问声明过的依赖，从结构上杜绝了幽灵依赖。
- 每个包也只能访问它自己声明的依赖，依赖关系严格。
- 多项目共享 store，节省磁盘，安装速度快。

代价是：一些依赖幽灵依赖的老包会在 pnpm 下报错。这时可以在 `.npmrc` 中针对性地配置提升（如 `public-hoist-pattern`），或者给出问题的包补上声明。

### 对比

| 方面 | npm | yarn 1 | yarn 2+（PnP） | pnpm |
| --- | --- | --- | --- | --- |
| `node_modules` 结构 | 扁平化 | 扁平化 | 默认不生成 | 符号链接 + 硬链接 |
| 幽灵依赖 | 存在 | 存在 | 禁止 | 禁止 |
| 磁盘占用 | 每个项目一份 | 每个项目一份 | 压缩包缓存 | 全局 store 共享 |
| workspaces | 支持 | 支持 | 支持 | 支持，功能最丰富 |
| 兼容性 | 最好 | 好 | 部分工具需适配 | 好，少数老包需配置 |

:::tip
新项目推荐 pnpm 或 npm；已有项目保持现有工具即可，不要在一个仓库里混用多个包管理器。可以在 `package.json` 写上 `packageManager` 字段，并在 `preinstall` 脚本里用 `npx only-allow pnpm` 这类方式约束团队使用同一种工具。
:::

## npx

npx 用来执行 npm 包里的命令。npm 7 起它成为 npm 的一部分，底层就是 `npm exec`。

查找顺序：

1. 先在项目的 `node_modules/.bin` 和 `PATH` 中找命令。
2. 找不到时，从 registry 下载到缓存目录再执行，不会安装到项目或全局。

常见用法：

```bash
# 运行项目里安装的命令，不用写 ./node_modules/.bin/eslint
npx eslint .

# 运行一次性的脚手架，不需要全局安装
npx create-vite@latest my-app

# 包名和命令名不一致时，用 -p 指定包
npx -p @angular/cli ng new my-app

# 在 npm 环境变量下执行一段 shell 命令
npx -c 'echo $npm_package_name'

# 运行 GitHub 上的仓库（必须是带 package.json 和 bin 的包）
npx github:user/repo
```

旧资料里的 `--no-install`、`--ignore-existing` 参数在 npm 7 之后已经被替换：现在用 `--no` 表示不允许下载远程包，`--yes` 表示下载时不提示确认。

旧资料还会用 `npx node@<版本> -v` 来临时切换 Node 版本。管理 Node 版本更推荐用专门的工具，如 nvm、fnm、Volta，它们会在切换目录或项目时自动选择对应版本。

## workspaces 与 monorepo

monorepo 指一个仓库里放多个包或应用，比如组件库、工具函数、文档站和示例应用放在一起。workspaces 是包管理器对这种结构的原生支持：

```json
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": ["packages/*", "apps/*"]
}
```

pnpm 使用单独的 `pnpm-workspace.yaml`：

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

workspaces 带来的能力：

- **统一安装**：在根目录执行一次安装，所有子包的依赖都会装好，公共依赖只装一份。
- **本地包互相引用**：子包之间直接通过包名引用，包管理器用符号链接指向本地源码，改了立即生效，不用反复发布。pnpm 和 yarn 2+ 支持 `workspace:*` 协议，明确表示"使用工作区内的版本"，发布时会自动替换为实际版本号。
- **按包执行命令**：

```bash
# npm
npm run build -w packages/ui
npm run test --workspaces

# pnpm
pnpm --filter @my/ui build
pnpm -r run test
```

workspaces 只解决依赖安装和链接。任务编排（按依赖顺序构建、增量构建、缓存）通常交给 Turborepo、Nx 等工具；版本管理和发布可以用 Changesets。monorepo 和 multirepo 的取舍见[常用工具库速查](/notes/fronted/keyword/others.html)。

## 常用命令

| 操作 | npm | pnpm | yarn 1 |
| --- | --- | --- | --- |
| 安装全部依赖 | `npm install` | `pnpm install` | `yarn` |
| 严格按 lock 安装 | `npm ci` | `pnpm install --frozen-lockfile` | `yarn install --frozen-lockfile` |
| 添加依赖 | `npm i <pkg>` | `pnpm add <pkg>` | `yarn add <pkg>` |
| 添加开发依赖 | `npm i -D <pkg>` | `pnpm add -D <pkg>` | `yarn add -D <pkg>` |
| 移除依赖 | `npm uninstall <pkg>` | `pnpm remove <pkg>` | `yarn remove <pkg>` |
| 查看可升级的包 | `npm outdated` | `pnpm outdated` | `yarn outdated` |
| 升级依赖 | `npm update` | `pnpm update` | `yarn upgrade` |
| 查看依赖来源 | `npm ls <pkg>` / `npm explain <pkg>` | `pnpm why <pkg>` | `yarn why <pkg>` |
| 安全审计 | `npm audit` | `pnpm audit` | `yarn audit` |
| 运行脚本 | `npm run <script>` | `pnpm <script>` | `yarn <script>` |

registry 相关：

```bash
# 查看与设置 registry
npm config get registry
npm config set registry https://registry.npmmirror.com

# 只对某个作用域使用私有 registry（写在项目 .npmrc 中）
# @my-scope:registry=https://npm.example.com/
```

国内镜像的旧地址 `registry.npm.taobao.org` 已停止服务，现在使用 `registry.npmmirror.com`。临时切换 registry 也可以用 nrm 这类工具，但更推荐把配置写进项目的 `.npmrc`，保证团队一致。

## 常用工具包速查

以下按用途列出一些仍在广泛使用的包。选择时先看 Node 是否已经内置了对应能力，能用内置就不加依赖。

### 命令行工具开发

| 包 | 说明 | 备注 |
| --- | --- | --- |
| `commander` | 解析命令行参数和子命令 | Node 也内置了 `util.parseArgs`，简单场景可直接用 |
| `chalk` | 终端文字着色 | 新版本只提供 ESM；轻量替代有 `picocolors`；较新的 Node 内置 `util.styleText` |
| `ora` | 终端加载动画 | |
| `@inquirer/prompts` | 交互式问答 | |
| `open` | 用系统默认程序打开网址或文件 | 原名 `opn`，已改名为 `open` |

### 文件与路径

| 包 | 说明 | 备注 |
| --- | --- | --- |
| `fs-extra` | 在 `fs` 基础上增加复制目录、确保目录存在等方法 | 现代 Node 的 `fs.cp`、`fs.mkdir({ recursive: true })` 已覆盖不少功能 |
| `rimraf` | 跨平台删除目录 | Node 内置的 `fs.rm(path, { recursive: true, force: true })` 可以替代 |
| `fast-glob` / `tinyglobby` | 按通配符匹配文件 | |
| `chokidar` | 监听文件变化 | |

### 环境与脚本

| 包 | 说明 | 备注 |
| --- | --- | --- |
| `cross-env` | 跨平台设置环境变量 | |
| `dotenv` | 从 `.env` 文件加载环境变量 | 较新的 Node 支持 `--env-file` 参数 |
| `npm-run-all2` / `concurrently` | 串行或并行执行多个 npm 脚本 | |
| `semver` | 解析和比较语义化版本 | npm 自身使用的就是它 |

### 时间处理

| 包 | 说明 | 备注 |
| --- | --- | --- |
| `moment` | 时间解析与格式化 | 已进入维护模式，官方不建议新项目使用，体积大且对象可变 |
| `dayjs` | API 与 moment 相近，体积小，对象不可变 | 迁移 moment 的常见选择 |
| `date-fns` | 函数式的日期工具集，按需引入 | |

### 代码质量

| 包 | 说明 | 备注 |
| --- | --- | --- |
| `eslint` | JS / TS 代码检查 | 新版本默认使用扁平配置文件 `eslint.config.js`，旧的 `.eslintrc` 格式已弃用 |
| `prettier` | 代码格式化 | |
| `husky` + `lint-staged` | Git 钩子，提交前只检查改动的文件 | |

:::note
`child_process` 是 Node 的内置模块，不需要也不应该从 npm 安装。npm 上同名的包与官方模块无关。
:::

## 小结

- `package.json` 中 `type`、`exports`、`files`、`engines`、`private` 等字段决定了模块格式、对外入口和发布内容。
- `dependencies` 运行时需要，`devDependencies` 仅开发时需要，`peerDependencies` 由宿主提供，`optionalDependencies` 安装失败可跳过；对库来说分类直接影响使用者。
- `^` 锁主版本、`~` 锁次版本，主版本为 0 时 `^` 规则更严格；语义化版本是约定，确定性要靠 lock 文件，CI 中用 `npm ci` 等严格模式安装。
- npm 和 yarn 1 扁平化安装，存在幽灵依赖；pnpm 通过全局内容寻址存储、硬链接和符号链接节省空间并杜绝幽灵依赖。
- npx 执行本地或临时下载的命令；workspaces 负责 monorepo 的依赖安装与本地链接，任务编排交给专门工具。

## 参考

- [npm 文档：package.json](https://docs.npmjs.com/cli/configuring-npm/package-json)
- [npm 文档：npm ci](https://docs.npmjs.com/cli/commands/npm-ci)
- [npm 文档：npx](https://docs.npmjs.com/cli/commands/npx)
- [npm 文档：workspaces](https://docs.npmjs.com/cli/using-npm/workspaces)
- [Semantic Versioning 2.0.0](https://semver.org/lang/zh-CN/)
- [pnpm：Motivation](https://pnpm.io/motivation)
- [pnpm：Workspace](https://pnpm.io/workspaces)
- [Node.js：Modules: Packages](https://nodejs.org/api/packages.html)
