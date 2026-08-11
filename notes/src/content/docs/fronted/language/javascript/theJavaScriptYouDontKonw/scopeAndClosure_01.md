---
title: 作用域与闭包
description: 词法作用域、作用域链、var/let/const 与暂时性死区、变量提升、块级作用域，以及闭包的原理、典型用途、循环陷阱和内存注意点。
---

作用域决定"一个变量名在这里指向哪个变量"，闭包则是作用域规则自然带来的结果：函数在定义它的作用域之外执行时，仍然能访问那个作用域。这篇从引擎如何处理变量讲起，依次梳理词法作用域、`var/let/const` 的差异、提升与暂时性死区，再讲闭包的原理、用途和常见坑。

## 引擎如何处理一段代码

JavaScript 常被称为"解释型语言"，但现代引擎在执行前都会先做编译。一个简化的流程：

1. **词法分析**：把源码切成一个个词法单元（token），如 `var`、`a`、`=`、`2`。
2. **语法分析**：根据语法规则把 token 组装成抽象语法树（AST）。
3. **代码生成**：把 AST 转换成可执行的代码（字节码或机器码）。

作用域在第 2 步就基本确定了：哪个变量声明在哪个函数、哪个块里，看源码结构就知道。AST 的细节可以参考 [AST 与代码转换](/notes/fronted/language/javascript/ast.html)。

### LHS 与 RHS 查询

引擎查找变量有两种目的：

- **LHS（赋值的目标）**：`a = 2` 里找 `a`，是为了给它赋值。
- **RHS（取值）**：`console.log(a)` 里找 `a`，是为了拿到它的值。

两者找不到变量时的表现不同：

| 情况 | 结果 |
| --- | --- |
| RHS 查询找不到变量 | 抛出 `ReferenceError` |
| LHS 查询找不到变量，非严格模式 | 自动在全局创建这个变量（隐式全局变量） |
| LHS 查询找不到变量，严格模式 | 抛出 `ReferenceError` |
| 找到了变量，但对值做了不合法操作（如调用非函数） | 抛出 `TypeError` |

隐式全局变量是常见的 bug 来源，这也是推荐开启严格模式（或使用 ES 模块，模块默认是严格模式）的原因之一。错误类型的细节见[错误类型与异常处理](/notes/fronted/language/javascript/basic.html)。

## 词法作用域

作用域有两种模型：

- **词法作用域（静态作用域）**：变量的可见范围由代码**写在哪里**决定，定义时就确定了。
- **动态作用域**：变量的可见范围由函数**在哪里被调用**决定，运行时才确定。

JavaScript 采用词法作用域：

```js
const value = 'global';

function foo() {
  console.log(value);
}

function bar() {
  const value = 'bar';
  foo();
}

bar(); // 'global'
```

`foo` 定义在全局，它内部的 `value` 就指向全局的 `value`，与 `bar` 在哪里调用它无关。如果是动态作用域，这里会输出 `'bar'`。

常有人说"JavaScript 的 `this` 是动态作用域"。更准确的说法是：`this` 不是变量，不走作用域查找，它的值由调用方式决定，这一点和动态作用域的"运行时确定"相似，但两者是不同的机制。`this` 的规则见 [this 与原型链](/notes/fronted/language/javascript/theJavaScriptYouDontKonw/thisAndPrototype_02.html)。

### 作用域链

作用域可以嵌套。查找变量时，引擎先在当前作用域找，找不到就去外层作用域，一直到全局作用域；全局也没有就按上一节的规则处理。这条由内向外的查找路径就是作用域链。

```js
const a = 1;

function outer() {
  const b = 2;
  function inner() {
    const c = 3;
    console.log(a + b + c); // 6：c 在本层，b 在 outer，a 在全局
  }
  inner();
}
outer();
```

内层同名变量会**遮蔽**外层变量，查找在第一个匹配处停止。

### 欺骗词法作用域：eval 与 with

`eval(code)` 可以在运行时往当前作用域里插入声明，`with(obj)` 会把一个对象当作作用域。它们让作用域无法在编译期确定，引擎也就难以优化。严格模式下 `with` 被禁止，`eval` 也有了自己独立的作用域。现代代码中不应使用它们。

## 作用域的种类

| 作用域 | 由什么创建 | 说明 |
| --- | --- | --- |
| 全局作用域 | 脚本顶层 | 浏览器中顶层 `var` 和函数声明会成为 `window` 的属性，`let` / `const` 不会 |
| 模块作用域 | ES 模块文件 | 每个模块的顶层变量只在模块内可见 |
| 函数作用域 | 函数 | 函数内声明的变量（包括 `var`）外部访问不到 |
| 块级作用域 | `{}`、`if`、`for`、`switch`、`try/catch` 等 | 只对 `let`、`const`、`class` 生效，`var` 无视块 |

`catch (err)` 中的 `err` 从一开始（ES3）就只在 `catch` 块中有效，算是 ES2015 之前少数几种块级作用域之一。

### 立即执行函数（IIFE）

在 `let` / `const` 出现之前，想要一个私有作用域只能借助函数：

```js
(function () {
  var temp = '只在这里可见';
  // ...
})();

console.log(typeof temp); // 'undefined'
```

IIFE 的作用是创建独立作用域、避免污染全局。现在有了块级作用域和 ES 模块，它的必要性已经降低，但在旧代码和一些打包产物中仍很常见。

## var、let、const

| 特性 | `var` | `let` | `const` |
| --- | --- | --- | --- |
| 作用域 | 函数作用域 | 块级作用域 | 块级作用域 |
| 重复声明 | 允许 | 同一作用域内报错 | 同一作用域内报错 |
| 提升 | 提升并初始化为 `undefined` | 提升但不初始化（暂时性死区） | 同 `let` |
| 重新赋值 | 可以 | 可以 | 不可以 |
| 顶层声明成为全局对象属性 | 是 | 否 | 否 |

`const` 保证的是**绑定不变**，不是值不可变：

```js
const user = { name: 'a' };
user.name = 'b';    // 可以，修改的是对象内容
user = {};          // TypeError，不能重新绑定
```

需要冻结对象内容时用 `Object.freeze`，它只冻结一层。

实践上：默认用 `const`，需要重新赋值时用 `let`，不再使用 `var`。

## 变量提升

引擎在执行一个作用域的代码之前，会先处理其中所有的声明。效果看起来像是声明被"提升"到了作用域顶部。注意：代码本身并没有被移动，只是声明在执行前就已经登记了；赋值仍然在原来的位置执行。

```js
console.log(a); // undefined
var a = 2;

// 相当于
var a;
console.log(a);
a = 2;
```

### 函数声明与函数表达式

函数声明会连同函数体一起提升，函数表达式只提升变量名：

```js
foo(); // 正常执行
function foo() {}

bar(); // TypeError: bar is not a function（此时 bar 是 undefined）
var bar = function () {};
```

同一作用域中，函数声明和 `var` 同名时，函数声明优先，`var` 的重复声明被忽略（但后面的赋值会覆盖）。

不建议在 `if` 等块里写函数声明：严格模式下它是块级的，非严格模式下各种历史兼容规则会让行为难以预测。需要条件定义时用函数表达式赋给 `let` / `const`。

### 暂时性死区（TDZ）

`let`、`const`、`class` 也会被提升，但不会被初始化。从进入作用域到执行到声明语句之间，这段区域叫暂时性死区，访问变量会抛出 `ReferenceError`：

```js
let x = 'outer';

{
  console.log(x); // ReferenceError，而不是 'outer'
  let x = 'inner';
}
```

这个例子证明了内层 `x` 确实被提升了：如果没有提升，这里会沿作用域链找到外层的 `'outer'`。

TDZ 中连 `typeof` 也会报错，这和"对未声明变量用 `typeof` 返回 `'undefined'`"不同：

```js
typeof undeclared; // 'undefined'
typeof y;          // ReferenceError
let y;
```

TDZ 的意义在于让"先用后声明"变成明确的错误，而不是悄悄得到 `undefined`。

## 闭包

### 定义

MDN 的定义：闭包是一个函数与其周围状态（词法环境）的引用捆绑在一起的组合。通俗地说，**函数会记住它被定义时所在的作用域，即使它在那个作用域之外执行，也能访问其中的变量**。

```js
function createCounter() {
  let count = 0;
  return function () {
    count += 1;
    return count;
  };
}

const counter = createCounter();
counter(); // 1
counter(); // 2
```

`createCounter` 执行完毕后，按理说它的局部变量 `count` 可以被回收了。但返回的函数仍然引用着 `count`，所以这块作用域被保留下来。每次调用 `createCounter` 都会创建一个新的作用域，彼此独立：

```js
const c1 = createCounter();
const c2 = createCounter();
c1(); c1();
c2(); // 1，与 c1 互不影响
```

### 原理

函数创建时，引擎会在函数对象内部保存一个指向当前词法环境的引用（规范中是 `[[Environment]]` 内部槽）。函数调用时创建新的词法环境，其外层指针指向这个保存的环境，于是作用域链得以延续。

因此严格来说，JavaScript 中每个函数在创建时都形成了闭包。我们平时说"闭包"，通常特指"函数在定义它的作用域之外被调用、并且访问了外层变量"这种能被观察到的情况，比如作为返回值、回调、事件处理函数。

## 闭包的典型用途

### 私有状态

闭包变量外部无法直接访问，只能通过返回的函数操作：

```js
function createWallet(initial) {
  let balance = initial;
  return {
    deposit(amount) {
      if (amount <= 0) throw new RangeError('金额必须大于 0');
      balance += amount;
    },
    getBalance() {
      return balance;
    },
  };
}

const wallet = createWallet(100);
wallet.deposit(50);
wallet.getBalance(); // 150
wallet.balance;      // undefined
```

`class` 现在可以用 `#field` 声明真正的私有字段，但闭包方案仍然常见于函数式风格的代码。

### 模块模式

ES 模块出现之前，常用 IIFE 加闭包实现模块，只暴露公共接口：

```js
const storage = (function () {
  const cache = new Map();
  function key(name) {
    return `app:${name}`;
  }
  return {
    get: (name) => cache.get(key(name)),
    set: (name, value) => cache.set(key(name), value),
  };
})();
```

现在用 ES 模块就能达到同样效果：模块里没有 `export` 的变量和函数就是私有的。

### 函数工厂

根据参数生成定制的函数：

```js
function createFormatter(currency) {
  const formatter = new Intl.NumberFormat('zh-CN', { style: 'currency', currency });
  return (value) => formatter.format(value);
}

const formatCNY = createFormatter('CNY');
const formatUSD = createFormatter('USD');
formatCNY(12.5); // '¥12.50'
```

`Intl.NumberFormat` 实例只创建一次，被闭包保存复用。

### 柯里化与偏函数

柯里化把多参数函数变成一系列单参数函数，每一步都靠闭包记住已经传入的参数：

```js
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return (...rest) => curried.apply(this, [...args, ...rest]);
  };
}

const add = (a, b, c) => a + b + c;
const curriedAdd = curry(add);
curriedAdd(1)(2)(3); // 6
curriedAdd(1, 2)(3); // 6
```

`fn.length` 不计算剩余参数和带默认值的参数，所以这个实现只适合参数个数固定的函数。

### 防抖等需要"记住状态"的工具函数

```js
function debounce(fn, wait) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}
```

`timer` 在多次调用之间共享，就是靠闭包保存的。节流、缓存（memoize）、`once` 也是同样的思路。

## 循环中的闭包

经典问题：

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 3 3 3
```

`var` 没有块级作用域，整个循环只有一个 `i`。三个回调闭包引用的是同一个变量，等它们执行时循环早已结束，`i` 是 3。

解决方法：

```js
// 1. 用 let：每次迭代都会创建新的 i 绑定
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 0 1 2

// 2. 用 IIFE 为每次迭代创建作用域（let 之前的写法）
for (var i = 0; i < 3; i++) {
  (function (j) {
    setTimeout(() => console.log(j), 0);
  })(i);
}

// 3. 利用 setTimeout 的额外参数传值
for (var i = 0; i < 3; i++) {
  setTimeout((j) => console.log(j), 0, i);
}
```

`for (let ...)` 的规范行为是：每次迭代开始时，用上一轮结束时的值创建一个新的 `i` 绑定，所以每个回调捕获的是各自那一轮的 `i`。这是语言特意为循环闭包设计的。

## 闭包与内存

闭包本身不是内存泄漏，但它会延长变量的生命周期：只要闭包函数还能被访问到，它引用的外层变量就不会被回收。需要注意的场景：

- **长期存活的闭包引用了大对象。** 比如挂在全局事件、定时器、缓存里的回调，引用了一个大数组或 DOM 节点。
- **忘记解除注册。** 组件销毁时没有 `removeEventListener`、`clearInterval`，回调和它引用的一切都会一直存活。
- **同一作用域里的闭包可能共享环境。** 引擎通常只为闭包保留实际用到的变量，但同一个函数里创建的多个闭包往往共享同一个环境对象，其中一个闭包用到的大对象可能因为另一个长期存活的闭包而无法回收。不要依赖具体引擎的优化行为。

```js
function setup(element) {
  const bigData = new Array(1e6).fill(0);
  const onClick = () => console.log(bigData.length);
  element.addEventListener('click', onClick);

  // 返回清理函数，让调用方在合适时机解除引用
  return () => element.removeEventListener('click', onClick);
}
```

排查时可以用浏览器开发者工具的 Memory 面板拍摄堆快照，查看对象被谁持有。调试调用链路时，`console.trace()` 可以打印当前位置的调用栈。

## 小结

- JavaScript 使用词法作用域：变量指向哪里由代码写在哪里决定，`this` 是另一套由调用方式决定的机制。
- 查找变量沿作用域链由内向外，内层同名变量遮蔽外层。
- `var` 是函数作用域并提升为 `undefined`；`let` / `const` 是块级作用域，提升但处于暂时性死区，访问会报错。日常默认用 `const`。
- 闭包是函数与其定义时词法环境的组合，用于私有状态、模块、函数工厂、柯里化、防抖等。
- 循环里用 `let` 就能避免回调共享同一个变量的问题；长期存活的闭包要注意及时解除引用。

## 参考

- [MDN：闭包](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Closures)
- [MDN：let](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Statements/let)
- [MDN：变量提升（Hoisting）](https://developer.mozilla.org/zh-CN/docs/Glossary/Hoisting)
- [MDN：内存管理](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Memory_management)
