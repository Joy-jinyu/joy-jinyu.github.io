import { chromium } from 'playwright-core'
const exe = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const b = await chromium.launch({ executablePath: exe, headless: true })
const p = await b.newPage({ viewport: { width: 800, height: 600 } })
const cases = {
  'opacity:0': 'opacity:0',
  'transform 移出屏幕': 'transform:translateX(-2000px)',
  'pointer-events:none + opacity:0': 'opacity:0;pointer-events:none',
  'visibility:hidden': 'visibility:hidden',
  'display:none': 'display:none',
  'aria-hidden=true': '',
  'inert': '',
  'height:0;overflow:hidden': 'height:0;overflow:hidden',
}
let html = '<body style="margin:0">'
let i = 0
for (const [k, css] of Object.entries(cases)) {
  const attr = k === 'aria-hidden=true' ? 'aria-hidden="true"' : k === 'inert' ? 'inert' : ''
  html += `<div style="position:absolute;left:${10 + (i % 4) * 190}px;top:${10 + Math.floor(i / 4) * 80}px;width:150px;height:50px"><div id="w${i}" ${attr} style="${css}"><button id="b${i}" style="width:150px;height:50px">按钮${i}</button></div></div>`
  i++
}
await p.setContent(html)
const out = []
i = 0
for (const k of Object.keys(cases)) {
  const r = await p.evaluate((i) => {
    const btn = document.getElementById('b' + i)
    const wrap = btn.parentElement.parentElement.getBoundingClientRect()
    const rc = btn.getBoundingClientRect()
    const visiblePx = rc.width > 0 && rc.height > 0 && rc.right > 0 && rc.left < innerWidth && getComputedStyle(btn).visibility !== 'hidden' && Number(getComputedStyle(btn.parentElement).opacity) > 0 && btn.parentElement.getBoundingClientRect().height > 0
    const hit = document.elementFromPoint(wrap.left + 75, wrap.top + 25)
    btn.focus()
    const focused = document.activeElement === btn
    document.activeElement.blur()
    return { visiblePx, clickable: hit === btn, focusable: focused }
  }, i)
  const snap = await p.accessibility.snapshot({ interestingOnly: false })
  const names = JSON.stringify(snap)
  r.readable = names.includes(`按钮${i}`)
  out.push([k, r])
  i++
}
for (const [k, r] of out) console.log(k.padEnd(34), '看得见', r.visiblePx ? '是' : '否', '| 点得到', r.clickable ? '是' : '否', '| 能聚焦', r.focusable ? '是' : '否', '| 读屏能读到', r.readable ? '是' : '否')
console.log('chrome', b.version())
await b.close()
