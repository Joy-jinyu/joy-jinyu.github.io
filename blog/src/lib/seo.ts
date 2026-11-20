/**
 * 结构化数据里互相引用的节点 id。WebSite 和 Person 两个节点的完整定义在首页（site/index.html）的 JSON-LD 里，
 * 这里只按 @id 指过去，改名字、地址要两边一起看
 */
const SITE = 'https://www.pairwise.site'

export const WEBSITE_ID = `${SITE}/#website`
export const BLOG_ID = `${SITE}/blog/#blog`
export const JOY = { '@type': 'Person', '@id': `${SITE}/#joy`, name: 'Joy', url: `${SITE}/` }
