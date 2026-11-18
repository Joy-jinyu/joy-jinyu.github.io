import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { COLUMN_IDS } from './lib/columns'

export const collections = {
  posts: defineCollection({
    // 文件名即 URL：src/content/posts/tmux-guide.mdx -> /blog/tmux-guide/
    // 投稿目录只收 .md：MDX 会在构建时执行代码，投稿里混进 .mdx 也不加载
    loader: glob({ pattern: ['**/*.{md,mdx}', '!contrib/**/*.mdx'], base: './src/content/posts' }),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      /** 首页卡片上的一行小字，例如「约 55 分钟 · 三部分」 */
      meta: z.string().optional(),
      /** 所属专栏，见 lib/columns.ts */
      column: z.enum(COLUMN_IDS),
      /** 投稿作者的 GitHub 用户名，文章页据此链到作者主页；自己写的文章不填 */
      author: z.string().regex(/^[A-Za-z0-9-]{1,39}$/).optional(),
      draft: z.boolean().default(false),
    }),
  }),
}
