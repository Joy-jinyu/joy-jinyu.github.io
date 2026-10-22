import { getCollection, type CollectionEntry } from 'astro:content'

export type Post = CollectionEntry<'posts'>

/** 已发布的文章，新的在前；草稿只在 dev 下可见 */
export async function listPosts(): Promise<Post[]> {
  const all = await getCollection('posts', (p) => import.meta.env.DEV || !p.data.draft)
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
}

/** 中文按每分钟约 400 字估算，英文单词按 200 个估算；代码块不计入 */
export function readingMinutes(body = ''): number {
  const text = body.replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>/g, '')
  const cjk = (text.match(/[一-鿿]/g) || []).length
  const words = (text.replace(/[一-鿿]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length
  return Math.max(1, Math.round(cjk / 400 + words / 200))
}

const fmt = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
export const formatDate = (d: Date) => fmt.format(d).replaceAll('/', '.')

/** 卡片标题与文章标题共用的过渡名，跨页时标题会从卡片位置形变到文章页 */
export const titleTransition = (id: string) => `post-title-${id.replace(/[^a-z0-9-]/gi, '-')}`
