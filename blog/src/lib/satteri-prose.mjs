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

/**
 * 读者投稿里链接 / 图片允许的地址：http、https、mailto，以及没写协议的相对地址和 #锚点。
 * 传入解析器解码后的值（实体、反斜杠转义都已还原）；浏览器会忽略地址里的空白和控制字符，这里同样先去掉。
 * 守门检查 .github/scripts/check-contrib.mjs 复用这条规则。
 */
export const isSafeUrl = (url) => {
  const u = String(url).replace(/[\u0000- ]/g, '').toLowerCase()
  return !/^[a-z][a-z0-9+.-]*:/.test(u) || /^(https?|mailto):/.test(u)
}

const sanitize = {
  name: 'contrib-sanitize',
  raw(node, ctx) {
    ctx.removeNode(node)
  },
  element: {
    filter: ['a', 'img'],
    visit(node, ctx) {
      const url = node.tagName === 'a' ? node.properties.href : node.properties.src
      if (url == null || isSafeUrl(url)) return
      // 链接只摘掉 href，不能用子节点替换：被替换下来的子节点不会再被访问，里面的原始 HTML 会漏过清洗
      if (node.tagName === 'a') ctx.setProperty(node, 'href', null)
      else ctx.removeNode(node)
    },
  },
}

/**
 * 读者投稿（posts/contrib/ 下的 .md）的安全清洗：删掉原始 HTML，不安全的链接摘掉地址、图片去掉。
 * 拿不到文件路径时也清洗（宁可误清，不可漏放）；自己写的文章都是 .mdx，不受影响。
 */
export const contribSanitize = ({ fileURL, sourceFormat }) =>
  sourceFormat === 'markdown' && (!fileURL || fileURL.pathname.includes('/src/content/posts/contrib/')) ? sanitize : null
