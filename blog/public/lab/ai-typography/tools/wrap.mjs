/**
 * 中文段落的末行：同样的几段话，宽度从 300 到 430px 每 1px 排一次，比较 text-wrap: wrap 和 pretty
 * 有多少种宽度会让最后一行只剩一两个字（不算标点）。
 * 用法：node wrap.mjs <输出 txt>。依赖 playwright-core 和本机 Chrome（CHROME_PATH 可覆盖）。
 */
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'

const [out] = process.argv.slice(2)
const STACK = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", sans-serif'
const PARAS = [
  '这次更新重做了文件上传。用 Claude Code 上传的大文件（超过 2 GB）会自动分片，断网后能从断点继续，平均速度提升 35%。',
  '上传中断后，重新连上 Wi-Fi 会从中断的位置继续，不用从头再传。',
  '分享链接可以选“1 天”“7 天”或“永久”，过期后自动失效。',
  '在 iPhone 和 Mac 之间，可以直接把文件投送到团队空间。',
  '文件列表的加载速度提升约 2 倍，1 万个文件的文件夹也能在 1 秒内打开。',
  '修复了在 iOS 18 上偶尔无法预览 PDF 的问题。',
  '修复了文件名含有 emoji 时，下载后文件名乱码的问题。',
]
const FS = 15
const WIDTHS = Array.from({ length: 131 }, (_, i) => 300 + i)
const PUNCT = /[，。、：；！？“”‘’（）《》—…\s]/g

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const page = await browser.newPage({ viewport: { width: 600, height: 800 } })
await page.setContent(`<html lang="zh-CN"><body style="margin:0">${PARAS.map((t, i) => `<p id="p${i}" style='margin:0 0 20px;font:${FS}px/1.6 ${STACK}'>${t}</p>`).join('')}</body></html>`)
await page.evaluate(() => document.fonts.ready)

/** 返回每段在当前宽度下的最后一行（去掉标点后）有几个字 */
const lastLines = (mode, w) => page.evaluate(({ mode, w, n }) => {
  const res = []
  for (let i = 0; i < n; i++) {
    const p = document.getElementById('p' + i)
    p.style.width = w + 'px'
    p.style.textWrap = mode
    const node = p.firstChild
    const rg = document.createRange()
    let lastTop = -Infinity, line = ''
    for (let k = 0; k < node.data.length; k++) {
      rg.setStart(node, k); rg.setEnd(node, k + 1)
      const r = rg.getClientRects()[0]
      if (!r) continue
      if (r.top > lastTop + 2) { line = ''; lastTop = r.top }
      line += node.data[k]
    }
    res.push(line)
  }
  return res
}, { mode, w, n: PARAS.length })

const lines = [`Chrome ${browser.version()}，${FS}px，行高 1.6，宽度 ${WIDTHS[0]}–${WIDTHS.at(-1)}px 每 1px 一次，共 ${WIDTHS.length} 种宽度 × ${PARAS.length} 段`, '「短尾」= 最后一行去掉标点和空格后只剩 1–2 个字符']
const summary = {}
const samples = []
for (const mode of ['wrap', 'pretty']) {
  let short = 0, one = 0
  for (const w of WIDTHS) {
    const ls = await lastLines(mode, w)
    ls.forEach((l, i) => {
      const n = [...l.replace(PUNCT, '')].length
      if (n <= 2) { short++; if (mode === 'wrap' && samples.length < 12) samples.push(`${w}px 第${i + 1}段：「${l}」`) }
      if (n === 1) one++
    })
  }
  summary[mode] = { short, one }
  lines.push(`${mode}：短尾 ${short} 次（其中只剩 1 个字 ${one} 次），占 ${(short / (WIDTHS.length * PARAS.length) * 100).toFixed(1)}%`)
}
lines.push('', 'wrap 下的短尾举例：', ...samples)
writeFileSync(out, lines.join('\n') + '\n')
await browser.close()
console.log(lines.join('\n'))
