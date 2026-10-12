---
title: this 与原型链
description: this 的四种绑定规则与优先级、箭头函数与 call/apply/bind，以及原型、原型链查找、new 的过程、class 与原型的关系、instanceof 原理和 Object.create。
---

`this` 和原型是 JavaScript 对象系统的两根支柱：`this` 决定函数运行时操作的是哪个对象，原型链决定对象上找不到的属性去哪里找。这篇先讲 `this` 的绑定规则和优先级，再讲原型、`new`、`class` 和 `instanceof` 的底层机制。

## 为什么需要 this

`this` 提供了一种隐式传递对象引用的方式。同一个函数可以被不同对象复用，而不必每次显式把对象作为参数传进去：

```js
function greet() {
  return `你好，${this.name}`;
}

const a = { name: 'A', greet };
const b = { name: 'B', greet };
a.greet(); // '你好，A'
b.greet(); // '你好，B'
```

如果不用 `this`，就得写成 `greet(obj)`，调用层次一深，到处显式传上下文对象会很繁琐。原型上的方法正是依靠 `this` 才能被所有实例共享。

一个常见的说法是"谁调用就指向谁"。它能覆盖最常见的方法调用，但解释不了 `new`、`bind`、箭头函数、回调丢失 `this` 等情况。准确的说法是：**普通函数的 `this` 在定义时无法确定，由函数被调用的方式决定**；箭头函数例外，它没有自己的 `this`。

## 四种绑定规则

### 默认绑定

独立调用函数（前面没有任何对象）时使用默认绑定：

```js
function show() {
  return this;
}
show(); // 非严格模式：globalThis（浏览器中是 window）；严格模式：undefined
```

决定结果的是**函数体**是否处于严格模式，而不是调用位置。ES 模块和 `class` 内部的代码都自动是严格模式。

### 隐式绑定

通过对象调用方法时，`this` 指向这个对象。链式访问时只看最后一层：

```js
const obj = {
  name: 'obj',
  inner: { name: 'inner', show() { return this.name; } },
};
obj.inner.show(); // 'inner'
```

**隐式丢失** 是最常见的 `this` bug：方法被取出来单独调用，就退回了默认绑定。

```js
const user = {
  name: 'user',
  show() { return this?.name; },
};

const fn = user.show;
fn(); // 严格模式下 this 是 undefined，读取 this.name 直接报错；非严格模式下读的是 globalThis.name

setTimeout(user.show, 0);        // 同样丢失：传进去的只是函数本身
[1].forEach(user.show);          // 同样丢失
```

传参本质上是把函数引用赋值给另一个变量，和 `const fn = user.show` 没有区别。

### 显式绑定：call、apply、bind

三个方法都定义在 `Function.prototype` 上：

| 方法 | 作用 | 参数形式 | 是否立即调用 |
| --- | --- | --- | --- |
| `fn.call(thisArg, a, b)` | 指定 `this` 调用 | 逐个传入 | 是 |
| `fn.apply(thisArg, [a, b])` | 指定 `this` 调用 | 数组（或类数组） | 是 |
| `fn.bind(thisArg, a)` | 返回一个 `this` 被固定的新函数，可预置部分参数 | 逐个传入 | 否 |

```js
function intro(greeting, punctuation) {
  return `${greeting}，${this.name}${punctuation}`;
}
const p = { name: '张三' };

intro.call(p, '你好', '！');      // '你好，张三！'
intro.apply(p, ['你好', '！']);   // '你好，张三！'
const bound = intro.bind(p, '嗨');
bound('。');                      // '嗨，张三。'
```

`bind` 解决了隐式丢失：`setTimeout(user.show.bind(user), 0)`。被 `bind` 过的函数再次 `call` / `bind` 也改不了它的 `this`。

非严格模式下，`thisArg` 传 `null` 或 `undefined` 会被替换为全局对象，传原始值会被包装成对象；严格模式下原样使用。

有了展开语法后，`apply` 的很多用法可以替换：`Math.max.apply(null, arr)` 写成 `Math.max(...arr)` 即可。

### new 绑定

用 `new` 调用函数时，`this` 指向新创建的对象。具体过程放在后面"new 做了什么"一节。

### 优先级

当多条规则同时适用时：

**`new` 绑定 > 显式绑定 > 隐式绑定 > 默认绑定**

```js
function Foo(name) { this.name = name; }
const obj = {};

const Bound = Foo.bind(obj);
const instance = new Bound('x');
obj.name;      // undefined：new 忽略了 bind 指定的 this
instance.name; // 'x'
```

`new` 一个绑定函数时，绑定的 `this` 被忽略，但预置的参数仍然有效。判断一个普通函数调用的 `this`，按这个顺序问自己：是不是 `new` 调用？是不是 `call/apply/bind`？是不是通过对象调用？都不是就是默认绑定。

## 箭头函数的 this

箭头函数没有自己的 `this`，它使用定义时外层作用域的 `this`，相当于把 `this` 当作普通变量沿词法作用域查找（作用域规则见[作用域与闭包](/notes/fronted/language/javascript/theJavaScriptYouDontKonw/scopeAndClosure_01.html)）：

```js
const timer = {
  seconds: 0,
  start() {
    setInterval(() => {
      this.seconds += 1; // this 是 start 被调用时的 this，即 timer
    }, 1000);
  },
};
timer.start();
```

箭头函数的特点：

- `call`、`apply`、`bind` 无法改变它的 `this`（传入的 `thisArg` 被忽略）。
- 不能用 `new` 调用，也没有 `prototype` 属性。
- 没有自己的 `arguments`，需要时用剩余参数 `...args`。

所以箭头函数**不适合**作为对象方法或原型方法：

```js
const counter = {
  count: 0,
  inc: () => { this.count += 1; }, // this 是外层的 this（ES 模块顶层为 undefined），不是 counter
};
```

适合的场景是回调：在方法里传给 `setTimeout`、`map`、`then` 的函数，需要沿用方法的 `this`。

### 其他常见场景

- **DOM 事件监听**：`addEventListener` 中的普通函数，`this` 是 `event.currentTarget`（绑定监听器的元素）；箭头函数则沿用外层 `this`。
- **class 方法作为回调**：class 内部是严格模式，方法被取出后 `this` 是 `undefined`，会直接报错。常见处理是在构造函数里 `bind`，或用箭头函数形式的类字段：

```js
class Button {
  label = '提交';
  handleClick = () => {
    console.log(this.label); // 类字段中的箭头函数，this 固定为实例
  };
}
```

类字段方式会让每个实例都拥有一份自己的函数，而不是共享原型上的方法，实例很多时要考虑这点开销。

## 原型与 [[Prototype]]

每个对象都有一个内部槽 `[[Prototype]]`，指向另一个对象（它的原型）或 `null`。读取属性时，如果对象自身没有，就沿 `[[Prototype]]` 往上找。

访问 `[[Prototype]]` 的标准方式：

```js
const proto = { hello() { return 'hi'; } };
const obj = Object.create(proto);

Object.getPrototypeOf(obj) === proto; // true
obj.hello();                          // 'hi'，来自原型
Object.hasOwn(obj, 'hello');          // false，不是自身属性
```

### __proto__ 与 prototype 的区别

这两个名字很容易混淆，但含义完全不同：

| | `obj.__proto__` | `Fn.prototype` |
| --- | --- | --- |
| 属于谁 | 几乎所有对象（通过 `Object.prototype` 上的访问器继承而来） | 普通函数和 class（箭头函数、对象方法简写、class 方法、async 函数没有） |
| 含义 | 这个对象**自己的**原型，即 `[[Prototype]]` | 用 `new Fn()` 创建的**实例**将会使用的原型 |
| 推荐用法 | 不推荐，用 `Object.getPrototypeOf` / `Object.setPrototypeOf` 代替 | 在上面定义实例共享的方法 |

它们之间的关系：

```js
function Person(name) {
  this.name = name;
}
Person.prototype.sayName = function () {
  return this.name;
};

const p = new Person('a');

Object.getPrototypeOf(p) === Person.prototype;              // true
Person.prototype.constructor === Person;                    // true
Object.getPrototypeOf(Person.prototype) === Object.prototype; // true
Object.getPrototypeOf(Object.prototype);                    // null
Object.getPrototypeOf(Person) === Function.prototype;       // true，函数本身也是对象
```

`__proto__` 原本是浏览器的私有实现，后来为了兼容被纳入规范，属于不推荐在新代码中使用的遗留特性，读写原型应使用 `Object.getPrototypeOf` / `Object.setPrototypeOf`。用 `Object.create(null)` 创建的对象不继承 `Object.prototype`，也就没有 `__proto__` 访问器。

### 原型链查找

```text
p ──[[Prototype]]──> Person.prototype ──> Object.prototype ──> null
     自身属性: name     sayName, constructor   hasOwnProperty, toString ...
```

读取 `p.toString()` 的过程：`p` 自身没有 → `Person.prototype` 没有 → `Object.prototype` 找到。如果一直找到 `null` 都没有，结果是 `undefined`。

**写入**属性的规则和读取不同：

- 一般情况下，赋值会在对象**自身**创建或修改属性，即使原型上有同名属性，也只是遮蔽它，不会修改原型。
- 如果原型链上的同名属性是**只读**的，赋值静默失败（严格模式下抛 `TypeError`）。
- 如果原型链上的同名属性是 **setter**，会调用这个 setter，而不会在自身创建属性。

判断属性是不是自身的，用 `Object.hasOwn(obj, key)`（较新的写法）或 `Object.prototype.hasOwnProperty.call(obj, key)`。`for...in` 会遍历原型链上可枚举的属性，`Object.keys` 只返回自身可枚举属性。

原型链不宜过长，查找不存在的属性需要走完整条链。运行时用 `Object.setPrototypeOf` 修改已有对象的原型，会影响引擎优化，MDN 明确提示应避免，需要特定原型时在创建时用 `Object.create` 指定。

## new 做了什么

`new Fn(...args)` 大致做了四件事：

1. 创建一个新的空对象。
2. 把新对象的 `[[Prototype]]` 设为 `Fn.prototype`。
3. 以新对象作为 `this` 执行 `Fn`。
4. 如果 `Fn` 返回了一个对象（包括函数），就以它作为结果；否则返回第 1 步创建的对象。

用代码模拟：

```js
function myNew(Fn, ...args) {
  const obj = Object.create(Fn.prototype);   // 1、2
  const result = Fn.apply(obj, args);        // 3
  return result !== null && (typeof result === 'object' || typeof result === 'function')
    ? result
    : obj;                                   // 4
}

const p2 = myNew(Person, 'b');
p2.sayName(); // 'b'
```

这个模拟不能用于 `class`：class 构造函数禁止不带 `new` 直接调用，`Fn.apply` 会抛出 `TypeError`。

第 4 步说明构造函数返回原始值会被忽略，返回对象则会替换掉新实例，这是一个容易踩的坑。

## class 与原型的关系

`class` 大体上是原型写法的语法糖，背后仍然是构造函数和原型对象：

```js
class Animal {
  constructor(name) {
    this.name = name;
  }
  speak() {
    return `${this.name} 发出声音`;
  }
  static create(name) {
    return new Animal(name);
  }
}

typeof Animal;                                    // 'function'
Object.hasOwn(Animal.prototype, 'speak');         // true，方法在原型上
Object.hasOwn(Animal, 'create');                  // true，静态方法在类本身上
```

`extends` 同时建立了两条原型链：

```js
class Dog extends Animal {
  speak() {
    return `${super.speak()}：汪`;
  }
}

Object.getPrototypeOf(Dog.prototype) === Animal.prototype; // true，实例方法继承
Object.getPrototypeOf(Dog) === Animal;                     // true，静态方法继承
```

它和手写的构造函数并不完全等价，主要差异：

| 方面 | `class` | 构造函数 |
| --- | --- | --- |
| 不带 `new` 调用 | 抛出 `TypeError` | 可以调用，`this` 按默认绑定 |
| 严格模式 | 类体内自动严格模式 | 取决于所在代码 |
| 方法可枚举性 | 原型方法不可枚举 | 直接赋值的方法可枚举 |
| 提升 | 存在暂时性死区，声明前不能使用 | 函数声明整体提升 |
| 子类构造函数 | 必须先调用 `super()` 才能使用 `this` | 需要手动 `Parent.call(this)` |
| 继承内置类型 | `extends Array`、`extends Error` 能正常工作 | 用旧式写法很难做对 |
| 私有字段 `#x` | 支持，真正私有，不在原型链上，外部无法访问 | 不支持 |

旧式的继承写法（父类也是普通构造函数），可以对照理解 `extends` 在做什么：

```js
function Pet(name) {
  this.name = name;
}
Pet.prototype.speak = function () {
  return `${this.name} 发出声音`;
};

function Cat(name) {
  Pet.call(this, name); // 相当于 super(name)
}
Cat.prototype = Object.create(Pet.prototype); // 实例方法继承
Cat.prototype.constructor = Cat;               // 修复 constructor 指向
Object.setPrototypeOf(Cat, Pet);               // 静态方法继承

new Cat('咪').speak(); // '咪 发出声音'
```

## instanceof 的原理

`obj instanceof Fn` 检查的是：`Fn.prototype` 是否出现在 `obj` 的原型链上。

```js
function myInstanceof(obj, Fn) {
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
    return false; // 原始值直接返回 false
  }
  const target = Fn.prototype;
  let proto = Object.getPrototypeOf(obj);
  while (proto !== null) {
    if (proto === target) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}

myInstanceof(new Dog('d'), Animal); // true
```

真实的 `instanceof` 还会先检查 `Fn[Symbol.hasInstance]`，类可以通过定义这个静态方法自定义判断逻辑。

需要注意：

- 它检查的是原型链，不是"由谁构造"。修改 `Fn.prototype` 或对象的原型后，结果会跟着变。
- **跨 realm 会失效**：iframe 里创建的数组，`arr instanceof Array` 是 `false`，因为两个窗口的 `Array.prototype` 不是同一个对象。判断数组应该用 `Array.isArray`。
- 原始值使用 `instanceof` 总是 `false`，判断原始类型用 `typeof`。

另一个相关方法 `Proto.isPrototypeOf(obj)` 直接检查某个对象是否在 `obj` 的原型链上，不依赖构造函数。

## Object.create

`Object.create(proto, descriptors?)` 创建一个以 `proto` 为原型的新对象，第二个参数可以同时定义属性描述符：

```js
const base = {
  describe() { return `${this.type}：${this.name}`; },
};

const item = Object.create(base, {
  type: { value: '商品', enumerable: true },
  name: { value: '键盘', enumerable: true, writable: true },
});
item.describe(); // '商品：键盘'
```

几种用途：

- **不借助构造函数实现继承**：对象直接委托给另一个对象，这是原型最本质的用法。
- **创建纯净字典**：`Object.create(null)` 得到一个没有原型的对象，不会和 `toString`、`constructor` 等继承属性冲突。不过它没有 `hasOwnProperty` 等方法，需要用 `Object.hasOwn`。键值对场景现在更推荐用 `Map`。
- **实现旧式继承**：如上一节 `Cat.prototype = Object.create(Pet.prototype)`。早年常见的 `Cat.prototype = new Pet()` 会执行一次父构造函数，在原型上留下多余的实例属性，不应再使用。

## 小结

- 普通函数的 `this` 由调用方式决定：默认绑定、隐式绑定、显式绑定（`call/apply/bind`）、`new` 绑定，优先级从低到高；方法被取出单独调用会丢失 `this`。
- 箭头函数没有自己的 `this`，沿用外层作用域的值，无法被 `bind` 改变，适合回调，不适合做对象方法。
- 每个对象有 `[[Prototype]]`，读属性沿原型链查找；`Fn.prototype` 是实例的原型，`__proto__` 是对象自己的原型，后者用 `Object.getPrototypeOf` 代替。
- `new` 创建对象、链接原型、绑定 `this` 执行构造函数，构造函数返回对象时会替换实例。
- `class` 基于原型，但有强制 `new`、严格模式、TDZ、私有字段等差异；`instanceof` 检查原型链，跨 realm 判断数组用 `Array.isArray`。

## 参考

- [MDN：this](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/this)
- [MDN：继承与原型链](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Inheritance_and_the_prototype_chain)
- [MDN：Function.prototype.bind()](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Function/bind)
- [MDN：new 运算符](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/new)
- [MDN：类](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Classes)
- [MDN：Object.create()](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/create)
