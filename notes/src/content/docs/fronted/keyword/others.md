---
title: 常用工具库速查
description: 按用途整理博客与内容站、代码高亮、图片资源、监控统计、Node 服务端等方向的常用工具库，并简要对比 Monorepo 与 Multirepo。
---

这篇是一份按用途分类的工具库速查表，覆盖搭建博客或内容站、展示代码、处理图片、监控与统计、Node 服务端开发等常见需求，每项说明它解决什么问题、适合什么场景。最后简要对比 Monorepo 与 Multirepo 两种代码仓库组织方式。

:::caution
第三方库的维护状态会变化。表中标注「使用前确认维护状态」的条目，引入前先看仓库最近的提交与发布时间、未关闭的 issue 情况，以及是否支持你使用的框架版本。
:::

## 内容渲染与代码高亮

| 工具 | 说明 | 适用场景 |
| --- | --- | --- |
| marked | 体积小、速度快的 Markdown 解析器，把 Markdown 转成 HTML | 在浏览器或 Node 中简单地渲染 Markdown |
| markdown-it | 可扩展的 Markdown 解析器，插件生态丰富 | 需要自定义语法（容器、脚注、锚点等）的文档站 |
| remark / rehype（unified 生态） | 把 Markdown、HTML 解析成语法树再处理，插件化 | 需要在语法树层面做转换的场景，许多静态站点框架底层使用它 |
| highlight.js | 运行时代码高亮，支持语言多，可自动检测语言 | 客户端渲染的页面，需要即时高亮 |
| Prism | 轻量的代码高亮库，按需加载语言和插件 | 对体积敏感的页面 |
| Shiki | 使用与 VS Code 相同的语法定义和主题，通常在构建时生成高亮好的 HTML | 静态站点、文档站，追求和编辑器一致的高亮效果 |

渲染用户输入的 Markdown 时要注意 XSS：marked 等解析器默认不会清理 HTML，输出到页面前应使用 DOMPurify 之类的库进行过滤。

## 博客与内容站组件

| 工具 | 说明 | 适用场景 |
| --- | --- | --- |
| giscus | 基于 GitHub Discussions 的评论系统 | 技术博客、文档站，读者用 GitHub 账号评论 |
| Gitalk | 基于 GitHub Issues 的评论系统，使用前确认维护状态 | 旧博客中常见；需要 OAuth 应用凭证，新项目更推荐 giscus |
| tocbot | 根据文章标题自动生成目录，并在滚动时高亮当前章节 | 自建博客的文章侧边目录 |
| PhotoSwipe | 图片点击放大、手势缩放、左右切换的画廊组件 | 图片较多的文章或相册页 |
| medium-zoom | 轻量的图片点击放大效果 | 只需要单张放大，不需要画廊功能 |

如果使用 Astro Starlight、VitePress、Docusaurus 这类文档框架，目录、代码高亮、搜索通常已经内置，不需要再单独引入上面的库。

## 图片与静态资源

| 方案 | 说明 | 适用场景 |
| --- | --- | --- |
| 云厂商对象存储 + CDN | 各大云厂商都提供对象存储和 CDN，通常还支持按 URL 参数裁剪、缩放、转格式 | 正式项目的图片、视频等资源 |
| jsDelivr | 面向开源项目的公共 CDN，可以加速 npm 包和 GitHub 仓库中的文件 | 引用开源库的静态文件 |
| sharp | Node 中的高性能图片处理库 | 构建时或服务端生成缩略图、转换 WebP / AVIF |

有些资料推荐用"GitHub 仓库 + jsDelivr"搭建免费图床。jsDelivr 的使用政策针对的是开源项目文件分发，把它当成通用图床可能违反其使用条款，且存在被限制访问的风险。个人博客的图片更稳妥的做法是放在站点仓库里随站点一起部署，或使用正式的对象存储服务。

## 监控与统计

| 工具 | 说明 | 适用场景 |
| --- | --- | --- |
| Sentry | 前后端错误监控与性能追踪，开源且可自建，提供 Source Map 还原 | 线上错误收集、发布质量追踪 |
| web-vitals | 采集 LCP、INP、CLS 等核心性能指标的官方库 | 自建性能监控，把指标上报到自己的服务 |
| Fundebug 等国内错误监控平台 | 商业化错误监控服务，使用前确认维护状态 | 已在使用的旧项目 |
| 百度统计、Google Analytics | 网站访问统计 | 需要流量来源、访问量等运营数据 |
| Plausible、Umami | 注重隐私、轻量的访问统计，可自建 | 个人站点、对隐私合规要求较高的站点 |

单页应用（SPA）切换路由时页面并不刷新，统计脚本默认只记录首次加载的页面。需要在路由变化后手动上报一次页面浏览：有的统计服务提供专门的 SPA 追踪选项（如百度统计的 URL 变化追踪设置），有的需要在路由钩子里调用上报接口。具体做法以对应服务的文档为准。

## 社交分享

| 工具 | 说明 | 适用场景 |
| --- | --- | --- |
| Web Share API | 浏览器原生的分享接口 `navigator.share()`，调起系统分享面板 | 移动端分享，无需第三方库 |
| vue-social-share 等分享组件 | 生成各社交平台分享按钮的组件，使用前确认维护状态 | 旧的 Vue 2 项目 |

Web Share API 在移动端浏览器支持较好，桌面端支持不完整。调用前先判断 `navigator.share` 是否存在，不支持时降级为复制链接。

## Node 服务端

### Koa

Koa 是 Express 原班人马设计的 Web 框架，核心只提供基于 `async/await` 的中间件机制（洋葱模型），路由、请求体解析等功能都由独立的中间件提供。

| 包 | 说明 | 备注 |
| --- | --- | --- |
| koa | Koa 核心 | |
| @koa/router | 路由中间件 | 旧包名 `koa-router` 已转移到 `@koa/router`，新项目使用后者 |
| @koa/bodyparser / koa-bodyparser | 解析 JSON、表单等请求体，结果放在 `ctx.request.body` | 不处理文件上传；文件上传需要 multer 一类的中间件 |
| @koa/cors | 处理跨域请求 | |
| koa-static | 静态文件服务 | |

```js
import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';

const app = new Koa();
const router = new Router();

router.post('/api/users', (ctx) => {
  const { name } = ctx.request.body;
  ctx.status = 201;
  ctx.body = { name };
});

app.use(bodyParser());
app.use(router.routes()).use(router.allowedMethods());
app.listen(3000);
```

### 其他服务端框架与数据层

| 工具 | 说明 | 适用场景 |
| --- | --- | --- |
| Express | 最广泛使用的 Node Web 框架，生态最大 | 通用 Web 服务，资料多 |
| Fastify | 注重性能和基于 JSON Schema 的校验 | 对吞吐量有要求的 API 服务 |
| NestJS | 基于 TypeScript 和依赖注入的分层框架 | 结构复杂、团队较大的后端项目 |
| Hono | 基于 Web 标准 `Request` / `Response` 的轻量框架，可运行在 Node、Deno、Bun 和边缘平台 | 边缘函数、多运行时部署 |
| Mongoose | MongoDB 的 ODM，提供 Schema 定义、校验和查询封装 | 使用 MongoDB 的 Node 项目 |
| Prisma、Drizzle | TypeScript 友好的 ORM / 查询构建器 | 使用 MySQL、PostgreSQL 等关系型数据库的项目 |

## Monorepo 与 Multirepo

Monorepo（monolithic repository）指把多个项目或包放在同一个仓库里；Multirepo（multiple repository，也叫 polyrepo）指每个项目或包一个独立仓库。

| 方面 | Monorepo | Multirepo |
| --- | --- | --- |
| 代码共享 | 包之间直接本地引用，改动即时生效 | 需要发布新版本，再在使用方升级 |
| 跨项目修改 | 一次提交即可同时修改多个包，原子性好 | 需要在多个仓库分别提交、按顺序发布 |
| 依赖版本 | 容易统一依赖版本，减少重复 | 各仓库各自管理，容易出现版本分裂 |
| 工具与规范 | 一套 lint、构建、CI 配置覆盖全部包 | 每个仓库各自维护配置，容易不一致 |
| 权限控制 | 仓库级权限粒度粗，按目录控制需额外机制 | 按仓库授权，边界清晰 |
| 构建与 CI | 仓库变大后需要增量构建、任务缓存，否则越来越慢 | 每个仓库体量小，CI 简单 |
| 独立性 | 包之间耦合更容易发生，需要约束依赖方向 | 团队自主性高，技术栈可以不同 |

常用工具：

- **依赖管理**：npm / yarn / pnpm 的 workspaces，详见 [npm 依赖管理](/notes/fronted/language/node/node_package.html)。
- **任务编排与缓存**：Turborepo、Nx，按依赖关系排序执行任务，只重新构建受影响的包，并缓存构建结果。
- **版本与发布**：Changesets，记录每次变更影响哪些包及版本级别，统一生成变更日志和发布。
- Lerna 是较早的 monorepo 管理工具，一度停止维护后由 Nx 团队接手，新项目通常直接使用 workspaces 搭配上面的工具。

选择思路：

- 多个包之间改动频繁、互相依赖紧密（如组件库、工具库、文档站、示例应用），适合 Monorepo。
- 项目之间相互独立、由不同团队维护、发布节奏不同，或者需要严格的访问权限隔离，适合 Multirepo。
- 选择 Monorepo 时，从一开始就使用 workspaces 和任务缓存工具，并约定包之间的依赖方向，避免仓库变成难以拆分的整体。

## 小结

- 内容渲染：marked、markdown-it 解析 Markdown，Shiki 适合构建时高亮，highlight.js、Prism 适合运行时高亮；渲染用户输入要做 XSS 过滤。
- 博客组件：评论推荐 giscus，目录用 tocbot，图片放大用 PhotoSwipe 或 medium-zoom；使用文档框架时这些功能通常已内置。
- 图片资源用对象存储加 CDN，不要把公共 CDN 当作通用图床。
- 监控统计：错误监控用 Sentry，性能指标用 web-vitals；SPA 需要在路由变化时手动上报页面浏览。
- Koa 的路由包已迁移到 `@koa/router`；表中标注的旧库使用前先确认维护状态。
- Monorepo 便于共享代码和原子修改，但需要任务缓存和依赖约束；Multirepo 边界清晰、团队独立，但跨仓库协作成本高。

## 参考

- [MDN：Navigator.share()](https://developer.mozilla.org/zh-CN/docs/Web/API/Navigator/share)
- [npm 文档：workspaces](https://docs.npmjs.com/cli/using-npm/workspaces)
- [pnpm：Workspace](https://pnpm.io/workspaces)
