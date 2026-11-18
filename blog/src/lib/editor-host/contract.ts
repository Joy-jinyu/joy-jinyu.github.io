/**
 * 投稿编辑器（NSH 应用）与宿主页面（/blog/editor/，blog/src/lib/editor-host/）之间的接口约定。
 * 两边都从这里导入类型：应用用 host.call / host.on，宿主实现同名函数、发同名事件。
 * 改这里就是改协议，两边要一起改。
 */

// 应用的 capabilities.host 要覆盖下面所有函数名的前缀：nsh.json 和 tests/nsh.json 各写一份，
// scripts/package-editor.sh 打包前会比对两份是否一致。

export type Login = { login: string; avatarUrl: string } | null

export type AiStatus = { configured: false } | { configured: true; model: string }

/** 投稿稿件；date、author、column 由宿主在提交时补上 */
export type Draft = {
  title: string
  description: string
  tags: string[]
  body: string
}

export type AiTask =
  /** 润色正文：input 是正文 */
  | { task: 'polish'; input: string; extra?: string }
  /** 起标题和摘要：input 是正文 */
  | { task: 'meta'; input: string; extra?: string }
  /** 一键生成整篇：input 是主题或提纲 */
  | { task: 'draft'; input: string; extra?: string }
  /** 画 Mermaid 图（流程图、时序图、饼图、折线 / 柱状图…）：input 是想画什么 */
  | { task: 'diagram'; input: string; extra?: string }
  /** 画一张 SVG 插图：input 是想画什么；宿主清洗后存成图片 */
  | { task: 'svg'; input: string; extra?: string }

/** 存在宿主里的一张图片：path 写进正文（发布后的地址），url 只给预览用 */
export type MediaRef = { path: string; url: string }

export type AiResult = {
  polish: { body: string }
  meta: { titles: string[]; description: string; tags: string[] }
  draft: Draft
  diagram: { mermaid: string }
  svg: { image: MediaRef }
}

export type SubmitStep = 'fork' | 'branch' | 'commit' | 'pr'

export type Submitted = { prNumber: number; prUrl: string; path: string }

export type MyPr = {
  number: number
  title: string
  url: string
  state: 'open' | 'merged' | 'closed'
  updatedAt: string
}

/** host.call(name, args) → 返回值。耗时的调用（auth.login、ai.complete、contrib.submit）应用要传 { timeout: 0 } */
export type HostCalls = {
  /** 应用的首屏渲染好了：宿主收起加载占位 */
  'site.ready': { args: null; result: null }
  'auth.status': { args: null; result: Login }
  'auth.login': { args: null; result: Login }
  'auth.logout': { args: null; result: null }
  'ai.status': { args: null; result: AiStatus }
  /** 打开站点顶栏的「AI 设置」对话框 */
  'ai.openSettings': { args: null; result: null }
  /** 流式生成：过程用 ai.delta 事件推过来，结束时返回整理好的结果。id 由应用生成，ai.cancel 用它中止 */
  'ai.complete': { args: AiTask & { id: string }; result: AiResult[AiTask['task']] }
  'ai.cancel': { args: { id: string }; result: null }
  /** 存一张图片（data 是 base64）；宿主校验格式和大小，按内容哈希命名 */
  'media.add': { args: { name: string; type: string; data: string }; result: MediaRef }
  /** 正文里的图片地址换成预览地址；宿主没有这张图时返回 null */
  'media.url': { args: { path: string }; result: { url: string } | null }
  /** 把 Mermaid 代码渲染成 SVG 图片地址，给预览用；代码有错时抛出带行号的错误 */
  'diagram.render': { args: { code: string; dark: boolean }; result: { url: string } }
  /** 提交时宿主把正文里引用到的图片一起放进 PR */
  'contrib.submit': { args: Draft; result: Submitted }
  'contrib.mine': { args: null; result: MyPr[] }
  /** 在新标签页打开站外链接（PR 页面等） */
  'site.open': { args: { url: string }; result: null }
}

/** player.hostEvent(name, payload) → 应用 host.on(name) */
export type HostEvents = {
  'auth.changed': Login
  'ai.changed': AiStatus
  'contrib.progress': { step: SubmitStep; state: 'active' | 'done' }
  /** 生成过程：reasoning 是模型的思考过程（有的模型没有），content 是正在写出的内容 */
  'ai.delta': { id: string; kind: 'reasoning' | 'content'; text: string }
}

/**
 * 稿件的限制，应用做提示、宿主提交前再校验一次。
 * bodyBytes：正文 UTF-8 字节数；PR 守门规则限制整个文件 512 KB（.github/scripts/check-contrib.mjs），留出 frontmatter 的余量。
 */
export const LIMITS = { title: 80, description: 140, tags: 5, tag: 20, bodyBytes: 480 * 1024, images: 10, imageBytes: 2 * 1024 * 1024 } as const

/**
 * 投稿图片发布后的地址：/blog/contrib-images/<内容哈希前 16 位>.<扩展名>。
 * 文件名规则的权威在 blog/src/lib/contrib-media.mjs（MEDIA_FILE）；这份约定要被 NSH 应用导入，没法引用那个模块，改规则两处一起改。
 */
export const MEDIA_PREFIX = '/blog/contrib-images/'
export const MEDIA_PATH = /^\/blog\/contrib-images\/[0-9a-f]{16}\.(png|jpg|webp|gif|svg)$/

/** 正文的 UTF-8 字节数，和 LIMITS.bodyBytes 比较 */
export const bodyBytes = (body: string) => new TextEncoder().encode(body).length
