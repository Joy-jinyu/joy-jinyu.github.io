/**
 * 访客自己配置的 OpenAI 兼容接口的流式对话：从浏览器直连，拆出思考过程和内容两路。
 * 投稿编辑器（editor-host/ai.ts）和页面上的小猫对话（ai-bridge.ts）共用。
 */
import type { AiConfig } from './ai-settings'

export type DeltaKind = 'reasoning' | 'content'
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

/**
 * 有的模型把思考过程放在 content 的 <think>…</think> 里（DeepSeek R1 类），有的放在 reasoning_content / reasoning 字段里；
 * 这里统一拆成两路。标签可能被切在两个分片之间，所以留一小段尾巴等下一片。
 */
function thinkSplitter(emit: (kind: DeltaKind, text: string) => void) {
  let inThink = false
  let pending = ''
  const flush = (final: boolean) => {
    for (;;) {
      const tag = inThink ? '</think>' : '<think>'
      const i = pending.indexOf(tag)
      if (i >= 0) {
        if (i) emit(inThink ? 'reasoning' : 'content', pending.slice(0, i))
        pending = pending.slice(i + tag.length)
        inThink = !inThink
        continue
      }
      const keep = final ? 0 : Math.min(pending.length, tag.length - 1)
      const out = pending.slice(0, pending.length - keep)
      if (out) emit(inThink ? 'reasoning' : 'content', out)
      pending = pending.slice(pending.length - keep)
      return
    }
  }
  return { push: (text: string) => ((pending += text), flush(false)), end: () => flush(true) }
}

/** 中止时抛「已停止」；返回去掉首尾空白的完整内容（不含思考过程） */
export async function chat(config: AiConfig, messages: ChatMessage[], signal: AbortSignal, onDelta: (kind: DeltaKind, text: string) => void): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` },
      body: JSON.stringify({ model: config.model, stream: true, messages }),
    })
  } catch (err) {
    if (signal.aborted) throw new Error('已停止')
    throw new Error('请求没发出去：可能是这个接口不允许浏览器直接调用（跨域限制），或网络不通')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(`AI 接口返回 ${res.status}${data?.error?.message ? `：${data.error.message}` : ''}`)
  }
  let content = ''
  const split = thinkSplitter((kind, text) => {
    if (kind === 'content') content += text
    onDelta(kind, text)
  })
  // 不支持流式的接口会直接回一整段 JSON
  if (!res.headers.get('content-type')?.includes('event-stream')) {
    const data = await res.json().catch(() => null)
    const msg = data?.choices?.[0]?.message
    const reasoning = msg?.reasoning_content ?? msg?.reasoning
    if (typeof reasoning === 'string' && reasoning) onDelta('reasoning', reasoning)
    if (typeof msg?.content === 'string') split.push(msg.content)
  } else {
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
    let buf = ''
    try {
      for (;;) {
        const { value, done } = await reader.read()
        // 流结束时最后一行可能没有换行，也要处理
        buf += done ? '\n' : value
        if (buf.length > 1_000_000) throw new Error('AI 接口返回的数据格式不对')
        const lines = buf.split('\n')
        buf = lines.pop()!
        for (const line of lines) {
          const m = /^data:\s?(.*)$/.exec(line.trim())
          if (!m || m[1] === '[DONE]') continue
          let chunk: { choices?: { delta?: { content?: string; reasoning_content?: string; reasoning?: string } }[]; error?: { message?: string } }
          try {
            chunk = JSON.parse(m[1])
          } catch {
            continue
          }
          if (chunk.error) throw new Error(`AI 接口出错：${chunk.error.message ?? '未知错误'}`)
          const delta = chunk.choices?.[0]?.delta
          const reasoning = delta?.reasoning_content ?? delta?.reasoning
          if (reasoning) onDelta('reasoning', reasoning)
          if (delta?.content) split.push(delta.content)
        }
        if (done) break
      }
    } catch (err) {
      if (signal.aborted) throw new Error('已停止')
      throw err
    }
  }
  split.end()
  if (!content.trim()) throw new Error('AI 接口没有返回内容')
  return content.trim()
}
