/**
 * 字号表 X 光：贴进 DevTools 的 Console 回车，列出页面上每一种文字样式（字号 · 字重 · 颜色 · 字距），
 * 标出「在页面上挨着、只差一个通道、而且差得不多」的样式对——它们很容易被看成同一级。再运行一次就关掉。
 * 「挨着」：两段文字左右有重叠，上下间隔不超过两个字号。代码块不算。
 * 「差得不多」是经验阈值，不是规范：字号差 ≤ 2px，字重差 ≤ 100，两种颜色在 OKLab 里的距离 < 0.05。
 * 另外顺手查三件中文排版的事：<html lang>、text-autospace 开没开、正文字体排出来的引号是不是英文字体的窄引号。
 * 来源：https://joy-jinyu.github.io/blog/ai-typography/
 */
(() => {
  const ID = '__type_audit__'
  const old = document.getElementById(ID)
  if (old) {
    old.remove()
    document.querySelectorAll('[data-type-audit]').forEach((e) => { e.style.outline = e.dataset.typeAudit; delete e.dataset.typeAudit })
    return
  }
  const rgb = (c) => (c.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number)
  const hex = (c) => '#' + rgb(c).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  // sRGB → OKLab（Björn Ottosson 的公式），两色距离近似「看起来差多少」
  const oklab = (c) => {
    const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
  }
  const dE = (a, b) => Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i]))
  const shown = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0' }

  // 一、按「直接装着文字的元素」收集样式
  const map = new Map()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n; (n = walker.nextNode()); ) {
    const el = n.parentElement
    if (!n.data.trim() || !el || el.closest('script,style,noscript,svg,pre,code,kbd,samp,#' + ID) || !shown(el)) continue
    const cs = getComputedStyle(el)
    const s = { fs: Math.round(parseFloat(cs.fontSize) * 2) / 2, fw: Number(cs.fontWeight), color: cs.color, ls: cs.letterSpacing === 'normal' ? '0' : cs.letterSpacing }
    const key = `${s.fs}|${s.fw}|${hex(s.color)}|${s.ls}`
    if (!map.has(key)) map.set(key, { ...s, hex: hex(s.color), els: new Set(), sample: '' })
    const g = map.get(key)
    g.els.add(el)
    if (!g.sample) g.sample = n.data.trim().slice(0, 18)
  }
  const styles = [...map.values()].sort((a, b) => b.fs - a.fs || b.fw - a.fw)

  // 二、在页面上挨着、只差一个通道、而且差得不多的样式对
  const box = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top + scrollY, b: r.bottom + scrollY } }
  /** 找一对上下挨着的元素：左右有重叠，上下间隔不超过两个字号 */
  const neighbors = (A, B) => {
    const lim = 2 * Math.max(A.fs, B.fs)
    for (const a of A.els) for (const b of B.els) {
      const x = box(a), y = box(b)
      if (Math.min(x.r, y.r) <= Math.max(x.l, y.l)) continue
      const gap = Math.max(y.t - x.b, x.t - y.b)
      if (gap >= -1 && gap <= lim) return [a, b]
    }
    return null
  }
  const close = []
  for (let i = 0; i < styles.length; i++) for (let j = i + 1; j < styles.length; j++) {
    const a = styles[i], b = styles[j]
    const diff = []
    if (a.fs !== b.fs) diff.push(['字号', Math.abs(a.fs - b.fs) <= 2, `${a.fs}/${b.fs}px`])
    if (a.fw !== b.fw) diff.push(['字重', Math.abs(a.fw - b.fw) <= 100, `${a.fw}/${b.fw}`])
    if (a.hex !== b.hex) diff.push(['颜色', dE(a.color, b.color) < 0.05, `${a.hex}/${b.hex}`])
    if (a.ls !== b.ls) diff.push(['字距', false, `${a.ls}/${b.ls}`])
    if (diff.length !== 1 || !diff[0][1]) continue
    const pair = neighbors(a, b)
    if (pair) close.push({ a, b, ta: pair[0].textContent.trim().slice(0, 18), tb: pair[1].textContent.trim().slice(0, 18), what: `只差${diff[0][0]} ${diff[0][2]}` })
  }

  // 三、中文排版三件事
  const probe = document.createElement('span')
  probe.textContent = '“'
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap'
  document.body.append(probe)
  const qem = probe.getBoundingClientRect().width / parseFloat(getComputedStyle(probe).fontSize)
  probe.remove()
  const bodyCs = getComputedStyle(document.body)
  const checks = [
    ['<html lang>', document.documentElement.lang || '没写', !!document.documentElement.lang],
    ['text-autospace', bodyCs.textAutospace ?? '浏览器不支持', bodyCs.textAutospace && bodyCs.textAutospace !== 'no-autospace'],
    ['正文的引号“', `${qem.toFixed(2)} em${qem < 0.5 ? '，像英文字体的窄引号' : ''}`, qem >= 0.5],
  ]

  console.table(styles.map((s) => ({ 字号: s.fs, 字重: s.fw, 颜色: s.hex, 字距: s.ls, 处数: s.els.size, 例子: s.sample })))
  if (close.length) console.table(close.map((c) => ({ 样式A: `${c.a.fs}/${c.a.fw}/${c.a.hex}「${c.ta}」`, 样式B: `${c.b.fs}/${c.b.fw}/${c.b.hex}「${c.tb}」`, 差别: c.what })))

  // 面板：放在 Shadow DOM 里，不受页面样式影响；点一行就把用这个样式的元素框出来
  const host = document.createElement('div')
  host.id = ID
  host.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647'
  const root = host.attachShadow({ mode: 'open' })
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  root.innerHTML = `<style>
    .p{width:min(420px,calc(100vw - 24px));max-height:min(60vh,520px);overflow:auto;padding:14px;border-radius:12px;background:#111418;color:#e8eaee;font:12px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.45)}
    h3{margin:0 0 8px;font-size:13px}h4{margin:12px 0 6px;font-size:12px;color:#9aa3b2}
    table{width:100%;border-collapse:collapse}td{padding:4px 6px;border-top:1px solid #262b33;vertical-align:middle}
    tr{cursor:pointer}tr:hover td{background:#1b2028}.m{font-family:ui-monospace,Menlo,monospace;color:#9aa3b2;white-space:nowrap}
    .w{color:#fbbf24}.ok{color:#4ade80}.bad{color:#f87171}button{float:right;border:0;background:none;color:#9aa3b2;font:inherit;cursor:pointer}
  </style><div class="p"><button type="button">关闭</button><h3>文字样式 ${styles.length} 种 · 字号 ${new Set(styles.map((s) => s.fs)).size} 种</h3>
    ${close.length ? `<h4 class="w">容易看成同一级的 ${close.length} 对（挨着，只差一个通道，而且差得不多）</h4>${close.map((c) => `<div>「${esc(c.ta)}」和「${esc(c.tb)}」：${esc(c.what)}</div>`).join('')}` : '<h4 class="ok">没有挨着又只差一点点的样式对</h4>'}
    <h4>中文排版</h4>${checks.map(([k, v, ok]) => `<div><span class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'}</span> ${esc(k)}：${esc(v)}</div>`).join('')}
    <h4>全部样式（点一行，在页面上框出来）</h4><table>${styles.map((s, i) => `<tr data-i="${i}"><td class="m">${s.fs}px ${s.fw}</td><td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${s.hex};vertical-align:-1px"></span> <span class="m">${s.hex}</span></td><td class="m">×${s.els.size}</td><td>${esc(s.sample)}</td></tr>`).join('')}</table></div>`
  root.querySelector('button').addEventListener('click', () => { host.remove(); clear() })
  const clear = () => document.querySelectorAll('[data-type-audit]').forEach((e) => { e.style.outline = e.dataset.typeAudit; delete e.dataset.typeAudit })
  root.querySelectorAll('tr').forEach((tr) => tr.addEventListener('click', () => {
    clear()
    const els = [...styles[Number(tr.dataset.i)].els]
    els.forEach((e) => { e.dataset.typeAudit = e.style.outline; e.style.outline = '2px solid #f59e0b' })
    els[0]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }))
  document.body.append(host)
})()
