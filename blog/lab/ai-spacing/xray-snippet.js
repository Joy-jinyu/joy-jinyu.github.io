/**
 * 间距 X 光（浏览器版）：整段贴进 DevTools 控制台回车，页面上会画出
 *   蓝色虚线框：行盒，CSS 排版用的盒子，margin、padding、gap 都从它算起；
 *   红色实线框：墨迹，字真正画到的地方；
 *   标签：这块文字和正下方最近一块东西之间的间距，「写」按行盒量，「看」按墨迹量。
 * 再运行一次就关掉。只处理当前屏幕上下各一屏的内容；结果也存在 window.__spacingXray 里。
 * 墨迹按字体度量推算（canvas measureText），和逐像素截图比，误差见文章附录。
 */
(() => {
  const ID = '__spacing_xray__'
  const old = document.getElementById(ID)
  if (old) { old.remove(); delete window.__spacingXray; return }

  const g = document.createElement('canvas').getContext('2d')
  const px = (v) => parseFloat(v) || 0
  const alpha = (c) => {
    if (!c || c === 'transparent') return 0
    const p = c.match(/\(([^)]+)\)/)?.[1].split(/[\s,/]+/).filter(Boolean) ?? []
    return p.length > 3 ? parseFloat(p[3]) : 1
  }
  const effBg = (el) => {
    for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (alpha(c) > 0) return c }
    return 'rgb(255, 255, 255)'
  }
  const shown = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.display === 'none' || px(cs.opacity) === 0) return false
    }
    return getComputedStyle(el).visibility !== 'hidden'
  }
  const top0 = scrollY - innerHeight, bottom0 = scrollY + 2 * innerHeight
  const atoms = [], edges = []

  for (const el of document.body.querySelectorAll('*')) {
    // 代码块里每行之间本来就是 0，标出来只是噪音
    if (el.closest('#' + ID) || el.closest('pre') || ['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'svg'].includes(el.tagName)) continue
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || r.bottom + scrollY < top0 || r.top + scrollY > bottom0 || !shown(el)) continue
    const cs = getComputedStyle(el)

    const texts = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim())
    if (texts.length) {
      g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      let line = null, ink = null
      const grow = (a, b) => (a ? { t: Math.min(a.t, b.t), b: Math.max(a.b, b.b), l: Math.min(a.l, b.l), r: Math.max(a.r, b.r) } : b)
      for (const t of texts) {
        const m = g.measureText(t.textContent.trim())
        const rg = document.createRange(); rg.selectNodeContents(t)
        for (const q of rg.getClientRects()) {
          // 内容区顶 + 字体的上伸高度 = 基线；基线往上、往下各减去字形实际的高度就是墨迹
          const base = q.top + m.fontBoundingBoxAscent
          ink = grow(ink, { t: base - m.actualBoundingBoxAscent, b: base + m.actualBoundingBoxDescent, l: q.left, r: q.right })
          const lh = cs.lineHeight === 'normal' ? q.height : px(cs.lineHeight), half = (lh - q.height) / 2
          line = grow(line, { t: q.top - half, b: q.bottom + half, l: q.left, r: q.right })
        }
      }
      if (!ink) continue
      // 只装文字的块级元素，内容盒就是行盒；用 text-box 裁过的，padding 是用来包墨迹的，算边框盒
      if (el.children.length === 0 && cs.display !== 'inline') {
        const trimmed = cs.textBoxTrim && cs.textBoxTrim !== 'none'
        const it = trimmed ? 0 : px(cs.borderTopWidth) + px(cs.paddingTop), ib = trimmed ? 0 : px(cs.borderBottomWidth) + px(cs.paddingBottom)
        line = { ...line, t: r.top + it, b: r.bottom - ib }
      }
      const off = (o) => ({ t: o.t + scrollY, b: o.b + scrollY, l: o.l + scrollX, r: o.r + scrollX })
      atoms.push({ el, text: texts.map((t) => t.textContent.trim()).join(' '), line: off(line), ink: off(ink) })
    }

    if (el !== document.body) {
      const bgOn = (alpha(cs.backgroundColor) > 0 && cs.backgroundColor !== effBg(el.parentElement)) || cs.backgroundImage !== 'none'
      const fill = bgOn || cs.boxShadow !== 'none'
      const side = (s) => px(cs[`border${s}Width`]) > 0 && alpha(cs[`border${s}Color`]) > 0 && cs[`border${s}Style`] !== 'none'
      const l = r.left + scrollX, w = r.width
      if (fill || side('Top')) edges.push({ y: r.top + scrollY, l, r: l + w })
      if (fill || side('Bottom')) edges.push({ y: r.bottom + scrollY, l, r: l + w })
      // 绝对定位的伪元素常被拿来画分隔线：按它的 top / bottom / height 推出位置
      for (const p of ['::before', '::after']) {
        const s = getComputedStyle(el, p)
        if (!s.content || s.content === 'none' || s.position !== 'absolute' || alpha(s.backgroundColor) === 0) continue
        const h = px(s.height), y = s.top !== 'auto' ? r.top + px(s.top) : r.bottom - px(s.bottom) - h
        const pl = s.left !== 'auto' ? r.left + px(s.left) : r.right - px(s.right) - px(s.width)
        const pr = s.right !== 'auto' ? r.right - px(s.right) : pl + px(s.width)
        if (h > 0 && h <= 4) edges.push({ y: y + scrollY, l: pl + scrollX, r: pr + scrollX }, { y: y + h + scrollY, l: pl + scrollX, r: pr + scrollX })
      }
    }
  }

  // 每块文字往下找最近的一块：别的文字（行盒 / 墨迹两种看法）或看得见的盒子边
  const overlap = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1
  const below = (a, view) => {
    const q = a[view]
    let best = null
    for (const b of atoms) {
      if (b === a || !overlap(q, b[view])) continue
      const d = b[view].t - q.b
      if (d >= -0.5 && (!best || d < best)) best = d
    }
    for (const e of edges) {
      if (!overlap(q, e)) continue
      const d = e.y - q.b
      if (d >= -0.5 && (!best || d < best)) best = d
    }
    return best
  }
  const gaps = atoms.map((a) => ({ text: a.text.slice(0, 20), written: below(a, 'line'), seen: below(a, 'ink'), a }))

  const root = document.createElement('div')
  root.id = ID
  root.style.cssText = `position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;font:600 10px/1 ui-monospace,Menlo,monospace`
  const box = (o, css) => {
    const d = document.createElement('div')
    d.style.cssText = `position:absolute;left:${o.l}px;top:${o.t}px;width:${o.r - o.l}px;height:${o.b - o.t}px;box-sizing:border-box;${css}`
    root.append(d)
  }
  const r1 = (v) => Math.round(v * 10) / 10
  for (const { a, written, seen } of gaps) {
    box(a.line, 'border:1px dashed rgba(37,99,235,.75);background:rgba(37,99,235,.06)')
    box(a.ink, 'border:1px solid rgba(225,29,72,.9)')
    if (written == null || seen == null || written > 48) continue
    const tag = document.createElement('div')
    tag.textContent = `写 ${r1(written)} · 看 ${r1(seen)}`
    const hot = seen - written >= 4
    tag.style.cssText = `position:absolute;left:${a.ink.l}px;top:${a.ink.b + 1}px;padding:2px 4px;border-radius:4px;white-space:nowrap;color:#fff;background:${hot ? 'rgba(225,29,72,.92)' : 'rgba(30,41,59,.82)'}`
    root.append(tag)
  }
  document.body.append(root)
  window.__spacingXray = gaps.map(({ text, written, seen }) => ({ text, written: written == null ? null : r1(written), seen: seen == null ? null : r1(seen) }))
  console.table(window.__spacingXray.filter((x) => x.written != null && x.written <= 48))
})()
