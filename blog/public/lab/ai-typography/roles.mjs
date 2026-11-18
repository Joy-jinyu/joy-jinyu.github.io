/**
 * 按文案把 type-probe.mjs 的样式清单归到角色上（三份页面文案相同，所以能按字认出谁是谁），
 * 输出每份页面每个角色的字号、字重、颜色、对比度，以及全页用了几种字号。
 * 用法：node roles.mjs <输出 json> <probe json>...
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [out, ...inputs] = process.argv.slice(2)
const norm = (t) => t.replace(/\s+/g, '')
const ROLES = [
  ['nav', '导航标题', (t, s) => t === '版本更新' && s.y < 120],
  ['version', '版本号', (t) => /^(v|版本)?3\.9\.0$/.test(t)],
  ['meta', '日期和大小', (t) => /2026年?10月?28日?|86\.4MB/.test(t)],
  ['lead', '导语', (t) => t.startsWith('这次更新重做了')],
  ['group', '分组标题', (t) => ['新功能', '体验优化', '问题修复'].includes(t)],
  ['title', '条目标题', (t) => ['断点续传', '链接有效期', '支持AirDrop'].includes(t)],
  ['desc', '条目说明', (t) => ['上传中断后', '分享链接可以选', '在iPhone和Mac之间'].some((p) => t.startsWith(p))],
  ['item', '列表条目', (t) => ['文件列表的加载速度', '搜索支持拼音首字母', '深色模式下', '修复了在iOS', '修复了文件名'].some((p) => t.startsWith(p))],
  ['notice', '提示框', (t) => t.includes('不再支持iOS15')],
  ['hint', '按钮上方小字', (t) => t.startsWith('更新约需')],
  ['button', '按钮', (t) => t === '立即更新'],
]

const pages = inputs.map((f) => {
  const d = JSON.parse(readFileSync(f, 'utf8'))
  const roles = {}
  const other = []
  for (const s of d.styles) {
    const t = norm(s.text)
    const hit = ROLES.find(([, , test]) => test(t, s))
    if (!hit) { other.push(`${s.sel}「${s.text.slice(0, 12)}」${s.fs}/${s.fw}`); continue }
    const [key, label] = hit
    const st = { fs: s.fs, fw: s.fw, color: s.color, contrast: s.contrast, lh: s.lh, ls: s.ls }
    const prev = roles[key]
    // 同一角色出现多次时，样式不一致要记下来
    if (!prev) roles[key] = { label, ...st, n: 1 }
    else { prev.n++; if (prev.fs !== st.fs || prev.fw !== st.fw || prev.color !== st.color) prev.mixed = true }
  }
  const sizes = [...new Set(d.styles.map((s) => s.fs))].sort((a, b) => a - b)
  return { file: d.file, sizes, roles, other }
})
writeFileSync(out, JSON.stringify(pages, null, 1))
for (const p of pages) {
  console.log(`== ${p.file}：${p.sizes.length} 种字号 ${p.sizes.join(' / ')}`)
  for (const r of Object.values(p.roles)) console.log(`  ${r.label.padEnd(6, '　')} ${r.fs}px ${r.fw} ${r.color} 对比度 ${r.contrast}${r.mixed ? ' （同角色样式不一）' : ''}  ×${r.n}`)
  if (p.other.length) console.log('  未归类：' + p.other.join('；'))
}
