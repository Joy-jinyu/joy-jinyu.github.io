/** 不同字体栈下 text-box: trim-both cap alphabetic 裁在哪、汉字墨迹冒出多少。用法：node textbox-stack.mjs；依赖 playwright-core 和本机 Chrome */
// text-box 按第一个可用字体的 cap 高裁：不同字体栈下，汉字墨迹相对裁剪后盒子的位置
import { chromium } from 'playwright-core'
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const p = await b.newPage({ viewport: { width: 600, height: 400 }, deviceScaleFactor: 2 })
const stacks = {
  'apple-system+PingFang': `-apple-system, 'PingFang SC', sans-serif`,
  'apple+Blink+PingFang': `-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif`,
  'system-ui': `system-ui, sans-serif`,
  'PingFang 在前': `'PingFang SC', -apple-system, sans-serif`,
  'Helvetica+PingFang': `'Helvetica Neue', 'PingFang SC', sans-serif`,
}
const rows = []
for (const [k, f] of Object.entries(stacks)) for (const fs of [13, 16, 20]) {
  await p.setContent(`<body style="margin:0;background:#fff"><p id=t style="margin:60px 20px;font:400 ${fs}px/1.4 ${f};color:#000;text-box:trim-both cap alphabetic">邮件摘要每周一早上</p><p id=u style="margin:0 20px;font:400 ${fs}px/1.4 ${f}">x</p></body>`)
  const r = await p.evaluate(() => { const q = document.getElementById('t').getBoundingClientRect(); return { y: q.top, h: q.height } })
  const buf = await p.screenshot({ clip: { x: 0, y: r.y - 20, width: 600, height: r.h + 40 } })
  const ink = await p.evaluate(async (b64) => { const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()); const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext('2d'); g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, bmp.width, bmp.height).data; let t = -1, bt = -1; for (let y = 0; y < bmp.height; y++) for (let x = 0; x < bmp.width; x++) { const i = (y * bmp.width + x) * 4; if (Math.min(d[i], d[i + 1], d[i + 2]) < 243) { if (t < 0) t = y; bt = y; break } } return { t, bt } }, buf.toString('base64'))
  const it = r.y - 20 + ink.t / 2, ib = r.y - 20 + (ink.bt + 1) / 2
  rows.push([k, fs, (r.h / fs).toFixed(3) + 'em', '上冒 ' + ((r.y - it) / fs).toFixed(3) + 'em', '下冒 ' + ((ib - r.y - r.h) / fs).toFixed(3) + 'em', `${(r.y - it).toFixed(1)}px / ${(ib - r.y - r.h).toFixed(1)}px`])
}
console.log(rows.map((r) => r.join('\t')).join('\n'))
await b.close()
