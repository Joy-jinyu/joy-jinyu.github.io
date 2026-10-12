---
title: PostCSS 工作原理
description: PostCSS 从解析、AST 节点、插件遍历到输出与 source map 的完整流程，以及用当前 API 写一个最小插件。
---

PostCSS 的处理流程和编译器前端很像：把源码解析成树，在树上做变换，再生成代码。这篇沿着这条流水线讲解析器、AST 节点类型、插件如何遍历和修改节点、输出与 source map，最后用 PostCSS 8 的插件 API 写一个可运行的小插件。PostCSS 的定位和用法见 [PostCSS 简介](/notes/fronted/projectBuild/postcss/introduction.html)。

## 整体流程

```text
CSS 字符串
  │  Parser（分词 + 语法分析）
  ▼
AST（Root 及其子节点）
  │  插件按顺序遍历、修改
  ▼
修改后的 AST
  │  Stringifier
  ▼
CSS 字符串 + source map
```

在代码里对应的是：

```js
const postcss = require('postcss');

postcss([pluginA(), pluginB()])
  .process(css, { from: 'src/app.css', to: 'dist/app.css', map: { inline: false } })
  .then((result) => {
    result.css; // 输出的 CSS
    result.map; // source map 对象
    result.warnings(); // 插件产生的警告
  });
```

`postcss([...])` 创建一个处理器，`process()` 返回一个 LazyResult：真正的处理在访问 `.css`、调用 `.then()` 等时才执行。存在异步插件时必须用 `.then()` / `await`，同步访问 `.css` 会报错。

这和编译器的"源码 → 中间表示 → 目标代码"是同一个思路，区别在于 PostCSS 的输入和输出都是 CSS，中间表示就是 AST。通用的 AST 概念可以参考 [AST 与代码转换](/notes/fronted/language/javascript/ast.html)。

## Parser：从字符串到 AST

解析分两步：

1. **分词（tokenize）**：把字符串切成 token，比如单词、括号、冒号、分号、字符串、注释、空白。
2. **语法分析（parse）**：根据 token 序列组装节点，遇到 `{` 开始一个规则块，遇到 `prop: value;` 生成一个声明，遇到 `@` 开头的生成 at 规则。

PostCSS 解析器有两个特点：

- **只管结构，不校验语义。** 它不知道 `colr: red` 是拼错的属性，也不知道某个 at 规则是否存在，只要结构合法就能解析。这让插件可以引入新的语法。
- **保留原始格式。** 每个节点的 `raws` 属性记录了空白、换行、分号等原始格式信息。不经插件修改的部分，输出时能和输入保持一致，不会被重新排版。

解析器可以替换。通过 `syntax` 或 `parser` 选项传入 `postcss-scss`、`postcss-less` 等自定义语法，就能把 SCSS、Less 源码解析成 PostCSS AST，用于 stylelint 检查这类场景。注意这只是"能解析"，并不会把 SCSS 编译成 CSS。

## AST 节点类型

```css
/* 主题色 */
@media (min-width: 768px) {
  .btn {
    color: red;
  }
}
```

解析结果：

```text
Root
├── Comment        text: "主题色"
└── AtRule         name: "media", params: "(min-width: 768px)"
    └── Rule       selector: ".btn"
        └── Declaration  prop: "color", value: "red"
```

| 节点 | 对应 CSS | 常用属性 |
| --- | --- | --- |
| `Root` | 整个文件 | `nodes` |
| `AtRule` | `@media`、`@import`、`@font-face` 等 | `name`、`params`、`nodes`（可能没有，比如 `@import`） |
| `Rule` | 选择器加规则块 | `selector`、`selectors`、`nodes` |
| `Declaration` | `属性: 值` | `prop`、`value`、`important` |
| `Comment` | `/* ... */` | `text` |

另有一个 `Document` 节点，用于一个文件里包含多段 CSS 的情况（如 HTML 中的多个 `<style>`），一般插件很少需要处理。

所有节点都有 `type`、`parent`、`source`（在源文件中的位置）、`raws`。容器节点（Root、AtRule、Rule）提供遍历和增删方法：

```js
const root = postcss.parse('a { color: red; margin: 0 }');

root.walkDecls((decl) => {
  console.log(decl.prop, decl.value);
});
// color red
// margin 0

root.walkRules('a', (rule) => {
  rule.append({ prop: 'padding', value: '0' });
});

console.log(root.toString());
// a { color: red; margin: 0; padding: 0 }
```

常用的操作方法：`walk` / `walkDecls` / `walkRules` / `walkAtRules` / `walkComments` 遍历；`append` / `prepend` / `insertBefore` / `insertAfter` 插入；`remove` / `replaceWith` 删除和替换；`clone` / `cloneBefore` / `cloneAfter` 复制节点。

## 插件如何处理 AST

### 访问者（visitor）模式

PostCSS 8 的插件是一个对象，按节点类型声明回调，由 PostCSS 统一遍历一次 AST，在走到对应节点时调用所有插件的回调：

| 事件 | 触发时机 |
| --- | --- |
| `Once` / `OnceExit` | 每个文件开始处理时 / 全部处理完后，各执行一次 |
| `Root` / `RootExit` | 进入 / 离开根节点 |
| `AtRule` / `AtRuleExit` | 进入 / 离开 at 规则，可以按名称过滤，如 `AtRule: { media: fn }` |
| `Rule` / `RuleExit` | 进入 / 离开规则 |
| `Declaration` / `DeclarationExit` | 遇到声明，可以按属性名过滤，如 `Declaration: { color: fn }` |
| `Comment` / `CommentExit` | 遇到注释 |

旧的写法是每个插件在 `Once` 里自己调用 `root.walkDecls()` 把整棵树走一遍，十个插件就走十遍。访问者模式让多个插件共享同一次遍历，开销更小。

### 修改后的重新访问

插件修改了节点后，PostCSS 会把被改动的节点标记为"脏"，在本轮遍历后重新访问这些节点，让其他插件有机会处理新内容。这带来一个要求：**插件的修改必须是收敛的**。如果回调每次都会再改一次同一个节点（比如无条件地在值后面追加内容），就会陷入死循环。常见做法是先判断是否需要处理，处理过的节点不再命中条件。

### 插件间的数据传递

回调的第二个参数是辅助对象，常用的有 `result`（用于 `result.warn()` 输出警告）、`postcss`（用于创建节点，如 `postcss.decl()`），以及 `Comment`、`Declaration` 等节点构造器。

## Stringifier 与 source map

输出阶段由 Stringifier 递归拼接节点：节点自身的内容加上 `raws` 中保存的空白和分隔符。没有 `raws` 的新建节点会按默认格式（或参照同级节点的格式）输出。

source map 的生成依赖每个节点的 `source` 字段：解析时记录了节点在输入文件中的起止位置，输出时把节点在新文件中的位置与之对应。相关选项：

```js
postcss(plugins).process(css, {
  from: 'src/app.css', // 输入文件路径，用于 source map 和报错定位
  to: 'dist/app.css', // 输出文件路径
  map: {
    inline: false, // 不内联到 CSS 末尾，单独生成 .map
    prev: prevMap, // 上一个工具（如 Sass）生成的 map，用于串联
  },
});
```

`from` 应该总是传入，否则 PostCSS 会给出警告，source map 和错误信息中也看不到文件名。确实没有文件时（比如测试中处理字符串）可以显式传 `from: undefined`。`prev` 用于多步编译：Sass → PostCSS 时把 Sass 的 map 传进来，最终 map 就能直接指回 `.scss` 源文件。构建工具的 loader 一般会自动处理这一步。

## 写一个最小插件

需求：把声明值中的 `px` 换算成 `rem`，基准值可配置。

```js
// postcss-px-to-rem-lite.js
const PX_REGEXP = /(\d*\.?\d+)px/g;

/** 把声明值里的 px 换算成 rem */
const plugin = (opts = {}) => {
  const rootValue = opts.rootValue ?? 16;
  const minPixelValue = opts.minPixelValue ?? 1;

  return {
    postcssPlugin: 'postcss-px-to-rem-lite',
    Declaration(decl) {
      if (!decl.value.includes('px')) return;
      decl.value = decl.value.replace(PX_REGEXP, (match, num) => {
        const px = Number(num);
        // 1px 边框这类细线保持原样
        if (px <= minPixelValue) return match;
        return `${px / rootValue}rem`;
      });
    },
  };
};

plugin.postcss = true;

module.exports = plugin;
```

几个必须项：

- 导出的是**函数**，调用后返回插件对象，这样用户可以传选项。
- 返回对象必须有 `postcssPlugin` 字段，值是插件名，用于报错信息和调试。
- 函数上要设置 `plugin.postcss = true`，PostCSS 据此识别这是一个插件工厂，用户才能写成 `postcss([plugin])` 不带括号。

使用和验证：

```js
const postcss = require('postcss');
const pxToRem = require('./postcss-px-to-rem-lite');

postcss([pxToRem({ rootValue: 16 })])
  .process('.box { margin: 16px 8px; border: 1px solid #000 }', { from: undefined })
  .then((result) => {
    console.log(result.css);
    // .box { margin: 1rem 0.5rem; border: 1px solid #000 }
  });
```

替换后的值里不再有可匹配的 `px`（`1px` 保留但会被同样的条件跳过），所以重新访问不会造成死循环。

这个示例只演示 API，实际使用还需要处理更多情况：`url()` 和字符串中的 `px` 不应替换、选择器或属性黑名单、媒体查询参数是否换算等。正式项目优先使用成熟插件。

### ESM 写法

```js
/** 把声明值里的 px 换算成 rem */
const plugin = (opts = {}) => ({
  postcssPlugin: 'postcss-px-to-rem-lite',
  Declaration(decl) {
    // 同上
  },
});
plugin.postcss = true;

export default plugin;
```

### 已废弃的 postcss.plugin()

PostCSS 8 之前的插件这样写：

```js
// 旧写法，PostCSS 8 起已废弃
module.exports = postcss.plugin('my-plugin', (opts) => {
  return (root, result) => {
    root.walkDecls((decl) => {
      /* ... */
    });
  };
});
```

PostCSS 8 废弃了 `postcss.plugin()`，调用时会输出废弃警告。主要原因是这种写法要求插件把 `postcss` 作为 `dependencies` 引入，项目里可能同时装了多个 PostCSS 版本，导致节点类型对不上；而新写法通过回调参数拿到 `postcss` 实例，插件只需把 `postcss` 声明为 `peerDependencies`。旧资料里的插件示例看到 `postcss.plugin` 时，应改写为上面的对象形式。

## 小结

- PostCSS 流程是 Parser → AST → 插件修改 → Stringifier，可附带输出 source map。
- AST 主要由 Root、AtRule、Rule、Declaration、Comment 组成，`raws` 保留原始格式，`source` 记录源码位置。
- PostCSS 8 插件使用访问者模式：返回 `{ postcssPlugin, Declaration() {...} }` 这样的对象，多个插件共享一次遍历。
- 修改过的节点会被重新访问，插件修改必须收敛，否则会死循环。
- `postcss.plugin()` 已废弃，新插件导出工厂函数并设置 `plugin.postcss = true`，`postcss` 作为 peer 依赖。

## 参考

- [PostCSS API 文档](https://postcss.org/api/)
- [PostCSS：Writing a PostCSS Plugin](https://postcss.org/docs/writing-a-postcss-plugin)
