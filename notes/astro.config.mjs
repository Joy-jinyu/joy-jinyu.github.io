import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import sitemap from '@astrojs/sitemap'
import sidebar from './sidebar.mjs'

export default defineConfig({
  // 正式域名（site/CNAME）：canonical、sitemap 都用它；github.io 会 301 跳过来
  site: 'https://www.pairwise.site',
  // 笔记站挂在 /notes/ 子路径下，根路径是首页（site/index.html），简历在 /resume/
  base: '/notes',
  // 输出 xxx.html，保持和原 VuePress 一样的文章 URL
  build: { format: 'file' },
  integrations: [
    // 自己挂 sitemap（Starlight 发现已有就不再挂默认的）：文章按 xxx.html 输出，站内链接和 canonical 都带 .html，
    // 默认 sitemap 却写成不带后缀的地址，两个地址都能打开，搜索引擎会当成重复页面。这里改成和 canonical 一致
    sitemap({
      serialize(item) {
        item.url = item.url.endsWith('/') ? `${item.url}index.html` : `${item.url}.html`
        return item
      },
    }),
    starlight({
      title: 'Pairwise 技术笔记',
      description: '前端工程师的技术笔记：JavaScript、框架、工程化、性能、浏览器与常用工具',
      locales: { root: { label: '简体中文', lang: 'zh-CN' } },
      // 站点图标：简历页里的 Joy 签名头像（同一份图也放在 site/ 给简历页用）
      favicon: '/favicon.png',
      // 「← 简历」放在自定义侧边栏顶部那一行（src/components/Sidebar.astro）
      sidebar,
      // 视觉规范对齐简历页 site/resume/index.html：同一套字体、配色、底纹
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
        // Cloudflare Web Analytics 访问统计，说明见 site/index.html 同名注释
        {
          tag: 'script',
          attrs: {
            defer: true,
            src: 'https://static.cloudflareinsights.com/beacon.min.js',
            'data-cf-beacon': '{"token": "cfd1847ac0c347a4a677b092214a258d"}',
          },
        },
        // 分享卡片的图片（site/og.png，部署后在站点根目录）
        { tag: 'meta', attrs: { property: 'og:image', content: 'https://www.pairwise.site/og.png' } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: 'https://www.pairwise.site/og.png' } },
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
