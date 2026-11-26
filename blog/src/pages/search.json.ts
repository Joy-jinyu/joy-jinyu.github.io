import type { APIRoute } from 'astro'
import { listColumnGroups, listPosts, formatDate } from '../lib/posts'

/** 顶栏搜索（components/SiteSearch.astro）用的数据，构建时生成静态文件，打开搜索时才拉取 */
export interface SearchIndex {
  columns: { id: string; title: string; blurb: string; glyph: string; tint: string; count: number }[]
  /** 新的在前 */
  posts: { title: string; description: string; tags: string[]; column: string; date: string; url: string }[]
}

export const GET: APIRoute = async () => {
  const base = import.meta.env.BASE_URL
  const [groups, posts] = await Promise.all([listColumnGroups(), listPosts()])
  const index: SearchIndex = {
    columns: groups.map((g) => ({ id: g.id, title: g.title, blurb: g.blurb, glyph: g.glyph, tint: g.tint, count: g.posts.length })),
    posts: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      tags: p.data.tags,
      column: p.data.column,
      date: formatDate(p.data.date),
      url: `${base}${p.id}/`,
    })),
  }
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json; charset=utf-8' } })
}
