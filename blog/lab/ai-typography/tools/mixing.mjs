/**
 * 中英混排对照：同一句话换几种写法（不加空格 / 手敲空格 / text-autospace）和两种字体栈（英文字体在前 / 苹方在前），
 * 逐像素量汉字和西文之间看得见的空隙，再量引号、括号这些标点实际占多宽。
 * 用法：node mixing.mjs <输出 txt>。依赖 playwright-core 和本机 Chrome（CHROME_PATH 可覆盖）。
 * 空隙按墨迹算：截图后逐列找有颜色的像素，取前一个字的最右一列和后一个字的最左一列之差，换算成 em。
 */
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'

const [out] = process.argv.slice(2)
const FS = 40
const DPR = 2
const STACKS = {
  英文字体在前: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  苹方在前: '"PingFang SC", -apple-system, BlinkMacSystemFont, sans-serif',
}
const SENT = { none: '用Claude Code上传', space: '用 Claude Code 上传' }
const QUOTE = '可以选“1天”“7天”或“永久”，过期（超过2GB）。'

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const page = await browser.newPage({ viewport: { width: 1400, height: 400 }, deviceScaleFactor: DPR })
const lines = [`Chrome ${browser.version()}，${FS}px，空隙按墨迹逐像素量，单位 em`]

/** 把一行字放进页面，返回每个字符的盒子（CSS px）。style 用单引号：字体栈里有双引号 */
const render = async (text, css) => {
  await page.setContent(`<html lang="zh-CN"><body style="margin:0;background:#fff"><p id="t" style='margin:40px;font-size:${FS}px;line-height:1.5;color:#000;white-space:nowrap;${css}'>${text}</p></body></html>`)
  await page.evaluate(() => document.fonts.ready)
  return page.evaluate(() => {
    const n = document.getElementById('t').firstChild
    const rg = document.createRange()
    return [...n.data].map((ch, i) => { rg.setStart(n, i); rg.setEnd(n, i + 1); const r = rg.getBoundingClientRect(); return { ch, x: r.left, w: r.width, y: r.top, h: r.height } })
  })
}

/** 截图后按列找墨迹：返回 [x0, x1) 这段 CSS px 里每一列有没有墨迹 */
const inkCols = async (box) => {
  const buf = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.w, height: box.h } })
  const cols = await page.evaluate(async ({ b64 }) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width; c.height = img.height
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    const res = []
    for (let x = 0; x < c.width; x++) {
      let ink = false
      for (let y = 0; y < c.height && !ink; y++) if (d[(y * c.width + x) * 4] < 160) ink = true
      res.push(ink)
    }
    return res
  }, { b64: buf.toString('base64') })
  return cols
}

/** 量 a、b 两个字符之间看得见的空隙（em）：从 a 的盒子左边往右找 a 的最后一列墨迹，从 b 的盒子右边往左找 b 的第一列墨迹 */
const gapBetween = async (cs, i, j) => {
  const a = cs[i], b = cs[j]
  const box = { x: a.x, y: a.y, w: b.x + b.w - a.x, h: a.h }
  const cols = await inkCols(box)
  let ra = -1
  for (let x = 0; x < Math.round(a.w * DPR); x++) if (cols[x]) ra = x
  let lb = -1
  for (let x = Math.round((b.x - a.x) * DPR); x < cols.length; x++) if (cols[x]) { lb = x; break }
  return Math.round(((lb - ra - 1) / DPR / FS) * 1000) / 1000
}

for (const [sn, stack] of Object.entries(STACKS)) {
  lines.push(``, `== 字体栈：${sn}（${stack}）`)
  const variants = [
    ['不加空格', SENT.none, ''],
    ['手敲空格', SENT.space, ''],
    ['不加空格 + text-autospace: normal', SENT.none, 'text-autospace:normal;'],
    ['手敲空格 + text-autospace: normal', SENT.space, 'text-autospace:normal;'],
  ]
  for (const [vn, text, css] of variants) {
    const cs = await render(text, `font-family:${stack};${css}`)
    const iYong = cs.findIndex((c) => c.ch === '用')
    const iC = cs.findIndex((c) => c.ch === 'C')
    const iE = cs.findLastIndex((c) => c.ch === 'e')
    const iShang = cs.findIndex((c) => c.ch === '上')
    const g1 = await gapBetween(cs, iYong, iC)
    const g2 = await gapBetween(cs, iE, iShang)
    const sp = cs.find((c) => c.ch === ' ')
    lines.push(`${vn}：「用」到「C」${g1}，「e」到「上」${g2}${sp ? `；空格本身宽 ${Math.round((sp.w / FS) * 1000) / 1000}` : ''}`)
  }
  // 标点占多宽：盒子宽度（advance），单位 em
  for (const [vn, css] of [['默认', ''], ['text-spacing-trim: space-all', 'text-spacing-trim:space-all;']]) {
    const cs = await render(QUOTE, `font-family:${stack};${css}`)
    const pick = cs.filter((c) => '“”，（）。'.includes(c.ch)).map((c) => `${c.ch}${Math.round((c.w / FS) * 100) / 100}`)
    lines.push(`标点宽度（${vn}）：${pick.join(' ')}；整句 ${Math.round((cs.at(-1).x + cs.at(-1).w - cs[0].x) / FS * 100) / 100} em`)
  }
}

writeFileSync(out, lines.join('\n') + '\n')
await browser.close()
console.log(lines.join('\n'))
