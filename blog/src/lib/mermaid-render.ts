/**
 * Mermaid 渲染的页面一侧：编辑器预览（editor-host）和文章页（pages/[...slug].astro）共用。
 * 真正的渲染交给沙箱 iframe（pages/mermaid-frame.astro + lib/mermaid-sandbox.ts，不透明源），这里只收发消息；
 * 拿回来的是 SVG 文本，调用方放进 <img>（data: 地址），不直接插进页面。
 */
type Reply = { id: number; ok: boolean; svg?: string; error?: string }

let frame: Promise<HTMLIFrameElement> | null = null
let seq = 0
const waiting = new Map<number, (r: Reply) => void>()

function sandbox(): Promise<HTMLIFrameElement> {
  frame ??= new Promise((resolve, reject) => {
    const el = document.createElement('iframe')
    el.setAttribute('sandbox', 'allow-scripts')
    el.setAttribute('aria-hidden', 'true')
    el.tabIndex = -1
    el.title = 'mermaid'
    // 要真的排版（mermaid 用 getBBox 量文字），所以不能 display:none，只是挪到屏幕外
    el.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:900px;border:0;opacity:0;pointer-events:none'
    el.src = `${import.meta.env.BASE_URL}mermaid-frame/`
    const timer = setTimeout(() => reject(new Error('图表渲染器没加载出来')), 20_000)
    addEventListener('message', (e: MessageEvent) => {
      if (e.source !== el.contentWindow || e.origin !== 'null') return
      if (e.data?.ready) {
        clearTimeout(timer)
        resolve(el)
        return
      }
      const r = e.data as Reply
      waiting.get(r.id)?.(r)
      waiting.delete(r.id)
    })
    document.body.append(el)
  })
  return frame
}

/** 单张图最多等这么久：沙箱里一张一张画，卡住一张会把后面的都堵住 */
const RENDER_TIMEOUT_MS = 15_000

/** 丢掉沙箱，等着的请求一律失败；下次调用再建一个新的 */
function reset(reason: string) {
  frame?.then((f) => f.remove(), () => {})
  frame = null
  for (const [id, done] of waiting) done({ id, ok: false, error: reason })
  waiting.clear()
}

async function ask(code: string, dark: boolean, parseOnly: boolean): Promise<Reply> {
  // 加载失败不要缓存住，下次再建
  const el = await sandbox().catch((err) => {
    reset((err as Error).message)
    throw err
  })
  const id = ++seq
  return new Promise((resolve) => {
    const timer = setTimeout(() => reset('图表画得太久了，可能是代码太复杂'), RENDER_TIMEOUT_MS)
    waiting.set(id, (r) => {
      clearTimeout(timer)
      resolve(r)
    })
    el.contentWindow!.postMessage({ id, code, dark, parseOnly }, '*')
  })
}

/** 把 Mermaid 代码画成 SVG 文本；语法错误抛出 mermaid 自己的错误信息 */
export async function renderMermaid(code: string, dark: boolean): Promise<string> {
  const r = await ask(code, dark, false)
  if (!r.ok || !r.svg) throw new Error(r.error ?? '图表没画出来')
  return r.svg
}

/** 只查语法，不渲染 */
export async function checkMermaid(code: string): Promise<void> {
  const r = await ask(code, false, true)
  if (!r.ok) throw new Error(r.error ?? '图表语法有错')
}
