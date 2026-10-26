// 量 AI 生成的对话页布局：node probe.mjs run1.html out.json
// 需要 playwright-core，CHROME_PATH 指向本机 Chrome
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const [file, out] = process.argv.slice(2)
const url = 'file://' + path.resolve(file)
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const VIEWS = [
  { name: 'desk-1440', viewport: { width: 1440, height: 900 } },
  { name: 'desk-1024', viewport: { width: 1024, height: 768 } },
  { name: 'phone-390', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
]

const measure = () => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { l: +b.left.toFixed(1), r: +b.right.toFixed(1), t: +b.top.toFixed(1), b: +b.bottom.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) } }
  const msgs = [...document.querySelectorAll('.msg')]
  let sc = msgs[0].parentElement
  while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement
  const col = msgs[0].parentElement
  const cs = getComputedStyle(col)
  const colBox = r(col)
  const content = { l: colBox.l + parseFloat(cs.paddingLeft), r: colBox.r - parseFloat(cs.paddingRight) }
  const composer = r(document.querySelector('.composer'))
  const main = r(document.querySelector('.main'))
  const link = [...document.querySelectorAll('.msg a[href]')].sort((a, b) => b.textContent.length - a.textContent.length)[0]
  const pre = document.querySelector('.msg pre')
  const ta = document.querySelector('#input')
  const send = document.querySelector('.composer button[type=submit], #send, .send')
  return {
    pageOverflowX: document.documentElement.scrollWidth - innerWidth,
    scroller: sc ? (sc.id || sc.className) : 'document',
    scrollbarW: sc ? sc.offsetWidth - sc.clientWidth : 0,
    scrollbarGutter: sc ? getComputedStyle(sc).scrollbarGutter : null,
    main: { l: main.l, r: main.r, center: +((main.l + main.r) / 2).toFixed(1) },
    column: { ...content, w: +(content.r - content.l).toFixed(1), center: +((content.l + content.r) / 2).toFixed(1) },
    composer: { l: composer.l, r: composer.r, w: composer.w, t: composer.t, b: composer.b, center: +((composer.l + composer.r) / 2).toFixed(1) },
    edgeDiff: { left: +(composer.l - content.l).toFixed(1), right: +(composer.r - content.r).toFixed(1) },
    link: link && { r: r(link).r, overColumn: +(r(link).r - content.r).toFixed(1), wrap: getComputedStyle(link).wordBreak + '/' + getComputedStyle(link).overflowWrap },
    pre: pre && { r: r(pre).r, overColumn: +(r(pre).r - content.r).toFixed(1), clientW: pre.clientWidth, scrollW: pre.scrollWidth, overflowX: getComputedStyle(pre).overflowX },
    input: { fontSize: getComputedStyle(ta).fontSize, lineHeight: getComputedStyle(ta).lineHeight, h: r(ta).h },
    send: send && { w: r(send).w, h: r(send).h, centerY: +((r(send).t + r(send).b) / 2).toFixed(1) },
    inputCenterY: +((r(ta).t + r(ta).b) / 2).toFixed(1),
    sidebar: (() => { const s = document.querySelector('#sidebar'); const b = r(s); const st = getComputedStyle(s); return { ...b, visibility: st.visibility, display: st.display } })(),
    openNav: (() => { const b = document.querySelector('#openNav'); if (!b || getComputedStyle(b).display === 'none') return null; const x = r(b); return { w: x.w, h: x.h } })(),
  }
}

const result = {}
for (const v of VIEWS) {
  const ctx = await browser.newContext(v)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(url)
  await page.waitForTimeout(600)
  const scrollToEnd = () => page.evaluate(() => { let s = document.querySelector('.msg').parentElement; while (s && !/(auto|scroll)/.test(getComputedStyle(s).overflowY)) s = s.parentElement; (s || document.scrollingElement).scrollTop = 1e9 })
  await scrollToEnd()
  await page.waitForTimeout(200)
  const m = await page.evaluate(measure)
  m.lastMsgToComposer = await page.evaluate(() => { const ms = [...document.querySelectorAll('.msg')]; return +(document.querySelector('.composer').getBoundingClientRect().top - ms[ms.length - 1].getBoundingClientRect().bottom).toFixed(1) })
  await page.screenshot({ path: out.replace('.json', `-${v.name}.png`) })

  // 输入框自动增高：输入 12 行，再清空
  await page.click('#input')
  for (let i = 0; i < 12; i++) { await page.keyboard.type(`第 ${i + 1} 行`); if (i < 11) await page.keyboard.press('Shift+Enter') }
  m.grow = await page.evaluate(() => { const t = document.querySelector('#input'); const s = document.querySelector('.composer button[type=submit], #send, .send'); const tb = t.getBoundingClientRect(), sb = s.getBoundingClientRect(); return { h: +tb.height.toFixed(1), innerScroll: t.scrollHeight > t.clientHeight, sendBottomGap: +(tb.bottom - sb.bottom).toFixed(1), sendTopGap: +(sb.top - tb.top).toFixed(1) } })
  await page.screenshot({ path: out.replace('.json', `-${v.name}-grow.png`) })
  await page.fill('#input', '')
  await page.dispatchEvent('#input', 'input')
  m.shrinkH = await page.evaluate(() => +document.querySelector('#input').getBoundingClientRect().height.toFixed(1))

  // 用户往上翻时 AI 回复到达：会不会被拽回底部
  await page.fill('#input', '再解释一下')
  await page.dispatchEvent('#input', 'input')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  await page.evaluate(() => { let s = document.querySelector('.msg').parentElement; while (s && !/(auto|scroll)/.test(getComputedStyle(s).overflowY)) s = s.parentElement; s.scrollTop = 0 })
  await page.waitForTimeout(6000)
  m.yank = await page.evaluate(() => { let s = document.querySelector('.msg').parentElement; while (s && !/(auto|scroll)/.test(getComputedStyle(s).overflowY)) s = s.parentElement; return { scrollTop: Math.round(s.scrollTop), max: s.scrollHeight - s.clientHeight } })

  // 手机：打开抽屉
  if (m.openNav) {
    await page.click('#openNav')
    await page.waitForTimeout(500)
    m.drawer = await page.evaluate(() => { const s = document.querySelector('#sidebar').getBoundingClientRect(); const a = document.activeElement; return { l: +s.left.toFixed(1), w: +s.width.toFixed(1), focusInside: document.querySelector('#sidebar').contains(a), focus: a.id || a.className, bodyOverflow: getComputedStyle(document.body).overflow } })
    await page.screenshot({ path: out.replace('.json', `-${v.name}-drawer.png`) })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    m.drawerAfterEsc = await page.evaluate(() => +document.querySelector('#sidebar').getBoundingClientRect().left.toFixed(1))
  }
  m.errors = errors
  result[v.name] = m
  await ctx.close()
}
fs.writeFileSync(out, JSON.stringify(result, null, 2))
await browser.close()
