import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { listPosts } from '../lib/posts'

/** 博客订阅源：/blog/rss.xml，只放标题和摘要，正文留在站内 */
export async function GET(context: APIContext) {
  const posts = await listPosts()
  const base = import.meta.env.BASE_URL
  return rss({
    title: 'Pairwise 博客',
    description: 'Joy 写的 AI 应用开发、AI 写界面的审美与约束、前端工程化和终端工具实践。',
    site: new URL(base, context.site),
    trailingSlash: true,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.date,
      link: `${base}${p.id}/`,
      categories: p.data.tags,
    })),
    customData: '<language>zh-CN</language>',
  })
}
