---
title: 前端开发规范
description: 命名、目录结构、HTML/CSS/JS 编码约定、注释原则、Git 提交规范、代码评审要点，以及如何用 ESLint、Prettier、Stylelint、husky、lint-staged、commitlint 把规范落到工具上。
---

规范的价值不在于"哪种写法更好"，而在于让团队里每个人写出的代码看起来像一个人写的，从而降低阅读和评审成本。这篇整理一套通用的前端开发规范：先讲命名、目录、各语言的编码约定和注释原则，再讲提交规范与代码评审，最后说明怎样用工具自动执行这些规则，让规范不靠人记。

## 命名规范

命名是最常见、也最影响可读性的规范。总原则：**名字要说明"是什么"或"做什么"，并且在整个项目里风格一致。**

### 各类标识符的命名风格

| 对象 | 风格 | 示例 |
| --- | --- | --- |
| 变量、函数 | camelCase | `userList`、`fetchOrders` |
| 类、React/Vue 组件 | PascalCase | `UserCard`、`OrderService` |
| 常量（模块级、不会变的配置值） | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| 布尔值 | `is` / `has` / `can` / `should` 前缀 | `isVisible`、`hasPermission` |
| 事件处理函数 | `handle` 前缀；作为 props 传入时用 `on` 前缀 | `handleSubmit`、`onChange` |
| CSS 类名 | kebab-case，或团队约定的 BEM | `user-card`、`user-card__title--active` |
| TypeScript 类型、接口 | PascalCase，不加 `I` 前缀也可以，团队统一即可 | `UserInfo`、`OrderStatus` |

### 几条实用原则

- **用动词开头命名函数**：`getUser`、`formatDate`、`validateEmail`。返回布尔值的函数也用 `is` / `has` 开头。
- **单位写进名字**：`timeoutMs`、`maxSizeKb` 比 `timeout`、`maxSize` 少一次猜测。
- **避免无意义的名字**：`data`、`info`、`temp`、`obj` 只在作用域非常小时可以接受。
- **集合用复数**：`users` 是数组，`user` 是单个元素；遍历时 `users.map((user) => ...)` 读起来自然。
- **缩写只用通用的**：`id`、`url`、`api` 可以，自造缩写（如 `usrLst`）不要用。

## 目录结构

目录结构没有唯一正确答案，常见的两种组织方式：

- **按类型分**：`components/`、`hooks/`、`utils/`、`services/`。小项目简单直观。
- **按功能（feature）分**：`features/order/`、`features/user/`，每个功能目录内部再放自己的组件、接口、状态。项目变大后更好维护，删除一个功能时只需删一个目录。

一个中等规模的单页应用可以这样组织：

```text
src/
├── assets/          # 静态资源：图片、字体
├── components/      # 跨功能复用的通用组件
├── features/        # 按业务功能划分的模块
│   └── order/
│       ├── components/
│       ├── api.ts
│       └── hooks.ts
├── hooks/           # 通用 hooks / composables
├── services/        # 请求封装、第三方 SDK 初始化
├── styles/          # 全局样式、变量
├── utils/           # 纯函数工具
├── router/
└── main.ts
```

约定比结构本身更重要：

- 文件名风格统一。组件文件常用 PascalCase（`UserCard.tsx`），其他文件用 kebab-case 或 camelCase，选一种坚持下去。
- 目录层级不要太深，一般不超过 3–4 层。
- 测试文件和被测文件放在一起（`format.ts` 旁边放 `format.test.ts`），或统一放 `__tests__/`，二选一。

## HTML 编码约定

- **使用语义化标签**：页面结构用 `header`、`nav`、`main`、`section`、`article`、`footer`；可点击的操作用 `button`，跳转用 `a`。不要用 `div` 加点击事件模拟按钮，否则键盘和读屏软件都无法正常使用。
- **图片写 `alt`**：有内容的图片写描述，纯装饰图片写 `alt=""`。
- **表单控件关联 `label`**：用 `<label for="email">` 或把输入框包在 `label` 里，点击文字也能聚焦输入框。
- **属性值统一用双引号**，布尔属性直接写属性名（`disabled`），不写 `disabled="true"`。
- **按钮显式写 `type`**：表单里的 `button` 默认是 `type="submit"`，不需要提交的按钮写 `type="button"`，避免意外提交。

```html
<form>
  <label for="email">邮箱</label>
  <input id="email" name="email" type="email" required />
  <button type="button">清空</button>
  <button type="submit">提交</button>
</form>
```

更多 HTML 语义相关内容见 [HTML5 新特性](/notes/fronted/language/html/h5_standard.html)。

## CSS 编码约定

- **避免用 ID 选择器写样式**，选择器嵌套不超过 3 层。选择器优先级越高，后面越难覆盖。
- **不滥用 `!important`**：只有在覆盖第三方库的内联样式等少数场景才使用，并写注释说明原因。
- **颜色、间距、字号用变量**（CSS 自定义属性或预处理器变量），不要散落魔法数字。

```css
:root {
  --color-primary: #1677ff;
  --space-md: 16px;
}

.card {
  padding: var(--space-md);
  border: 1px solid var(--color-primary);
}
```

- **属性书写顺序保持一致**：常见做法是按"定位 → 盒模型 → 排版 → 视觉 → 其他"排列，可用 Stylelint 插件自动排序。
- **样式隔离**：组件样式用 CSS Modules、Vue 的 `scoped`、BEM 命名等方式之一，避免全局污染。
- **移动优先或桌面优先选一种**，媒体查询的方向保持一致，见 [媒体查询与响应式](/notes/fronted/language/css/media.html)。

## JavaScript / TypeScript 编码约定

这部分大多可以交给 ESLint 检查，下面列出最常见的约定和理由。

### 变量声明

默认用 `const`，需要重新赋值时才用 `let`，不用 `var`。`const` 让读者一眼知道这个绑定不会再变；`var` 的函数作用域和变量提升容易引出 bug，详见 [作用域与闭包](/notes/fronted/language/javascript/theJavaScriptYouDontKonw/scopeAndClosure_01.html)。

### 相等比较

用 `===` 和 `!==`，不用 `==`。唯一常见的例外是 `value == null`，它同时匹配 `null` 和 `undefined`，部分团队允许这一种写法。

### 解构与默认值

```js
// 取对象的多个属性
const { id, name } = user;

// 函数参数解构，并给默认值
function createUser({ name, role = 'guest' } = {}) {
  return { name, role };
}

// 返回多个值时返回对象，而不是数组，调用方按名字取，不依赖顺序
function getRange(list) {
  return { min: Math.min(...list), max: Math.max(...list) };
}
const { min, max } = getRange([3, 1, 2]);
```

### 函数参数

- 参数超过 3 个时，改成传一个对象。
- 不要用布尔值做位置参数，`render(true, false)` 无法看出含义，改为 `render({ animate: true, cache: false })`。
- 用剩余参数 `...args` 代替 `arguments`，前者是真正的数组。

```js
// 不推荐
function divide(a, b, round) {}
divide(10, 3, true);

// 推荐
function divide(a, b, { round = false } = {}) {}
divide(10, 3, { round: true });
```

### 对象与数组

- 用扩展运算符做浅拷贝：`const copy = [...list]`、`const next = { ...state, loading: false }`。
- 类数组转数组用 `Array.from()`：`Array.from(document.querySelectorAll('li'))`。
- 不直接修改入参和共享状态，返回新对象。这在 React、Redux 等依赖引用比较的场景里尤其重要。
- 只做"键值映射"且键不固定时，考虑用 `Map`：键可以是任意类型，有 `size`，遍历顺序就是插入顺序。描述一个有固定字段的实体时仍用普通对象。

### 类与模块

- 用 `class` 和 `extends` 代替手写 `prototype` 继承。
- 用 ES Module 的 `import` / `export`，不混用 CommonJS。
- 具名导出（`export function foo`）便于重命名检查和自动导入，许多团队默认只用具名导出；如果使用默认导出，同一模块里尽量不要同时有大量具名导出。

### 异步

- 用 `async` / `await` 代替层层嵌套的 `then`。
- 每个 `await` 的失败都要有去处：要么 `try/catch` 处理，要么让错误向上抛给统一的错误处理层。不要写空的 `catch`。
- 互不依赖的请求用 `Promise.all` 并发，而不是逐个 `await`。

```js
// 两个请求互不依赖，并发执行
const [user, orders] = await Promise.all([fetchUser(id), fetchOrders(id)]);
```

错误处理的更多细节见 [错误类型与异常处理](/notes/fronted/language/javascript/basic.html)。

### 与接口交互的约定

- 统一封装请求层，在一处处理超时、登录失效、网络错误和业务错误码，页面里只处理成功数据和需要特殊提示的错误。
- GET 请求的查询参数用 `URLSearchParams` 或 `encodeURIComponent` 编码，不要手动拼接含特殊字符的字符串。
- 提交类按钮在请求进行中禁用，防止重复提交。

```js
const params = new URLSearchParams({ keyword: 'a&b c', page: '1' });
fetch(`/api/search?${params}`); // keyword=a%26b+c&page=1
```

## 注释原则

注释写"代码没法表达的东西"，而不是把代码翻译成中文。

**应该写注释的情况：**

- **为什么这样做**：例如绕过某个浏览器 bug、对接口返回的特殊兼容。
- **不显而易见的约束**：调用前必须先做什么、参数取值范围、返回值的特殊含义。
- **魔法数字的来源**：`const RETRY_DELAY = 300; // 与后端限流窗口一致`。
- **TODO / FIXME**：写明原因，最好附上相关问题的链接，避免变成永远没人处理的标记。

**不应该写注释的情况：**

- 复述代码：`i++ // i 加 1`。
- 给不好的名字打补丁：与其写 `// d 是过期天数`，不如把变量改名为 `expireDays`。
- 注释掉的旧代码：版本管理里有历史，直接删除。

对导出的函数、组件，可以用 JSDoc 写一行用途说明，TypeScript 项目里类型已经能表达的信息不必重复：

```ts
/** 把金额（单位：分）格式化为带千分位的元字符串 */
export function formatCent(cent: number): string {
  return (cent / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
}
```

## Git 提交规范

提交信息推荐遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)，格式：

```text
<type>(<scope>): <subject>

<body>

<footer>
```

- `type`：提交类型，必填。
- `scope`：影响范围，如模块名，可选。
- `subject`：一句话说明改了什么，用祈使语气，结尾不加句号。
- `body`：说明为什么改、怎么改，可选。
- `footer`：关联问题编号，或用 `BREAKING CHANGE:` 标注不兼容变更。

常用 type：

| type | 含义 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 只改文档 |
| `style` | 不影响逻辑的格式调整（空格、分号等），不是指 CSS |
| `refactor` | 重构，既不是新功能也不是修 bug |
| `perf` | 性能优化 |
| `test` | 增加或修改测试 |
| `build` | 构建系统或外部依赖变更 |
| `ci` | CI 配置变更 |
| `chore` | 其他杂项 |
| `revert` | 回滚某次提交 |

示例：

```text
feat(order): 订单列表支持按状态筛选

fix(login): 修复记住密码时自动填充触发提交的问题

refactor(request)!: 统一错误码处理

BREAKING CHANGE: request() 不再返回原始 Response，改为返回解析后的 data
```

这种格式的好处是可以按 type 自动生成更新日志，也能根据 `feat` / `fix` / `BREAKING CHANGE` 推导语义化版本号。

其他提交习惯：

- 一次提交只做一件事，便于评审和回滚。
- 不要把格式化整个文件和逻辑修改混在一次提交里。
- 提交前确认没有调试代码（`console.log`、`debugger`）和密钥。

Git 命令本身的用法见 [Git 常用操作](/notes/others/git.html)。

## 代码评审要点

代码评审（Code Review）的目的是发现问题和传递知识，而不是比较个人偏好。格式问题交给工具，人只看工具看不出来的东西。

**作者提交前：**

- 改动范围尽量小，描述里写清楚背景、改了什么、怎么验证。
- 自己先看一遍 diff，去掉无关改动。

**评审者关注的重点（按优先级）：**

1. **正确性**：逻辑是否符合需求，边界情况（空数组、空值、网络失败、并发请求）是否处理。
2. **安全**：用户输入是否校验，是否有 XSS 风险（如直接把用户内容写进 `innerHTML`），是否泄露密钥。
3. **可维护性**：命名是否清楚，函数是否过长，是否有重复逻辑，抽象是否必要。
4. **性能**：是否有明显的重复渲染、无用请求、大列表一次性渲染。
5. **测试**：关键逻辑是否有测试覆盖。

**评论的写法：**

- 对事不对人，说明理由："这里 `list` 可能是 `undefined`，接口失败时会报错"比"这里写得不对"有用得多。
- 区分必须改和建议改，例如在建议性评论前加"可选："。

## 工具化落地

规范只有被工具自动执行，才不会随时间被遗忘。常用组合：

| 工具 | 作用 |
| --- | --- |
| ESLint | 检查 JS/TS 代码质量问题和潜在错误 |
| Prettier | 统一代码格式（缩进、引号、换行） |
| Stylelint | 检查 CSS / SCSS / Less |
| husky | 管理 Git hooks，在提交前后执行脚本 |
| lint-staged | 只对本次暂存的文件执行检查，速度快 |
| commitlint | 检查提交信息是否符合约定格式 |

分工原则：**格式交给 Prettier，质量交给 ESLint。** 两者规则冲突时，用 `eslint-config-prettier` 关掉 ESLint 中与格式相关的规则。过去常用 `eslint-plugin-prettier` 把 Prettier 作为 ESLint 规则运行，现在更推荐两者分开执行，速度更快，报错也更清晰。

### ESLint

ESLint 9 起默认使用扁平配置文件 `eslint.config.js`（旧的 `.eslintrc.*` 格式已被弃用）。可以用官方命令初始化：

```bash
npm init @eslint/config@latest
```

一个 TypeScript 项目的最小配置：

```js
// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  prettier, // 放在最后，关闭与 Prettier 冲突的格式规则
);
```

配置文件使用 ESM 语法（`import` / `export default`）。如果 `package.json` 里没有 `"type": "module"`，把文件名改成 `eslint.config.mjs`；后面的 `commitlint.config.js` 同理。

React、Vue 项目再分别加入 `eslint-plugin-react-hooks`、`eslint-plugin-vue` 等插件提供的配置。

### Prettier

```bash
npm i -D prettier eslint-config-prettier
```

```json title=".prettierrc"
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

用 `.prettierignore` 排除构建产物等不需要格式化的文件。Prettier 的选项刻意保持很少，团队不必在格式细节上反复争论。

### Stylelint

```bash
npm i -D stylelint stylelint-config-standard
```

```json title=".stylelintrc.json"
{
  "extends": ["stylelint-config-standard"]
}
```

使用 SCSS 时换成 `stylelint-config-standard-scss`。

### husky + lint-staged

在提交前只检查本次改动的文件：

```bash
npm i -D husky lint-staged
npx husky init
```

`husky init` 会在 `package.json` 里加入 `"prepare": "husky"` 脚本，并生成 `.husky/pre-commit`。把其中的内容改为：

```bash
# .husky/pre-commit
npx lint-staged
```

在 `package.json` 中配置 lint-staged：

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{css,scss}": ["stylelint --fix", "prettier --write"],
    "*.{json,md}": "prettier --write"
  }
}
```

### commitlint

```bash
npm i -D @commitlint/cli @commitlint/config-conventional
```

```js
// commitlint.config.js
export default { extends: ['@commitlint/config-conventional'] };
```

```bash
# .husky/commit-msg
npx --no -- commitlint --edit "$1"
```

此后不符合 Conventional Commits 格式的提交信息会被拒绝。

:::tip
本地 hooks 可以被 `git commit --no-verify` 跳过，所以 CI 里也应该再跑一遍 lint 和类型检查，作为最终把关。
:::

### 编辑器配置

让编辑器在保存时自动修复，减少手工操作。VS Code 的工作区配置 `.vscode/settings.json`：

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

再配合项目根目录的 `.editorconfig` 统一缩进和换行符，让不同编辑器的基础行为一致。相关插件见 [VS Code 插件推荐](/notes/fronted/soft/vsCodePlugin.html)。

## 小结

- 命名风格按标识符类型统一：变量函数 camelCase、类和组件 PascalCase、常量 UPPER_SNAKE_CASE，布尔值带 `is` / `has` 前缀。
- 目录可以按类型或按功能组织，项目变大后按功能划分更好维护；关键是约定一致。
- 注释写"为什么"和"不显而易见的约束"，不复述代码，不保留注释掉的旧代码。
- 提交信息遵循 Conventional Commits，一次提交只做一件事。
- 评审时格式交给工具，人关注正确性、安全、可维护性。
- 用 ESLint + Prettier + Stylelint 做检查，husky + lint-staged + commitlint 在提交时拦截，CI 再兜底。

## 参考

- [ESLint：Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files)
- [typescript-eslint：Getting Started](https://typescript-eslint.io/getting-started/)
- [Prettier：Options](https://prettier.io/docs/en/options.html)
- [Stylelint：Getting started](https://stylelint.io/user-guide/get-started)
- [husky](https://typicode.github.io/husky/)
- [lint-staged](https://github.com/lint-staged/lint-staged)
- [commitlint](https://commitlint.js.org/)
- [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)
- [MDN：HTML 元素参考](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element)
