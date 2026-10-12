---
title: ES2015+ 核心特性
description: 按主题梳理 ES2015 及之后版本的常用语言特性：变量与解构、函数、对象与数组新方法、Symbol、集合类型、迭代器与生成器、Promise 与 async、类、模块、Proxy/Reflect 等，每项配简短示例。
---

ES2015（常称 ES6）是 JavaScript 变化最大的一个版本，此后标准每年发布一版，逐步加入新特性。这篇按主题而不是按年份组织，覆盖日常开发中最常用的部分，每项给出最小示例和需要注意的细节。各特性的浏览器支持情况，以 MDN 页面底部的兼容性表格为准。

## 数据类型与相等判断

### 八种数据类型

| 分类 | 类型 |
| --- | --- |
| 原始类型（7 种） | `undefined`、`null`、`boolean`、`number`、`bigint`、`string`、`symbol` |
| 对象类型 | `Object`（数组、函数、日期、正则等都是对象） |

`Symbol` 由 ES2015 加入，`BigInt` 在之后的版本加入。`typeof null` 返回 `'object'` 是语言早期遗留的问题，判断 `null` 要直接用 `=== null`。

### 三种相等算法

| 算法 | 用在哪里 | `NaN` 与 `NaN` | `+0` 与 `-0` |
| --- | --- | --- | --- |
| 严格相等 `===` | `===`、`indexOf`、`switch` | 不相等 | 相等 |
| SameValueZero | `includes`、`Map` / `Set` 的键 | 相等 | 相等 |
| SameValue | `Object.is` | 相等 | 不相等 |

```js
[NaN].indexOf(NaN);   // -1
[NaN].includes(NaN);  // true
Object.is(NaN, NaN);  // true
Object.is(0, -0);     // false
```

## 变量声明与解构

### let 与 const

块级作用域、不允许重复声明、存在暂时性死区。默认用 `const`，需要重新赋值才用 `let`。详细规则见[作用域与闭包](/notes/fronted/language/javascript/theJavaScriptYouDontKonw/scopeAndClosure_01.html)。

### 解构赋值

```js
// 数组解构：按位置
const [first, , third = 0, ...rest] = [1, 2, undefined, 4, 5];
// first=1, third=0（undefined 时使用默认值）, rest=[4, 5]

// 对象解构：按属性名，可重命名、给默认值
const { name, age: userAge = 18, ...others } = { name: 'a', city: 'b' };
// name='a', userAge=18, others={ city: 'b' }

// 交换变量
let x = 1, y = 2;
[x, y] = [y, x];

// 函数参数解构
function request({ url, method = 'GET' } = {}) {}
```

默认值只在值严格等于 `undefined` 时生效，`null` 不会触发默认值。

### 模板字符串

```js
const user = { name: '张三' };
const msg = `你好，${user.name}
这是第二行`;
```

模板字符串可以跨行，`${}` 内可以写任意表达式。还有一种"标签模板"：``tag`...` `` 会把字符串片段和插值分别传给函数 `tag`，很多库借它实现 SQL、样式、国际化等 DSL。`String.raw` 是内置的标签函数，返回不处理转义的原始字符串。

## 函数

### 箭头函数

```js
const double = (n) => n * 2;
const toObj = (id) => ({ id }); // 返回对象字面量要加括号
```

箭头函数没有自己的 `this`、`arguments`，不能用 `new` 调用。`this` 的具体规则见 [this 与原型链](/notes/fronted/language/javascript/theJavaScriptYouDontKonw/thisAndPrototype_02.html)。

### 默认参数、剩余参数与展开

```js
function connect(host, port = 80, ...options) {
  // port 未传或传 undefined 时为 80；options 是真正的数组
}

const nums = [3, 1, 2];
Math.max(...nums);                 // 3，展开数组作为参数
const copy = [...nums, 4];         // 浅拷贝并追加
const merged = { ...defaults, ...userConfig }; // 对象展开（后者覆盖前者）
```

剩余参数取代了 `arguments`；展开语法只做**浅拷贝**，嵌套对象仍是同一个引用，深拷贝可用 `structuredClone`（这是宿主环境提供的 API，不属于 ECMAScript 本身）。

## 对象的新能力

### 字面量增强

```js
const key = 'dynamic';
const name = 'a';
const obj = {
  name,                 // 属性简写，等于 name: name
  [key + 'Key']: 1,     // 计算属性名
  greet() {},           // 方法简写
};
```

### 常用静态方法

| 方法 | 作用 |
| --- | --- |
| `Object.assign(target, ...sources)` | 把源对象的自身可枚举属性浅拷贝到目标对象 |
| `Object.is(a, b)` | SameValue 比较 |
| `Object.keys` / `values` / `entries` | 自身可枚举属性的键 / 值 / 键值对数组 |
| `Object.fromEntries(iterable)` | 键值对转对象，`entries` 的逆操作 |
| `Object.hasOwn(obj, key)` | 判断自身属性，替代 `hasOwnProperty.call` |
| `Object.groupBy(items, fn)` | 按回调返回值分组，返回一个原型为 `null` 的对象 |

```js
const prices = { a: 10, b: 20 };
const doubled = Object.fromEntries(
  Object.entries(prices).map(([k, v]) => [k, v * 2]),
);
// { a: 20, b: 40 }

Object.groupBy([1, 2, 3, 4], (n) => (n % 2 ? 'odd' : 'even'));
// { odd: [1, 3], even: [2, 4] }
```

### 类字段与私有成员

```js
class Counter {
  count = 0;          // 公有实例字段
  #step = 1;          // 私有字段，类外部无法访问
  static instances = 0;

  static {
    // 静态初始化块
  }

  increment() {
    this.count += this.#step;
  }

  #log() {}           // 私有方法
}
```

访问不存在的私有字段会抛出 `TypeError`，可以用 `#step in obj` 判断一个对象是否拥有某个私有字段。

## 数组与字符串的新方法

### 数组

| 方法 | 说明 |
| --- | --- |
| `Array.from(iterable, mapFn)` | 类数组或可迭代对象转数组 |
| `Array.of(...items)` | 用参数创建数组，避免 `new Array(3)` 的歧义 |
| `find` / `findIndex` | 返回第一个满足条件的元素 / 下标 |
| `findLast` / `findLastIndex` | 从后往前找 |
| `includes(value)` | 是否包含，能正确判断 `NaN` |
| `flat(depth)` / `flatMap(fn)` | 拍平嵌套数组 / 先 map 再拍平一层 |
| `at(index)` | 支持负数下标，`arr.at(-1)` 取最后一个 |
| `toSorted` / `toReversed` / `toSpliced` / `with` | 对应方法的**非变异**版本，返回新数组，原数组不变 |
| `fill`、`copyWithin`、`keys`、`values`、`entries` | 填充、内部复制、获取迭代器 |

```js
const list = [3, 1, 2];
const sorted = list.toSorted((a, b) => a - b); // [1, 2, 3]，list 仍是 [3, 1, 2]
const replaced = list.with(0, 9);              // [9, 1, 2]
list.at(-1);                                   // 2
[[1, [2]], [3]].flat(Infinity);                // [1, 2, 3]
```

在 React 等依赖不可变数据的场景里，非变异版本可以省掉先拷贝再修改的步骤。

### 字符串

```js
'abc'.includes('b');          // true
'abc'.startsWith('a');        // true
'5'.padStart(3, '0');         // '005'
'  a  '.trimEnd();            // '  a'
'a-b-c'.replaceAll('-', '/'); // 'a/b/c'
'ab'.repeat(2);               // 'abab'
'abc'.at(-1);                 // 'c'
```

字符串现在可以用 `for...of` 遍历，并且按 Unicode 码点而不是 UTF-16 码元迭代，由代理对组成的字符（如大多数单个 emoji）不会被拆成两半。但由多个码点组合成的字符（如带 ZWJ 的家庭 emoji、国旗）仍会被拆开：`[...'👨‍👩‍👧'].length` 是 5。要按用户看到的字符切分，用 `Intl.Segmenter`。

### 数值

- `Number.isNaN`、`Number.isFinite`：不做类型转换，比全局的 `isNaN` 更可靠。
- `Number.isInteger`、`Number.isSafeInteger`、`Number.EPSILON`、`Number.MAX_SAFE_INTEGER`。
- 指数运算符：`2 ** 10` 等于 `1024`。
- 数字分隔符：`1_000_000`，只为可读性，不影响值。

## Symbol

`Symbol()` 每次调用都返回一个唯一的值，常用作不会冲突的属性键。

### 消除魔术字符串

在多处出现、与代码强耦合的字符串或数字称为魔术字符串。如果这些值只需要彼此不同、不关心具体内容，可以用 Symbol：

```js
const Shape = {
  CIRCLE: Symbol('circle'),
  SQUARE: Symbol('square'),
};

function area(type, size) {
  switch (type) {
    case Shape.CIRCLE: return Math.PI * size ** 2;
    case Shape.SQUARE: return size ** 2;
  }
}
```

`Symbol('circle')` 中的字符串只是描述，用于调试，不影响唯一性。

### 作为属性名时的遍历规则

Symbol 属性不会出现在 `for...in`、`Object.keys()`、`Object.getOwnPropertyNames()`、`JSON.stringify()` 的结果里，适合定义"不想被常规遍历到"的内部属性。但它并不私有：

```js
const secret = Symbol('secret');
const obj = { [secret]: 1, visible: 2 };

Object.keys(obj);                  // ['visible']
Object.getOwnPropertySymbols(obj); // [Symbol(secret)]
Reflect.ownKeys(obj);              // ['visible', Symbol(secret)]
```

真正的私有成员应该用类的 `#` 私有字段。

### Symbol.for 与 Symbol.keyFor

`Symbol.for(key)` 在全局注册表中查找该 key，找到就返回已有的 Symbol，否则新建并登记。`Symbol()` 则不登记。全局注册表跨 realm 共享，例如同源 iframe 中用同一个 key 能取到同一个值。

```js
Symbol.for('app') === Symbol.for('app'); // true
Symbol('app') === Symbol('app');         // false

Symbol.keyFor(Symbol.for('foo')); // 'foo'
Symbol.keyFor(Symbol('foo'));     // undefined，未登记
```

### 内置 Symbol

语言用一组内置 Symbol 暴露内部行为的扩展点：

| Symbol | 作用 |
| --- | --- |
| `Symbol.iterator` | 定义对象的默认迭代器，供 `for...of`、展开语法使用 |
| `Symbol.asyncIterator` | 定义异步迭代器，供 `for await...of` 使用 |
| `Symbol.hasInstance` | 自定义 `instanceof` 的判断 |
| `Symbol.toPrimitive` | 自定义对象转原始值的方式 |
| `Symbol.toStringTag` | 自定义 `Object.prototype.toString` 返回的标签 |

## 集合类型：Set、Map、WeakSet、WeakMap

### Set 与 Map

```js
const unique = [...new Set([1, 2, 2, 3])]; // [1, 2, 3]

const map = new Map();
const keyObj = {};
map.set(keyObj, 'value').set('a', 1);
map.get(keyObj); // 'value'
map.size;        // 2
for (const [k, v] of map) {}
```

`Map` 和普通对象的区别：

| | `Map` | 普通对象 |
| --- | --- | --- |
| 键的类型 | 任意值，包括对象 | 字符串或 Symbol |
| 键的比较 | SameValueZero（`NaN` 等于 `NaN`，`+0` 等于 `-0`） | 非 Symbol 的键会被转成字符串 |
| 顺序 | 按插入顺序 | 整数键按升序排在前面，其余按插入顺序 |
| 大小 | `map.size` | 需要 `Object.keys(obj).length` |
| 原型上的同名键冲突 | 无 | 可能和 `toString` 等继承属性冲突 |

频繁增删键值对时优先用 `Map`。`Set` 还新增了集合运算方法 `union`、`intersection`、`difference`、`symmetricDifference`、`isSubsetOf` 等，较新的运行环境才支持。

### WeakSet 与 WeakMap

- 键（WeakSet 的成员）只能是对象，或者未通过 `Symbol.for` 登记的 Symbol，不能是 `null` 和其他原始值。
- 对键是**弱引用**：垃圾回收不考虑这里的引用，其他地方都不再引用这个对象时，它会被回收，对应条目自动消失。
- 因为条目随时可能消失，它们**不可遍历**，没有 `size`、`keys()` 等方法。

典型用途是给对象附加数据而不影响其生命周期，例如缓存计算结果、标记 DOM 节点、保存实例的私有数据：

```js
const privateData = new WeakMap();

class Countdown {
  constructor(counter, action) {
    privateData.set(this, { counter, action });
  }
  dec() {
    const data = privateData.get(this);
    if (data.counter < 1) return;
    data.counter -= 1;
    if (data.counter === 0) data.action();
  }
}

const c = new Countdown(2, () => console.log('DONE'));
c.dec();
c.dec(); // DONE
```

实例被回收后，`privateData` 中对应的条目也会被回收，不会泄漏。现在私有数据更推荐用 `#` 字段，WeakMap 仍适合"给不属于自己的对象挂数据"的场景。

## 迭代器与生成器

### 迭代协议

一个对象只要实现了 `[Symbol.iterator]()` 方法，返回一个带 `next()` 的迭代器，就是可迭代对象，可以用于 `for...of`、展开语法、解构、`Array.from`、`new Map(iterable)` 等。数组、字符串、Map、Set、`arguments`、NodeList 都是内置的可迭代对象，普通对象不是。

```js
const range = {
  from: 1,
  to: 3,
  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;
    return {
      next: () =>
        current <= last ? { value: current++, done: false } : { value: undefined, done: true },
    };
  },
};

[...range]; // [1, 2, 3]
```

### 生成器

生成器函数用 `function*` 定义，调用时不执行函数体，而是返回一个迭代器；每次 `next()` 执行到下一个 `yield` 暂停：

```js
function* rangeGen(from, to) {
  for (let i = from; i <= to; i++) {
    yield i;
  }
}

const it = rangeGen(1, 3);
it.next(); // { value: 1, done: false }
[...rangeGen(1, 3)]; // [1, 2, 3]
```

用生成器实现上面的 `range`，只需 `*[Symbol.iterator]() { for (...) yield ... }`，比手写 `next` 简洁很多。生成器还适合表示惰性序列（按需生成，甚至无限长）。`yield*` 可以委托给另一个可迭代对象。

异步版本是 `async function*`，配合 `for await...of` 逐个消费异步产生的数据，例如分页拉取接口、读取流。

## Promise 与异步函数

### Promise

Promise 表示一个将来才会完成的值，有 pending、fulfilled、rejected 三种状态，状态一旦确定就不再改变。

```js
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

delay(100)
  .then(() => fetch('/api'))
  .then((res) => res.json())
  .catch((err) => console.error(err))
  .finally(() => console.log('结束'));
```

组合方法：

| 方法 | 何时完成 | 何时拒绝 |
| --- | --- | --- |
| `Promise.all` | 全部成功，结果按顺序组成数组 | 任意一个拒绝 |
| `Promise.allSettled` | 全部结束（不论成败），返回每个的状态 | 不会拒绝 |
| `Promise.race` | 第一个结束的成功 | 第一个结束的拒绝 |
| `Promise.any` | 第一个成功 | 全部拒绝，抛出 `AggregateError` |

`Promise.withResolvers()` 返回 `{ promise, resolve, reject }`，适合需要在 Promise 外部决定结果的场景，省去在执行器里手动把 `resolve` 存出来的写法。

### async / await

```js
async function loadUser(id) {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`请求失败：${res.status}`);
  return res.json();
}

// 并发执行，而不是依次等待
const [a, b] = await Promise.all([loadUser(1), loadUser(2)]);
```

`async` 函数总是返回 Promise；`await` 之后的代码会作为微任务执行。执行顺序的细节见[执行机制与事件循环](/notes/fronted/language/javascript/eventLoop.html)，错误处理见[错误类型与异常处理](/notes/fronted/language/javascript/basic.html)。

ES 模块的顶层可以直接使用 `await`（顶层 await），模块的加载会等待它完成。

## Class

```js
class Animal {
  constructor(name) {
    this.name = name;
  }
  get displayName() {
    return `动物：${this.name}`;
  }
  speak() {
    return `${this.name} 发出声音`;
  }
  static of(name) {
    return new this(name);
  }
}

class Dog extends Animal {
  speak() {
    return `${super.speak()}，汪`;
  }
}

Dog.of('旺财').speak(); // '旺财 发出声音，汪'
```

`class` 基于原型实现，但有必须用 `new` 调用、类体自动严格模式、存在暂时性死区等差异，见 [this 与原型链](/notes/fronted/language/javascript/theJavaScriptYouDontKonw/thisAndPrototype_02.html)。

## 模块：import 与 export

```js
// math.js
export const PI = 3.14;
export function add(a, b) { return a + b; }
export default function multiply(a, b) { return a * b; }

// main.js
import multiply, { PI, add as sum } from './math.js';
import * as math from './math.js';

// 动态导入：返回 Promise，可用于按需加载
const { add } = await import('./math.js');
```

ES 模块的几个特点：

- **静态结构**：`import` / `export` 只能写在顶层，依赖关系在编译期就能确定，打包工具借此做 tree shaking。
- **实时绑定**：导入的是对导出变量的绑定，导出方修改了值，导入方能看到新值；导入方不能给导入的变量重新赋值。
- **默认严格模式**，顶层 `this` 是 `undefined`。
- 每个模块只执行一次，多次导入得到同一个实例。

浏览器中用 `<script type="module">` 加载；Node.js 中用 `.mjs` 扩展名或在 `package.json` 里设置 `"type": "module"`。与 CommonJS（`require` / `module.exports`）的区别可参考 [Node.js 架构与运行机制](/notes/fronted/language/node/introduction.html)。

## Proxy 与 Reflect

### Proxy

Proxy 属于元编程：在目标对象外面包一层，拦截对它的基本操作，自定义其行为。

```js
const target = { name: 'a' };
const proxy = new Proxy(target, {
  get(obj, prop, receiver) {
    if (!(prop in obj)) throw new ReferenceError(`属性 ${String(prop)} 不存在`);
    return Reflect.get(obj, prop, receiver);
  },
  set(obj, prop, value, receiver) {
    console.log(`设置 ${String(prop)}`);
    return Reflect.set(obj, prop, value, receiver);
  },
});

proxy.name;    // 'a'
proxy.age = 1; // 打印 "设置 age"
```

可以拦截的操作共 13 种：

| 捕获器 | 拦截的操作 |
| --- | --- |
| `get` / `set` | 读取 / 设置属性 |
| `has` | `in` 运算符 |
| `deleteProperty` | `delete` 运算符 |
| `ownKeys` | `Object.keys`、`Reflect.ownKeys`、`for...in` 等 |
| `getOwnPropertyDescriptor` | `Object.getOwnPropertyDescriptor` |
| `defineProperty` | `Object.defineProperty` |
| `preventExtensions` / `isExtensible` | 对应的 `Object` 方法 |
| `getPrototypeOf` / `setPrototypeOf` | 读取 / 设置原型 |
| `apply` | 函数调用（目标是函数时） |
| `construct` | `new` 调用（目标是构造函数时） |

Vue 3 的响应式系统就是基于 Proxy 拦截 `get` / `set` 来收集依赖和触发更新的。

**this 问题**：Proxy 不是目标对象的透明代理。通过代理调用方法时，方法内部的 `this` 指向代理而不是目标对象。对于依赖内部槽的内置对象（`Date`、`Map` 等），即使不写任何拦截也会出错：

```js
const proxy = new Proxy(new Date(), {});
proxy.getDate(); // TypeError：this 不是 Date 对象
```

解决方法是在 `get` 中把方法绑定回原始对象：

```js
const target = new Date(2015, 0, 1);
const proxy = new Proxy(target, {
  get(obj, prop) {
    const value = Reflect.get(obj, prop);
    return typeof value === 'function' ? value.bind(obj) : value;
  },
});
proxy.getDate(); // 1
```

### Reflect

`Reflect` 是一个提供静态方法的普通对象，它的方法和 Proxy 的 13 个捕获器一一对应：

- `Reflect.apply(target, thisArg, args)`
- `Reflect.construct(target, args, newTarget?)`
- `Reflect.get(target, key, receiver?)`
- `Reflect.set(target, key, value, receiver?)`
- `Reflect.has(target, key)`
- `Reflect.deleteProperty(target, key)`
- `Reflect.ownKeys(target)`
- `Reflect.defineProperty(target, key, descriptor)`
- `Reflect.getOwnPropertyDescriptor(target, key)`
- `Reflect.getPrototypeOf(target)` / `Reflect.setPrototypeOf(target, proto)`
- `Reflect.isExtensible(target)` / `Reflect.preventExtensions(target)`

它的设计目的：

- **在 Proxy 里执行默认行为**：捕获器里调用同名的 `Reflect` 方法，就能在自定义逻辑之后保留原有行为，并正确传递 `receiver`（涉及 getter / setter 和继承时尤其重要）。
- **更合理的返回值**：`Object.defineProperty` 失败时抛错，`Reflect.defineProperty` 返回 `false`，便于用条件判断。
- **把命令式操作变成函数**：`key in obj`、`delete obj[key]` 对应 `Reflect.has`、`Reflect.deleteProperty`，方便组合和传递。

## 其他常用语法

### 可选链与空值合并

```js
const city = user?.address?.city;   // 中间任一环节为 null/undefined 则返回 undefined
const len = list?.length ?? 0;      // 只有 null/undefined 才使用默认值
user.onLoad?.();                    // 方法存在才调用
```

`??` 和 `||` 的区别：`||` 对 `0`、`''`、`false` 也会取右侧，`??` 只对 `null` 和 `undefined` 生效。处理"数量为 0""空字符串是合法值"的场景要用 `??`。

### 逻辑赋值

```js
options.timeout ??= 3000; // 为 null/undefined 时才赋值
cache.value ||= compute(); // 为假值时才赋值
user.active &&= check();   // 为真值时才赋值
```

### BigInt

用于表示超出 `Number.MAX_SAFE_INTEGER` 的整数，字面量加 `n` 后缀：

```js
const big = 9007199254740993n;
big + 1n;          // 9007199254740994n
typeof big;        // 'bigint'
// big + 1         // TypeError：不能与 Number 直接混合运算
```

BigInt 不能和 Number 混合运算，不能用于 `Math` 的方法，`JSON.stringify` 遇到它会报错，需要自己处理序列化。

### 其他

- `globalThis`：在浏览器、Node.js、Worker 中统一指向全局对象。
- `catch` 可以省略绑定：`try { ... } catch { ... }`。
- `Error` 构造函数支持 `cause` 选项：`new Error('失败', { cause: err })`。
- `String.prototype.matchAll`：返回所有匹配（包括捕获组）的迭代器。
- 正则新增命名捕获组 `(?<year>\d{4})`、`s`（dotAll）标志、后行断言 `(?<=...)`。
- `WeakRef` 和 `FinalizationRegistry`：弱引用和对象回收回调，行为依赖垃圾回收时机，一般业务代码很少需要。

## 版本速查

只列出确定的版本归属，便于判断目标环境是否需要转译：

| 版本 | 特性 |
| --- | --- |
| ES2015 | `let`/`const`、解构、模板字符串、箭头函数、默认/剩余参数、展开（数组）、Symbol、Set/Map/WeakSet/WeakMap、迭代器与生成器、Promise、class、模块、Proxy/Reflect |
| ES2016 | `Array.prototype.includes`、指数运算符 `**` |
| ES2017 | `async`/`await`、`Object.values`/`entries`、`padStart`/`padEnd` |
| ES2018 | 对象展开与剩余属性、`Promise.prototype.finally`、异步迭代 |
| ES2019 | `flat`/`flatMap`、`Object.fromEntries`、可省略的 catch 绑定 |
| ES2020 | 可选链、空值合并、BigInt、`Promise.allSettled`、`globalThis`、动态 `import()` |
| ES2021 | `replaceAll`、`Promise.any`、逻辑赋值运算符、数字分隔符、WeakRef |
| ES2022 | 类字段与私有成员、顶层 await、`at()`、`Object.hasOwn`、Error `cause` |
| ES2023 | `findLast`/`findLastIndex`、`toSorted`/`toReversed`/`toSpliced`/`with` |
| ES2024 | `Object.groupBy`、`Promise.withResolvers` |

实际项目中，一般由 Babel、TypeScript、esbuild 等工具根据目标浏览器自动转译语法，`core-js` 等库补充缺失的 API，开发时可以直接写新语法。

## 小结

- 数据类型共 8 种，`Symbol` 和 `BigInt` 是新增的原始类型；比较相等时注意 `===`、SameValueZero、`Object.is` 的差别。
- 解构、展开、默认参数、模板字符串、箭头函数让日常代码更简洁；展开只是浅拷贝。
- `Map`/`Set` 适合频繁增删的键值和去重，`WeakMap`/`WeakSet` 用于不影响对象回收的附加数据。
- 迭代协议是 `for...of`、展开、解构的基础，生成器是实现迭代器最简便的方式。
- Promise、`async/await` 统一了异步写法；ES 模块是静态结构、实时绑定的。
- Proxy 拦截对象的基本操作，配合 Reflect 保留默认行为；可选链、空值合并、`at()`、非变异数组方法是近几年最常用的新增特性。

## 参考

- [MDN：JavaScript 参考](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference)
- [MDN：解构赋值](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment)
- [MDN：Symbol](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Symbol)
- [MDN：迭代协议](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Iteration_protocols)
- [MDN：JavaScript 模块](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Modules)
- [MDN：Proxy](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
- [MDN：Reflect](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Reflect)
