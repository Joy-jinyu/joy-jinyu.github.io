import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'

const base = process.argv[2] ?? 'http://127.0.0.1:4400/blog/lab/ai-motion-taste/'
const out = process.argv[3] ?? '/tmp/motion-sample-results'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const results = { measuredAt: new Date().toISOString(), sampleDate: '2026-10-26', browser: browser.version(), runs: [] }
for (const run of [1, 2]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference', colorScheme: 'light' })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(new URL(`run${run}.html`, base).href)
  const trigger = page.locator('button[aria-haspopup]').first()
  const menuId = await trigger.getAttribute('aria-controls')
  if (!menuId) throw new Error(`run${run}: trigger lacks aria-controls; inspect selectors`)
  const menu = page.locator(`[id="${menuId}"]`)
  const states = []
  async function snapshot(label) {
    states.push(await menu.evaluate((element, label) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return { label, hidden: element.hidden, inert: element.inert, display: style.display, opacity: style.opacity, transform: style.transform, visibility: style.visibility, pointerEvents: style.pointerEvents, duration: style.transitionDuration, easing: style.transitionTimingFunction, animation: style.animationName, animationDuration: style.animationDuration, active: document.activeElement?.tagName === 'BODY' ? 'BODY' : document.activeElement?.textContent.trim(), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }
    }, label))
  }
  await snapshot('initial')
  await trigger.click()
  await page.waitForTimeout(350)
  await snapshot('open')
  await page.screenshot({ path: `${out}/run${run}-desktop.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(350)
  await snapshot('escape-closed')
  await trigger.evaluate(async (element) => {
    element.click()
    await new Promise((resolve) => setTimeout(resolve, 60))
    element.click()
    await new Promise((resolve) => setTimeout(resolve, 60))
    element.click()
  })
  await page.waitForTimeout(450)
  await snapshot('open-close-open')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(350)
  await trigger.click()
  await page.waitForTimeout(350)
  await snapshot('reduced-open')
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' })
  await page.screenshot({ path: `${out}/run${run}-dark.png` })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(350)
  await trigger.click()
  await page.waitForTimeout(350)
  await snapshot('mobile-open')
  await page.screenshot({ path: `${out}/run${run}-mobile.png` })
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(350)
  const trace = await trigger.evaluate(async (button) => {
    const menu = document.getElementById(button.getAttribute('aria-controls'))
    const frames = []
    const start = performance.now()
    const read = (event) => {
      const style = getComputedStyle(menu)
      frames.push({ ms: Math.round((performance.now() - start) * 10) / 10, event, opacity: Number(style.opacity), transform: style.transform, hidden: menu.hidden, inert: menu.inert, expanded: button.getAttribute('aria-expanded') })
    }
    button.click()
    read('open')
    let phase = 0
    while (performance.now() - start < 500) {
      await new Promise(requestAnimationFrame)
      read('frame')
      if (phase === 0 && performance.now() - start >= 60) {
        button.click(); read('close'); phase = 1
      } else if (phase === 1 && performance.now() - start >= 120) {
        button.click(); read('reopen'); phase = 2
      }
    }
    return frames
  })
  results.runs.push({ run, menuId, errors, dimensions, states, trace })
  await page.close()
}
await fs.writeFile(`${out}/measurements.json`, JSON.stringify(results, null, 2))
console.log(JSON.stringify(results))
await browser.close()
