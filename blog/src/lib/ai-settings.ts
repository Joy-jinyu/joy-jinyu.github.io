/**
 * 访客自己的 AI 接口配置（OpenAI 兼容）：全站只在这里读写。
 * 默认存当前标签页（sessionStorage，换页还在、关掉标签就清）；勾选「记住」才写 localStorage。
 * 请求从访客浏览器直连 AI 服务商，不经过本站。
 */
export type AiConfig = { baseUrl: string; model: string; key: string }

const KEY = 'pairwise-ai'
const CHANGE = 'pairwise-ai-change'
const OPEN = 'pairwise-ai-open'

const isConfig = (v: unknown): v is AiConfig =>
  !!v &&
  typeof v === 'object' &&
  ['baseUrl', 'model', 'key'].every((k) => typeof (v as Record<string, unknown>)[k] === 'string' && (v as Record<string, string>)[k])

function read(store: () => Storage): AiConfig | null {
  try {
    const v = JSON.parse(store().getItem(KEY) ?? 'null')
    return isConfig(v) ? v : null
  } catch {
    return null
  }
}

function write(store: () => Storage, value: AiConfig | null) {
  try {
    if (value) store().setItem(KEY, JSON.stringify(value))
    else store().removeItem(KEY)
  } catch {
    // 隐私模式等存储不可用时，本次会话里也就用不上了；不影响页面其它功能
  }
}

const local = () => localStorage
const session = () => sessionStorage

export function loadAi(): { config: AiConfig | null; remembered: boolean } {
  const remembered = read(local)
  return remembered ? { config: remembered, remembered: true } : { config: read(session), remembered: false }
}

export function saveAi(config: AiConfig, remember: boolean) {
  write(remember ? local : session, config)
  write(remember ? session : local, null)
  dispatchEvent(new Event(CHANGE))
}

export function clearAi() {
  write(local, null)
  write(session, null)
  dispatchEvent(new Event(CHANGE))
}

/** 配置变化（本页保存，或别的标签页改了记住的配置）时回调；返回取消函数 */
export function onAiChange(listener: () => void): () => void {
  const onStorage = (e: StorageEvent) => e.key === KEY && listener()
  addEventListener(CHANGE, listener)
  addEventListener('storage', onStorage)
  return () => {
    removeEventListener(CHANGE, listener)
    removeEventListener('storage', onStorage)
  }
}

/** 请顶栏的「AI 设置」对话框打开（AiSettings.astro 监听） */
export const openAiSettings = () => dispatchEvent(new Event(OPEN))
export const onAiSettingsOpen = (listener: () => void) => addEventListener(OPEN, listener)

/** 接口地址只收 https；本机跑的模型（localhost / 127.0.0.1）允许 http */
export function checkBaseUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
    if (u.protocol === 'https:' || (local && u.protocol === 'http:')) return null
    return '接口地址要用 https://（本机模型可以用 http://localhost）'
  } catch {
    return '接口地址格式不对，例如 https://api.openai.com/v1'
  }
}
