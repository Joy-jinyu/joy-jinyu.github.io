/**
 * Mermaid 真正的渲染，只在沙箱页（pages/mermaid-frame.astro，sandbox="allow-scripts"、不透明源）里跑。
 * mermaid 渲染时会先把 SVG 插进当前页面量尺寸，图表代码来自读者投稿，万一绕过它的清洗也只能在沙箱里执行，
 * 碰不到站点的 localStorage（登录 token 在那里）。页面一侧用 lib/mermaid-render.ts 调过来。
 */
type Mermaid = typeof import('mermaid')['default']

let loading: Promise<Mermaid> | null = null
let seq = 0

function load(): Promise<Mermaid> {
  loading ??= import('mermaid').then((m) => m.default)
  return loading
}

/** 博客的配色（styles/global.css 的 --brand、--strong、--muted 等，深浅各一套）；图要放进 <img>，取不到页面的 CSS 变量，只能写值 */
const PALETTE = {
  dark: { node: '#0f1c21', border: '#00b8b8', text: '#f3f5f9', line: '#7d8596', note: '#1a1f29', accent: '#5eead4' },
  light: { node: '#e9f7f7', border: '#0b7f7f', text: '#0a0e19', line: '#6c6e75', note: '#f4f5f7', accent: '#0b8f8f' },
}

/**
 * mermaid 输出的 SVG 是 width="100%" + max-width 样式，放进 <img> 时浏览器算不出它本来多大，竖长的图会被缩成一小团。
 * 按 viewBox 写回固定的宽高，<img> 再用 max-width: 100% 往下缩。
 */
function fixSize(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  const [, , w, h] = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
  if (w > 0 && h > 0) {
    root.setAttribute('width', String(Math.ceil(w)))
    root.setAttribute('height', String(Math.ceil(h)))
    root.style.removeProperty('max-width')
  }
  return new XMLSerializer().serializeToString(root)
}

/** mermaid.initialize 是全局的：同一时间只画一张，免得切主题时用错配色 */
let queue: Promise<unknown> = Promise.resolve()
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = queue.then(fn, fn)
  queue = next.catch(() => {})
  return next
}

/** 把 Mermaid 代码画成 SVG 文本；语法错误抛出 mermaid 自己的错误信息 */
export const renderMermaid = (code: string, dark: boolean): Promise<string> => serial(() => render(code, dark))

async function render(code: string, dark: boolean): Promise<string> {
  const mermaid = await load()
  const c = dark ? PALETTE.dark : PALETTE.light
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    darkMode: dark,
    fontFamily: '"PingFang SC", "Hiragino Sans GB", -apple-system, "Segoe UI", sans-serif',
    themeVariables: {
      background: 'transparent',
      primaryColor: c.node,
      primaryBorderColor: c.border,
      primaryTextColor: c.text,
      secondaryColor: c.note,
      tertiaryColor: c.note,
      lineColor: c.line,
      textColor: c.text,
      noteBkgColor: c.note,
      noteTextColor: c.text,
      noteBorderColor: c.line,
      edgeLabelBackground: dark ? '#07090f' : '#ffffff',
      pie1: c.border,
      pie2: c.accent,
      pie3: c.line,
      pieStrokeColor: dark ? '#07090f' : '#ffffff',
      pieTitleTextColor: c.text,
      pieSectionTextColor: dark ? '#001414' : '#ffffff',
    },
  })
  const { svg } = await mermaid.render(`mermaid-${++seq}`, code)
  return fixSize(svg)
}

/** 只查语法，不渲染 */
export async function checkMermaid(code: string): Promise<void> {
  const mermaid = await load()
  await mermaid.parse(code)
}
