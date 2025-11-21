### [添加eslint和prettier](https://blog.csdn.net/weixin_42445810/article/details/113581402)

#### 创建react项目

```shell
npx create-react-app ${name} --template typescript
cd ${name}
```

#### 安装依赖

- eslint-plugin-import：此插件主要为了校验 import/export 语法，防止错误拼写文件路径以及导出名称的问题
- eslint-plugin-jsx-a11y：提供 jsx 元素可访问性校验
- eslint-plugin-react：校验 React
- eslint-plugin-react-hooks：根据 Hooks API 校验 Hooks 的使用

```shell
yarn add -D eslint-plugin-import eslint-plugin-jsx-a11y eslint-plugin-react eslint-plugin-react-hooks
```

#### 初始化eslint配置

```shell
npx eslint --init
√ How would you like to use ESLint? · style
√ What type of modules does your project use? · esm
√ Which framework does your project use? · react
√ Does your project use TypeScript? · No / Yes
√ Where does your code run? · browser
√ How would you like to define a style for your project? · guide
√ Which style guide do you want to follow? · airbnb
√ What format do you want your config file to be in? · JavaScript
Checking peerDependencies of eslint-config-standard@latest
Local ESLint installation not found.
The config that you've selected requires the following dependencies:

eslint-plugin-react@latest @typescript-eslint/eslint-plugin@latest eslint-config-standard@latest eslint@^7.12.1 eslint-plugin-import@^2.22.1 eslint-plugin-node@^11.1.0 eslint-plugin-promise@^4.2.1 || ^5.0.0 @typescript-eslint/parser@latest
√ Would you like to install them now with npm? · No / Yes
```

#### 添加prettier

```shell
yarn add -D prettier eslint-config-prettier eslint-plugin-prettier
```

增加`prettier`配置文件，在根目录增加.prettierrc.js

```js

module.exports = {
  singleQuote: true, // 平常模式使用单引号
  trailingComma: "none", // 末尾属性不添加,
  tabWidth: 2, // tab 为2个空格长度
  semi: false, // 不需要分号
  printWidth: 120 // 单行长度
}
```

修改.eslintrc.js

```js
module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: ['plugin:react/recommended', 'airbnb', 'plugin:prettier/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 12,
    sourceType: 'module'
  },
  plugins: ['react', '@typescript-eslint'],
  rules: {
    'react/jsx-filename-extension': 'off',
    'import/extensions': 0,
    'no-use-before-define': 0,
    'import/no-unresolved': 0
  }
}
```



#### 添加.editorconfig

```properties
# https://editorconfig.org
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
```



#### 添加setting.json

```js
{
    "files.autoSave": "onFocusChange",
    "editor.formatOnSave": true,
    "editor.formatOnType": true,
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": true
    },
}
```

#### 提交时校验

安装依赖

- husky：一个方便用来处理 pre-commit 、 pre-push 等 githooks 的工具
- lint-staged：对 git 暂存区的代码，运行 linters 的工具

```shell
yarn add -D lint-staged husky
```



增加配置

```json
// package.json
{
  ...
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "src/*.{js,jsx,mjs,ts,tsx}": [
      "node_modules/.bin/prettier --write",
      "node_modules/.bin/eslint --fix",
      "git add"
    ],
    "src/*.{css,scss,less,json,html,md,markdown}": [
      "node_modules/.bin/prettier --write",
      "git add"
    ]
  }
  ...
}
```