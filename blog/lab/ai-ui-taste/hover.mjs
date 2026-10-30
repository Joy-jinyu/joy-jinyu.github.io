/**
 * 触屏悬停测试：模拟手机触屏，点「⋯」打开再关闭、点两个主按钮、点菜单项后重新打开，读点之前和点之后的背景色。
 * 用法：node hover.mjs <html 文件>。依赖 playwright-core 和本机 Chrome（CHROME_PATH 可覆盖）
 */
import { chromium } from 'playwright-core'
import { resolve } from 'node:path'

const file = resolve(process.argv[2])
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
await page.goto('file://' + file)

/** 背景色、aria-expanded、是否匹配 :hover */
const state = (loc) => loc.evaluate((e) => [getComputedStyle(e).backgroundColor, e.getAttribute('aria-expanded'), e.matches(':hover')])
const more = page.locator('button.more')

const moreBefore = await state(more)
await more.tap(); await page.waitForTimeout(300)
await more.tap(); await page.waitForTimeout(400)
console.log('更多    ', 'before', JSON.stringify(moreBefore), 'after open+close', JSON.stringify(await state(more)))

for (const sel of ['.btn-primary', '.btn-secondary']) {
  const b = page.locator(sel)
  const before = await state(b)
  await b.tap(); await page.waitForTimeout(400)
  console.log(sel.padEnd(14), 'before', JSON.stringify(before), 'after tap', JSON.stringify(await state(b)))
}

await more.tap(); await page.waitForTimeout(300)
const item = page.locator('[role="menuitem"]').filter({ hasText: '复制链接' })
await item.tap(); await page.waitForTimeout(400)
await more.tap(); await page.waitForTimeout(400)
console.log('菜单项  ', 'after tap+reopen', JSON.stringify(await state(item)))
await browser.close()
