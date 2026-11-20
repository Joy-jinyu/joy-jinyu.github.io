import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import expressiveCode from 'astro-expressive-code'
import { satteri } from '@astrojs/markdown-satteri'
import { tableWrap, contribSanitize } from './src/lib/satteri-prose.mjs'
import sitemap from '@astrojs/sitemap'
import { readdirSync, readFileSync } from 'node:fs'

const SITE = 'https://www.pairwise.site'

/**
 * 文章地址 -> sitemap 的 lastmod（frontmatter 的 date、updated 里晚的那个）；博客首页取所有文章里最新的那天。
 * sitemap 插件拿不到内容集合，这里直接读 frontmatter
 */
function postLastmod() {
  const dir = new URL('./src/content/posts/', import.meta.url)
  const map = new Map()
  for (const file of readdirSync(dir, { recursive: true })) {
    // 和 content.config.ts 的 loader 一致：投稿目录里的 .mdx 不生成页面
    if (!/\.mdx?$/.test(file) || (file.startsWith('contrib') && file.endsWith('.mdx'))) continue
    const fm = readFileSync(new URL(file, dir), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''
    if (/^draft:\s*true/m.test(fm)) continue
    const pick = (key) => fm.match(new RegExp(`^${key}:\\s*['"]?([^'"\\r\\n]+)`, 'm'))?.[1]
    // updated 常只写日期（按 UTC 零点算），可能比带时刻的 date 还早，所以取两者里晚的
    const date = new Date(Math.max(...['date', 'updated'].map((k) => new Date(pick(k) ?? NaN)).filter((d) => !isNaN(d))))
    if (!isNaN(date)) map.set(`${SITE}/blog/${file.replace(/\.mdx?$/, '')}/`, date)
  }
  if (map.size) map.set(`${SITE}/blog/`, new Date(Math.max(...map.values())))
  return map
}
const lastmod = postLastmod()

export default defineConfig({
  // 正式域名（site/CNAME）：canonical、sitemap 都用它；github.io 会 301 跳过来
  site: SITE,
  // 博客挂在 /blog/ 子路径下，根路径是首页（site/index.html），简历在 /resume/，/notes/ 是笔记站
  base: '/blog',
  trailingSlash: 'always',
  // mdx 默认沿用这里的处理器（extendMarkdownConfig），所以插件只需挂一处
  markdown: { processor: satteri({ hastPlugins: [tableWrap, contribSanitize] }) },
  integrations: [
    // 必须排在 mdx 前面，否则 mdx 里的代码块不会交给它渲染
    expressiveCode({
      themes: ['github-dark-default', 'github-light-default'],
      // 跟随页面 data-theme 切换，和笔记站同一套规则
      themeCssSelector: (theme) => `[data-theme="${theme.type}"]`,
      useDarkModeMediaQuery: false,
      styleOverrides: {
        borderRadius: '12px',
        borderColor: 'var(--line)',
        codeFontFamily: 'var(--mono)',
        uiFontFamily: 'var(--mono)',
        // 不能用半透明底色：动态背景会从代码块里透出来
        codeBackground: 'color-mix(in srgb, var(--bg) 94%, var(--strong) 6%)',
        frames: {
          shadowColor: 'transparent',
          editorTabBarBackground: 'var(--panel)',
          terminalTitlebarBackground: 'var(--panel)',
        },
      },
    }),
    mdx(),
    // ai-bridge、mermaid-frame 是嵌在隐藏 iframe 里的空页面（自带 noindex），不给搜索引擎
    sitemap({
      filter: (page) => !page.includes('/ai-bridge/') && !page.includes('/mermaid-frame/'),
      serialize(item) {
        const d = lastmod.get(item.url)
        if (d) item.lastmod = d.toISOString()
        return item
      },
    }),
  ],
})
