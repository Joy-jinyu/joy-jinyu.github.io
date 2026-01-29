### [引用`caibaojian`博客](http://caibaojian.com/es6/proxy.html)

### 判断相等

#### Same-value equality

### 数据类型(元类型系统)

+ 基本数据类型：[Null](https://baijiahao.baidu.com/s?id=1596002376259458143&wfr=spider&for=pc)、Undefined、Symbol、String、Number、Boolean
+ 引用类型：Object

### Symbol

#### 消除魔术字符串

+ 替换魔术字符串形成强耦合的字符串或数值

#### 属性名的遍历

+ Symbol 作为属性名，该属性不会出现在`for...in`、`for...of`循环中，也不会被`Object.keys()`、`Object.getOwnPropertyNames()`、`JSON.stringify()`返回
  可以利用这个特性，为对象定义一些非私有的、但又希望只用于内部的方法
+ 可以通过`Object.getOwnPropertySymbols`获取指定对象的所有 Symbol 属性名
+ `Reflect.ownKeys`方法可以返回所有类型的键名，包括常规键名和 Symbol 键名

#### `Symbol.for(), Symbol.keyFor()`

+ `Symbol.for()`与`Symbol()`这两种写法，都会生成Symbol。它们的区别是，前者会被登记在全局环境中供搜索(找到就返回有的)，后者不会

+ `Symbol.for`为Symbol值登记的名字，是全局环境的，可以在不同的` iframe `或 service worker 中取到同一个值。

+ `Symbol.keyFor`方法返回一个已登记的 Symbol 类型值的`key`
  
  ```javascript
  var s1 = Symbol.for("foo");
  Symbol.keyFor(s1) // "foo"
  
  var s2 = Symbol("foo");
  Symbol.keyFor(s2) // undefined
  ```

#### 模块的 Singleton 模式

#### 内置的Symbol值

### Set

#### `WeakSet`

+ 首先，`WeakSet`的成员只能是对象，而不能是其他类型的值。
+ 其次，`WeakSet`中的对象都是弱引用，即垃圾回收机制不考虑`WeakSet`对该对象的引用，也就是说，如果其他对象都不再引用该对象，那么垃圾回收机制会自动回收该对象所占用的内存，不考虑该对象还存在于`WeakSet`之中。这个特点意味着，无法引用`WeakSet`的成员，因此`WeakSet`是不可遍历的。
+ `WeakSet`的一个用处，是储存DOM节点，而不用担心这些节点从文档移除时，会引发内存泄漏。

### Map

+ 键值可以是任何数据类型（key 判断是否相等几乎和`Object.is()`(`Same-value equality`)相同）

#### `WeakMap`

+ 只接受对象类型的Key（[不支持Null](https://baijiahao.baidu.com/s?id=1596002376259458143&wfr=spider&for=pc)）

+ 用作部署私有属性

  ```javascript
  let _counter = new WeakMap();
  let _action = new WeakMap();
  
  class Countdown {
    constructor(counter, action) {
      _counter.set(this, counter);
      _action.set(this, action);
    }
    dec() {
      let counter = _counter.get(this);
      if (counter < 1) return;
      counter--;
      _counter.set(this, counter);
      if (counter === 0) {
        _action.get(this)();
      }
    }
  }
  
  let c = new Countdown(2, () => console.log('DONE'));
  
  c.dec()
  c.dec()
  ```

### Proxy

属于一种元编程（`meta programming`），即对编程语言进行编程

#### 支持的拦截操作

- `get`
- `set`
- `has`
- `deleteProperty`
- `ownKeys`
- `getOwnPropertyDescription`
- `defineProperty`
- `preventExtensions`
- `getPrototypeOf`
- `isExtensible`
- `setPrototypeOf`
- `apply`
- construct

#### this问题

虽然 Proxy 可以代理针对目标对象的访问，但它不是目标对象的透明代理，即不做任何拦截的情况下，也无法保证与目标对象的行为一致。主要原因就是在 Proxy 代理的情况下，目标对象内部的`this`关键字会指向 Proxy 代理。

```javascript
// 反例
const target = new Date();
const handler = {};
const proxy = new Proxy(target, handler);

proxy.getDate();
// TypeError: this is not a Date object.
```

上面代码中，`getDate`方法只能在`Date`对象实例上面拿到，如果`this`不是`Date`对象实例就会报错。这时，`this`绑定原始对象，就可以解决这个问题。

```javascript
// 正确使用
const target = new Date('2015-01-01');
const handler = {
  get(target, prop) {
    if (prop === 'getDate') {
      return target.getDate.bind(target);
    }
    return Reflect.get(target, prop);
  }
};
const proxy = new Proxy(target, handler);

proxy.getDate() // 1
```

### Reflect

#### 设计目的

+ 将`Object`对象的一些明显属于语言内部的方法（比如`Object.defineProperty`），放到`Reflect`对象上。现阶段，某些方法同时在`Object`和`Reflect`对象上部署，未来的新方法将只部署在`Reflect`对象上。

+ 修改某些Object方法的返回结果，让其变得更合理。比如，`Object.defineProperty(obj, name, desc)`在无法定义属性时，会抛出一个错误，而`Reflect.defineProperty(obj, name, desc)`则会返回`false`。

+  让`Object`操作都变成函数行为。某些`Object`操作是命令式，比如`name in obj`和`delete obj[name]`，而`Reflect.has(obj, name)`和`Reflect.deleteProperty(obj, name)`让它们变成了函数行为。

+ `Reflect`对象的方法与`Proxy`对象的方法一一对应，只要是`Proxy`对象的方法，就能在`Reflect`对象上找到对应的方法。这就让`Proxy`对象可以方便地调用对应的`Reflect`方法，完成默认行为，作为修改行为的基础。也就是说，不管`Proxy`怎么修改默认行为，你总可以在`Reflect`上获取默认行为。

  ```javascript
  var loggedObj = new Proxy(obj, {
    get(target, name) {
      console.log('get', target, name);
      return Reflect.get(target, name);
    },
    deleteProperty(target, name) {
      console.log('delete' + name);
      return Reflect.deleteProperty(target, name);
    },
    has(target, name) {
      console.log('has' + name);
      return Reflect.has(target, name);
    }
  });
  ```

#### 方法清单

- `Reflect.apply(target,thisArg,args)`
- `Reflect.construct(target,args)`
- `Reflect.get(target,name,receiver)`
- `Reflect.set(target,name,value,receiver)`
- `Reflect.defineProperty(target,name,desc)`
- `Reflect.deleteProperty(target,name)`
- `Reflect.has(target,name)`
- `Reflect.ownKeys(target)`
- `Reflect.isExtensible(target)`
- `Reflect.preventExtensions(target)`
- `Reflect.getOwnPropertyDescriptor(target, name)`
- `Reflect.getPrototypeOf(target)`
- `Reflect.setPrototypeOf(target, prototype)`

