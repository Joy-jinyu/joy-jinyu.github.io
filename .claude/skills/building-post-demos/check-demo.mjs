/**
 * 博客演示组件的通用浏览器检查：深色 / 浅色 / 375px 截图、横向溢出、减少动态效果、控制台错误。
 * 用法：node check-demo.mjs <页面 URL> <组件选择器> <截图输出目录>
 * 依赖 playwright-core：仓库没装它，要把本文件复制到装了 playwright-core 的目录里运行。浏览器用本机 Chrome，路径不同时用 CHROME_PATH 覆盖。
 */
import { chromium } from 'playwright-core'

const [url, selector, out] = process.argv.slice(2)
if (!url || !selector || !out) {
  console.error('用法：node check-demo.mjs <页面 URL> <组件选择器> <截图输出目录>')
  process.exit(1)
}
const executablePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ executablePath })
const errors = []

async function open(name, options) {
  const page = await browser.newPage(options)
  page.on('pageerror', (e) => errors.push(`[${name}] ${e}`))
  // 资源加载失败用 response 记录（带 URL），console 里同一条「Failed to load resource」不再重复记
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(`[${name}] ${m.text()}`))
  page.on('response', (r) => r.status() >= 400 && errors.push(`[${name}] ${r.status()} ${r.url()}`))
  const res = await page.goto(url, { waitUntil: 'networkidle' })
  const demo = page.locator(selector).first()
  await demo.scrollIntoViewIfNeeded()
  return { page, demo, status: res?.status() }
}

for (const theme of ['dark', 'light']) {
  const { page, demo, status } = await open(theme, { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
  await demo.screenshot({ path: `${out}/demo-${theme}.png` })
  console.log(`${theme}: status ${status}`)
  await page.close()
}

const mobile = await open('mobile', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await mobile.demo.screenshot({ path: `${out}/demo-mobile.png` })
const [scrollWidth, innerWidth] = await mobile.page.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
console.log(`mobile: scrollWidth ${scrollWidth} / innerWidth ${innerWidth}${scrollWidth > innerWidth ? '  ← 有横向溢出' : ''}`)

const reduce = await open('reduce', { viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
const attrs = await reduce.demo.evaluate((el) => [...el.attributes].map((a) => a.name).join(' '))
console.log(`reduced-motion: 根元素属性 ${attrs}`)

console.log(errors.length ? `errors:\n${errors.join('\n')}` : 'errors: 无')
console.log(`截图在 ${out}/demo-{dark,light,mobile}.png，逐张看`)
await browser.close()
