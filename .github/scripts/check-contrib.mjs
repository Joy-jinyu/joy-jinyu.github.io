/**
 * 读者投稿 PR 的守门规则，由 .github/workflows/contrib-check.yml 的 guard 调用。
 * 用法：node check-contrib.mjs <pr-files.json> <PR head sha> <PR 作者 login>
 * 只用 git 把 PR 的文件当数据读，不执行 PR 里的任何东西；frontmatter 和正文都交给构建时同一套解析器，
 * 免得这里看到的和真正发布出去的不一样。真正的 XSS 防线是构建时的 contribSanitize，这里负责提前报给作者和审稿人。
 */
import { readFileSync, appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { parseFrontmatter } from '@astrojs/internal-helpers/frontmatter'
import { markdownToHtml } from 'satteri'
import { isSafeUrl } from '../../blog/src/lib/satteri-prose.mjs'

const [listPath, sha, prAuthor] = process.argv.slice(2)
if (!listPath || !/^[0-9a-f]{40}$/.test(sha ?? '') || !prAuthor) {
  console.error('用法：node check-contrib.mjs <pr-files.json> <sha> <author>')
  process.exit(2)
}

const ALLOWED_PATH = /^blog\/src\/content\/posts\/contrib\/[a-z0-9][a-z0-9-]*\.md$/
/** 投稿能写的 frontmatter 字段；slug、draft 这类会影响路由或发布的字段一律不收 */
const ALLOWED_KEYS = new Set(['title', 'description', 'date', 'tags', 'column', 'author'])
const MAX_BYTES = 512 * 1024

const errors = []
const fail = (file, msg) => errors.push({ file, msg })
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 2 * MAX_BYTES })

/** 用构建时同一个解析器渲染一遍，收集会被 contribSanitize 清掉的东西 */
function findUnsafe(markdown) {
  const found = []
  const detector = {
    name: 'contrib-detect',
    raw(node) {
      found.push(`原始 HTML：${node.value.trim().slice(0, 40)}`)
    },
    element: {
      filter: ['a', 'img'],
      visit(node) {
        const url = node.tagName === 'a' ? node.properties.href : node.properties.src
        if (url != null && !isSafeUrl(url)) found.push(`不安全的地址：${String(url).slice(0, 40)}`)
      },
    },
  }
  markdownToHtml(markdown, { hastPlugins: [detector] })
  return found
}

const files = JSON.parse(readFileSync(listPath, 'utf8'))
if (!Array.isArray(files) || files.length === 0) fail('', 'PR 里没有文件改动')

for (const { status, filename, previous_filename: previous } of files) {
  if (!ALLOWED_PATH.test(filename)) {
    fail(filename, '投稿只能新增或修改 blog/src/content/posts/contrib/ 下的 .md 文件（文件名只用小写字母、数字和连字符）')
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

  for (const msg of findUnsafe(content)) fail(filename, `${msg}（发布时会被删掉，请改用 Markdown 语法和 http/https 链接）`)
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
