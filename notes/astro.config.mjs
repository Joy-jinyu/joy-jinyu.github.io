import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import sidebar from './sidebar.mjs'

export default defineConfig({
  site: 'https://joy-jinyu.github.io',
  // 笔记站挂在 /notes/ 子路径下，根路径留给简历页（site/index.html）
  base: '/notes',
  // 输出 xxx.html，保持和原 VuePress 一样的文章 URL
  build: { format: 'file' },
  integrations: [
    starlight({
      title: '有爱心安 - 花期',
      description: '杂乱无章的技术博客',
      locales: { root: { label: '简体中文', lang: 'zh-CN' } },
      // 站点图标：简历页里的 Joy 签名头像（同一份图也放在 site/ 给简历页用）
      favicon: '/favicon.png',
      // 「← 简历」放在自定义侧边栏顶部那一行（src/components/Sidebar.astro）
      sidebar,
      // 视觉规范对齐简历页 site/index.html：同一套字体、配色、底纹
      customCss: ['./src/styles/theme.css'],
      components: {
        ThemeSelect: './src/components/ThemeSwitch.astro',
        Sidebar: './src/components/Sidebar.astro',
        PageSidebar: './src/components/PageSidebar.astro',
        Pagination: './src/components/Pagination.astro',
      },
      head: [
        // 跨页面过渡的开关必须在新页面首帧前就生效，放外链 CSS 里偶尔加载晚了会被浏览器跳过，所以内联在 head
        {
          tag: 'style',
          content:
            '@view-transition{navigation:auto}@media (prefers-reduced-motion:reduce){@view-transition{navigation:none}}',
        },
        // 首帧前恢复菜单 / 目录的收起状态，避免先展开再收起的闪动（按钮逻辑见 src/components/PanelToggle.astro）
        {
          tag: 'script',
          content:
            "try{for(const p of ['sidebar','toc'])if(localStorage.getItem('joy-'+p)==='collapsed')document.documentElement.dataset[p]='collapsed'}catch{}",
        },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/notes/apple-touch-icon.png' } },
        // 全站动态背景：waves 场景，组件拷贝自 learning/html（public/hero-bg.js），铺满视口的样式见 theme.css
        { tag: 'script', attrs: { src: '/notes/hero-bg.js', defer: true } },
        {
          tag: 'script',
          content:
            "document.addEventListener('DOMContentLoaded',()=>{const bg=document.createElement('hero-bg');bg.setAttribute('variant','waves');bg.setAttribute('intensity','0.55');document.body.prepend(bg)})",
        },
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true } },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap',
          },
        },
      ],
      expressiveCode: {
        themes: ['github-dark-default', 'github-light-default'],
        styleOverrides: {
          borderRadius: '12px',
          borderColor: 'var(--line)',
          codeFontFamily: 'var(--sl-font-mono)',
          uiFontFamily: 'var(--sl-font-mono)',
          // 不能用半透明的 --panel-hi：动态背景会从代码块里透出来
          codeBackground: 'color-mix(in srgb, var(--bg) 94%, var(--strong) 6%)',
          frames: {
            shadowColor: 'transparent',
            editorTabBarBackground: 'var(--panel)',
            terminalTitlebarBackground: 'var(--panel)',
          },
        },
      },
    }),
  ],
})
