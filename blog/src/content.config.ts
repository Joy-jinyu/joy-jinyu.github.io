import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

export const collections = {
  posts: defineCollection({
    // 文件名即 URL：src/content/posts/tmux-guide.mdx -> /blog/tmux-guide/
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      /** 首页卡片上的一行小字，例如「约 55 分钟 · 三部分」 */
      meta: z.string().optional(),
      draft: z.boolean().default(false),
    }),
  }),
}
