// 对话页布局检查：对齐、常显滚动条、往上翻时会不会被拽回底部、抽屉焦点、输入框字号和发送按钮大小。
// 用法：node layout-check.mjs <文件或 URL> [--message .msg] [--column 选择器] [--composer .composer]
//        [--input textarea] [--drawer aside] [--open '[aria-controls][aria-expanded]'] [--wait 6000] [--json]
// 依赖 playwright-core（npm i playwright-core）。CHROME_PATH 指向本机 Chrome，默认是 macOS 的安装路径。
// 结果：✓ 通过、✗ 不通过、? 没测成（比如发送后没有新内容）；有 ✗ 或 ? 时退出码为 1。
// 「被拽回底部」一项要求页面发送消息后自己产生回复（演示页用定时器模拟）；真实应用需要接好后端再测。
import { chromium } from 'playwright-core'
import path from 'node:path'

const argv = process.argv.slice(2)
const BOOL = ['json']
const flag = (name, def) => { const i = argv.indexOf('--' + name); return i < 0 ? def : argv[i + 1] }
const target = argv.find((a, i) => !a.startsWith('--') && !(argv[i - 1]?.startsWith('--') && !BOOL.includes(argv[i - 1].slice(2))))
if (!target) { console.error('用法：node layout-check.mjs <文件或 URL> [选项]'); process.exit(2) }
const url = /^https?:|^file:/.test(target) ? target : 'file://' + path.resolve(target)
const sel = {
  message: flag('message', '.msg'),
  column: flag('column', null),
  composer: flag('composer', '.composer'),
  input: flag('input', 'textarea'),
  drawer: flag('drawer', 'aside'),
  open: flag('open', '[aria-controls][aria-expanded]'),
}
const WAIT = Number(flag('wait', 6000))
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
// 0.5px 以内算对齐：小数像素取整后肉眼看不出
const TOL = 0.5
const DESK = [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }

/** 注入页面的取值函数，挂在 window.__lc 上 */
function helpers(sel) {
  const column = () => sel.column ? document.querySelector(sel.column) : document.querySelector(sel.message)?.parentElement
  // 只看纵向真能滚的那一层：overflow-x: hidden 也会把计算后的 overflow-y 变成 auto
  const scroller = () => {
    for (let s = column(); s; s = s.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(s).overflowY) && s.scrollHeight > s.clientHeight) return s
    }
    return document.scrollingElement
  }
  const offscreen = (el) => { const b = el.getBoundingClientRect(); return b.right <= 0 || b.left >= innerWidth }
  const name = (el) => el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.textContent.trim() ? ` "${el.textContent.trim().slice(0, 10)}"` : '')
  window.__lc = {
    scroller,
    column,
    geometry() {
      const colEl = column(), comp = document.querySelector(sel.composer)
      if (!colEl || !comp) return { error: `找不到${!colEl ? '消息列' : '输入框'}` }
      const sc = scroller()
      const cs = getComputedStyle(colEl), c = colEl.getBoundingClientRect(), k = comp.getBoundingClientRect()
      const l = c.left + parseFloat(cs.paddingLeft), r = c.right - parseFloat(cs.paddingRight)
      const f = (v) => +v.toFixed(1)
      return {
        left: f(k.left - l), right: f(k.right - r), center: f((k.left + k.right) / 2 - (l + r) / 2),
        scrollbar: sc === document.scrollingElement ? innerWidth - document.documentElement.clientWidth : sc.offsetWidth - sc.clientWidth,
      }
    },
    gap: () => { const s = scroller(); return Math.round(s.scrollHeight - s.scrollTop - s.clientHeight) },
    count: () => document.querySelectorAll(sel.message).length,
    /** 抽屉收起时，还能被 Tab 到、但整个落在视口左右两侧之外的元素 */
    offscreenTabbables() {
      const q = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]'
      return [...document.querySelectorAll(q)].filter((el) => {
        if (el.tabIndex < 0 || el.disabled || el.closest('[inert]')) return false
        if (!el.checkVisibility({ visibilityProperty: true })) return false
        return el.getBoundingClientRect().width > 0 && offscreen(el)
      }).map(name)
    },
    activeOffscreen: () => offscreen(document.activeElement),
    activeInDrawer: () => !!document.querySelector(sel.drawer)?.contains(document.activeElement),
    // 焦点停在 body 上，说明已经离开页面到了浏览器自己的界面（地址栏等），不算落到抽屉后面
    activeBehindDrawer: () => document.activeElement !== document.body && !document.querySelector(sel.drawer)?.contains(document.activeElement),
    activeName: () => name(document.activeElement),
    drawerShut() { const el = document.querySelector(sel.drawer); return offscreen(el) || !el.checkVisibility({ visibilityProperty: true }) },
    sendButton() { const c = document.querySelector(sel.composer); return c?.querySelector('button[type=submit]') || [...(c?.querySelectorAll('button') || [])].pop() || null },
  }
}

const results = []
const add = (id, label, pass, detail) => results.push({ id, label, pass, detail })

const launch = (classic) => chromium.launch(classic
  // 无头 Chrome 默认隐藏滚动条；关掉 overlay 滚动条后是常显滚动条，和 Windows 上一样占宽度
  ? { executablePath: chrome, args: ['--disable-features=OverlayScrollbar'], ignoreDefaultArgs: ['--hide-scrollbars'] }
  : { executablePath: chrome })
const open = async (browser, ctxOpts) => {
  const ctx = await browser.newContext(ctxOpts)
  await ctx.addInitScript(helpers, sel)
  const page = await ctx.newPage()
  await page.goto(url)
  await page.waitForTimeout(500)
  return { ctx, page, lc: (fn, ...a) => page.evaluate(([fn, a]) => window.__lc[fn](...a), [fn, a]) }
}

const browser = await launch(false)

// 1. 消息列和输入框左右边是否对齐（默认 overlay 滚动条）
for (const opts of [...DESK.map((viewport) => ({ viewport })), PHONE]) {
  const { ctx, lc } = await open(browser, opts)
  const g = await lc('geometry')
  const label = `${opts.viewport.width} 宽：左右边对齐`
  if (g.error) add('align', label, false, g.error)
  else add('align', label, Math.abs(g.left) <= TOL && Math.abs(g.right) <= TOL, `输入框左边 ${g.left > 0 ? '+' : ''}${g.left}px，右边 ${g.right > 0 ? '+' : ''}${g.right}px（负数表示比消息列宽）`)
  await ctx.close()
}

// 3. 刚发送时应该跟到底部；用户往上翻着看时，回复到达不该把人拽回底部
{
  const { ctx, page, lc } = await open(browser, { viewport: DESK[0] })
  await page.evaluate(() => { window.__lc.scroller().scrollTop = 1e9 })
  const before = await lc('count')
  await page.fill(sel.input, '再解释一下')
  const btn = await page.evaluateHandle(() => window.__lc.sendButton())
  if (btn.asElement()) await btn.asElement().click()
  else await page.press(sel.input, 'Enter')
  // 等自己的消息出现、页面跟到底部，最多 1 秒；回复可能很快就开始，所以一跟到底就往上翻
  let sent = false, gap = null
  for (let t = 0; t < 1000 && !(sent && gap <= 10); t += 50) {
    await page.waitForTimeout(50)
    sent = (await lc('count')) > before
    gap = await lc('gap')
  }
  add('follow', '刚发送：跟到底部', sent ? gap <= 10 : null, sent ? `离底部 ${gap}px` : `发送后没有新消息（找的是 ${sel.message}）`)
  // 回复短的话，「正在输入」换成文字后总高度可能不变；时间戳之类的小变化也不算，所以看消息条数或文字长度
  const mark = await page.evaluate(() => { window.__lc.scroller().scrollTop = 0; return [window.__lc.count(), window.__lc.column().textContent.length] })
  await page.waitForTimeout(WAIT)
  const grew = await page.evaluate(([c, len]) => window.__lc.count() > c || window.__lc.column().textContent.length - len >= 2, mark)
  const top = await page.evaluate(() => Math.round(window.__lc.scroller().scrollTop))
  add('stay', '往上翻时：回复到达不拽回底部', grew ? top <= 50 : null, grew ? `翻到顶部 ${WAIT}ms 后 scrollTop = ${top}px` : `${WAIT}ms 内没有新内容，没测成`)
  await ctx.close()
}

// 4. 手机宽度：收起的抽屉不能被 Tab 到；打开时焦点移进去、Tab 不出抽屉；Esc 关闭后焦点回到按钮
{
  const { ctx, page, lc } = await open(browser, PHONE)
  const off = await lc('offscreenTabbables')
  add('drawer-hidden', '收起的抽屉：屏幕外没有可 Tab 的元素', off.length === 0, off.length ? `${off.length} 个：${off.slice(0, 4).join('、')}${off.length > 4 ? '…' : ''}` : '0 个')
  let landed = 0
  for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); if (await lc('activeOffscreen')) landed++ }
  add('drawer-tab', '收起的抽屉：连按 25 次 Tab 不落到屏幕外', landed === 0, `${landed} 次落在屏幕外`)
  const opener = await page.$(`${sel.open}:visible`)
  if (!opener) {
    for (const [id, label] of [['drawer-open', '打开抽屉：焦点移进抽屉'], ['drawer-trap', '抽屉打开时：连按 30 次 Tab 不落到抽屉后面'], ['drawer-esc', 'Esc：关闭抽屉，焦点回到打开按钮']]) add(id, label, null, `找不到可见的打开按钮 ${sel.open}`)
  } else {
    await opener.click()
    await page.waitForTimeout(500)
    const inside = await lc('activeInDrawer')
    add('drawer-open', '打开抽屉：焦点移进抽屉', inside, inside ? '在抽屉里' : `焦点在 ${await lc('activeName')}`)
    let out = 0
    for (let i = 0; i < 30; i++) { await page.keyboard.press('Tab'); if (await lc('activeBehindDrawer')) out++ }
    add('drawer-trap', '抽屉打开时：连按 30 次 Tab 不落到抽屉后面', out === 0, `${out} 次落到抽屉后面的页面上`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    const back = await opener.evaluate((el) => el === document.activeElement)
    const shut = await lc('drawerShut')
    add('drawer-esc', 'Esc：关闭抽屉，焦点回到打开按钮', back && shut, `${shut ? '已关闭' : '没关上'}，焦点${back ? '回到了按钮' : `在 ${await lc('activeName')}`}`)
  }

  // 5. 输入框字号（iOS 小于 16px 会放大页面）和发送按钮的点击区域（WCAG 2.5.8 至少 24×24）
  const m = await page.evaluate((input) => {
    const b = window.__lc.sendButton()?.getBoundingClientRect()
    return { font: parseFloat(getComputedStyle(document.querySelector(input)).fontSize), btn: b && [Math.round(b.width), Math.round(b.height)] }
  }, sel.input)
  add('input-font', '手机上输入框字号 ≥ 16px', m.font >= 16, `${m.font}px`)
  add('target', '发送按钮 ≥ 24×24', !!m.btn && m.btn[0] >= 24 && m.btn[1] >= 24, m.btn ? `${m.btn[0]}×${m.btn[1]}` : '找不到按钮')
  await ctx.close()
}
await browser.close()

// 2. 常显滚动条（Windows、macOS 设成「始终显示」）：消息列和输入框的中线是否一致
{
  const classic = await launch(true)
  for (const viewport of DESK) {
    const { lc } = await open(classic, { viewport })
    const g = await lc('geometry')
    add('scrollbar', `常显滚动条，${viewport.width} 宽：中线一致`, !g.error && Math.abs(g.center) <= TOL, g.error || `滚动条 ${g.scrollbar}px，中线差 ${g.center}px`)
  }
  await classic.close()
}

const order = ['align', 'scrollbar', 'follow', 'stay', 'drawer-hidden', 'drawer-tab', 'drawer-open', 'drawer-trap', 'drawer-esc', 'input-font', 'target']
results.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
const bad = results.filter((r) => r.pass !== true)
if (argv.includes('--json')) console.log(JSON.stringify({ url, results }, null, 2))
else {
  console.log(url)
  for (const r of results) console.log(`${r.pass === true ? '✓' : r.pass === false ? '✗' : '?'} ${r.label}  ${r.detail}`)
  const fail = bad.filter((r) => r.pass === false).length, unknown = bad.length - fail
  console.log(bad.length ? [fail && `${fail} 项不通过`, unknown && `${unknown} 项没测成`].filter(Boolean).join('，') : '全部通过')
}
process.exit(bad.length ? 1 : 0)
