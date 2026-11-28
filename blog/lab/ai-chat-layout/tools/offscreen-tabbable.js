// axe-core 自定义规则：能被 Tab 到、却整个落在视口外的元素（比如只用 transform 移出去的抽屉）。
// 用法：注入 axe.min.js 后执行本文件，再 axe.run(document, { runOnly: ['offscreen-tabbable'] })
axe.configure({
  checks: [{ id: 'tabbable-not-offscreen', evaluate: (node) => !axe.commons.dom.isOffscreen(node) }],
  rules: [{
    id: 'offscreen-tabbable',
    selector: 'a[href], button, input, select, textarea, [tabindex]',
    matches: (node) => node.tabIndex >= 0 && axe.commons.dom.isFocusable(node),
    any: ['tabbable-not-offscreen'],
    tags: ['custom'],
  }],
})
