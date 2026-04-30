---
title: AST 与代码转换
description: 什么是抽象语法树、源码如何经过词法分析和语法分析变成 AST、ESTree 规范，以及用 Babel 解析、遍历、生成代码并编写插件，AST 在 ESLint、Prettier 和构建工具中的应用。
---

Babel、ESLint、Prettier、TypeScript、webpack 这些工具看起来功能各异，底层做的事却很相似：先把源码解析成抽象语法树（AST），在树上分析或修改，再输出结果。这篇讲 AST 是什么、怎么生成，然后用 Babel 演示完整的"解析、转换、生成"流程，并写一个最小插件，最后看各类工具如何使用 AST。

## 什么是 AST

AST（Abstract Syntax Tree，抽象语法树）是源码语法结构的树形表示。每个节点代表一种语法结构，比如变量声明、函数调用、二元运算。

"抽象"指的是它丢掉了不影响语义的细节：括号、分号、空白、大部分格式信息都不会作为节点出现，只通过树的结构体现。比如 `(1 + 2) * 3` 里的括号，在 AST 中体现为"乘法节点的左侧是一个加法节点"。保留全部细节（包括每个括号和空白）的树叫具体语法树（CST），通常只在需要原样还原格式的工具中使用。

以 `const a = 1 + 2;` 为例，它的 AST（ESTree 格式，省略位置信息）是：

```json
{
  "type": "Program",
  "sourceType": "script",
  "body": [
    {
      "type": "VariableDeclaration",
      "kind": "const",
      "declarations": [
        {
          "type": "VariableDeclarator",
          "id": { "type": "Identifier", "name": "a" },
          "init": {
            "type": "BinaryExpression",
            "operator": "+",
            "left": { "type": "Literal", "value": 1, "raw": "1" },
            "right": { "type": "Literal", "value": 2, "raw": "2" }
          }
        }
      ]
    }
  ]
}
```

每个节点都有 `type` 字段表示类型，其余字段因类型而异。真实的 AST 还会带 `start`、`end`、`loc` 等位置信息，工具靠它们报告错误位置和生成 source map。

## 从源码到 AST

解析通常分两步。

### 词法分析（Tokenizing）

扫描字符流，切分成有意义的最小单元，称为 token（词法单元），同时丢掉空白和注释（或单独保存）：

| token | 类型 |
| --- | --- |
| `const` | 关键字 |
| `a` | 标识符 |
| `=` | 运算符 |
| `1` | 数字字面量 |
| `+` | 运算符 |
| `2` | 数字字面量 |
| `;` | 标点 |

这一步只看单个词是否合法，不关心它们的组合。

### 语法分析（Parsing）

按照语言的语法规则，把 token 序列组装成树，同时检查结构是否合法。比如 `const a = ;` 每个 token 都合法，但在语法分析阶段会报 `SyntaxError`，因为 `=` 后面缺少表达式。运算符优先级、结合性也在这一步处理：`1 + 2 * 3` 会被组装成"加法的右侧是乘法"。

JavaScript 引擎执行代码前也要经过这两步，之后再把 AST 编译成字节码或机器码。作用域就是在这个阶段基本确定的，见[作用域与闭包](/notes/fronted/language/javascript/theJavaScriptYouDontKonw/scopeAndClosure_01.html)。

## ESTree 规范

不同解析器生成的 AST 如果各不相同，工具之间就无法共享。ESTree 是社区维护的 JavaScript AST 格式规范，它起源于 Mozilla SpiderMonkey 引擎暴露的解析器 API，后来随着语言版本更新持续扩展。

遵循或基本遵循 ESTree 的解析器有 Acorn、Espree（ESLint 默认解析器，基于 Acorn）等。常见节点类型：

| 节点类型 | 对应代码 |
| --- | --- |
| `Program` | 整个文件 |
| `VariableDeclaration` / `VariableDeclarator` | `const a = 1` |
| `FunctionDeclaration` / `ArrowFunctionExpression` | 函数声明 / 箭头函数 |
| `Identifier` | 变量名、属性名 |
| `Literal` | 字面量 |
| `CallExpression` | `fn(a)` |
| `MemberExpression` | `obj.prop`、`obj[key]` |
| `BinaryExpression` | `a + b` |
| `IfStatement`、`ReturnStatement`、`BlockStatement` | 对应语句 |
| `ImportDeclaration` / `ExportNamedDeclaration` | 模块导入导出 |

Babel 的 AST 基于 ESTree，但有一些差异：最外层多一个 `File` 节点包住 `Program`；`Literal` 被细分为 `StringLiteral`、`NumericLiteral`、`BooleanLiteral` 等；还支持 JSX、TypeScript、Flow 等扩展节点。需要严格 ESTree 输出时，可以给 `@babel/parser` 开启 `estree` 插件。

写代码处理 AST 之前，最好先在 [AST Explorer](https://astexplorer.net/) 里粘贴代码，选择对应的解析器，直接查看节点结构，比查文档快得多。

## 用 @babel/parser 解析

```bash
npm install @babel/parser @babel/traverse @babel/generator @babel/types
```

```js
const { parse } = require('@babel/parser');

const ast = parse('const greet = (name) => `hi ${name}`;', {
  sourceType: 'module',            // 允许 import / export
  plugins: ['jsx', 'typescript'],  // 按需开启语法扩展
});

console.log(ast.type);                                    // 'File'
console.log(ast.program.body[0].type);                    // 'VariableDeclaration'
console.log(ast.program.body[0].declarations[0].init.type); // 'ArrowFunctionExpression'
```

`sourceType` 可选 `'script'`、`'module'`、`'unambiguous'`（根据有没有 `import` / `export` 自动判断）。解析失败会抛出 `SyntaxError`，错误对象上带有出错位置。

## Babel 转换的三个阶段

Babel 的工作可以分成三步：

| 阶段 | 工具包 | 输入 → 输出 |
| --- | --- | --- |
| 解析（parse） | `@babel/parser` | 源码字符串 → AST |
| 转换（transform） | `@babel/traverse` + 插件 | AST → 修改后的 AST |
| 生成（generate） | `@babel/generator` | AST → 代码字符串（和 source map） |

Babel 自身只负责这个流程，具体做什么转换完全由插件决定。不配置任何插件时，输出的代码和输入在语义上相同（格式可能变化）。`@babel/preset-env` 等预设只是一组插件的集合。

### 手动走一遍

```js
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

const code = 'function square(n) { return n * n; }';
const ast = parse(code);

traverse(ast, {
  Identifier(path) {
    if (path.node.name === 'n') {
      path.node.name = 'x';
    }
  },
});

const output = generate(ast, {}, code);
console.log(output.code);
// function square(x) {
//   return x * x;
// }
```

`@babel/traverse` 和 `@babel/generator` 用 CommonJS 引入时要取 `.default`，这是它们以 ES 模块默认导出编译后的形式。

### 访问者模式与 path

`traverse` 深度优先遍历整棵树。传入的对象叫**访问者（visitor）**，键是节点类型，遍历到该类型的节点时调用对应的函数。默认在进入节点时调用，也可以分别指定进入和离开：

```js
traverse(ast, {
  FunctionDeclaration: {
    enter(path) { /* 进入函数节点，子节点还没遍历 */ },
    exit(path) { /* 子节点都遍历完了 */ },
  },
});
```

回调拿到的不是节点本身，而是 **path**。`path.node` 才是节点，path 额外提供了上下文和操作能力：

| 能力 | 示例 |
| --- | --- |
| 访问父节点 | `path.parent`、`path.parentPath` |
| 访问子路径 | `path.get('body')` |
| 修改树 | `path.replaceWith(node)`、`path.remove()`、`path.insertBefore(node)` |
| 作用域信息 | `path.scope.hasBinding('x')`、`path.scope.rename('a', 'b')` |
| 控制遍历 | `path.skip()`（不遍历子节点）、`path.stop()`（停止整个遍历） |

上面直接改 `path.node.name` 的写法过于粗暴，会把其他作用域里同名的 `n` 也改掉。正确的重命名应该用 `path.scope.rename`，它会根据作用域信息只改同一个绑定的所有引用。

## 写一个最小 Babel 插件

Babel 插件是一个函数，接收 Babel 的 API 对象，返回包含 `visitor` 的对象。`types`（即 `@babel/types`）提供了判断节点类型（`t.isXxx`）和创建节点（`t.xxx()`）的工具。

### 示例一：移除 console.log

```js
// babel-plugin-remove-console-log.js
module.exports = function removeConsoleLog({ types: t }) {
  return {
    name: 'remove-console-log',
    visitor: {
      ExpressionStatement(path) {
        const expr = path.node.expression;
        if (
          t.isCallExpression(expr) &&
          t.isMemberExpression(expr.callee) &&
          t.isIdentifier(expr.callee.object, { name: 'console' }) &&
          t.isIdentifier(expr.callee.property, { name: 'log' }) &&
          !path.scope.hasBinding('console') // 局部变量也叫 console 时不处理
        ) {
          path.remove();
        }
      },
    },
  };
};
```

几个细节：

- 匹配的是 `ExpressionStatement`（独立成句的调用），而不是所有 `CallExpression`。如果 `console.log` 出现在表达式中间（如 `a = console.log(x)`），直接删除调用会破坏语法。
- 用 `path.scope.hasBinding('console')` 排除被局部变量遮蔽的情况，这是 AST 方案相对正则替换的优势：它理解作用域。
- `console['log']()` 这种计算属性写法，`property` 是 `StringLiteral`，这个最小实现没有覆盖。

### 示例二：用节点构造器替换代码

把指数运算 `a ** b` 转成 `Math.pow(a, b)`：

```js
module.exports = function transformExponent({ types: t }) {
  return {
    name: 'transform-exponent',
    visitor: {
      BinaryExpression(path) {
        if (path.node.operator !== '**') return;
        path.replaceWith(
          t.callExpression(
            t.memberExpression(t.identifier('Math'), t.identifier('pow')),
            [path.node.left, path.node.right],
          ),
        );
      },
    },
  };
};
```

替换后的新节点也会被继续遍历，所以嵌套的 `a ** b ** c` 也能被处理。复合赋值 `a **= b` 是 `AssignmentExpression`，这里没有覆盖。

### 使用插件

```js
const { transformSync } = require('@babel/core');

const result = transformSync('console.log(1); const y = 2 ** 3;', {
  plugins: ['./babel-plugin-remove-console-log.js', './transform-exponent.js'],
  configFile: false,
});
console.log(result.code);
// const y = Math.pow(2, 3);
```

在项目中则写进 Babel 配置文件的 `plugins` 数组。插件按数组顺序执行，并且多个插件的访问者会合并到同一次遍历中，而不是每个插件各遍历一遍。

## AST 在工具链中的应用

### ESLint

ESLint 用 Espree 把代码解析成 ESTree 格式的 AST，每条规则就是一个访问者，在匹配的节点上检查并报告问题。一个禁止 `==` 的简化规则：

```js
// eqeqeq 规则的简化版
module.exports = {
  meta: {
    type: 'suggestion',
    messages: { useStrict: '请使用 {{expected}} 代替 {{actual}}' },
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator === '==' || node.operator === '!=') {
          context.report({
            node,
            messageId: 'useStrict',
            data: { expected: `${node.operator}=`, actual: node.operator },
          });
        }
      },
    };
  },
};
```

规则还可以提供 `fix` 函数实现自动修复，修复操作基于源码文本的位置范围，而不是重新生成整段代码。解析 TypeScript 时，ESLint 换用 `@typescript-eslint/parser`，它输出兼容 ESTree 的 AST。

### Prettier

Prettier 先把代码解析成 AST，然后几乎完全抛弃原有格式，根据 AST 和打印宽度等配置重新打印代码。所以不管原来怎么排版，输出都一致。它只保留少量原始格式信息，比如空行、注释的位置。这也解释了为什么 Prettier 不会改变代码语义：它输出的是同一棵树。

### 构建工具

- **依赖分析**：打包器解析每个模块的 AST，找出 `import`、`require`、动态 `import()`，构建依赖图。webpack 内部就是用 Acorn 解析 JavaScript 模块的。
- **Tree shaking**：基于 ES 模块的静态结构，分析哪些导出没有被用到，在打包结果中去掉。
- **语法转译**：Babel、TypeScript 编译器、esbuild、SWC 把新语法、JSX、TypeScript 转成目标环境能运行的代码。后两者分别用 Go 和 Rust 编写，速度明显快于基于 JavaScript 的工具。
- **压缩**：Terser 等压缩工具在 AST 上做变量重命名、死代码删除、常量折叠。
- **代码迁移（codemod）**：批量升级 API 时，用 jscodeshift 等工具在 AST 上做结构化修改，比正则替换可靠。
- **CSS 也有 AST**：PostCSS 把 CSS 解析成 AST 交给插件处理，原理见 [PostCSS 工作原理](/notes/fronted/projectBuild/postcss/translate.html)。

webpack 的 Loader 和 Plugin 开发可以参考 [webpack Loader 与 Plugin 开发](/notes/fronted/projectBuild/webpack/api.html)。

:::tip
需要修改代码时，先问自己能否用正则可靠完成。只要涉及作用域、嵌套结构、字符串和注释中可能出现相同文本等情况，就该用 AST。反过来，只是改一个固定的配置字符串，正则就够了。
:::

## 小结

- AST 是源码语法结构的树形表示，省略了括号、分号、空白等不影响语义的细节，每个节点用 `type` 标识。
- 源码经过词法分析得到 token，再经过语法分析组装成 AST；语法错误在这一步被发现。
- ESTree 是 JavaScript AST 的通用格式规范，Babel 在其基础上做了扩展和少量改动。
- Babel 的流程是 parse → transform → generate，插件通过访问者在 path 上读取和修改节点，`path.scope` 提供作用域信息。
- ESLint 的规则、Prettier 的重新打印、打包器的依赖分析和 tree shaking、压缩和 codemod，底层都依赖 AST；调试时先用 AST Explorer 看节点结构。

## 参考

- [ESTree 规范](https://github.com/estree/estree)
- [Babel：@babel/parser](https://babeljs.io/docs/babel-parser)
- [Babel：@babel/traverse](https://babeljs.io/docs/babel-traverse)
- [Babel：@babel/types](https://babeljs.io/docs/babel-types)
- [Babel：插件开发](https://babeljs.io/docs/plugins)
- [ESLint：自定义规则](https://eslint.org/docs/latest/extend/custom-rules)
- [AST Explorer](https://astexplorer.net/)
