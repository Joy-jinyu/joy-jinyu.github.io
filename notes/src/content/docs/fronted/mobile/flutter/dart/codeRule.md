---
title: Dart 编码规范
description: 基于 Effective Dart 整理命名、导入顺序、格式化、注释与文档注释、常见用法建议，并说明如何用 dart format、analysis_options.yaml 和 lints 包把规范落到项目里。
---

Dart 官方的编码规范叫 Effective Dart，分为风格（Style）、文档（Documentation）、用法（Usage）、设计（Design）四部分。这篇挑出日常写代码最常遇到的条目，按"规则 + 原因 + 示例"整理，最后说明怎么用工具自动检查，而不是靠人工记忆。

## 规则的措辞

Effective Dart 每条规则用固定的词开头，表示约束强度：

| 措辞 | 含义 |
| --- | --- |
| 要（DO） | 应该始终遵守 |
| 不要（DON'T） | 几乎总是错误的做法 |
| 推荐（PREFER） | 大多数情况下应该这样做，有充分理由时可以例外 |
| 避免（AVOID） | 大多数情况下不应这样做 |
| 考虑（CONSIDER） | 视情况而定，可做可不做 |

## 命名

Dart 用三种命名风格：

| 风格 | 写法 | 适用对象 |
| --- | --- | --- |
| `UpperCamelCase` | 每个单词首字母大写 | 类、枚举类型、`typedef`、类型参数、扩展名、mixin |
| `lowerCamelCase` | 第一个单词小写，其余单词首字母大写 | 变量、参数、命名参数、类成员、顶层函数和变量、**常量**、枚举值 |
| `lowercase_with_underscores` | 全小写，下划线连接 | 包名、目录名、源文件名、导入前缀 |

```dart
// 文件名：http_client.dart
import 'dart:math' as math;

class HttpClient {}
typedef Predicate<T> = bool Function(T value);
extension StringUtils on String {}

const defaultTimeout = Duration(seconds: 10);
enum Status { pending, done }

void sendRequest({required String url}) {}
```

几条细则：

- **常量用 `lowerCamelCase`**，而不是 Java 风格的 `SCREAMING_CAPS`。原因有三：全大写在很多场景下（比如颜色常量）不好看；常量经常会被改成 `final` 变量，到时又得改名；枚举自动生成的 `values` 属性本身就是小写。只有在与已有的全大写代码保持一致时（如从其他语言生成的代码）才使用全大写。
- **超过两个字母的缩写词按普通单词处理**：写 `HttpConnection`、`parseJson`，而不是 `HTTPConnection`、`parseJSON`。两个字母的缩写保持大写，如 `IOStream`，但在 `lowerCamelCase` 开头时小写，如 `ioStream`。
- **不要使用前缀字母**，比如匈牙利命名法 `kDefaultTimeout`、`mName`。Dart 有类型和作用域信息，不需要靠前缀区分。Flutter 框架源码中能看到 `kMinInteractiveDimension` 这类带 `k` 前缀的常量，那是 Flutter 仓库自身的约定，应用代码按 Effective Dart 来即可。
- 不使用的回调参数用 `_` 命名。
- 只有私有成员才以 `_` 开头；局部变量、参数不要加下划线，它们本来就不对外可见。

## 导入顺序

按以下顺序分组，组与组之间空一行，每组内按字母排序：

1. `dart:` 核心库
2. `package:` 第三方包和本项目的包
3. 相对路径导入
4. `export` 语句单独放在所有导入之后

```dart
import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:my_app/models/user.dart';

import 'utils.dart';

export 'src/api.dart';
```

`lib/` 内部的文件之间推荐用相对路径导入。但不要用相对路径从 `lib/` 外部（如 `test/`、`bin/`）伸进 `lib/`，也不要从 `lib/` 里用相对路径引用外部文件，这类情况要用 `package:` 导入；否则同一个文件可能通过两种路径被导入，被当成两个不同的库，导致类型不一致。`dart fix` 和编辑器的"整理导入"功能可以自动排序。

## 格式化

**要用 `dart format` 格式化代码**，不要手动调整空格和换行。旧资料里的 `dartfmt` 命令已被 `dart format` 取代。

```bash
dart format .                          # 格式化当前目录
dart format --output=none --set-exit-if-changed .   # 只检查，不修改，适合 CI
```

Flutter 项目同样使用 `dart format`。格式化器默认行宽为 80 个字符，统一使用格式化器后，代码评审里就不需要再讨论格式问题。

其他相关规则：

- **要对所有流程控制语句使用花括号**。只有 `if` 语句没有 `else`、并且整个语句能写在一行时，可以省略花括号。

  ```dart
  if (arg == null) return defaultValue; // 可以

  if (overflowChars != other.overflowChars) {
    return overflowChars < other.overflowChars;
  }
  ```

- **考虑修改代码让格式化结果更好**：格式化器处理不好过长的表达式时，可以拆出局部变量，而不是去手动调整格式。
- **在多行参数列表末尾加尾逗号**：格式化器会据此把参数排成每行一个，这在 Flutter 的 Widget 嵌套中特别有用。较新版本的格式化器会自行决定是否加尾逗号，以实际格式化结果为准。

## 注释

- **要像写句子一样写注释**：首字母大写（英文）、以句号结尾。中文注释也应完整成句。
- **不要用块注释 `/* */` 写说明文字**。普通注释用 `//`，文档注释用 `///`；`/* */` 只在临时注释掉一段代码时使用。

```dart
void greet(String name) {
  // 假设 name 已经去除了首尾空格。
  print('Hi, $name!');
}
```

## 文档注释

文档注释以 `///` 开头，放在声明之前，`dart doc` 会根据它生成 API 文档网页。`/** */` 也被支持（历史原因），但推荐用 `///`：更紧凑，内容里有用 `*` 表示的列表时也不容易混淆。

```dart
/// 删除路径为 [path] 的文件或目录。
///
/// 如果 [recursive] 为 true，会连同子目录一起删除。
/// 文件不存在时抛出 [IOException]。
///
/// ```dart
/// await deletePath('/tmp/cache', recursive: true);
/// ```
Future<void> deletePath(String path, {bool recursive = false}) async {
  // ...
}
```

要点：

- **要用一句话总结开头**，并且让这句话单独成段，后面空一行再写细节。很多工具只显示第一句。
- **要用方括号引用作用域内的标识符**，如 `[path]`、`[IOException]`，生成文档时会变成链接。
- **把参数、返回值、异常的说明写进正文**，用方括号引用参数，不需要 `@param` 这类标签。
- **要把文档注释放在注解（如 `@override`、`@Deprecated`）之前**。
- **推荐为公开 API 写文档注释**；私有 API 有复杂逻辑时也推荐写。
- **考虑写库级别的文档注释**：放在文件开头的 `library` 指令前，说明库的用途、核心概念、主要类的链接和示例代码。
- **考虑在文档中加示例代码**，用 Markdown 代码块。
- **避免与上下文重复**：不要在类 `Widget` 的文档里写"这是一个 Widget 类"。
- 描述属性时说明"它是什么"，描述方法时说明"它做什么"。
- 英文文档中，引用当前实例的成员时推荐用 "this" 而不是 "the"，例如 "Returns `true` if this list is empty"。
- **避免过度使用 Markdown**，不要用 HTML 排版；表格只在确有必要时使用。
- **推荐简洁**，避免不常见的缩写。

## 常见用法建议

以下条目来自 Effective Dart 的 Usage 部分，挑选了最常用的。

### 字符串

```dart
// 推荐：插值
var greeting = 'Hello, $name! You are ${year - birth} years old.';

// 避免：用 + 拼接
var greeting2 = 'Hello, ' + name + '!';

// 不要在只有简单标识符时加多余花括号
print('Hi, ${name}'); // 写成 'Hi, $name'
```

长字符串跨行时，使用相邻字符串字面量自动拼接，而不是 `+`。

### 集合

```dart
// 推荐：集合字面量
var points = <Point>[];
var addresses = <String, Address>{};

// 不要用 length 判断是否为空
if (lunchBox.isEmpty) {}
if (words.isNotEmpty) {}

// 筛选指定类型用 whereType
var ints = objects.whereType<int>();

// 避免对函数字面量调用 forEach，直接用 for-in
for (final person in people) {
  person.greet();
}
```

### 变量与成员

- **不要显式地把变量初始化为 `null`**：可空变量默认就是 `null`。
- **避免存储可以计算出来的值**：比如有了 `radius` 就不要再存 `area`，否则两者容易不同步；需要时写成 getter。
- **不要无意义地包装字段**：只是读写一个字段，不需要写 getter/setter，直接用公开字段；需要只读时用 `final` 字段或只写 getter。
- 局部变量是否标注类型：通常靠推断即可；公开 API 的参数、返回值、字段应标注类型。

### 构造函数

```dart
class Point {
  double x, y;
  // 推荐：用 this. 简写初始化字段
  Point(this.x, this.y);
}

// 不要使用 new
var p = Point(1, 2);

// 不要冗余地写 const：外层已是 const 上下文时，内部不用再写
const primaryColors = [
  Color('red', [255, 0, 0]),
  Color('green', [0, 255, 0]),
];
```

### 错误处理

- **避免没有 `on` 子句的 `catch`**：笼统捕获会吞掉本该暴露的程序错误。
- **不要静默丢弃异常**：捕获后至少要记录或转换。
- **只为程序缺陷抛出 `Error`**，可预期的失败用 `Exception`。
- **不要显式捕获 `Error` 及其子类**，它们代表 bug，应该修代码而不是捕获。
- **要用 `rethrow` 重新抛出**，以保留原始调用栈。

### 异步

- **推荐用 `async/await`**，比链式 `then` 更易读。
- **不要在没有用处的地方写 `async`**：函数体里没有 `await`，又不需要把同步异常转成 Future 错误时，不必标记 `async`。
- 启动后不等待的 Future，要有意识地处理它的错误（例如用 `unawaited()` 明确标记，并在内部处理异常）。

## 用 analysis_options.yaml 和 lints 落地

规范靠记忆很难执行，Dart 提供了静态分析器和 lint 规则集，可以在编辑器里实时提示、在 CI 中检查。

### 官方规则集

| 包 | 用途 |
| --- | --- |
| `package:lints` | Dart 官方规则集，包含 `core.yaml`（核心规则）和 `recommended.yaml`（推荐规则，包含核心规则） |
| `package:flutter_lints` | Flutter 项目的推荐规则集，在 `lints` 基础上加入 Flutter 相关规则；新建的 Flutter 项目默认已配置 |

用 `dart create` 创建的项目通常已经配置好 `lints`。手动添加：

```bash
dart pub add --dev lints
# Flutter 项目
flutter pub add --dev flutter_lints
```

### 配置文件

在项目根目录（与 `pubspec.yaml` 同级）创建 `analysis_options.yaml`：

```yaml
include: package:lints/recommended.yaml
# Flutter 项目改为：include: package:flutter_lints/flutter.yaml

analyzer:
  exclude:
    - "**/*.g.dart"          # 排除代码生成的文件
  language:
    strict-casts: true       # 禁止隐式的 dynamic 向下转换
    strict-raw-types: true   # 要求显式写出泛型参数
  errors:
    todo: ignore             # 调整某条诊断的级别

linter:
  rules:
    prefer_single_quotes: true          # 开启规则集之外的规则
    always_declare_return_types: true
    avoid_print: false                  # 关闭某条规则（如 flutter_lints 中包含的 avoid_print）
```

`linter.rules` 有两种写法：列表写法（`- rule_name`）只能开启规则；map 写法（`rule_name: true/false`）既能开启也能关闭。**两种写法不能在同一个文件里混用**，需要关闭规则时统一用 map 写法。

### 运行检查与自动修复

```bash
dart analyze              # 静态分析
flutter analyze           # Flutter 项目
dart fix --dry-run        # 预览可自动修复的问题
dart fix --apply          # 应用自动修复
```

单行忽略某条规则（尽量少用，并写明原因）：

```dart
// ignore: avoid_print
print('debug');

// 整个文件忽略
// ignore_for_file: avoid_print
```

推荐在 CI 中执行 `dart format --output=none --set-exit-if-changed .` 和 `dart analyze`，两者都通过才允许合并。

## 小结

- 类型相关的名字用 `UpperCamelCase`，变量、成员、常量用 `lowerCamelCase`，文件、目录、包名和导入前缀用 `lowercase_with_underscores`。
- 导入按 `dart:`、`package:`、相对路径分组排序，`export` 单独放最后。
- 格式交给 `dart format`；流程控制语句加花括号。
- 普通注释用 `//`，文档注释用 `///`，以一句话总结开头，用方括号引用标识符。
- 用 `analysis_options.yaml` 引入 `lints` / `flutter_lints` 规则集，配合 `dart analyze`、`dart fix` 在编辑器和 CI 中自动检查。

## 参考

- [Effective Dart](https://dart.dev/effective-dart)
- [Effective Dart：风格](https://dart.dev/effective-dart/style)
- [Effective Dart：文档](https://dart.dev/effective-dart/documentation)
- [Effective Dart：用法](https://dart.dev/effective-dart/usage)
- [Effective Dart：设计](https://dart.dev/effective-dart/design)
- [Dart：自定义静态分析](https://dart.dev/tools/analysis)
- [Dart：Linter 规则](https://dart.dev/tools/linter-rules)
- [dart format](https://dart.dev/tools/dart-format)
