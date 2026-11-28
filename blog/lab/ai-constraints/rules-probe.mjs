/**
 * 规则探针：对一份「通知」页逐条检查 AGENTS.md 里能用机器判定的规则，输出每条的结果和读数。
 * 接口由脚本拦截后回复；安全区用 CDP 的 Emulation.setSafeAreaInsetsOverride 模拟。
 * 用法：node rules-probe.mjs <页面 URL（http）> <输出 json>；依赖 playwright-core 和本机 Chrome（CHROME_PATH 可覆盖）。
 */
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const [url, out] = process.argv.slice(2)
const NOTICES = readFileSync(fileURLToPath(new URL('./api/notices.json', import.meta.url)), 'utf8')
const TOKENS = ['#b65a3c', '#ffffff', '#f4f4f1', '#1c1c1a', '#5f5e59', '#e7e6e1', '#b42318', '#d97757', '#1a1a19', '#141413', '#1f1e1c', '#f0efea', '#a3a199', '#2f2e2b', '#f97066']
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const R = {}

/** list / post：'ok' | '500' | 'hang'；hang 永不回应 */
async function open({ list = 'ok', post = 'ok', w = 375, h = 812, scheme = 'light', insets } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  let listCalls = 0
  await page.route(/notices\.json/, (r) => {
    listCalls++
    const mode = typeof list === 'function' ? list(listCalls) : list
    if (mode === 'hang') return
    if (mode === '500') return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal"}' })
    return r.fulfill({ contentType: 'application/json', body: NOTICES })
  })
  await page.route(/notices\/(\d+\/read|read-all)/, (r) => {
    if (post === 'hang') return
    if (post === '500') return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal"}' })
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' })
  })
  if (insets) await (await ctx.newCDPSession(page)).send('Emulation.setSafeAreaInsetsOverride', { insets })
  await page.goto(url, { waitUntil: 'commit' })
  return { ctx, page, errors }
}
const text = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
/** 每半秒读一次页面文字：中途出现过报错就算走出来了（提示可能一闪而过），最后还停在「……中」就算卡住 */
async function watch(page, ms) {
  // 报错的说法各份不一样，这里尽量收全；判定以后再回源码核对过
  const ERR = /重试|失败|没能|超时|出错|没有加载|没加载|重新加载|再试|没有响应|没有回应/
  let firstError = null
  for (let t = 0; t <= ms; t += 500) {
    const tx = await text(page)
    if (firstError === null && ERR.test(tx)) firstError = { at: t / 1000, text: tx.match(new RegExp(`[^。]*(?:${ERR.source})[^。]*`))?.[0].slice(0, 60) }
    await sleep(500)
  }
  const end = await text(page)
  const busy = await page.evaluate(() => document.querySelectorAll('[aria-busy="true"]').length)
  return { firstError, stuck: /(加载|标记|处理|提交)中/.test(end) || busy > 0, end: end.slice(0, 160), escaped: firstError !== null && !/(加载|标记|处理|提交)中/.test(end) }
}
const focusOf = (page) => page.evaluate(() => { const a = document.activeElement; return a === document.body ? 'body' : `${a.tagName.toLowerCase()}「${(a.getAttribute('aria-label') || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 16)}」` })

// 一、静态检查：层级、autospace、text-box、颜色、对比度、悬停，浅色和深色各一次
for (const scheme of ['light', 'dark']) {
  const { ctx, page, errors } = await open({ scheme })
  await sleep(1200)
  R[scheme] = await page.evaluate((TOKENS) => {
    const hex = (c) => { const p = c.match(/[\d.]+/g); if (!p || (p[3] !== undefined && +p[3] === 0)) return null; return '#' + p.slice(0, 3).map((v) => Math.round(+v).toString(16).padStart(2, '0')).join('') }
    const lum = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0)
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; const p = b.match(/[\d.]+/g); if (p && (p[3] === undefined || +p[3] > 0.5)) return hex(b) } return '#ffffff' }
    const leaf = (re) => [...document.querySelectorAll('body *')].find((e) => [...e.childNodes].some((n) => n.nodeType === 3 && re.test(n.textContent)) && e.getBoundingClientRect().width > 1)
    const style = (el) => { if (!el) return null; const cs = getComputedStyle(el); return { fs: parseFloat(cs.fontSize), fw: cs.fontWeight, color: hex(cs.color), ls: cs.letterSpacing, tt: cs.textTransform } }
    const group = style(leaf(/^\s*今天\s*$/)), title = style(leaf(/林晓在/))
    const body = leaf(/营收同比/)
    const colors = new Set(), low = []
    let trimmed = 0
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
      if (r.width <= 1 || r.height <= 1 || cs.visibility === 'hidden' || cs.display === 'none') continue
      if (cs.textBoxTrim && cs.textBoxTrim !== 'none') trimmed++
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      if (own) {
        const fg = hex(cs.color), bg = bgOf(el)
        if (fg) { colors.add(fg); const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); const cr = (a + 0.05) / (b + 0.05); if (cr < 4.5) low.push(`${el.textContent.trim().slice(0, 10)} ${fg}/${bg} ${cr.toFixed(2)}`) }
      }
      for (const c of [cs.backgroundColor, ...['Top', 'Right', 'Bottom', 'Left'].filter((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none').map((s) => cs[`border${s}Color`])]) { const h = hex(c); if (h) colors.add(h) }
    }
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n')
    let rest = '', i = 0
    for (;;) { const m = css.slice(i).match(/@media[^{]*hover\s*:\s*hover[^{]*\{/); if (!m) { rest += css.slice(i); break } rest += css.slice(i, i + m.index); let j = i + m.index + m[0].length, d = 1; while (d) { d += css[j] === '{' ? 1 : css[j] === '}' ? -1 : 0; j++ } i = j }
    return {
      group, title,
      channels: group && title ? ['fw', 'color', 'ls', 'tt'].filter((k) => group[k] !== title[k]) : null,
      autospace: body ? getComputedStyle(body).textAutospace : null,
      trimmed,
      outside: [...colors].filter((c) => !TOKENS.includes(c)),
      lowContrast: low,
      bodyBg: hex(getComputedStyle(document.body).backgroundColor),
      hoverOutside: (rest.match(/:hover/g) ?? []).length,
      timeoutInCode: /AbortSignal\.timeout|AbortController/.test([...document.scripts].map((s) => s.textContent).join('\n')),
    }
  }, TOKENS)
  R[scheme].errors = errors
  await ctx.close()
}

// 二、列表请求挂起：22 秒内有没有报错、最后还在不在加载
{
  const { ctx, page } = await open({ list: 'hang' })
  R.listHang = await watch(page, 22000)
  await ctx.close()
}

// 三、标为已读的请求挂起：20 秒后有没有报错、有没有卡在「……中」
{
  const { ctx, page } = await open({ post: 'hang' })
  await sleep(1200)
  const item = page.locator('body *', { hasText: /林晓在/ }).last()
  await item.click().catch(() => {})
  R.readHang = await watch(page, 22000)
  await ctx.close()
}

// 四、重试以后焦点去哪：第一次 500，第二次成功
{
  const { ctx, page } = await open({ list: (n) => (n === 1 ? '500' : 'ok') })
  await sleep(1200)
  const retry = page.locator('button:visible', { hasText: /重试|重新加载|再试/ }).first()
  if (await retry.count()) {
    await retry.focus(); await page.keyboard.press('Enter'); await sleep(1500)
    const after = await focusOf(page)
    await page.keyboard.press('Tab')
    R.retryFocus = { after, nextTab: await focusOf(page), ok: after !== 'body' }
  } else R.retryFocus = { after: null, ok: false, note: '没有找到重试按钮', text: (await text(page)).slice(0, 160) }
  await ctx.close()
}

// 五、横屏安全区：可点元素有没有落进安全区以外
for (const [name, w, h, insets] of [['landscape', 852, 393, { top: 0, right: 59, bottom: 21, left: 59 }], ['portrait', 393, 852, { top: 59, right: 0, bottom: 34, left: 0 }]]) {
  const { ctx, page } = await open({ w, h, insets })
  await sleep(1200)
  R[name] = await page.evaluate((ins) => {
    const W = innerWidth, H = innerHeight
    const fixed = (el) => { for (let e = el; e; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return true } return false }
    return [...document.querySelectorAll('button, a[href], input, [role="button"]')].filter((el) => {
      const r = el.getBoundingClientRect()
      if (r.width < 2) return false
      return r.left < ins.left - 0.5 || r.right > W - ins.right + 0.5 || (fixed(el) && (r.top < ins.top - 0.5 || r.bottom > H - ins.bottom + 0.5))
    }).map((el) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 10))
  }, insets)
  await ctx.close()
}

writeFileSync(out, JSON.stringify(R, null, 1))
await browser.close()
