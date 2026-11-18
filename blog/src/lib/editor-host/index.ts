/**
 * 投稿编辑器的宿主：挂在 /blog/editor/ 页面的 window.pairwiseEditorHost 上，
 * NSH 页面（iframe 里的 /blog/editor-app/）的 host.js 调 attach(player) 接上来。
 * 函数和事件的名字、参数见 blog/editor-app/host-contract.ts。
 */
import type { AiStatus, AiTask, Draft, HostCalls, HostEvents } from '../../../editor-app/host-contract'
import { loadAi, onAiChange, openAiSettings } from '../ai-settings'
import { complete } from './ai'
import { currentLogin, isAuthError, login, logout, mine, submit } from './github'

/** NSH 的 createPlayer 返回的 player 里，这里用到的部分 */
type Player = {
  hostEvent(name: string, payload: unknown): void
  setDark(dark: boolean): void
}

type Handler<K extends keyof HostCalls> = (args: HostCalls[K]['args']) => Promise<HostCalls[K]['result']> | HostCalls[K]['result']

function aiStatus(): AiStatus {
  const { config } = loadAi()
  return config ? { configured: true, model: config.model } : { configured: false }
}

/** 上一次 attach 留下的监听；iframe 重新加载会再 attach 一次，先把旧的撤掉 */
let detach: (() => void) | null = null

function attach(player: Player) {
  detach?.()
  const emit = <K extends keyof HostEvents>(name: K, payload: HostEvents[K]) => player.hostEvent(name, payload)

  // 跟着博客顶栏的明暗开关走
  const root = document.documentElement
  const syncDark = () => player.setDark(root.dataset.theme !== 'light')
  syncDark()
  const themeObserver = new MutationObserver(syncDark)
  themeObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
  const offAi = onAiChange(() => emit('ai.changed', aiStatus()))
  detach = () => {
    themeObserver.disconnect()
    offAi()
  }

  const handlers: { [K in keyof HostCalls]: Handler<K> } = {
    'auth.status': () => currentLogin(),
    'auth.login': async () => {
      const user = await login()
      emit('auth.changed', user)
      return user
    },
    'auth.logout': () => {
      logout()
      emit('auth.changed', null)
      return null
    },
    'ai.status': () => aiStatus(),
    'ai.openSettings': () => {
      openAiSettings()
      return null
    },
    'ai.complete': (task: AiTask) => {
      const { config } = loadAi()
      if (!config) {
        openAiSettings()
        throw new Error('还没设置 AI：在顶栏「AI 设置」里填接口地址、模型和 key')
      }
      return complete(config, task)
    },
    'contrib.submit': (draft: Draft) => submit(draft, (step, state) => emit('contrib.progress', { step, state })),
    'contrib.mine': () => mine(),
    'site.open': ({ url }) => {
      if (!/^https:\/\/github\.com\//.test(url)) throw new Error('只能打开 GitHub 上的链接')
      open(url, '_blank', 'noopener')
      return null
    },
  }

  return {
    async call(name: string, args: unknown) {
      const handler = (handlers as Record<string, (a: unknown) => unknown>)[name]
      if (!handler) throw new Error(`没有宿主函数 ${name}`)
      try {
        return await handler(args)
      } catch (err) {
        // token 失效：github.ts 已经清掉登录，这里让应用回到未登录界面
        if (isAuthError(err)) emit('auth.changed', null)
        throw err
      }
    },
  }
}

declare global {
  interface Window {
    pairwiseEditorHost?: { attach: typeof attach }
  }
}

window.pairwiseEditorHost = { attach }
