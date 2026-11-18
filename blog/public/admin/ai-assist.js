/**
 * 投稿编辑器里的 AI 写作助手：访客填自己的 OpenAI 兼容接口地址、key、模型，请求从浏览器直接发出，不经过本站。
 * key 默认只在内存里；勾选「在本机记住」才写进 localStorage。
 * CMS 只允许自定义字段改自己的值，所以结果只给出建议和复制按钮，由作者自己粘贴。
 */
;(() => {
  const { useState } = CMS.React
  const STORE = 'contrib-ai'
  const FIELD = 'ai'

  const PRESETS = [
    { id: 'polish', label: '润色正文', prompt: '润色下面这篇中文博客正文：改正错别字和病句，让表达更简洁，保留原意、结构和 Markdown 格式。只输出改好的正文。' },
    { id: 'meta', label: '起标题和摘要', prompt: '根据下面的博客正文，给出 3 个标题备选和 1 句 60 字以内的摘要。按「标题：」「摘要：」分行输出。' },
    { id: 'outline', label: '按提纲起草', prompt: '下面是一份提纲或零散笔记，把它扩写成一篇结构清楚的中文博客正文，用 Markdown 小标题分节，不要写 HTML。' },
  ]

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORE) || 'null')
    } catch {
      return null
    }
  }

  function persist(remember, conf) {
    try {
      if (remember) localStorage.setItem(STORE, JSON.stringify(conf))
      else localStorage.removeItem(STORE)
    } catch {
      /* 存储不可用：只在内存里用 */
    }
  }

  async function complete({ baseUrl, key, model }, system, user) {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error?.message || `接口返回 ${res.status}`)
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new Error('接口返回里没有内容')
    return text
  }

  const css = {
    box: 'display:grid;gap:10px;padding:12px;border:1px solid rgba(127,127,127,.3);border-radius:10px',
    row: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px',
    input: 'padding:6px 8px;border:1px solid rgba(127,127,127,.4);border-radius:6px;font:inherit;background:transparent;color:inherit',
    out: 'margin:0;padding:10px;max-height:320px;overflow:auto;white-space:pre-wrap;border-radius:6px;background:rgba(127,127,127,.1)',
  }

  function AiAssist({ entry }) {
    const saved = loadSaved()
    const [conf, setConf] = useState(saved ?? { baseUrl: 'https://api.openai.com/v1', key: '', model: '' })
    const [remember, setRemember] = useState(Boolean(saved))
    const [extra, setExtra] = useState('')
    const [state, setState] = useState({ busy: false, text: '', error: '' })

    const update = (k) => (e) => {
      const next = { ...conf, [k]: e.target.value }
      setConf(next)
      if (remember) persist(true, next)
    }
    const toggleRemember = (e) => {
      setRemember(e.target.checked)
      persist(e.target.checked, conf)
    }

    const run = async (preset) => {
      if (!conf.baseUrl || !conf.key || !conf.model) return setState({ busy: false, text: '', error: '先填接口地址、key 和模型' })
      setState({ busy: true, text: '', error: '' })
      try {
        const body = entry?.getIn(['data', 'body']) || ''
        if (!body.trim()) return setState({ busy: false, text: '', error: '正文还是空的' })
        const system = extra.trim() ? `${preset.prompt}\n额外要求：${extra.trim()}` : preset.prompt
        setState({ busy: false, text: await complete(conf, system, body), error: '' })
      } catch (err) {
        setState({ busy: false, text: '', error: `请求失败：${err.message}（若是跨域报错，说明这家接口不允许浏览器直接调用）` })
      }
    }

    const copy = () => navigator.clipboard?.writeText(state.text)

    return html`
      <div style=${css.box}>
        <div style=${css.row}>
          <input style=${css.input} placeholder="接口地址" value=${conf.baseUrl} onInput=${update('baseUrl')} />
          <input style=${css.input} placeholder="模型名" value=${conf.model} onInput=${update('model')} />
          <input style=${css.input} type="password" placeholder="API key" autocomplete="off" value=${conf.key} onInput=${update('key')} />
        </div>
        <label><input type="checkbox" checked=${remember} onChange=${toggleRemember} /> 在本机记住（存进这个浏览器的 localStorage）</label>
        <input style=${css.input} placeholder="额外要求（可不填），例如：语气轻松一点" value=${extra} onInput=${(e) => setExtra(e.target.value)} />
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${PRESETS.map((p) => html`<button type="button" disabled=${state.busy} onClick=${() => run(p)}>${p.label}</button>`)}
        </div>
        ${state.busy && html`<div>生成中…</div>`}
        ${state.error && html`<div role="alert" style="color:#d33">${state.error}</div>`}
        ${state.text &&
        html`<div style="display:grid;gap:6px">
          <pre style=${css.out}>${state.text}</pre>
          <div><button type="button" onClick=${copy}>复制结果</button> 复制后自己粘贴到正文或标题里</div>
        </div>`}
      </div>
    `
  }

  CMS.registerFieldType('ai_assist', AiAssist)
  // 助手字段只在编辑时用，保存前从数据里去掉，不写进文章 frontmatter
  CMS.registerEventListener({ name: 'preSave', handler: ({ entry }) => entry.get('data').delete(FIELD) })
})()
