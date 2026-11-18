/**
 * 投稿编辑器的 AI 能力：用访客自己配置的 OpenAI 兼容接口，从浏览器直连。
 * 提示词只在这里维护；结果按 host-contract.ts 的 AiResult 返回。
 */
import type { AiConfig } from '../ai-settings'
import { LIMITS, type AiResult, type AiTask, type Draft } from '../../../editor-app/host-contract'

const STYLE = '用简体中文，语气平实，像在跟同行讲清楚一件事；不用夸张修辞；中英文之间加空格。'

const JSON_RULE =
  '只输出一个 JSON 对象，不要代码块标记，不要任何解释。正文用 Markdown，不能写 HTML 标签，链接只用 http / https。'

const PROMPTS: Record<AiTask['task'], string> = {
  polish: `你是中文技术博客的编辑。润色用户给的博客正文：改正错别字和病句，让表达更简洁，保留原意、结构和 Markdown 格式，不新增事实。${STYLE}只输出改好的正文。`,
  meta: `你是中文技术博客的编辑。根据用户给的博客正文，给出 3 个标题备选（每个不超过 ${LIMITS.title} 字）、1 句摘要（不超过 ${LIMITS.description} 字）、最多 ${LIMITS.tags} 个标签（每个不超过 ${LIMITS.tag} 字）。${STYLE}${JSON_RULE}格式：{"titles":["..."],"description":"...","tags":["..."]}`,
  draft: `你是中文技术博客的作者。根据用户给的主题或提纲，写一篇完整的博客：开头直接讲要解决的问题，用 Markdown 二级、三级标题分节，必要时给代码示例，结尾给出可以直接用的结论。标题不超过 ${LIMITS.title} 字，摘要不超过 ${LIMITS.description} 字，最多 ${LIMITS.tags} 个标签。${STYLE}${JSON_RULE}格式：{"title":"...","description":"...","tags":["..."],"body":"..."}`,
}

async function chat(config: AiConfig, system: string, user: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` },
      body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    })
  } catch {
    throw new Error('请求没发出去：可能是这个接口不允许浏览器直接调用（跨域限制），或网络不通')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`AI 接口返回 ${res.status}${data?.error?.message ? `：${data.error.message}` : ''}`)
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) throw new Error('AI 接口没有返回内容')
  return text.trim()
}

/** 模型偶尔会包一层 ```json 或在前后多说话：取第一个 { 到最后一个 } */
function parseJson(text: string): Record<string, unknown> {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  try {
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1))
  } catch {
    // 落到下面统一报错
  }
  throw new Error('AI 返回的格式不对，可以再试一次')
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
/** 去重：应用的列表按标签文字做 key，重复的标签会让行错乱 */
const tags = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map((t) => str(t, LIMITS.tag)).filter(Boolean))].slice(0, LIMITS.tags)

function toDraft(o: Record<string, unknown>): Draft {
  const draft = { title: str(o.title, LIMITS.title), description: str(o.description, LIMITS.description), tags: tags(o.tags), body: str(o.body, 200_000) }
  if (!draft.title || !draft.body) throw new Error('AI 返回的稿子缺少标题或正文，可以再试一次')
  return draft
}

export async function complete(config: AiConfig, task: AiTask): Promise<AiResult[AiTask['task']]> {
  const input = task.input.trim()
  if (!input) throw new Error(task.task === 'draft' ? '先写下主题或提纲' : '正文还是空的')
  const system = task.extra?.trim() ? `${PROMPTS[task.task]}\n额外要求：${task.extra.trim()}` : PROMPTS[task.task]
  const text = await chat(config, system, input)
  if (task.task === 'polish') return { body: text }
  const o = parseJson(text)
  if (task.task === 'draft') return toDraft(o)
  const titles = (Array.isArray(o.titles) ? o.titles : []).map((t) => str(t, LIMITS.title)).filter(Boolean).slice(0, 3)
  if (!titles.length) throw new Error('AI 没给出标题，可以再试一次')
  return { titles, description: str(o.description, LIMITS.description), tags: tags(o.tags) }
}
