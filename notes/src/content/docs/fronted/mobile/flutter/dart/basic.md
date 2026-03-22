---
title: Dart 基础概念
description: Dart 的核心设计：一切皆对象、静态类型与类型推断、空安全、JIT 与 AOT 编译、库与包管理、程序入口，以及和 JavaScript 的主要差异。
---

Dart 是 Flutter 使用的语言，语法看起来像 Java 和 JavaScript 的混合，但设计理念有自己的特点。这篇不讲具体语法，而是先建立几个基础概念：类型系统怎么工作、空安全解决什么问题、代码怎么被编译和组织。读完再看 [Dart 语法](/notes/fronted/mobile/flutter/dart/grammar.html)会顺畅很多。

## 一切皆对象

Dart 中每个值都是某个类的实例：数字、字符串、布尔值、函数，甚至 `null` 都是对象。

- 数字 `1` 是 `int` 的实例，可以直接调用方法：`1.toString()`、`3.isOdd`。
- 函数是 `Function` 类型的对象，可以赋值给变量、作为参数传递。
- `null` 是 `Null` 类的唯一实例。

关于继承关系，要说得更准确一点：在空安全之后，**除了 `null` 之外**的所有对象都继承自 `Object`。`Null` 不是 `Object` 的子类，所以 `Object` 类型的变量不能保存 `null`；类型层级的顶端其实是 `Object?`（可空的 Object）。

```dart
Object a = 1;        // 可以
Object? b = null;    // 可以
// Object c = null;  // 编译错误
```

这和 JavaScript 不同：JS 区分原始值（number、string 等）和对象，原始值调用方法时会临时包装成对象。

## 静态类型与类型推断

Dart 是静态类型语言，类型在编译期检查。但大多数时候不需要手写类型，编译器会推断：

```dart
var name = 'Dart';      // 推断为 String
final count = 42;       // 推断为 int
name = 1;               // 编译错误：int 不能赋值给 String
```

`var` 声明的变量类型在初始化时就确定了，之后不能换成别的类型，这点和 JS 的 `var` 完全不同。

确实需要"任意类型"时有两种选择：

| 类型 | 含义 | 调用方法时 |
| --- | --- | --- |
| `Object?` | 任何值都可以放 | 只能调用 `Object` 上的方法，其他操作要先判断或转换类型，编译器会检查 |
| `dynamic` | 关闭静态检查 | 任何调用都能通过编译，错了在运行时报错 |

优先使用 `Object?`，`dynamic` 主要用于处理 JSON 这类结构不确定的数据。

Dart 支持泛型，并且泛型在运行时保留（reified），`List<int>` 和 `List<String>` 在运行时也是不同的类型：

```dart
var list = <int>[1, 2, 3];
print(list is List<int>);    // true
print(list is List<String>); // false
```

Java 的泛型在运行时会擦除，Dart 不会。

## 空安全

空安全（null safety）的规则很简单：**类型默认不可为空**。

```dart
String a = 'hi';
// a = null;           // 编译错误
String? b;             // 可空类型，默认值为 null
print(b?.length);      // 安全访问，b 为 null 时结果为 null
print(b ?? 'default'); // 为 null 时取默认值
```

编译器会追踪变量是否可能为空，访问可空类型的成员前必须先处理空值。做过判断后，编译器会自动把类型"提升"为非空：

```dart
int lengthOf(String? s) {
  if (s == null) return 0;
  return s.length; // 这里 s 已被提升为 String
}
```

几个配套机制：

- `!`：非空断言，告诉编译器"这里一定不为空"，如果运行时为空会抛异常。尽量少用。
- `late`：延迟初始化，声明一个非空变量但稍后才赋值；读取时如果还没赋值会抛异常。
- `required`：命名参数如果是非空类型且没有默认值，必须标记为 `required`。

"健全"（sound）的意思是：只要类型声明为非空，运行时就一定不会是 `null`，编译器和运行时都可以依赖这一点做优化。从 Dart 3 开始，语言只支持健全的空安全模式，旧的未迁移代码无法再运行。

## 编译方式：JIT 与 AOT

Dart 可以用不同方式编译，适配不同阶段：

| 方式 | 说明 | 使用场景 |
| --- | --- | --- |
| JIT（即时编译） | 在 Dart VM 上运行，边运行边编译，支持增量重新加载代码 | 开发阶段：`dart run`、Flutter Debug 模式，热重载依赖它 |
| AOT（预先编译） | 提前编译为目标平台的机器码，启动快、运行稳定 | 发布阶段：`dart compile exe`、Flutter Release 模式 |
| 编译到 JS / Wasm | 编译为 JavaScript 或 WebAssembly 在浏览器中运行 | Web 平台 |

JIT 让开发时能快速迭代，AOT 让发布版本获得接近原生的性能，这也是 Flutter 选择 Dart 的重要原因之一。

## 库与包

### 库（library）

在 Dart 里，**每个 `.dart` 文件就是一个库**。可见性以库为单位：以下划线 `_` 开头的标识符只在当前库内可见，没有 `public` / `private` / `protected` 关键字。

```dart
// counter.dart
class Counter {
  int _value = 0;           // 库私有
  int get value => _value;  // 公开的只读访问
  void increment() => _value++;
}
```

注意私有是"库级别"的，同一个文件里的其他类也能访问 `_value`，这一点和 Java 的类级别私有不同。

导入方式：

```dart
import 'dart:math';                    // 核心库
import 'package:http/http.dart' as http; // 第三方包，加前缀避免命名冲突
import 'src/utils.dart';               // 相对路径
import 'package:collection/collection.dart' show IterableExtension; // 只导入部分
```

### 包（package）与 pubspec.yaml

包是可以分发的一组库，由 `pubspec.yaml` 描述，用 pub 工具管理，作用类似 npm 和 `package.json`。

```yaml
name: my_app
description: 示例项目
version: 1.0.0

environment:
  sdk: ^3.0.0

dependencies:
  http: ^1.2.0

dev_dependencies:
  lints: ^4.0.0
```

常用命令：

```bash
dart pub get              # 安装依赖，生成 pubspec.lock
dart pub add http         # 添加依赖
dart pub add --dev lints  # 添加开发依赖
dart pub upgrade          # 在约束范围内升级
dart pub outdated         # 查看可升级的版本
```

Flutter 项目中对应地使用 `flutter pub get` 等命令。版本约束 `^1.2.0` 表示 `>=1.2.0 <2.0.0`，和 npm 的语义一致。应用项目应该提交 `pubspec.lock`，保证构建可复现。

包的约定目录：`lib/` 下是对外公开的代码，`lib/src/` 下放内部实现（约定不被外部直接导入），`bin/` 放可执行入口，`test/` 放测试。

## 程序入口 main

每个 Dart 程序都从顶层函数 `main()` 开始执行：

```dart
void main() {
  print('Hello, Dart');
}

// 需要命令行参数时
void main(List<String> arguments) {
  print(arguments);
}
```

Flutter 应用的入口也是 `main()`，通常在里面调用 `runApp()`：

```dart
import 'package:flutter/material.dart';

void main() {
  runApp(const MaterialApp(home: Text('Hello')));
}
```

Dart 支持顶层函数和顶层变量，不需要像 Java 那样把一切放进类里。函数也可以是类的静态方法、实例方法，或者定义在另一个函数内部的局部函数。

## 表达式、语句与错误

- **表达式**有值，比如 `a + b`、`cond ? x : y`、函数调用；**语句**没有值，比如 `if`、`for`、`return`。`if` 是语句，所以需要值的地方用条件表达式 `? :`。
- 静态分析会产出两类问题：**警告**（代码可能有问题，但能运行）和**错误**。错误又分为编译期错误（代码无法运行）和运行时错误（运行时抛出异常）。

## 与 JavaScript 的主要差异

| 方面 | JavaScript | Dart |
| --- | --- | --- |
| 类型 | 动态类型 | 静态类型 + 类型推断 |
| `null` / `undefined` | 两者都有 | 只有 `null`，未初始化的可空变量就是 `null` |
| 空值检查 | 运行时出错 | 编译期空安全检查 |
| 相等比较 | `==` 会隐式转换，常用 `===` | `==` 调用对象的 `operator ==`，不做隐式类型转换；判断同一对象用 `identical()` |
| 真值判断 | 任何值都能用于条件（truthy/falsy） | 条件必须是 `bool`，`if (list.length)` 编译不通过 |
| 隐私 | `#` 私有字段、闭包 | 以 `_` 开头，库级私有 |
| 模块 | ES Module | 文件即库，`import` / `export`，`show` / `hide` 控制导入范围 |
| 类 | 基于原型，`class` 是语法糖 | 基于类，支持 mixin、扩展方法、抽象类、隐式接口 |
| 函数参数 | 不检查个数 | 位置参数、可选位置参数、命名参数，调用时严格检查 |
| 异步 | `Promise`、`async/await` | `Future`、`Stream`、`async/await`，也有事件循环和微任务队列 |
| 并发 | Web Worker | Isolate：各自独立内存，通过消息通信 |

JS 的事件循环可以参考[执行机制与事件循环](/notes/fronted/language/javascript/eventLoop.html)，Dart 单个 isolate 内的模型与之类似：一个事件队列加一个微任务队列，微任务优先执行。

## 小结

- Dart 中所有值都是对象；空安全后除 `null` 外的对象都继承自 `Object`，顶层类型是 `Object?`。
- 静态类型配合类型推断，`var` 推断后类型不能再变；优先用 `Object?` 而非 `dynamic`。
- 类型默认非空，`?`、`!`、`late`、`required` 是空安全的配套语法；Dart 3 起只支持健全空安全。
- 开发用 JIT 支持热重载，发布用 AOT 获得性能，Web 平台编译到 JS 或 Wasm。
- 每个文件是一个库，`_` 开头表示库级私有；包由 `pubspec.yaml` 描述，用 pub 管理。

## 参考

- [Dart 语言概览](https://dart.dev/language)
- [Dart：理解空安全](https://dart.dev/null-safety/understanding-null-safety)
- [Dart：类型系统](https://dart.dev/language/type-system)
- [Dart：包与 pubspec](https://dart.dev/tools/pub/pubspec)
- [Dart：平台与编译](https://dart.dev/overview)
