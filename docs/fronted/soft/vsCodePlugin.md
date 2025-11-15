## 2019

### Paste JSON as Code

 可以复制代码生成 typescript 及其它类型的代码

### Markdown All in One

 替代 vs 自带的 markDown

### Better Comments

 可以很好的写注释:警告、查询、待办事项、高亮

### Github Markdown Preview

 预览 markDown 文件

### Bracket Pair Colorizer 2

 同一代码块开头结尾拥有相同的颜色

### Pretter - Code formatter

 代码格式化

```json

    "[javascript]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode"
    },
    /*  prettier的配置 */
    "prettier.printWidth": 100, // 超过最大值换行
    "prettier.tabWidth": 4, // 缩进字节数
    "prettier.useTabs": false, // 缩进不使用tab，使用空格
    "prettier.semi": false, // 句尾添加分号
    "prettier.singleQuote": true, // 使用单引号代替双引号
    "prettier.proseWrap": "preserve", // 默认值。因为使用了一些折行敏感型的渲染器（如GitHub comment）而按照markdown文本样式进行折行
    "prettier.arrowParens": "avoid", //  (x) => {} 箭头函数参数只有一个时是否要有小括号。avoid：省略括号
    "prettier.bracketSpacing": true, // 在对象，数组括号与文字之间加空格 "{ foo: bar }"
    "prettier.disableLanguages": [
        "vue"
    ], // 不格式化vue文件，vue文件的格式化单独设置
    "prettier.endOfLine": "auto", // 结尾是 \n \r \n\r auto
    "prettier.eslintIntegration": false, //不让prettier使用eslint的代码格式进行校验
    "prettier.htmlWhitespaceSensitivity": "ignore",
    "prettier.ignorePath": ".prettierignore", // 不使用prettier格式化的文件填写在项目的.prettierignore文件中
    "prettier.jsxBracketSameLine": false, // 在jsx中把'>' 单独放一行
    "prettier.jsxSingleQuote": false, // 在jsx中使用单引号代替双引号
    "prettier.parser": "babylon", // 格式化的解析器，默认是babylon
    "prettier.requireConfig": false, // Require a 'prettierconfig' to format prettier
    "prettier.stylelintIntegration": false, //不让prettier使用stylelint的代码格式进行校验
    "prettier.trailingComma": "es5", // 在对象或数组最后一个元素后面是否加逗号（在ES5中加尾逗号）
    "prettier.tslintIntegration": false // 不让prettier使用tslint的代码格式进行校验
```



### open in browser view in browser

 在浏览器中查看本地 html

---

## 2020

### Indenticator

### `Material Theme`

 `vs`的样式配置

### `Vetur`

 `vue`对`vs`的支持

### `Bookmarks`

 给代码添加书签

### `Color Highlight`

 代码高亮

### `Path Intellisense 1.4.2`

 代码寻址

### `Perttier - Code Formatter`

 代码格式化

### `Eslint`

 代码格式校验

### `Better Comments`

 代码注释

### `Auto Close Tag`

 自动补全`Close`标签

### `vscode-flow-ide`

 `vscode`对 flow 的检测

### `Go To Method`

 方法跳转

## visual studio code配置

```json
{
    "git.path": "D:\\soft\\git\\Git\\bin\\git.exe",
    "emmet.syntaxProfiles": {
        "vue-html": "html",
        "vue": "html"
    },
    "files.associations": {
        "*.vue": "vue"
    },
    "editor.tabCompletion": "onlySnippets",
    "[jsonc]": {
        "editor.defaultFormatter": "vscode.json-language-features"
    },
    // C:\\Windows\\System32\\cmd.exe
    "terminal.integrated.shell.windows": "D:\\soft\\git\\Git\\bin\\bash.exe",
    "terminal.external.windowsExec": "D:\\soft\\git\\Git\\bin\\bash.exe",
    /// ### [wrap_attributes]
    /// - auto: 仅在超出行长度时才对属性进行换行。
    /// - force: 对除第一个属性外的其他每个属性进行换行。
    /// - force-aligned: 对除第一个属性外的其他每个属性进行换行，并保持对齐。
    /// - force-expand-multiline: 对每个属性进行换行。
    /// - aligned-multiple: 当超出折行长度时，将属性进行垂直对齐。 
    // ### [eslint rules](https://cn.eslint.org/docs/rules/),
    "files.exclude": {
        "**/.git": false,
        // "**/.svn": true,
        // "**/.hg": true,
        // "**/CVS": true,
        // "**/.DS_Store": true
    },
    "remote.SSH.configFile": "C:\\Users\\Administrator\\.ssh\\config",
    "path-intellisense.mappings": {
        "@": "${workspaceRoot}/src"
    },
    "path-intellisense.extensionOnImport": true,
    "path-intellisense.autoSlashAfterDirectory": true,
    "path-intellisense.showHiddenFiles": true,
    "path-intellisense.absolutePathToWorkspace": false,
    "commentTranslate.targetLanguage": "zh-CN",
    "css.completion.completePropertyWithSemicolon": false,
    "[javascript]": {
        "editor.defaultFormatter": "vscode.typescript-language-features"
    },
    "workbench.colorTheme": "Material Theme",
    "materialTheme.accent": "Bright Teal",
    "editor.tokenColorCustomizations": {
        "[Material Theme]": {
            "comments": "#229977"
        }
    },
    // 【配置参考地址】（https://blog.csdn.net/dscn15848078969/article/details/107578108）
    "workbench.colorCustomizations": {
        "terminal.border": "#030202",
        // 编辑区域背景
        "editor.background": "#2E2E2E",
        // 侧边栏
        "sideBar.foreground": "#999",
        "sideBar.border": "#2b2b2b",
        // 侧边栏列表
        "list.inactiveSelectionBackground": "#32363d",
        "list.inactiveSelectionForeground": "#dfdfdf",
        "list.hoverBackground": "#32363d",
        "list.hoverForeground": "#dfdfdf",
        "editorError.foreground": "#ff0000"
    },
    "bookmarks.navigateThroughAllFiles": false,
    "leek-fund.funds": [
        "320007",
        "001102",
        "001632",
        "420009",
        "003096",
        "003885",
        "001071",
        "005963"
    ],
    "leek-fund.stocks": [
        "sh000001",
        "sh000300",
        "sh000016",
        "sh000688",
        "hk03690",
        "hk00700",
        "usr_ixic",
        "usr_dji",
        "usr_inx",
        "sz002385",
        "sh600109",
        "sh601012",
        "sh600733",
        "sh600276",
        "sh600906",
        "sh601919"
    ],
    "material-icon-theme.folders.theme": "specific",
    "workbench.iconTheme": "material-icon-theme",
    "material-icon-theme.folders.color": "#26a69a",
    "material-icon-theme.activeIconPack": "vue_vuex",
    "material-icon-theme.saturation": 1,
    "material-icon-theme.hidesExplorerArrows": false,
    "window.zoomLevel": -1,
    "cSpell.allowedSchemas": [
        "file",
        "gist",
        "sftp",
        "untitled",
        "vue"
    ],
    "cSpell.diagnosticLevel": "Error",
    "cSpell.enableFiletypes": [
        "vue"
    ]
}
```

