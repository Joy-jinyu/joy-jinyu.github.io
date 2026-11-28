/**
 * 接口模拟器：贴进 DevTools 的 Console 回车，右下角出现一个面板，让页面之后发出的每个 fetch 请求
 * 「正常 / 慢 3 秒 / 一直不回来 / 返回 500 / 断网」。用来看页面在每种情况下显示什么、能不能走出来。
 * 只改 fetch，不管 XMLHttpRequest 和 WebSocket。请求带了 signal 时照样能被它取消（超时、用户取消都能生效）。
 * 再运行一次就关掉，fetch 恢复原样。
 * 嵌进别的页面时，先设 window.__netLabHeadless = true 就不画面板，用 window.__netLab.set(mode) 和 .state() 控制。
 * 来源：https://joy-jinyu.github.io/blog/ai-states/
 */
(() => {
  const ID = '__net_lab__'
  if (window.__netLab) {
    window.fetch = window.__netLab.orig
    clearInterval(window.__netLab.timer)
    delete window.__netLab
    document.getElementById(ID)?.remove()
    return
  }
  const orig = window.fetch
  const MODES = { normal: '正常', slow: '慢 3 秒', hang: '一直不回来', error: '返回 500', offline: '断网' }
  let mode = 'normal'
  const pending = new Set()
  let total = 0

  const wait = (ms, signal) => new Promise((resolve, reject) => {
    const t = ms === Infinity ? null : setTimeout(resolve, ms)
    if (signal?.aborted) return reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason ?? new DOMException('Aborted', 'AbortError')) }, { once: true })
  })

  window.fetch = async function (input, init = {}) {
    total++
    const signal = init.signal ?? (input instanceof Request ? input.signal : undefined)
    const rec = { t0: performance.now(), url: String(input instanceof Request ? input.url : input), method: (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase() }
    pending.add(rec)
    render()
    try {
      if (mode === 'slow') await wait(3000, signal)
      if (mode === 'hang') await wait(Infinity, signal)
      if (mode === 'error') { await wait(300, signal); return new Response('{"error":"internal"}', { status: 500, headers: { 'content-type': 'application/json' } }) }
      if (mode === 'offline') { await wait(300, signal); throw new TypeError('Failed to fetch') }
      return await orig.call(this, input, init)
    } finally {
      pending.delete(rec)
      render()
    }
  }

  const state = () => {
    const now = performance.now()
    const list = [...pending].map((r) => ({ ...r, waited: (now - r.t0) / 1000 }))
    return { mode, total, pending: list }
  }
  window.__netLab = { orig, set: (m) => { mode = m; render() }, state, MODES }

  let root = null
  function render() {
    if (!root) return
    const s = state()
    root.querySelectorAll('button[data-m]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === mode)))
    root.querySelector('.st').textContent = s.pending.length
      ? `等待中 ${s.pending.length} 个：` + s.pending.map((r) => `${r.method} ${r.url.split('/').pop()} 已等 ${r.waited.toFixed(1)} 秒`).join('；')
      : `没有等待中的请求（共拦下 ${s.total} 个）`
  }
  if (window.__netLabHeadless) return

  const host = document.createElement('div')
  host.id = ID
  host.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647'
  root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `<style>
    .p{width:min(340px,calc(100vw - 24px));padding:12px 14px;border-radius:12px;background:#111418;color:#e8eaee;font:12px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.45)}
    h3{margin:0 0 8px;font-size:13px}.row{display:flex;flex-wrap:wrap;gap:6px}
    button{min-height:30px;padding:0 10px;border:1px solid #2c323c;border-radius:8px;background:#1a1f27;color:#c9cfd9;font:inherit;cursor:pointer}
    button[aria-pressed="true"]{border-color:#f59e0b;color:#fbbf24}.x{float:right;min-height:0;padding:0;border:0;background:none;color:#9aa3b2}
    .st{margin-top:8px;color:#9aa3b2;font-variant-numeric:tabular-nums}
  </style><div class="p"><button class="x" type="button">关闭</button><h3>接口怎么回</h3>
    <div class="row">${Object.entries(MODES).map(([k, v]) => `<button type="button" data-m="${k}">${v}</button>`).join('')}</div>
    <div class="st" aria-live="polite"></div></div>`
  root.querySelectorAll('button[data-m]').forEach((b) => b.addEventListener('click', () => window.__netLab.set(b.dataset.m)))
  root.querySelector('.x').addEventListener('click', () => { window.fetch = orig; clearInterval(window.__netLab.timer); delete window.__netLab; host.remove() })
  document.body.append(host)
  window.__netLab.timer = setInterval(render, 500)
  render()
})()
