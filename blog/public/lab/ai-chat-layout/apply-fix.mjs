// 把 fixes.json 里的修正套到原文件上，输出 runN-fixed.html：node apply-fix.mjs run2.html
import fs from 'node:fs'
import path from 'node:path'
const file = process.argv[2]
const n = path.basename(file).match(/run(\d)/)[1]
const fix = JSON.parse(fs.readFileSync(new URL('./fixes.json', import.meta.url)))[n]
let html = fs.readFileSync(file, 'utf8')
for (const { from, to } of fix.js) {
  if (!html.includes(from)) throw new Error(`run${n}: 找不到要替换的代码：${from.slice(0, 40)}`)
  html = html.replace(from, to)
}
html = html.replace('</head>', `<style data-fix>${fix.css}</style></head>`)
fs.writeFileSync(file.replace('.html', '-fixed.html'), html)
