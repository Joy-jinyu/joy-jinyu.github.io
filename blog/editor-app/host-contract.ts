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

export type AiResult = {
  polish: { body: string }
  meta: { titles: string[]; description: string; tags: string[] }
  draft: Draft
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
  'auth.status': { args: null; result: Login }
  'auth.login': { args: null; result: Login }
  'auth.logout': { args: null; result: null }
  'ai.status': { args: null; result: AiStatus }
  /** 打开站点顶栏的「AI 设置」对话框 */
  'ai.openSettings': { args: null; result: null }
  'ai.complete': { args: AiTask; result: AiResult[AiTask['task']] }
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
}

/**
 * 稿件的限制，应用做提示、宿主提交前再校验一次。
 * bodyBytes：正文 UTF-8 字节数；PR 守门规则限制整个文件 512 KB（.github/scripts/check-contrib.mjs），留出 frontmatter 的余量。
 */
export const LIMITS = { title: 80, description: 140, tags: 5, tag: 20, bodyBytes: 480 * 1024 } as const

/** 正文的 UTF-8 字节数，和 LIMITS.bodyBytes 比较 */
export const bodyBytes = (body: string) => new TextEncoder().encode(body).length
