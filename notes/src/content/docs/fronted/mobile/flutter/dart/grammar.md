---
title: Dart 语法
description: Dart 常用语法速览：变量与 final/const、内置类型、集合字面量、函数参数、空安全相关运算符与级联、类与构造函数、继承与 mixin、扩展方法、异步与异常处理。
---

这篇按"写代码时最常用到的顺序"整理 Dart 语法，每一节给出最小示例，并标出和 JavaScript 不同的地方。概念层面的背景（类型系统、空安全、库与包）见 [Dart 基础概念](/notes/fronted/mobile/flutter/dart/basic.html)。

## 变量

```dart
var name = 'Bob';        // 推断为 String
String city = 'Paris';   // 显式标注类型
int? age;                // 可空类型，默认值 null
late String token;       // 非空，但稍后再赋值
```

在空安全下，非空变量必须在使用前初始化；局部变量可以先声明后赋值，只要编译器能确认使用前一定赋过值。

### final 与 const

| 关键字 | 含义 | 何时确定值 |
| --- | --- | --- |
| `final` | 只能赋值一次 | 运行时，第一次赋值时 |
| `const` | 编译期常量 | 编译时，值必须由常量表达式算出 |

```dart
final now = DateTime.now();  // 可以：运行时确定
// const t = DateTime.now(); // 错误：不是编译期常量
const pi = 3.14159;
const list = [1, 2, 3];      // 常量列表，不可修改
```

`const` 还能修饰值本身：`const [1, 2]` 创建一个深度不可变的列表，相同的常量值在内存中只有一份（会被规范化复用）。Flutter 中给 Widget 加 `const` 构造，可以让框架跳过不必要的重建。

另外注意：`final` 只保证变量不能重新赋值，对象内容仍可修改：

```dart
final items = [1, 2];
items.add(3);   // 可以
// items = [];  // 错误
```

## 内置类型

| 类型 | 说明 |
| --- | --- |
| `int`、`double`（父类型 `num`） | 整数与浮点数；没有 JS 那样的单一 number 类型 |
| `String` | UTF-16 字符串，单双引号均可，`'''` 写多行字符串 |
| `bool` | 只有 `true` / `false`，条件判断必须用 `bool` |
| `List`、`Set`、`Map` | 集合类型，见下一节 |
| `Runes` | 字符串的 Unicode 码点，处理 emoji 等字符时使用（Flutter 中更常用 `characters` 包） |
| `Symbol` | 标识符的符号表示，日常开发很少用到 |
| `Record` | Dart 3 引入的记录类型，如 `(int, String)` |
| `Null` | 只有一个值 `null` |

字符串插值和常用转换：

```dart
var n = 3;
print('count: $n, next: ${n + 1}');
var i = int.parse('42');
var d = double.parse('1.5');
var s = 3.14159.toStringAsFixed(2); // '3.14'
```

记录可以方便地返回多个值：

```dart
(int, String) pair() => (1, 'one');

void main() {
  var (num, word) = pair(); // 解构
  print('$num $word');
}
```

## 集合

```dart
var list = <int>[1, 2, 3];            // List，有序可重复
var set = <String>{'a', 'b'};         // Set，无序不重复
var map = <String, int>{'a': 1};      // Map，键值对
var emptySet = <String>{};            // 注意：{} 单独写是 Map
```

集合字面量里可以直接写 `if`、`for` 和展开运算符，构建列表时非常方便（Flutter 写 `children` 时常用）：

```dart
var isAdmin = true;
var base = [1, 2];
List<int>? extra;

var result = [
  0,
  ...base,             // 展开：0, 1, 2
  ...?extra,           // 空感知展开：extra 为 null 时跳过
  if (isAdmin) 99,     // 条件元素
  for (var x in base) x * 10, // 循环元素：10, 20
];
// [0, 1, 2, 99, 10, 20]
```

常用操作：

```dart
var nums = [1, 2, 3, 4];
var evens = nums.where((n) => n.isEven).toList();
var doubled = nums.map((n) => n * 2).toList();
var sum = nums.fold<int>(0, (a, b) => a + b);
print(nums.isEmpty);   // 判断空用 isEmpty，而不是 length == 0
```

`map`、`where` 返回的是惰性的 `Iterable`，需要列表时调用 `toList()`。

## 函数

```dart
int add(int a, int b) {
  return a + b;
}

int add2(int a, int b) => a + b;  // 箭头函数：函数体只有一个表达式
```

箭头 `=>` 后面只能是一个表达式，不能是语句块。

### 参数

Dart 的参数分三类：

```dart
// 1. 必需位置参数
void a(int x) {}

// 2. 可选位置参数：用 [] 包起来，可设默认值
String greet(String name, [String greeting = 'Hello']) => '$greeting, $name';
greet('Tom');            // Hello, Tom
greet('Tom', 'Hi');      // Hi, Tom

// 3. 命名参数：用 {} 包起来，调用时写参数名
void createUser({required String name, int age = 0, String? email}) {}
createUser(name: 'Tom', email: 'a@b.com');
```

命名参数默认是可选的；非空且没有默认值的命名参数必须加 `required`。可选位置参数和命名参数不能在同一个函数里同时使用。

### 函数是一等对象与闭包

```dart
void printItem(int x) => print(x);
[1, 2].forEach(printItem);         // 函数作为参数

var square = (int x) => x * x;     // 匿名函数赋值给变量

Function makeAdder(int base) {
  return (int x) => base + x;      // 闭包，捕获了 base
}

void main() {
  var add10 = makeAdder(10);
  print(add10(5)); // 15
}
```

Dart 使用词法作用域，闭包捕获的是外层变量本身。更精确的函数类型写法是 `int Function(int)`，可以用 `typedef` 起别名：

```dart
typedef IntMapper = int Function(int);
IntMapper makeAdder2(int base) => (x) => base + x;
```

## 运算符

除了常见的算术、比较、逻辑运算符，Dart 有几个需要特别记住的：

| 运算符 | 含义 | 示例 |
| --- | --- | --- |
| `~/` | 整除 | `7 ~/ 2` 结果为 `3` |
| `is` / `is!` | 类型判断 | `if (x is String)` |
| `as` | 类型转换，失败抛异常 | `(x as String).length` |
| `?.` | 空感知访问 | `user?.name` |
| `??` | 为 null 时取右侧 | `name ?? 'guest'` |
| `??=` | 为 null 时才赋值 | `cache ??= load();` |
| `!` | 非空断言 | `map['key']!` |
| `..` / `?..` | 级联，对同一对象连续操作 | 见下文 |

`==` 比较的是值（调用 `operator ==`），判断是否同一个对象用 `identical(a, b)`。Dart 没有 `===`。

### 级联运算符

级联让你对同一个对象连续调用方法或设置属性，整个表达式的值是这个对象本身：

```dart
var buffer = StringBuffer()
  ..write('Hello')
  ..write(', ')
  ..write('Dart');
print(buffer.toString()); // Hello, Dart

var paint = Paint()
  ..color = Colors.blue
  ..strokeWidth = 2;
```

对象可能为空时，第一个级联写成 `?..`。

## 控制流

`if/else`、`for`、`for-in`、`while`、`do-while`、`break`、`continue` 和 JS 基本一样，区别是条件必须为 `bool`。

`switch` 在 Dart 3 中得到增强，支持模式匹配和 switch 表达式，非空 case 之间不会贯穿执行（不需要写 `break`）：

```dart
String describe(Object value) => switch (value) {
      int n when n < 0 => '负数',
      int _ => '整数',
      String s => '字符串：$s',
      _ => '其他',
    };
```

`assert(condition, message)` 只在开发模式生效，发布版本会被忽略。

## 类

```dart
class Point {
  final double x;
  final double y;

  // 构造函数，this.x 语法直接给字段赋值
  const Point(this.x, this.y);

  // 命名构造函数
  Point.origin()
      : x = 0,
        y = 0;

  double squaredDistanceTo(Point other) {
    final dx = x - other.x;
    final dy = y - other.y;
    return dx * dx + dy * dy;
  }

  @override
  String toString() => 'Point($x, $y)';
}

void main() {
  var p = Point(1, 2);       // 不需要 new
  var o = Point.origin();
  print(p.runtimeType);      // Point
}
```

### 初始化列表

构造函数参数列表和函数体之间、冒号后面的部分是初始化列表，在函数体执行之前运行，用来初始化 `final` 字段、调用父类构造函数、做断言：

```dart
class Rect {
  final double width;
  final double height;
  final double area;

  Rect(this.width, this.height)
      : assert(width >= 0),
        area = width * height;
}
```

### 命名参数构造与 getter/setter

```dart
class User {
  final String name;
  int _age;

  User({required this.name, int age = 0}) : _age = age;

  int get age => _age;
  set age(int value) {
    if (value < 0) throw ArgumentError('age 不能为负');
    _age = value;
  }
}
```

### factory 构造函数

`factory` 构造函数不一定创建新实例，可以返回缓存对象或子类实例，常用于单例和从 JSON 创建对象：

```dart
class Logger {
  static final Map<String, Logger> _cache = {};
  final String name;

  Logger._internal(this.name); // 私有命名构造

  factory Logger(String name) {
    return _cache.putIfAbsent(name, () => Logger._internal(name));
  }
}

class Todo {
  final int id;
  final String title;
  Todo({required this.id, required this.title});

  factory Todo.fromJson(Map<String, dynamic> json) {
    return Todo(id: json['id'] as int, title: json['title'] as String);
  }
}
```

### 静态成员

```dart
class Config {
  static const version = '1.0';
  static int count = 0;
  static void reset() => count = 0;
}
```

## 继承、接口与 mixin

### 继承与抽象类

```dart
abstract class Shape {
  double area(); // 抽象方法，没有方法体
}

class Circle extends Shape {
  final double r;
  Circle(this.r);

  @override
  double area() => 3.14159 * r * r;
}
```

子类构造函数调用父类构造可以用 `super(...)`，或直接用 `super.参数` 的简写：

```dart
class Animal {
  final String name;
  Animal(this.name);
}

class Dog extends Animal {
  Dog(super.name);
}
```

### 隐式接口

每个类都隐式定义了一个接口，其他类可以用 `implements` 实现它，此时必须实现所有成员（不继承任何实现）：

```dart
class Flyer {
  void fly() {}
}

class Bird implements Flyer {
  @override
  void fly() => print('flying');
}
```

Dart 只支持单继承，但可以实现多个接口。

### mixin

mixin 用来在多个类之间复用代码，而不建立继承关系：

```dart
mixin Swimmer {
  void swim() => print('swimming');
}

mixin Walker {
  void walk() => print('walking');
}

class Duck extends Animal with Swimmer, Walker {
  Duck(super.name);
}
```

用 `on` 可以限制 mixin 只能用于某个类的子类，并在 mixin 中调用该类的成员。Dart 3 起，普通 `class` 不能再直接被 `with` 混入，需要声明为 `mixin` 或 `mixin class`。

Dart 3 还加入了类修饰符：`sealed`（密封类，配合 switch 做穷尽检查）、`final`、`base`、`interface`，用于控制类能否在库外被继承或实现。

### 枚举

```dart
enum Status { pending, done }

// 增强枚举：可以有字段、构造函数和方法
enum Level {
  low(1),
  high(3);

  final int weight;
  const Level(this.weight);
}

void main() {
  print(Status.done.name);     // done
  print(Level.high.weight);    // 3
  print(Status.values);        // [Status.pending, Status.done]
}
```

### 扩展方法

扩展方法可以给已有类型（包括 `String`、`int` 这类内置类型）添加方法，而不用修改原类或继承：

```dart
extension StringX on String {
  bool get isBlank => trim().isEmpty;
  String capitalize() => isEmpty ? this : this[0].toUpperCase() + substring(1);
}

void main() {
  print('  '.isBlank);       // true
  print('dart'.capitalize()); // Dart
}
```

扩展方法是静态分发的：根据变量的静态类型决定调用哪个扩展，对 `dynamic` 类型的变量不生效。

## 泛型

```dart
class Box<T> {
  final T value;
  Box(this.value);
}

// 限制类型参数
class NumBox<T extends num> {
  final T value;
  NumBox(this.value);
  bool get isPositive => value > 0; // 可以使用 num 上的运算
}

// 泛型函数
T first<T>(List<T> items) => items.first;
```

## 异步

### Future 与 async/await

`Future` 相当于 JS 的 `Promise`，表示一个将来才会得到的结果：

```dart
Future<String> fetchName() async {
  await Future.delayed(const Duration(seconds: 1));
  return 'Dart';
}

Future<void> main() async {
  try {
    final name = await fetchName();
    print(name);
  } catch (e) {
    print('出错：$e');
  }

  // 并发等待多个 Future
  final results = await Future.wait([fetchName(), fetchName()]);
  print(results);
}
```

- `async` 函数总是返回 `Future`。
- 不用 `await` 时可以用 `then`、`catchError`、`whenComplete` 链式处理。
- 和 JS 一样，`await` 之后的代码会在之后的事件循环中继续执行，不会阻塞当前线程。

### Stream

`Stream` 表示一串异步事件，类似可以被持续监听的数据流：

```dart
Stream<int> countDown(int from) async* {
  for (var i = from; i >= 0; i--) {
    await Future.delayed(const Duration(milliseconds: 100));
    yield i; // 产出一个值
  }
}

Future<void> main() async {
  await for (final n in countDown(3)) {
    print(n); // 3 2 1 0
  }

  // 或者用 listen
  final sub = countDown(2).listen(
    (n) => print('got $n'),
    onDone: () => print('done'),
  );
  // 不再需要时调用 sub.cancel()
}
```

`async*` 函数返回 `Stream`，用 `yield` 产出值；`sync*` 函数返回 `Iterable`，是同步生成器。

### Isolate

Dart 的代码运行在 isolate 中，每个 isolate 有独立的内存和事件循环，彼此不共享状态，只能通过消息通信。耗时的计算可以放到另一个 isolate 中，避免阻塞 UI：

```dart
import 'dart:isolate';

Future<void> main() async {
  final result = await Isolate.run(() {
    var sum = 0;
    for (var i = 0; i < 100000000; i++) {
      sum += i;
    }
    return sum;
  });
  print(result);
}
```

## 异常处理

```dart
void check(int age) {
  if (age < 0) {
    throw ArgumentError.value(age, 'age', '不能为负');
  }
}

void main() {
  try {
    check(-1);
  } on ArgumentError catch (e) {
    print('参数错误：${e.message}');
  } on FormatException {
    print('格式错误');
  } catch (e, stackTrace) {
    print('其他错误：$e');
    print(stackTrace);
    rethrow; // 继续向上抛出
  } finally {
    print('总会执行');
  }
}
```

- `on 类型` 按类型捕获，`catch (e, s)` 拿到异常对象和调用栈。
- `rethrow` 保留原始调用栈重新抛出。
- Dart 区分 `Exception`（可预期、应该处理的情况，如格式错误、IO 失败）和 `Error`（程序缺陷，如参数错误、越界，通常不应该捕获后继续运行）。
- 技术上可以 `throw` 任何非空对象，但应只抛出 `Exception` 或 `Error` 的实现类。

## 注释

```dart
// 单行注释

/* 多行注释，一般只用于临时注释掉代码 */

/// 文档注释，会被 dart doc 用来生成 API 文档。
/// 用方括号引用标识符，如 [Point]。
class Point {}
```

注释的写法规范见 [Dart 编码规范](/notes/fronted/mobile/flutter/dart/codeRule.html)。

## 小结

- `final` 运行时只赋值一次，`const` 是编译期常量且深度不可变；`final` 不限制对象内容被修改。
- 集合字面量支持 `if`、`for`、`...`、`...?`，判断空集合用 `isEmpty`。
- 参数分必需位置、可选位置 `[]`、命名 `{}` 三类，非空命名参数要么有默认值，要么加 `required`。
- 常用运算符：`?.`、`??`、`??=`、`!`、`~/`、`is`、`as` 和级联 `..`。
- 类支持命名构造、初始化列表、`factory`；复用代码可以用继承、`implements`、mixin 和扩展方法。
- 异步用 `Future`、`async/await`、`Stream`、`async*`；计算密集任务放到 isolate；异常用 `on`/`catch`/`finally`，并区分 `Exception` 与 `Error`。

## 参考

- [Dart 语言概览](https://dart.dev/language)
- [Dart：变量](https://dart.dev/language/variables)
- [Dart：集合](https://dart.dev/language/collections)
- [Dart：函数](https://dart.dev/language/functions)
- [Dart：构造函数](https://dart.dev/language/constructors)
- [Dart：Mixin](https://dart.dev/language/mixins)
- [Dart：扩展方法](https://dart.dev/language/extension-methods)
- [Dart：异步编程](https://dart.dev/language/async)
- [Dart：并发与 Isolate](https://dart.dev/language/concurrency)
