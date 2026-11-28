/**
 * 风格清单：贴进 DevTools 的 Console 回车，列出页面上实际画出来的颜色、圆角、字号、字重、阴影和控件高度，
 * 并标出「不等于任何一个 CSS 变量的值」——它们是变量表之外、AI（或人）自己定的值。再运行一次就关掉。
 * 变量取自所有样式表里 :root / html 上声明的自定义属性（包括 @media 里的），按当前主题求值后比较。
 * 胶囊形（圆角大于等于短边一半）只有在变量里有 500px 以上的圆角值（如 999px）时才算在变量里。
 * 1px 以下的元素（读屏专用的隐藏文字）不算。来源：https://joy-jinyu.github.io/blog/ai-consistency/
 */
(() => {
  const ID = '__style_audit__'
  const old = document.getElementById(ID)
  const clear = () => document.querySelectorAll('[data-style-audit]').forEach((e) => { e.style.outline = e.dataset.styleAudit; delete e.dataset.styleAudit })
  if (old) { old.remove(); clear(); return }

  // 一、收集变量，按当前主题求出实际的值：颜色统一成 rgb()，长度统一成 px
  const names = new Set()
  const walk = (rules) => {
    for (const r of rules) {
      if (r.cssRules && !r.selectorText) walk(r.cssRules)
      else if (r.selectorText && /(^|,)\s*(:root|html)\b/.test(r.selectorText)) for (const p of r.style) if (p.startsWith('--')) names.add(p)
    }
  }
  for (const s of document.styleSheets) { try { walk(s.cssRules) } catch {} }
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;visibility:hidden'
  document.body.append(probe)
  const asColor = new Set(), asPx = new Set()
  for (const n of names) {
    probe.style.color = ''; probe.style.color = `var(${n})`
    const c = getComputedStyle(probe).color
    if (probe.style.color && c) asColor.add(c)
    probe.style.width = ''; probe.style.width = `var(${n})`
    const w = getComputedStyle(probe).width
    if (probe.style.width && w.endsWith('px')) asPx.add(parseFloat(w))
  }
  probe.remove()

  // 二、收集页面上画出来的值
  const bag = { 颜色: new Map(), 圆角: new Map(), 字号: new Map(), 字重: new Map(), 控件高度: new Map(), 阴影: new Map() }
  const add = (k, v, el) => { if (!bag[k].has(v)) bag[k].set(v, new Set()); bag[k].get(v).add(el) }
  const seen = (c) => c && !/rgba\([^)]*,\s*0\)$/.test(c) && c !== 'transparent'
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('#' + ID) || el.closest('svg') && el.tagName !== 'svg') continue
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
    if (r.width <= 1 || r.height <= 1 || cs.visibility === 'hidden' || cs.opacity === '0') continue
    const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (text) { add('颜色', cs.color, el); add('字号', parseFloat(cs.fontSize), el); add('字重', cs.fontWeight, el) }
    if (seen(cs.backgroundColor)) add('颜色', cs.backgroundColor, el)
    for (const s of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none' && seen(cs[`border${s}Color`])) add('颜色', cs[`border${s}Color`], el)
    const rad = parseFloat(cs.borderTopLeftRadius)
    if (rad > 0) add('圆角', rad >= Math.min(r.width, r.height) / 2 - 0.5 ? '胶囊' : rad, el)
    if (cs.boxShadow !== 'none') add('阴影', cs.boxShadow, el)
    if (el.matches('button, input:not([type="checkbox"]):not([type="radio"]), select, textarea, [role="button"], summary')) add('控件高度', Math.round(r.height), el)
  }
  const hasPill = [...asPx].some((v) => v >= 500)
  const outside = (k, v) => (k === '颜色' ? !asColor.has(v) : k === '圆角' ? (v === '胶囊' ? !hasPill : !asPx.has(v)) : k === '字号' || k === '控件高度' ? !asPx.has(v) : false)
  const rows = Object.entries(bag).flatMap(([k, m]) => [...m.entries()].map(([v, els]) => ({ k, v, els: [...els], out: outside(k, v) })))
    .sort((a, b) => a.k.localeCompare(b.k) || b.els.length - a.els.length)
  const outCount = rows.filter((r) => r.out).length
  console.table(rows.map((r) => ({ 类别: r.k, 值: String(r.v), 处数: r.els.length, 变量之外: r.out ? '是' : '' })))

  // 三、面板：放在 Shadow DOM 里，不受页面样式影响；点一行就把用这个值的元素框出来
  const host = document.createElement('div')
  host.id = ID
  host.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647'
  const root = host.attachShadow({ mode: 'open' })
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const groups = Object.keys(bag).map((k) => {
    const list = rows.filter((r) => r.k === k)
    if (!list.length) return ''
    return `<h4>${k} ${list.length} 种${k === '字重' || k === '阴影' ? '' : ` · 变量之外 ${list.filter((r) => r.out).length} 种`}</h4><table>${list.map((r) => `<tr data-i="${rows.indexOf(r)}"><td>${k === '颜色' ? `<span class="sw" style="background:${r.v}"></span>` : ''}<span class="m">${esc(k === '阴影' ? String(r.v).slice(0, 48) : r.v)}${typeof r.v === 'number' ? 'px' : ''}</span></td><td class="m">×${r.els.length}</td><td>${r.out ? '<span class="w">变量之外</span>' : ''}</td></tr>`).join('')}</table>`
  }).join('')
  root.innerHTML = `<style>
    .p{width:min(400px,calc(100vw - 24px));max-height:min(60vh,520px);overflow:auto;padding:14px;border-radius:12px;background:#111418;color:#e8eaee;font:12px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.45)}
    h3{margin:0 0 4px;font-size:13px}h4{margin:12px 0 6px;font-size:12px;color:#9aa3b2}p{margin:0;color:#9aa3b2}
    table{width:100%;border-collapse:collapse}td{padding:4px 6px;border-top:1px solid #262b33;vertical-align:middle}
    tr{cursor:pointer}tr:hover td{background:#1b2028}.m{font-family:ui-monospace,Menlo,monospace;color:#c9cfd9;white-space:nowrap}
    .sw{display:inline-block;width:12px;height:12px;margin-right:6px;border-radius:3px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25);vertical-align:-2px}
    .w{color:#fbbf24}button{float:right;border:0;background:none;color:#9aa3b2;font:inherit;cursor:pointer}
  </style><div class="p"><button type="button">关闭</button><h3>页面上画出来的值 · 变量之外 ${outCount} 处</h3>
    <p>读到 ${names.size} 个 CSS 变量。点一行，在页面上框出用它的元素。</p>${groups}</div>`
  root.querySelector('button').addEventListener('click', () => { host.remove(); clear() })
  root.querySelectorAll('tr').forEach((tr) => tr.addEventListener('click', () => {
    clear()
    const els = rows[Number(tr.dataset.i)].els
    els.forEach((e) => { e.dataset.styleAudit = e.style.outline; e.style.outline = '2px solid #f59e0b' })
    els[0]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }))
  document.body.append(host)
})()
