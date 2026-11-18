/**
 * 触屏 X 光：贴进 DevTools 的 Console 回车（最好先切到 DevTools 的手机模式），
 * 给每个可点元素标出宽 × 高：小于 24px 标红（WCAG 2.5.8 的下限），小于 44px 标黄（Apple 建议的 44pt），
 * 再按 iPhone 15 的安全区在视口四边画出斜线：竖屏上 59、下 34，横屏左右 59、下 21（数值来自 useyourloaf.com）。
 * 伸进斜线区（安全区边距）的可点元素用紫色虚线框，并在面板里单独列出来。再运行一次就关掉；滚动或缩放窗口后，运行两次（先关再开）即可刷新。
 * 来源：https://joy-jinyu.github.io/blog/ai-h5/
 */
(() => {
  const ID = '__h5_xray__'
  const old = document.getElementById(ID)
  if (old) { old.remove(); return }
  const host = document.createElement('div')
  host.id = ID
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none'
  const root = host.attachShadow({ mode: 'open' })
  const W = innerWidth, H = innerHeight
  const preset = W > H ? { name: '横屏', top: 0, right: 59, bottom: 21, left: 59 } : { name: '竖屏', top: 59, right: 0, bottom: 34, left: 0 }
  const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 12)
  const fixedAncestor = (el) => { for (let e = el; e; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return true } return false }
  const items = [...document.querySelectorAll('button, a[href], input:not([type="hidden"]), textarea, select, summary, [role="button"], [role="tab"], [role="switch"]')].map((el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) return null
    const min = Math.min(r.width, r.height)
    const fixed = fixedAncestor(el)
    const out = r.left < preset.left - 0.5 || r.right > W - preset.right + 0.5 || (fixed && (r.top < preset.top - 0.5 || r.bottom > H - preset.bottom + 0.5))
    return { el, r, min, out, level: min < 24 ? 'bad' : min < 44 ? 'warn' : 'ok' }
  }).filter(Boolean)
  const box = (i) => `<div class="b ${i.level} ${i.out ? 'out' : ''}" style="left:${i.r.left}px;top:${i.r.top}px;width:${i.r.width}px;height:${i.r.height}px"><span>${Math.round(i.r.width)}×${Math.round(i.r.height)}</span></div>`
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const outs = items.filter((i) => i.out), small = items.filter((i) => i.level !== 'ok')
  root.innerHTML = `<style>
    .z{position:absolute;background:repeating-linear-gradient(45deg,rgba(225,29,72,.25) 0 6px,rgba(225,29,72,.07) 6px 12px)}
    .b{position:absolute;box-sizing:border-box;border:1.5px solid #22c55e;border-radius:4px}.b.warn{border-color:#f59e0b}.b.bad{border-color:#ef4444}.b.out{border:3px dashed #c026d3}
    .b span{position:absolute;left:0;top:-15px;padding:0 3px;border-radius:3px;background:#111;color:#fff;font:600 10px/14px ui-monospace,Menlo,monospace;white-space:nowrap}
    .p{position:absolute;right:12px;bottom:12px;width:min(320px,calc(100vw - 24px));max-height:45vh;overflow:auto;padding:12px 14px;border-radius:12px;background:#111418;color:#e8eaee;font:12px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.45);pointer-events:auto}
    h3{margin:0 0 6px;font-size:13px}p{margin:4px 0;color:#9aa3b2}.w{color:#fbbf24}.r{color:#f87171}button{float:right;border:0;background:none;color:#9aa3b2;font:inherit;cursor:pointer}
  </style>
  <i class="z" style="left:0;right:0;top:0;height:${preset.top}px"></i><i class="z" style="left:0;right:0;bottom:0;height:${preset.bottom}px"></i>
  <i class="z" style="top:0;bottom:0;left:0;width:${preset.left}px"></i><i class="z" style="top:0;bottom:0;right:0;width:${preset.right}px"></i>
  ${items.map(box).join('')}
  <div class="p"><button type="button">关闭</button><h3>${W}×${H} · 按 iPhone 15 ${preset.name}的安全区边距</h3>
    <p>可点元素 ${items.length} 个；<span class="r">小于 24px ${items.filter((i) => i.level === 'bad').length} 个</span>，<span class="w">小于 44px ${small.length} 个</span>。</p>
    <p class="${outs.length ? 'r' : ''}">伸进安全区边距 ${outs.length} 个${outs.length ? '：' + outs.map((i) => esc(name(i.el))).join('、') : ''}</p>
    ${small.length ? `<p>小于 44px：${small.map((i) => `${esc(name(i.el))} ${Math.round(i.r.width)}×${Math.round(i.r.height)}`).join('；')}</p>` : ''}
  </div>`
  root.querySelector('button').addEventListener('click', () => host.remove())
  console.table(items.map((i) => ({ 元素: name(i.el), 宽: Math.round(i.r.width), 高: Math.round(i.r.height), 小于44: i.level !== 'ok' ? '是' : '', 伸进安全区边距: i.out ? '是' : '' })))
  document.body.append(host)
})()
