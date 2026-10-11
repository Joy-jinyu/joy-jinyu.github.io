import { defineCollection } from 'astro:content'
import { docsLoader } from '@astrojs/starlight/loaders'
import { docsSchema } from '@astrojs/starlight/schema'

export const collections = {
  docs: defineCollection({
    // 默认 id 会转小写，这里保留原文件名大小写，旧链接（如 /notes/workSummary/...）才不会 404
    loader: docsLoader({ generateId: ({ entry }) => entry.replace(/\.md$/, '') }),
    schema: docsSchema(),
  }),
}
