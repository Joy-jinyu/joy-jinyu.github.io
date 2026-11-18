/**
 * 读者投稿 PR 的守门规则，由 .github/workflows/contrib-check.yml 的 guard 调用。
 * 用法：node check-contrib.mjs <pr-files.json> <PR head sha> <PR 作者 login>
 * 只用 git 把 PR 的文件当数据读，不执行 PR 里的任何东西；frontmatter 和正文都交给构建时同一套解析器，
 * 免得这里看到的和真正发布出去的不一样。真正的 XSS 防线是构建时的 contribSanitize，这里负责提前报给作者和审稿人。
 */
import { readFileSync, appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import sax from 'sax'
import { parseFrontmatter } from '@astrojs/internal-helpers/frontmatter'
import { markdownToHtml } from 'satteri'
import { isSafeUrl } from '../../blog/src/lib/satteri-prose.mjs'
import { allowedAttr, allowedElement, MAX_IMAGE_BYTES, MAX_SVG_BYTES, MAX_SVG_ELEMENTS, MAX_SVG_USE, MEDIA_DIR, MEDIA_FILE, sniffImage } from '../../blog/src/lib/contrib-media.mjs'

const [listPath, sha, prAuthor] = process.argv.slice(2)
if (!listPath || !/^[0-9a-f]{40}$/.test(sha ?? '') || !prAuthor) {
  console.error('用法：node check-contrib.mjs <pr-files.json> <sha> <author>')
  process.exit(2)
}

const ALLOWED_PATH = /^blog\/src\/content\/posts\/contrib\/[a-z0-9][a-z0-9-]*\.md$/
const MAX_IMAGES = 10
/** Mermaid 里用不着的写法：init 指令能改配置，click / href 能挂链接和回调，HTML 标签和 javascript: 都没有正经用途 */
const MERMAID_BANNED = [
  [/%%\{/, '%%{ 指令'],
  [/\bclick\b/i, 'click'],
  [/\bhref\b/i, 'href'],
  [/<\s*[a-z!/]/i, 'HTML 标签'],
  [/javascript\s*:/i, 'javascript:'],
]
/** 投稿能写的 frontmatter 字段；slug、draft 这类会影响路由或发布的字段一律不收 */
const ALLOWED_KEYS = new Set(['title', 'description', 'date', 'tags', 'column', 'author'])
const MAX_BYTES = 512 * 1024

const errors = []
const fail = (file, msg) => errors.push({ file, msg })
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 2 * MAX_BYTES })
const gitBytes = (...args) => execFileSync('git', args, { maxBuffer: 2 * MAX_IMAGE_BYTES })

/** 用 XML 解析器（和浏览器解析 SVG 一样）逐个元素、属性对白名单；DOCTYPE、实体、处理指令、CDATA 一律不收 */
function svgProblems(bytes) {
  const found = []
  let text
  try {
    // 只收 UTF-8：浏览器会按 XML 声明里的编码解码，和这里不一致就可能看到不同的内容
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return ['SVG 要用 UTF-8 编码']
  }
  const parser = sax.parser(true, { xmlns: false })
  let depth = 0
  let roots = 0
  let elements = 0
  let uses = 0
  parser.onerror = (err) => {
    found.push(`SVG 不是合法的 XML：${err.message.split('\n')[0]}`)
    parser.resume()
  }
  parser.ondoctype = () => found.push('SVG 里不能有 DOCTYPE')
  parser.onprocessinginstruction = (pi) => {
    if (pi.name !== 'xml') return found.push(`SVG 里不能有处理指令 ${pi.name}`)
    // 写了 encoding 就必须是带引号的 utf-8（没引号的写法浏览器怎么读不好说，一律不收）
    if (/encoding/i.test(pi.body) && !/encoding\s*=\s*(["'])utf-?8\1/i.test(pi.body)) found.push('SVG 只能声明 UTF-8 编码')
  }
  parser.oncdata = () => found.push('SVG 里不能有 CDATA')
  parser.onattribute = ({ name, value }) => {
    if (!allowedAttr(name, value)) found.push(`SVG 里不能有属性 ${name}="${String(value).slice(0, 30)}"`)
  }
  parser.onopentag = (node) => {
    // sax 遇到同名属性会悄悄丢掉后一个（不报错也不发事件），浏览器却可能用它：按标签原文数一遍属性名
    const raw = text.slice(parser.startTagPosition - 1, parser.position).replace(/"[^"]*"|'[^']*'/g, '""')
    const names = [...raw.matchAll(/\s([^\s=/>]+)\s*=/g)].map((m) => m[1])
    const dup = names.find((n, i) => names.indexOf(n) !== i)
    if (dup) found.push(`SVG 里同一个元素不能有重复的属性 ${dup}`)
    if (depth === 0 && ++roots > 1) found.push('SVG 只能有一个根元素')
    if (depth++ === 0 && node.name !== 'svg') found.push('SVG 的根元素必须是 svg')
    if (!allowedElement(node.name)) found.push(`SVG 里不能有 <${node.name}>`)
    if (++elements === MAX_SVG_ELEMENTS + 1) found.push('SVG 太复杂了')
    if (node.name === 'use' && ++uses === MAX_SVG_USE + 1) found.push('SVG 里的 <use> 太多了')
  }
  parser.onclosetag = () => depth--
  parser.write(text).close()
  return found
}

/** 投稿图片：只能新增，名字是内容哈希，格式按文件头认，SVG 过白名单 */
function checkImage(status, filename, sha) {
  const name = filename.slice(MEDIA_DIR.length + 1)
  if (status !== 'added') return fail(filename, '投稿图片只能新增，不能修改或删除')
  const [mode, type] = git('ls-tree', sha, '--', filename).split(/\s+/)
  if (mode !== '100644' || type !== 'blob') return fail(filename, '只接受普通文件')
  const size = Number(git('cat-file', '-s', `${sha}:${filename}`))
  const ext = name.split('.').pop()
  if (size > (ext === 'svg' ? MAX_SVG_BYTES : MAX_IMAGE_BYTES)) return fail(filename, '图片太大了')
  const bytes = gitBytes('show', `${sha}:${filename}`)
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16)
  if (`${hash}.${ext}` !== name) fail(filename, '图片文件名要是内容 sha256 的前 16 位（用站内编辑器插图会自动处理）')
  if (ext === 'svg') {
    for (const p of svgProblems(bytes)) fail(filename, p)
  } else if (sniffImage(bytes) !== ext) {
    fail(filename, `文件内容不是 ${ext} 图片`)
  }
}

/** 用构建时同一个解析器渲染一遍，收集会被 contribSanitize 清掉的东西 */
function findUnsafe(markdown) {
  const found = []
  const detector = {
    name: 'contrib-detect',
    raw(node) {
      found.push(`原始 HTML：${node.value.trim().slice(0, 40)}（发布时会被删掉，请改用 Markdown 语法）`)
    },
    element: [
      {
        filter: ['a', 'img'],
        visit(node) {
          const url = node.tagName === 'a' ? node.properties.href : node.properties.src
          if (url != null && !isSafeUrl(url)) found.push(`不安全的地址：${String(url).slice(0, 40)}（发布时会被删掉，链接只能用 http / https）`)
        },
      },
      {
        // Mermaid 图在文章页的沙箱里渲染；这里再挡掉用不着、又常被拿来绕过的写法，审稿时也一眼看得到
        filter: ['code'],
        visit(node) {
          if (!String(node.properties.className ?? '').includes('language-mermaid')) return
          const code = (node.children ?? []).map((c) => c.value ?? '').join('')
          const bad = MERMAID_BANNED.find(([re]) => re.test(code))
          if (bad) found.push(`Mermaid 图里不能用 ${bad[1]}`)
        },
      },
    ],
  }
  markdownToHtml(markdown, { hastPlugins: [detector] })
  return found
}

const files = JSON.parse(readFileSync(listPath, 'utf8'))
if (!Array.isArray(files) || files.length === 0) fail('', 'PR 里没有文件改动')

const images = files.filter((f) => f.filename.startsWith(`${MEDIA_DIR}/`))
if (images.length > MAX_IMAGES) fail('', `一篇投稿最多 ${MAX_IMAGES} 张图片`)
/** PR 里稿件正文的合集，用来确认每张图都被引用了 */
let posts = ''

for (const { status, filename, previous_filename: previous } of files) {
  if (filename.startsWith(`${MEDIA_DIR}/`) && MEDIA_FILE.test(filename.slice(MEDIA_DIR.length + 1))) {
    checkImage(status, filename, sha)
    continue
  }
  if (!ALLOWED_PATH.test(filename)) {
    fail(filename, `投稿只能改 blog/src/content/posts/contrib/ 下的 .md 文件（文件名只用小写字母、数字和连字符），以及新增 ${MEDIA_DIR}/ 下的图片`)
    continue
  }
  if (status !== 'added' && status !== 'modified') {
    fail(filename, `投稿不能删除、重命名或复制文件（状态 ${status}${previous ? `，原文件 ${previous}` : ''}）`)
    continue
  }
  const [mode, type] = git('ls-tree', sha, '--', filename).split(/\s+/)
  if (mode !== '100644' || type !== 'blob') {
    fail(filename, '只接受普通文本文件')
    continue
  }
  if (Number(git('cat-file', '-s', `${sha}:${filename}`)) > MAX_BYTES) {
    fail(filename, `文件超过 ${MAX_BYTES / 1024} KB`)
    continue
  }

  const text = git('show', `${sha}:${filename}`)
  let parsed
  try {
    parsed = parseFrontmatter(text)
  } catch (err) {
    fail(filename, `frontmatter 解析失败：${err.message.split('\n')[0]}`)
    continue
  }
  const { frontmatter: fm, rawFrontmatter, content } = parsed
  posts += content
  if (!rawFrontmatter) {
    fail(filename, '缺少 frontmatter')
    continue
  }
  const extra = Object.keys(fm).filter((k) => !ALLOWED_KEYS.has(k))
  if (extra.length) fail(filename, `frontmatter 只能有 ${[...ALLOWED_KEYS].join('、')}，多了 ${extra.join('、')}`)
  if (fm.column !== 'contrib') fail(filename, 'column 必须是 contrib')
  if (typeof fm.author !== 'string' || fm.author.toLowerCase() !== prAuthor.toLowerCase()) {
    fail(filename, `author 必须是提交 PR 的 GitHub 用户名 ${prAuthor}`)
  }

  for (const msg of findUnsafe(content)) fail(filename, msg)
}

if (images.length && !posts) fail('', '图片要和稿件一起提交')
for (const { filename } of images) {
  const name = filename.slice(MEDIA_DIR.length + 1)
  if (posts && !posts.includes(`/blog/contrib-images/${name}`)) fail(filename, '这张图片没有在稿件里用到')
}

/** GitHub 工作流命令的转义：文件名来自 PR，不转义就能伪造命令 */
const escData = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
const escProp = (s) => escData(s).replace(/:/g, '%3A').replace(/,/g, '%2C')

const summary = errors.length
  ? ['## 投稿检查未通过', '', ...errors.map((e) => `- ${e.file ? `\`${e.file.replace(/[`\n\r]/g, '?')}\`：` : ''}${e.msg.replace(/[\n\r]/g, ' ')}`)].join('\n')
  : '## 投稿检查通过'
for (const e of errors) console.log(`::error${e.file ? ` file=${escProp(e.file)}` : ''}::${escData(e.msg)}`)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n')
process.exit(errors.length ? 1 : 0)
