---
title: VS Code 插件推荐
description: 按用途分类整理前端开发常用的 VS Code 插件，说明哪些旧插件已被内置功能取代，并给出一份通用的编辑器配置。
---

VS Code 本身已经内置了很多早年要靠插件实现的功能，插件装得多反而会拖慢启动和编辑。这篇按用途整理前端开发常用的插件，标出已经可以卸载的旧插件，最后给出一份与插件配套的基础配置。插件名后的括号是扩展 ID，可以在扩展面板中直接搜索，或用 `code --install-extension <ID>` 安装。

## 代码质量

| 插件 | 扩展 ID | 作用 |
| --- | --- | --- |
| ESLint | `dbaeumer.vscode-eslint` | 在编辑器中实时显示 ESLint 报错，支持保存时自动修复。读取项目里的 ESLint 配置和本地安装的 ESLint。 |
| Prettier - Code formatter | `esbenp.prettier-vscode` | 用 Prettier 格式化代码，优先使用项目里的 `.prettierrc` 配置。 |
| Stylelint | `stylelint.vscode-stylelint` | 检查 CSS、SCSS、Less 等样式文件。 |
| Error Lens | `usernamehw.errorlens` | 把错误和警告直接显示在对应代码行的末尾，不用把鼠标悬停上去。 |
| Code Spell Checker | `streetsidesoftware.code-spell-checker` | 检查变量名、注释里的英文拼写错误，支持驼峰拆词。 |
| EditorConfig for VS Code | `EditorConfig.EditorConfig` | 让编辑器遵循项目根目录的 `.editorconfig`（缩进、换行符、编码）。 |

这几个插件只负责"在编辑器里显示和触发"，规则本身应该写在项目配置里，这样命令行、CI 和编辑器的检查结果才一致。规则怎么配见 [前端开发规范](/notes/fronted/codeBasic/developRule.html)。

## Git

| 插件 | 扩展 ID | 作用 |
| --- | --- | --- |
| GitLens | `eamodio.gitlens` | 在代码行旁显示最后修改人和提交信息（blame），查看文件和行的修改历史，比较分支与提交。部分高级功能需要付费。 |
| Git Graph | `mhutchie.git-graph` | 以图形方式查看提交历史和分支关系，可以在图上执行检出、合并、变基等操作。 |

VS Code 内置的源代码管理面板已经能完成暂存、提交、推送、解决冲突等日常操作，近年的版本也内置了提交图（Source Control Graph）。只是偶尔看历史的话，内置功能可能已经够用。Git 命令本身见 [Git 常用操作](/notes/others/git.html)。

## 编辑效率

| 插件 | 扩展 ID | 作用 |
| --- | --- | --- |
| Path Intellisense | `christian-kohler.path-intellisense` | 输入文件路径时自动补全。可以通过 `path-intellisense.mappings` 配置 `@` 等路径别名。 |
| Bookmarks | `alefragnani.Bookmarks` | 给代码行加书签，在书签之间快速跳转，适合阅读大型代码库。 |
| Better Comments | `aaron-bond.better-comments` | 按前缀给注释上色，例如 `// !` 警告、`// ?` 疑问、`// TODO` 待办。 |
| Paste JSON as Code | `quicktype.quicktype` | 把 JSON 粘贴为 TypeScript 类型或其他语言的数据结构定义，适合根据接口返回生成类型。 |
| Color Highlight | `naumovs.color-highlight` | 在任意文件中把颜色值渲染成对应的颜色。CSS 文件里内置就有颜色预览，这个插件主要用于 JS、TS 等文件中的颜色字符串。 |
| Live Server | `ritwickdey.LiveServer` | 为静态 HTML 页面启动本地服务器，保存后自动刷新浏览器。用 Vite 等工具的项目自带开发服务器，不需要它。 |

## 框架与语言支持

| 插件 | 扩展 ID | 作用 |
| --- | --- | --- |
| Vue - Official | `Vue.volar` | Vue 官方维护的插件，提供 `.vue` 单文件组件的语法高亮、类型检查和补全。取代了旧的 Vetur。 |
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` | Tailwind 类名补全、悬停显示对应的 CSS、检查冲突的类名。 |
| ES7+ React/Redux/React-Native snippets | `dsznajder.es7-react-js-snippets` | 常用 React 代码片段，例如输入 `rafce` 生成函数组件模板。 |
| Markdown All in One | `yzhang.markdown-all-in-one` | Markdown 快捷键、自动生成目录、列表编号自动维护、表格格式化。 |
| Markdown Preview Github Styling | `bierner.markdown-preview-github-styles` | 让内置的 Markdown 预览使用 GitHub 的样式。 |

:::caution
Vetur 是 Vue 2 时代的插件，已不再推荐。开发 Vue 3 项目应使用 Vue - Official，并且两者不要同时启用，否则会出现重复的提示和格式化冲突。
:::

## 远程开发

| 插件 | 扩展 ID | 作用 |
| --- | --- | --- |
| Remote - SSH | `ms-vscode-remote.remote-ssh` | 通过 SSH 连接远程机器，在本地界面中编辑远程文件、使用远程终端。 |
| Dev Containers | `ms-vscode-remote.remote-containers` | 在 Docker 容器中开发，把开发环境写成配置文件，团队成员打开项目即可得到一致的环境。 |

## 主题与图标

| 插件 | 扩展 ID | 作用 |
| --- | --- | --- |
| Material Icon Theme | `PKief.material-icon-theme` | 按文件类型和文件夹名称显示对应图标，在资源管理器里更容易区分文件。 |
| GitHub Theme | `GitHub.github-vscode-theme` | GitHub 风格的亮色和暗色配色主题。 |

主题属于个人偏好，按喜好选择即可。VS Code 内置的 Dark Modern / Light Modern 主题已经足够日常使用。

## 已被内置功能取代的插件

下面这些插件曾经很流行，现在可以卸载，改用 VS Code 的内置设置：

| 插件 | 现状 | 内置替代 |
| --- | --- | --- |
| Bracket Pair Colorizer / Bracket Pair Colorizer 2 | 作者已声明停止维护，推荐使用内置功能 | 括号配对着色已内置，`editor.bracketPairColorization.enabled`（新版默认开启）；配对辅助线 `editor.guides.bracketPairs` |
| Indenticator（高亮当前缩进层级） | 内置功能已覆盖 | `editor.guides.highlightActiveIndentation` |
| Go To Method（跳转到方法） | 内置功能已覆盖 | 命令"转到文件中的符号"（macOS `Cmd+Shift+O`，Windows `Ctrl+Shift+O`） |
| Github Markdown Preview 中的基础预览 | 内置已有预览 | 内置 Markdown 预览（`Cmd/Ctrl+Shift+V`），需要 GitHub 样式时只装上面的样式插件 |
| open in browser | 静态页面可用 Live Server 代替 | 现代项目一般由构建工具的开发服务器提供访问地址 |

两个容易引起争议的插件：

- **Auto Rename Tag**（`formulahendry.auto-rename-tag`）：修改开始标签时同步修改结束标签。VS Code 内置的"链接编辑"（`editor.linkedEditing`）在 HTML 中可以实现相同效果，在 JSX、Vue 模板中是否完全覆盖取决于对应语言的支持情况，这里不下结论，可以先开启内置设置，不够用再装插件。
- **Auto Close Tag**（`formulahendry.auto-close-tag`）：自动补全结束标签。HTML 文件中内置已支持（`html.autoClosingTags`），JSX 中也有 TypeScript 语言服务提供的类似能力，多数情况下不需要再装。

另外，原清单中的 `vscode-flow-ide` 用于 Flow 类型检查。Flow 在社区中的使用已经很少，新项目普遍使用 TypeScript，这里不再推荐。

## 推荐的基础配置

用户级配置（`settings.json`，命令面板中搜索"首选项：打开用户设置 (JSON)"）放与项目无关的个人偏好：

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "editor.bracketPairColorization.enabled": true,
  "editor.guides.bracketPairs": "active",
  "editor.linkedEditing": true,
  "editor.stickyScroll.enabled": true,
  "files.eol": "\n",
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "workbench.iconTheme": "material-icon-theme"
}
```

几点说明：

- `source.fixAll.eslint` 的值在较新的 VS Code 中写 `"explicit"`（保存时执行）；旧版本的写法是 `true`。
- `editor.stickyScroll.enabled` 在滚动时把当前所在的函数、类的开头固定在顶部，阅读长文件时很有用。
- 和团队相关的配置（格式化器、保存时修复）应该放进项目的 `.vscode/settings.json` 并提交到仓库，同时在 `.vscode/extensions.json` 中列出推荐插件，其他成员打开项目时 VS Code 会提示安装：

```json title=".vscode/extensions.json"
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "EditorConfig.EditorConfig"
  ]
}
```

旧配置迁移时注意：

- 原配置里大量 `prettier.xxx` 设置（如 `prettier.eslintIntegration`、`prettier.parser: "babylon"`）来自旧版 Prettier 插件，已被移除或不再生效。Prettier 的选项应写在项目的 `.prettierrc` 中，插件会自动读取。
- `terminal.integrated.shell.windows` 已被终端配置文件（`terminal.integrated.profiles.windows` 与 `terminal.integrated.defaultProfile.windows`）取代。
- 配置里不要写本机绝对路径（如 Git、终端程序的安装路径）后再提交到项目仓库，换一台机器就会失效。

## 小结

- 代码质量类插件（ESLint、Prettier、Stylelint）只负责在编辑器中执行项目配置，规则写在项目里。
- Error Lens、GitLens、Path Intellisense 等是提升效率的常用插件，按需安装。
- Vue 3 项目用 Vue - Official，不再使用 Vetur。
- 括号着色、缩进高亮、跳转符号、标签联动编辑都已内置，对应的旧插件可以卸载。
- 团队配置放进 `.vscode/settings.json` 和 `.vscode/extensions.json` 一起提交，个人偏好放用户设置。

## 参考

- [VS Code：Extension Marketplace](https://code.visualstudio.com/docs/editor/extension-marketplace)
- [VS Code：User and Workspace Settings](https://code.visualstudio.com/docs/getstarted/settings)
- [VS Code：Terminal Profiles](https://code.visualstudio.com/docs/terminal/profiles)
- [Vue：工具链 - IDE 支持](https://cn.vuejs.org/guide/scaling-up/tooling.html#ide-support)
