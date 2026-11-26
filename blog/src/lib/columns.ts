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
  {
    id: 'teardown',
    title: '拆解',
    blurb: '把别人做出来的东西拆开，看它是怎么搭起来的，记下能借走的做法。',
  },
  {
    id: 'launch',
    title: '建站与上线',
    blurb: '把自己做的网站放上线、让人搜得到：部署、SEO、收录，以及上线当天才发现的问题。',
  },
  {
    id: 'contrib',
    title: '投稿',
    blurb: '读者写的文章：在站内编辑器里写好提交，审过后发布。',
  },
] as const

export type ColumnId = (typeof COLUMNS)[number]['id']

/** 给 zod enum 用的 id 列表 */
export const COLUMN_IDS = COLUMNS.map((c) => c.id) as [ColumnId, ...ColumnId[]]
