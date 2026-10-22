/**
 * 构建期的正文加工（Sätteri hast 插件，Astro 7 默认的 Markdown 处理器）：
 * 表格包一层 .table-wrap，窄屏时在容器内横向滚动，不撑破页面
 */
export const tableWrap = {
  name: 'table-wrap',
  element: {
    filter: ['table'],
    visit(node, ctx) {
      ctx.wrapNode(node, { type: 'element', tagName: 'div', properties: { className: ['table-wrap'] }, children: [] })
    },
  },
}
