import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import expressiveCode from 'astro-expressive-code'
import { satteri } from '@astrojs/markdown-satteri'
import { tableWrap } from './src/lib/satteri-prose.mjs'

export default defineConfig({
  site: 'https://joy-jinyu.github.io',
  // 博客挂在 /blog/ 子路径下，根路径是简历页（site/index.html），/notes/ 是笔记站
  base: '/blog',
  trailingSlash: 'always',
  // mdx 默认沿用这里的处理器（extendMarkdownConfig），所以插件只需挂一处
  markdown: { processor: satteri({ hastPlugins: [tableWrap] }) },
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
  ],
})
