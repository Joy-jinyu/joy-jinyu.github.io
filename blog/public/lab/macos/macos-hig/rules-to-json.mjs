// 把系列 8 篇附录里的 <slug>.rules.yaml 抽成一个 JSON。
// 用法（仓库根目录）：node blog/public/lab/macos/macos-hig/rules-to-json.mjs > blog/public/lab/macos/rules.json
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

const POSTS = ['windows', 'sidebar-toolbar', 'menus', 'pointer-focus', 'controls', 'type-color', 'presentation', 'feedback']
const rules = []
const posts = {}
for (const name of POSTS) {
  const slug = `macos-${name}`
  const text = readFileSync(`blog/src/content/posts/${slug}.mdx`, 'utf8')
  const m = text.match(/```yaml title="([^"]+)\.rules\.yaml"\n([\s\S]*?)\n```/)
  if (!m || m[1] !== slug) throw new Error(`${slug}: 没找到 ${slug}.rules.yaml`)
  const list = parse(m[2])
  posts[slug] = list.length
  for (const r of list) {
    rules.push({
      ...r,
      source: String(r.source).split(' ｜ '),
      post: `/blog/${slug}/`,
    })
  }
}
console.log(JSON.stringify({ total: rules.length, posts, rules }, null, 2))
