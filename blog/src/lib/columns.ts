/**
 * 博客的专栏：首页按这里的顺序分组，每篇文章在 frontmatter 里用 column 指定归属。
 * 专栏内按发布日期从早到晚排，也就是阅读顺序。
 * glyph 是专栏卡片和搜索结果里方块图标上的字，tint 是方块和圆点的颜色（上面压白字，深浅两套主题共用）。
 */
export const COLUMNS = [
  {
    id: 'ui-taste',
    title: 'UI 审美',
    blurb: 'AI 写得出界面，写不出分寸。每篇挑一类细节，实测 AI 的产出，讲清原理、验收方法和能直接用的规则。',
    glyph: 'UI',
    tint: '#5a74ff',
  },
  {
    id: 'macos',
    title: 'macOS 设计规范',
    blurb: '把 Apple 的人机界面指南拆成能检查的规则：每篇一个界面部件，原文加 macOS 26 原生控件的实测数值。',
    glyph: '⌘',
    tint: '#636366',
  },
  {
    id: 'tools',
    title: '工具与环境',
    blurb: '每天在用的终端工具和配置，踩过的坑和做过的取舍。',
    glyph: '工',
    tint: '#0cb6ff',
  },
  {
    id: 'teardown',
    title: '拆解',
    blurb: '把别人做出来的东西拆开，看它是怎么搭起来的，记下能借走的做法。',
    glyph: '拆',
    tint: '#ff7128',
  },
  {
    id: 'launch',
    title: '建站与上线',
    blurb: '把自己做的网站放上线、让人搜得到：部署、SEO、收录，以及上线当天才发现的问题。',
    glyph: '建',
    tint: '#35c15c',
  },
  {
    id: 'contrib',
    title: '投稿',
    blurb: '读者写的文章：在站内编辑器里写好提交，审过后发布。',
    glyph: '投',
    tint: '#ec54b8',
  },
] as const

export type ColumnId = (typeof COLUMNS)[number]['id']

/** 给 zod enum 用的 id 列表 */
export const COLUMN_IDS = COLUMNS.map((c) => c.id) as [ColumnId, ...ColumnId[]]

/** 搜索在博客首页选中专栏时派发的 window 事件，detail 是专栏 id；首页收到后打开该专栏的弹层 */
export const OPEN_COLUMN_EVENT = 'blog:open-column'
