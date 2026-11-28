/**
 * H5 探针：按 iPhone 15 的尺寸和安全区（竖屏 393×852，上 59、下 34；横屏 852×393，左右 59、下 21），
 * 量每个可点元素的大小、有没有落进安全区以外、按下时有没有可见变化、点过以后会不会停在悬停态，
 * 以及常驻栏占了多少高度、输入框的字号。安全区用 CDP 的 Emulation.setSafeAreaInsetsOverride 模拟。
 * 用法：node h5-probe.mjs <页面 URL> <输出 json> <截图前缀>
 * 依赖 playwright-core 和本机 Chrome（CHROME_PATH 可覆盖）。
 */
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'

const [url, out, shot] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const result = { url }

async function open(w, h, insets) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets })
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForTimeout(500)
  return { ctx, page, cdp }
}

/** 可点元素：位置、大小、名字；以及固定在顶部 / 底部的栏 */
const layout = (page, insets) => page.evaluate((ins) => {
  const W = innerWidth, H = innerHeight
  const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 16)
  const controls = [...document.querySelectorAll('button, a[href], input, textarea, [role="button"]')].filter((el) => el.getBoundingClientRect().width > 0).map((el) => {
    const r = el.getBoundingClientRect()
    const out = []
    if (r.left < (ins.left ?? 0) - 0.5) out.push(`左边进了安全区 ${Math.round((ins.left ?? 0) - r.left)}px`)
    if (r.right > W - (ins.right ?? 0) + 0.5) out.push(`右边进了安全区 ${Math.round(r.right - (W - (ins.right ?? 0)))}px`)
    if (r.top < (ins.top ?? 0) - 0.5 && r.bottom > 0) out.push(`上边进了安全区`)
    if (r.bottom > H - (ins.bottom ?? 0) + 0.5 && r.top < H) out.push(`下边进了安全区`)
    return { tag: el.tagName.toLowerCase(), name: name(el), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, out, fs: parseFloat(getComputedStyle(el).fontSize) }
  })
  const bars = [...document.querySelectorAll('body *')].filter((el) => {
    const cs = getComputedStyle(el)
    return (cs.position === 'fixed' || cs.position === 'sticky') && el.getBoundingClientRect().height > 20 && el.getBoundingClientRect().width > W * 0.8
  }).map((el) => { const r = el.getBoundingClientRect(); return { tag: el.tagName.toLowerCase(), cls: String(el.className).split(' ')[0], top: Math.round(r.top), h: Math.round(r.height), pt: getComputedStyle(el).paddingTop, pb: getComputedStyle(el).paddingBottom, pl: getComputedStyle(el).paddingLeft, pr: getComputedStyle(el).paddingRight } })
  return { W, H, controls, bars, barShare: Math.round((bars.reduce((s, b) => s + b.h, 0) / H) * 1000) / 10 }
}, insets)

// 竖屏
{
  const ins = { top: 59, bottom: 34, left: 0, right: 0 }
  const { ctx, page, cdp } = await open(393, 852, ins)
  result.portrait = await layout(page, ins)
  await page.screenshot({ path: `${shot}-portrait.png` })

  // 按下态：用 CDP 强制 :active，比较按下前后的背景、文字色、透明度、缩放、滤镜
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
  const handles = await page.$$('button, a[href], [role="button"]')
  const pressed = []
  for (const h of handles) {
    if (!(await h.isVisible())) continue
    const look = () => h.evaluate((el) => { const cs = getComputedStyle(el); const i = el.querySelector('svg'); return [cs.backgroundColor, cs.color, cs.opacity, cs.transform, cs.filter, cs.boxShadow, i ? getComputedStyle(i).transform : ''].join(' | ') })
    // 用 data 属性定位节点，再拿 nodeId
    await h.evaluate((el, i) => el.setAttribute('data-probe', i), pressed.length)
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-probe="${pressed.length}"]` })
    const before = await look()
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] })
    const during = await look()
    await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })
    const name = await h.evaluate((el) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 16))
    const disabled = await h.evaluate((el) => el.disabled === true)
    pressed.push({ name, disabled, changes: before !== during, before, during })
  }
  result.pressed = pressed

  // 点过以后：轻点每个按钮（发送除外），读点之前和点之后的背景色、是否匹配 :hover
  const taps = []
  for (const h of await page.$$('button:not([disabled]), [role="button"]')) {
    if (!(await h.isVisible())) continue
    const name = await h.evaluate((el) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 16))
    if (/返回|分享|更多|下载|重命名|移动/.test(name)) continue // 这些会弹提示或跳走，只测收藏和点赞
    const st = () => h.evaluate((el) => [getComputedStyle(el).backgroundColor, el.matches(':hover')])
    const before = await st()
    await h.tap(); await page.waitForTimeout(400)
    taps.push({ name, before, after: await st() })
  }
  result.taps = taps
  result.input = await page.evaluate(() => { const i = document.querySelector('input, textarea'); const cs = getComputedStyle(i); return { fs: parseFloat(cs.fontSize), h: i.getBoundingClientRect().height } })
  result.code = await page.evaluate(() => {
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n')
    const js = [...document.querySelectorAll('script')].map((s) => s.textContent).join('\n')
    const meta = document.querySelector('meta[name="viewport"]')?.content ?? ''
    return {
      viewport: meta,
      insets: [...new Set(css.match(/safe-area-inset-(top|right|bottom|left)/g) ?? [])],
      visualViewport: /visualViewport/.test(js),
      interactiveWidget: /interactive-widget/.test(meta),
      hoverOutsideMedia: /:hover/.test(css.replace(/@media\s*\(hover:\s*hover\)\s*\{[\s\S]*?\}\s*\}/g, '')),
      tapHighlight: (css.match(/-webkit-tap-highlight-color\s*:\s*([^;]+)/) ?? [])[1] ?? null,
      touchAction: (css.match(/touch-action\s*:\s*([^;]+)/) ?? [])[1] ?? null,
    }
  })
  await ctx.close()
}

// 横屏
{
  const ins = { top: 0, bottom: 21, left: 59, right: 59 }
  const { ctx, page } = await open(852, 393, ins)
  result.landscape = await layout(page, ins)
  await page.screenshot({ path: `${shot}-landscape.png` })
  await ctx.close()
}

writeFileSync(out, JSON.stringify(result, null, 1))
await browser.close()
