/** 侧边栏：按主题组织，slug 对应 src/content/docs 下的文件路径（不带 .md） */
const page = (label, slug) => ({ label, slug })
const group = (label, items) => ({ label, collapsed: true, items })

export default [
  group('JavaScript', [
    page('执行机制与事件循环', 'fronted/language/javascript/eventLoop'),
    page('作用域与闭包', 'fronted/language/javascript/theJavaScriptYouDontKonw/scopeAndClosure_01'),
    page('this 与原型链', 'fronted/language/javascript/theJavaScriptYouDontKonw/thisAndPrototype_02'),
    page('ES2015+ 核心特性', 'fronted/language/javascript/es6'),
    page('错误类型与异常处理', 'fronted/language/javascript/basic'),
    page('AST 与代码转换', 'fronted/language/javascript/ast'),
  ]),
  group('TypeScript', [page('类型系统', 'fronted/language/typescript/basic')]),
  group('HTML 与 CSS', [
    page('HTML5 新特性', 'fronted/language/html/h5_standard'),
    page('CSS 核心概念', 'fronted/language/css/introduction'),
    page('媒体查询与响应式', 'fronted/language/css/media'),
  ]),
  group('React', [
    page('项目搭建', 'fronted/language/react/createProject'),
    page('核心概念与 Hooks', 'fronted/language/react/notes'),
    page('协调与 Fiber', 'fronted/language/react/algorithm'),
    page('Redux 状态管理', 'fronted/language/react/redux'),
  ]),
  group('Vue', [
    page('Vue 3 项目搭建', 'fronted/language/vue/createProject'),
    page('Vite 原理与使用', 'fronted/language/vue/vite/introduction'),
  ]),
  group('Node.js', [
    page('架构与运行机制', 'fronted/language/node/introduction'),
    page('异步与并发', 'fronted/language/node/problem'),
    page('npm 依赖管理', 'fronted/language/node/node_package'),
    page('Deno 简介', 'fronted/language/deno/introduction'),
  ]),
  group('工程化', [
    page('构建工具概览', 'fronted/projectBuild/introduction'),
    group('webpack', [
      page('由来', 'fronted/projectBuild/webpack/background'),
      page('核心概念', 'fronted/projectBuild/webpack/concept'),
      page('配置详解', 'fronted/projectBuild/webpack/configuration'),
      page('实践指南', 'fronted/projectBuild/webpack/guide'),
      page('常用 Loader 与 Plugin', 'fronted/keyword/webpackDependencies'),
      page('Loader 与 Plugin 开发', 'fronted/projectBuild/webpack/api'),
      page('搭建 Vue 项目', 'fronted/projectBuild/webpack/vueProject'),
    ]),
    group('PostCSS', [
      page('简介', 'fronted/projectBuild/postcss/introduction'),
      page('工作原理', 'fronted/projectBuild/postcss/translate'),
    ]),
    page('单元测试', 'fronted/test/karma'),
  ]),
  group('性能与架构', [
    page('性能优化总览', 'fronted/optimization/introduction'),
    page('白屏问题分析', 'fronted/optimization/blankScreen/background'),
    page('白屏优化方案', 'fronted/optimization/blankScreen/case'),
    page('微前端概念', 'fronted/optimization/microFronted/introduction'),
    page('微前端方案与实践', 'fronted/optimization/microFronted/practise'),
  ]),
  group('浏览器', [
    page('工作原理', 'system/browser/basic'),
    page('Cookie 详解', 'system/browser/cookies'),
    page('实时通信方案', 'fronted/instantMessage/introduction'),
    page('兼容性问题汇总', 'fronted/compatible/browsers'),
  ]),
  group('编码实践', [
    page('前端开发规范', 'fronted/codeBasic/developRule'),
    page('《编写可读代码的艺术》', 'fronted/codeBasic/codeArtReading'),
    page('开发踩坑记录', 'fronted/codeBasic/problemRecord'),
  ]),
  group('移动端', [
    page('跨平台开发概览', 'fronted/mobile/introduction'),
    page('Flutter 环境搭建', 'fronted/mobile/flutter/environment'),
    page('Dart 基础概念', 'fronted/mobile/flutter/dart/basic'),
    page('Dart 语法', 'fronted/mobile/flutter/dart/grammar'),
    page('Dart 编码规范', 'fronted/mobile/flutter/dart/codeRule'),
  ]),
  group('工具', [
    page('Git 常用操作', 'others/git'),
    page('VS Code 插件推荐', 'fronted/soft/vsCodePlugin'),
    page('常用工具库速查', 'fronted/keyword/others'),
    page('Markdown 语法速查', 'others/markdown'),
  ]),
  group('系统与数据库', [
    page('Linux 常用命令', 'system/linux/basic'),
    page('Linux 软件安装与管理', 'system/linux/soft'),
    page('Vim 使用指南', 'system/linux/vim'),
    page('MySQL 安装与基础配置', 'databases/mysql/install'),
  ]),
  group('英语', [page('前端常用英文术语', 'language/english/professional')]),
]
