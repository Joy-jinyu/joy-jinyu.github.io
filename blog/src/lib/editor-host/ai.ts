/**
 * 投稿编辑器的 AI 能力：用访客自己配置的 OpenAI 兼容接口，从浏览器直连，流式拿回思考过程和内容。
 * 提示词（含内置的画图规则）只在这里维护；结果按 contract.ts 的 AiResult 返回。
 */
import type { AiConfig } from '../ai-settings'
import { chat, type DeltaKind } from '../ai-chat'
import { LIMITS, type AiResult, type AiTask, type Draft } from './contract'

const STYLE = '用简体中文，语气平实，像在跟同行讲清楚一件事；不用夸张修辞；中英文之间加空格。'
const MD = '正文用 Markdown，不能写 HTML 标签，链接只用 http / https。需要流程图、时序图或数据图时，用 ```mermaid 代码块。'
const MERMAID_RULES =
  '只用这些 Mermaid 图：flowchart、sequenceDiagram、stateDiagram-v2、pie、xychart-beta（折线 / 柱状）、timeline、mindmap。节点文字用中文、尽量短；不写 %%{init}%% 指令，不写 click、href、callback，不写 HTML。'

const PROMPTS: Record<AiTask['task'], string> = {
  polish: `你是中文技术博客的编辑。润色用户给的博客正文：改正错别字和病句，让表达更简洁，保留原意、结构、Markdown 格式和其中的代码块、mermaid 图，不新增事实。${STYLE}只输出改好的正文。`,
  meta: `你是中文技术博客的编辑。根据用户给的博客正文，给出 3 个标题备选（每个不超过 ${LIMITS.title} 字）、1 句摘要（不超过 ${LIMITS.description} 字）、最多 ${LIMITS.tags} 个标签（每个不超过 ${LIMITS.tag} 字）。${STYLE}严格按下面的格式逐行输出，不要别的内容：\n标题：…\n标题：…\n标题：…\n摘要：…\n标签：a, b, c`,
  draft: `你是中文技术博客的作者。根据用户给的主题或提纲写一篇完整的博客：开头直接讲要解决的问题，用 Markdown 二级、三级标题分节，必要时给代码示例或图，结尾给出可以直接用的结论。${STYLE}${MD}${MERMAID_RULES}严格按下面的格式输出：前三行是 标题：…（不超过 ${LIMITS.title} 字）、摘要：…（不超过 ${LIMITS.description} 字）、标签：a, b（最多 ${LIMITS.tags} 个），第四行是 ---，之后是正文。`,
  diagram: `你会把一段描述画成 Mermaid 图。${MERMAID_RULES}按内容选最合适的图：步骤和分支用 flowchart，谁调谁用 sequenceDiagram，占比用 pie，随时间或分类变化的数值用 xychart-beta。只输出 Mermaid 代码本身，不要代码块标记，不要解释。`,
  svg: `你会把一段描述画成一张 SVG 插图，用来放进技术博客。只输出一个 <svg> 元素：带 xmlns 和 viewBox，宽 800 左右；背景透明；配色只用青色 #00b8b8、#5eead4，中性灰 #7d8596、#c3c9d4，深灰 #4a5160，强调色 #f5b454，保证深色和浅色背景上都看得清；文字用 font-family="sans-serif"，字号不小于 14。不能有 <script>、<style>、style 属性、<foreignObject>、<image>、<a>、动画、事件属性、外部链接或字体；渐变、箭头用 <defs> 里的 id 引用。不要代码块标记，不要解释。`,
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
/** 去重：应用的列表按标签文字做 key，重复的标签会让行错乱 */
const tags = (v: string) => [...new Set(v.split(/[,，、]/).map((t) => str(t, LIMITS.tag)).filter(Boolean))].slice(0, LIMITS.tags)
/** 「标题：xxx」这类行，冒号中英文都认 */
const field = (line: string, name: string) => (new RegExp(`^\\s*${name}\\s*[:：]\\s*(.*)$`).exec(line)?.[1] ?? null)
const stripFence = (text: string) => text.replace(/^```[\w-]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim()

function parseDraft(text: string): Draft {
  const lines = text.split('\n')
  const sep = lines.findIndex((l) => l.trim() === '---')
  const head = sep > 0 ? lines.slice(0, sep) : lines.slice(0, 3)
  const pick = (name: string) => head.map((l) => field(l, name)).find((v) => v !== null) ?? ''
  const draft = {
    title: str(pick('标题'), LIMITS.title),
    description: str(pick('摘要'), LIMITS.description),
    tags: tags(pick('标签')),
    body: (sep > 0 ? lines.slice(sep + 1) : lines.slice(3)).join('\n').trim(),
  }
  if (!draft.title || !draft.body) throw new Error('AI 返回的稿子缺少标题或正文，可以再试一次')
  return draft
}

function parseMeta(text: string): AiResult['meta'] {
  const lines = text.split('\n')
  const titles = lines.map((l) => field(l, '标题')).filter((v): v is string => !!v).map((t) => str(t, LIMITS.title)).filter(Boolean).slice(0, 3)
  if (!titles.length) throw new Error('AI 没给出标题，可以再试一次')
  const one = (name: string) => lines.map((l) => field(l, name)).find((v) => v !== null) ?? ''
  return { titles, description: str(one('摘要'), LIMITS.description), tags: tags(one('标签')) }
}

/** 渲染前的语法检查交给宿主的 diagram.ts；这里只管拿到代码。onSend：输入检查通过、请求真正发出前调一次 */
export type Finishers = { checkMermaid: (code: string) => Promise<void>; storeSvg: (raw: string) => Promise<AiResult['svg']['image']>; onSend?: () => void }

export async function complete(
  config: AiConfig,
  task: AiTask,
  signal: AbortSignal,
  onDelta: (kind: DeltaKind, text: string) => void,
  finish: Finishers,
): Promise<AiResult[AiTask['task']]> {
  const input = task.input.trim()
  if (!input) throw new Error(task.task === 'polish' || task.task === 'meta' ? '正文还是空的' : '先写下想要什么')
  const system = task.extra?.trim() ? `${PROMPTS[task.task]}\n额外要求：${task.extra.trim()}` : PROMPTS[task.task]
  finish.onSend?.()
  const text = await chat(config, [{ role: 'system', content: system }, { role: 'user', content: input }], signal, onDelta)
  switch (task.task) {
    case 'polish':
      return { body: text }
    case 'meta':
      return parseMeta(text)
    case 'draft':
      return parseDraft(text)
    case 'diagram': {
      const mermaid = stripFence(text)
      await finish.checkMermaid(mermaid)
      return { mermaid }
    }
    case 'svg':
      return { image: await finish.storeSvg(stripFence(text)) }
  }
}

/** AI 设置里「获取模型」：OpenAI 兼容的 /models */
export async function listModels(baseUrl: string, key: string): Promise<string[]> {
  let res: Response
  try {
    res = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, { headers: { Authorization: `Bearer ${key}` } })
  } catch {
    throw new Error('拿不到模型列表：可能是接口不允许浏览器直接调用，或网络不通。可以手动填模型名')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`拿不到模型列表（${res.status}${data?.error?.message ? `：${data.error.message}` : ''}），可以手动填模型名`)
  const ids = (Array.isArray(data?.data) ? data.data : []).map((m: { id?: unknown }) => m?.id).filter((id: unknown): id is string => typeof id === 'string')
  return [...new Set<string>(ids)].sort()
}

/** AI 设置里「测试」：发一句最短的话，看能不能通、要多久 */
export async function ping(config: AiConfig): Promise<{ ms: number; reply: string }> {
  const t = performance.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 30_000)
  try {
    const reply = await chat(config, [{ role: 'system', content: '只回复「好」。' }, { role: 'user', content: 'ping' }], ctrl.signal, () => {})
    return { ms: Math.round(performance.now() - t), reply: reply.slice(0, 40) }
  } finally {
    clearTimeout(timer)
  }
}
