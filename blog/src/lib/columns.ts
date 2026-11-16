/**
 * 博客的专栏：首页按这里的顺序分组，每篇文章在 frontmatter 里用 column 指定归属。
 * 专栏内按发布日期从早到晚排，也就是阅读顺序。
 */
export const COLUMNS = [
  {
    id: 'ui-taste',
    title: 'UI 审美',
    blurb: 'AI 写得出界面，写不出分寸。每篇挑一类细节，实测 AI 的产出，讲清原理、验收方法和能直接用的规则。',
  },
  {
    id: 'tools',
    title: '工具与环境',
    blurb: '每天在用的终端工具和配置，踩过的坑和做过的取舍。',
  },
] as const

export type ColumnId = (typeof COLUMNS)[number]['id']

/** 给 zod enum 用的 id 列表 */
export const COLUMN_IDS = COLUMNS.map((c) => c.id) as [ColumnId, ...ColumnId[]]
