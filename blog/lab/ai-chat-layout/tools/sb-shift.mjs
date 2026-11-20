import { chromium } from 'playwright-core'
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--disable-features=OverlayScrollbar'], ignoreDefaultArgs: ['--hide-scrollbars'] })
const p = await b.newPage({ viewport: { width: 1280, height: 700 } })
for (const gutter of ['auto', 'stable']) {
  await p.setContent(`<style>html{scrollbar-gutter:${gutter}}body{margin:0}main{width:600px;margin:0 auto;height:2000px;background:#eee}</style><main></main>`)
  const a = await p.evaluate(() => document.querySelector('main').getBoundingClientRect().x)
  await p.evaluate(() => { document.documentElement.style.overflow = 'hidden' })
  const c = await p.evaluate(() => document.querySelector('main').getBoundingClientRect().x)
  console.log(`scrollbar-gutter:${gutter}  打开弹窗锁滚动前 x=${a}  锁滚动后 x=${c}  位移 ${c - a}px`)
}
await b.close()
