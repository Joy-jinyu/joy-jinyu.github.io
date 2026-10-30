/** 汉字、数字在行高 1.5 时上下各留多少空白（字体栈和三份 AI 页面一样：英文系统字体在前），以及 cap alphabetic 裁剪后冒出多少（像素扫描）。用法：node ink-metrics.mjs；依赖 playwright-core 和本机 Chrome */
// 中文、英文、数字的墨迹相对行盒、相对 text-box 裁剪后的盒子在哪（像素扫描）
import { chromium } from 'playwright-core'
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const p = await b.newPage({ viewport: { width: 600, height: 900 }, deviceScaleFactor: 2 })
const sizes = [12, 14, 16, 18, 20, 24]
const strs = { cjk: '邮件摘要登录设备', cjk2: '每周一早上点发送', digits: '8812 3390' }
const modes = { none: '', cap: 'text-box:trim-both cap alphabetic' }
const out = []
for (const [mk, mv] of Object.entries(modes)) for (const [sk, sv] of Object.entries(strs)) for (const fs of sizes) {
  await p.setContent(`<body style="margin:0;background:#fff"><p id=t style="margin:40px 20px;font:400 ${fs}px/1.5 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;color:#000;${mv}">${sv}</p></body>`)
  const r = await p.evaluate(() => { const q = document.getElementById('t').getBoundingClientRect(); return { y: q.top, h: q.height } })
  const buf = await p.screenshot({ clip: { x: 0, y: r.y - 20, width: 600, height: r.h + 40 } })
  const rows = await p.evaluate(async (b64) => { const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()); const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext('2d'); g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, bmp.width, bmp.height).data; let t = -1, bt = -1; for (let y = 0; y < bmp.height; y++) { for (let x = 0; x < bmp.width; x++) { if (Math.min(d[(y * bmp.width + x) * 4], d[(y * bmp.width + x) * 4 + 1], d[(y * bmp.width + x) * 4 + 2]) < 243) { if (t < 0) t = y; bt = y; break } } } return { t, bt } }, buf.toString('base64'))
  const inkTop = r.y - 20 + rows.t / 2, inkBot = r.y - 20 + (rows.bt + 1) / 2
  out.push({ mode: mk, str: sk, fs, boxH: r.h, overTop: +((r.y - inkTop) / fs).toFixed(3), overBot: +((inkBot - (r.y + r.h)) / fs).toFixed(3), inkH: +((inkBot - inkTop) / fs).toFixed(3), gapTopPx: +(inkTop - r.y).toFixed(1), gapBotPx: +(r.y + r.h - inkBot).toFixed(1) })
}
console.table(out.map((o) => ({ ...o })))
await b.close()
