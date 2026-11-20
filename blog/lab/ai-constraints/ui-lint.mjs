/**
 * UI 静态检查：只读源码、不开浏览器，查 AGENTS.md 里能从代码直接判断的几条规则。
 * 能查的只是「写没写」，不是「对不对」：比如写了 AbortSignal.timeout，不代表每个请求都用上了。
 * 用法：node ui-lint.mjs <html 文件…>；只看文件里内联的 <style> 和 <script>。
 * 系列里的用法：在 blog/public/lab/ 下运行，参数是各篇目录里 AI 原样产出的文件，清单见 data/ui-lint-output.txt 第一行。
 * 退出码：有任何一条不通过就是 1，可以直接放进 CI 或 pre-commit。
 */
import { readFileSync } from 'node:fs'

/** 去掉 @media (hover: hover) { … } 块（花括号配对），剩下的部分里不该再有 :hover */
const withoutHoverMedia = (css) => {
  let out = '', i = 0
  for (;;) {
    const m = css.slice(i).match(/@media[^{]*\(\s*hover\s*:\s*hover\s*\)[^{]*\{/)
    if (!m) return out + css.slice(i)
    out += css.slice(i, i + m.index)
    let j = i + m.index + m[0].length, depth = 1
    while (depth && j < css.length) { depth += css[j] === '{' ? 1 : css[j] === '}' ? -1 : 0; j++ }
    i = j
  }
}

const RULES = [
  ['viewport-fit=cover 要同时处理左右安全区边距', ({ html, css }) => !/viewport-fit\s*=\s*cover/.test(html) || (/safe-area-inset-left/.test(css) && /safe-area-inset-right/.test(css))],
  ['悬停样式要写在 @media (hover: hover) 里', ({ css }) => !/:hover/.test(withoutHoverMedia(css))],
  ['用了 fetch 就要设超时', ({ js }) => !/\bfetch\s*\(/.test(js) || /AbortSignal\.timeout|new AbortController/.test(js)],
  ['中文页面要打开 text-autospace', ({ html, css }) => !/<html[^>]*lang=["']zh/.test(html) || /text-autospace\s*:\s*(normal|auto)/.test(css)],
  // 选择器里带 :root 的规则块（包括写在 @media 里的深色那一套）都算变量定义，先剔掉再找写死的颜色
  ['颜色只在 :root 里定义', ({ css }) => !/#[0-9a-f]{3,8}\b|rgba?\(\s*\d/i.test(css.replace(/[^{}]*:root[^{}]*\{[^}]*\}/g, ''))],
  ['去掉了点击高亮，就要有 :active', ({ css }) => !/-webkit-tap-highlight-color\s*:\s*(transparent|rgba\([^)]*,\s*0\))/.test(css) || /:active/.test(css)],
  ['去掉了焦点轮廓，就要有 :focus-visible', ({ css }) => !/outline\s*:\s*(none|0)\b/.test(css) || /:focus-visible/.test(css)],
]

let failed = 0
for (const file of process.argv.slice(2)) {
  const html = readFileSync(file, 'utf8')
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
  const js = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n')
  const results = RULES.map(([name, check]) => [name, check({ html, css, js })])
  const bad = results.filter(([, ok]) => !ok)
  failed += bad.length
  console.log(`${bad.length ? '✗' : '✓'} ${file}${bad.length ? '' : '：全部通过'}`)
  for (const [name] of bad) console.log(`    ✗ ${name}`)
}
process.exit(failed ? 1 : 0)
