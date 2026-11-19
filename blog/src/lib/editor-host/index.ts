/**
 * 投稿编辑器的宿主：挂在 /blog/editor/ 页面的 window.pairwiseEditorHost 上，
 * NSH 页面（iframe 里的 /blog/editor-app/）的 host.js 调 attach(player) 接上来。
 * 函数和事件的名字、参数见 blog/src/lib/editor-host/contract.ts。
 */
import type { AiStatus, AiTask, Draft, HostCalls, HostEvents } from './contract'
import { emitAiActivity } from '../ai-bridge'
import type { DeltaKind } from '../ai-chat'
import { loadAi, onAiChange, openAiSettings } from '../ai-settings'
import { checkMermaid, renderMermaid } from '../mermaid-render'
import { complete } from './ai'
import { currentLogin, isAuthError, login, logout, mine, submit } from './github'
import { addImage, addSvg, toBase64, urlOf } from './media'

/** NSH 的 createPlayer 返回的 player 里，这里用到的部分 */
type Player = {
  hostEvent(name: string, payload: unknown): void
  setDark(dark: boolean): void
}

type Handler<K extends keyof HostCalls> = (args: HostCalls[K]['args']) => Promise<HostCalls[K]['result']> | HostCalls[K]['result']

/** 编辑器首屏好了：editor.astro 收起加载占位 */
export const READY_EVENT = 'pairwise-editor-ready'

function aiStatus(): AiStatus {
  const { config } = loadAi()
  return config ? { configured: true, model: config.model } : { configured: false }
}

const svgUrl = (svg: string) => `data:image/svg+xml;base64,${toBase64(new TextEncoder().encode(svg))}`

/** 上一次 attach 留下的监听；iframe 重新加载会再 attach 一次，先把旧的撤掉 */
let detach: (() => void) | null = null
/** 每次生成一个序号：应用可能拿同一个 id 重跑，旧那次的 cancel 会晚于新那次的 start 到达，小猫按 id#序号 配对 */
let runSeq = 0

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
  /** 进行中的生成，ai.cancel 按 id 中止 */
  const running = new Map<string, AbortController>()
  detach = () => {
    themeObserver.disconnect()
    offAi()
    for (const c of running.values()) c.abort()
  }

  const handlers: { [K in keyof HostCalls]: Handler<K> } = {
    'site.ready': () => {
      dispatchEvent(new Event(READY_EVENT))
      return null
    },
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
    'ai.complete': async ({ id, ...task }: AiTask & { id: string }) => {
      const { config } = loadAi()
      if (!config) {
        openAiSettings()
        throw new Error('还没设置 AI：在顶栏「AI 设置」里填接口地址、选好模型')
      }
      const ctrl = new AbortController()
      running.get(id)?.abort()
      running.set(id, ctrl)
      const kind = task.task
      const run = `${id}#${++runSeq}`
      // 进度同时广播给页面上的小猫，事件约定见 ../ai-bridge.ts；请求发出前就被拦下的（比如正文还是空的）不算
      let sent = false
      try {
        const onDelta = (phase: DeltaKind, text: string) => {
          emit('ai.delta', { id, kind: phase, text })
          emitAiActivity({ id: run, task: kind, phase, text })
        }
        const result = await complete(config, task as AiTask, ctrl.signal, onDelta, {
          checkMermaid: async (code) => {
            try {
              await checkMermaid(code)
            } catch (err) {
              throw new Error(`AI 画的图有语法错误，可以重新生成：${(err as Error).message.split('\n')[0]}`)
            }
          },
          storeSvg: addSvg,
          onSend: () => {
            sent = true
            emitAiActivity({ id: run, task: kind, phase: 'start' })
          },
        })
        emitAiActivity({ id: run, task: kind, phase: 'done' })
        return result
      } catch (err) {
        if (sent) emitAiActivity({ id: run, task: kind, phase: ctrl.signal.aborted ? 'cancel' : 'error', text: (err as Error).message })
        throw err
      } finally {
        if (running.get(id) === ctrl) running.delete(id)
      }
    },
    'ai.cancel': ({ id }) => {
      running.get(id)?.abort()
      running.delete(id)
      return null
    },
    'media.add': async ({ type, data }) => {
      if (type === 'image/svg+xml') throw new Error('不能上传 SVG 文件；要插图可以用「插入图表」让 AI 画')
      return addImage(data)
    },
    'media.url': async ({ path }) => {
      const url = await urlOf(path)
      return url ? { url } : null
    },
    'diagram.render': async ({ code, dark }) => {
      if (code.length > 20_000) throw new Error('图太大了')
      return { url: svgUrl(await renderMermaid(code, dark)) }
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
