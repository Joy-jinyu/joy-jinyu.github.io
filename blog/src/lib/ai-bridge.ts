/**
 * 页面级的 AI 桥：把访客的 AI 配置和流式对话挂到 window.pairwiseAi，给不打包博客代码的脚本（site/pet-ai.js 小猫）用。
 * 博客页由 Base.astro 装上；简历页没有博客代码，pet-ai.js 在隐藏的同源 iframe 里加载 /blog/ai-bridge/，
 * 用 iframe.contentWindow.pairwiseAi（同一标签页里同源的 frame 共用 sessionStorage，读得到访客存的配置）。
 */
import { chat, type ChatMessage, type DeltaKind } from './ai-chat'
import { loadAi, onAiChange, openAiSettings } from './ai-settings'

/**
 * 站内 AI 正在干活的进度，以 window 上的 CustomEvent('pairwise-ai-activity') 广播，小猫（site/pet-ai.js）听它做反应。
 * - id：每次生成唯一（编辑器用应用给的 id 加 #序号，同一个 id 重跑也不会撞），同一次生成的各个阶段 id 相同，按它配对开始和结束；
 *   task：任务种类（编辑器里是 AiTask['task']）
 * - phase：start（请求真正发出时；发出前就被拦下的输入错误不发任何事件）→ reasoning / content 流式片段（text 是这一片的文字，
 *   可能出现多次）→ done / error / cancel 三选一结束；error 的 text 是错误说明；用户中止算 cancel，不算 error
 */
type AiActivity = { id: string; task: string; phase: 'start' | DeltaKind | 'done' | 'error' | 'cancel'; text?: string }

export const emitAiActivity = (detail: AiActivity) => dispatchEvent(new CustomEvent('pairwise-ai-activity', { detail }))

type PairwiseAi = {
  status(): { configured: boolean; model?: string }
  /** 配置变了就回调；返回取消函数 */
  onChange(cb: () => void): () => void
  /** 这个页面里没有「AI 设置」对话框（比如 /blog/ai-bridge/）时返回 false，调用方自己跳到 /blog/#ai-settings */
  openSettings(): boolean
  /** 没配置时直接拒绝；中止时拒绝的错误是「已停止」 */
  chat(messages: ChatMessage[], opts?: { signal?: AbortSignal; onDelta?: (kind: DeltaKind, text: string) => void }): Promise<string>
}

declare global {
  interface Window {
    pairwiseAi?: PairwiseAi
  }
}

export function installAiBridge() {
  if (window.pairwiseAi) return
  window.pairwiseAi = {
    status() {
      const { config } = loadAi()
      return config ? { configured: true, model: config.model } : { configured: false }
    },
    onChange: (cb) => onAiChange(cb),
    openSettings() {
      if (!document.querySelector('ai-settings')) return false
      openAiSettings()
      return true
    },
    async chat(messages, { signal, onDelta } = {}) {
      const { config } = loadAi()
      if (!config) throw new Error('还没设置 AI：先在博客顶栏的「AI 设置」里填好接口地址、key 和模型')
      // 简历页从父页面传进来的 signal 属于另一个 window，这里换成本页自己的
      const ctrl = new AbortController()
      if (signal?.aborted) ctrl.abort()
      signal?.addEventListener('abort', () => ctrl.abort(), { once: true })
      return chat(config, messages, ctrl.signal, onDelta ?? (() => {}))
    },
  }
}
