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
      sidebar: [{ label: '← 简历', link: 'https://joy-jinyu.github.io/' }, ...sidebar],
    }),
  ],
})
