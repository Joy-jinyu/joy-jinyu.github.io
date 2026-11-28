// 检查文章附录 yaml 里每条 source：lab: 路径用 jq -e 查字段存在且不为 null（值为 false 也算存在），hig: 片段用 rg -F 先在 HIG 纯文本里查，查不到再查原始 JSON（系统色值只在图片 alt 里）。
// 用法（仓库根目录）：node blog/public/lab/macos/probe/check-sources.mjs <文章.mdx> <HIG 纯文本目录>
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { parse } from 'yaml'
const [mdx, higDir] = process.argv.slice(2)
const text = readFileSync(mdx, 'utf8')
const m = text.match(/```yaml title="[^"]+\.rules\.yaml"\n([\s\S]*?)\n```/)
const rules = parse(m[1])
let fail = 0, total = 0
for (const r of rules) {
  for (const src of String(r.source).split(' ｜ ')) {
    total++
    let ok = false, how = ''
    const lab = src.match(/^lab:(\S+?)#(.+)$/)
    const hig = src.match(/^hig:(\S+) "(.+)"$/)
    try {
      if (lab) {
        execFileSync('jq', ['-e', `(${lab[2]}) != null`, `blog/public/lab/${lab[1]}`], { stdio: 'pipe' }); ok = true; how = 'jq'
      } else if (hig) {
        try { execFileSync('rg', ['-q', '-F', hig[2], `${higDir}/${hig[1]}.md`]); how = 'rg' }
        catch { execFileSync('rg', ['-q', '-F', hig[2], `${higDir}/${hig[1]}.json`]); how = 'rg(json，图片 alt 等)' }
        ok = true
      } else how = '格式不对'
    } catch { how = lab ? 'jq 无此字段' : 'rg 没命中' }
    if (!ok) fail++
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${r.id} ${how} ${src}`)
  }
}
console.log(`${rules.length} 条规则，${total} 个 source，失败 ${fail}`)
process.exit(fail ? 1 : 0)
