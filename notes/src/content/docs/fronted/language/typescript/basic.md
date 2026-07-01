---
title: TypeScript 类型系统
description: 从基础类型、类型收窄、泛型讲到工具类型、映射类型与条件类型，再到 tsconfig 关键选项和在 Node.js 项目中运行 TypeScript 的几种方式。
---

TypeScript 是 JavaScript 的超集：在 JS 语法之上加了一套静态类型系统，编译时做检查，编译后类型全部擦除，运行的仍是普通 JS。这篇按"日常最常用 → 类型编程入门 → 工程配置"的顺序梳理类型系统的核心概念，读完应该能看懂常见库的类型声明，并为自己的项目配好一套严格的类型检查。

## 基础类型

| 类型 | 说明 |
| --- | --- |
| `string` / `number` / `boolean` | 对应 JS 的原始值。注意用小写，`String` 等大写形式是包装对象类型，几乎用不到。 |
| `bigint` / `symbol` | 对应 JS 的 `BigInt` 和 `Symbol`。 |
| `null` / `undefined` | 开启 `strictNullChecks` 后是独立类型，不能随便赋给其他类型。 |
| 数组 | `number[]` 或 `Array<number>`，两种写法等价。 |
| 元组 | `[string, number]`，长度和每个位置的类型都固定。 |
| `object` | 任何非原始值。 |
| `void` | 函数没有有意义的返回值。 |
| `any` / `unknown` / `never` | 见下一节。 |

大多数情况下不必手写类型，TS 会根据初始值和返回语句推断：

```ts
let count = 0;            // 推断为 number
const lang = 'ts';        // 推断为字面量类型 'ts'（const 不可重新赋值）
const list = [1, 2, 3];   // 推断为 number[]

function add(a: number, b: number) {
  return a + b;           // 返回值推断为 number
}
```

经验做法是：函数参数、导出 API 的签名显式标注，局部变量交给推断。

## any、unknown 与 never

这三个是类型系统的"边界"类型，最容易混用。

| 类型 | 含义 | 能赋什么值给它 | 能拿它做什么 |
| --- | --- | --- | --- |
| `any` | 关闭类型检查 | 任何值 | 任何操作，都不报错 |
| `unknown` | 类型安全的"不知道是什么" | 任何值 | 几乎什么都不能做，必须先收窄 |
| `never` | 不可能存在的值 | 除 `never` 自己外都不能赋 | 可以赋给任何类型 |

```ts
let a: any = JSON.parse('{}');
a.foo.bar();              // 编译通过，运行时报错

let u: unknown = JSON.parse('{}');
// u.foo;                 // 报错：'u' is of type 'unknown'
if (typeof u === 'object' && u !== null && 'foo' in u) {
  console.log(u.foo);     // 收窄后才可以访问
}
```

`any` 会"传染"：一个 `any` 值参与的表达式结果也是 `any`，类型检查就此失效。外部输入（接口响应、`JSON.parse`、`catch` 到的错误）应当用 `unknown` 接住，校验后再使用。

`never` 常见于两处：永远不会正常返回的函数（总是抛错或死循环），以及类型收窄到"没有剩余可能"时。后者可以用来做穷尽检查，见下文判别联合一节。

## 联合、交叉与字面量类型

**联合类型** `A | B` 表示"是 A 或者是 B"。使用前通常需要先判断是哪一种：

```ts
function format(id: string | number) {
  return typeof id === 'number' ? id.toFixed(0) : id.trim();
}
```

**交叉类型** `A & B` 表示"同时满足 A 和 B"，常用来组合对象类型：

```ts
type WithId = { id: string };
type User = { name: string };
type UserRecord = WithId & User; // { id: string; name: string }
```

两个同名属性类型冲突时，交叉结果里该属性会变成 `never`，不会报错，要留意。如果冲突的是字面量这类判别属性（如 `{ kind: 'a' } & { kind: 'b' }`），整个交叉类型会被直接化简为 `never`。

**字面量类型** 把具体的值当成类型，配合联合可以表达枚举：

```ts
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
function request(url: string, method: Method) {}

request('/api', 'GET');
// request('/api', 'get'); // 报错：大小写不匹配
```

对象字面量的属性默认会被拓宽成 `string` 等宽类型。需要保留字面量时用 `as const`，它会把整个对象变成只读并保留每个值的字面量类型：

```ts
const config = { method: 'GET', retry: 3 } as const;
// 类型为 { readonly method: 'GET'; readonly retry: 3 }
```

## 类型收窄

联合类型在使用前要"收窄"到具体的一支。TS 能识别以下几种判断：

```ts
// typeof：区分原始类型
function f1(x: string | number) {
  if (typeof x === 'string') x.toUpperCase();
  else x.toFixed();
}

// in：判断对象上是否有某个属性
type Fish = { swim(): void };
type Bird = { fly(): void };
function move(a: Fish | Bird) {
  if ('swim' in a) a.swim();
  else a.fly();
}

// instanceof：区分类实例
function f2(e: Date | Error) {
  if (e instanceof Date) e.getTime();
  else e.message;
}
```

`typeof null` 的结果是 `'object'`，所以 `typeof x === 'object'` 并不能排除 `null`，需要额外判断 `x !== null`。

### 判别联合

给联合里的每个成员加一个字面量类型的公共字段（通常叫 `type` 或 `kind`），判断这个字段就能收窄。这是建模"多种状态"最常用的写法：

```ts
type State =
  | { status: 'loading' }
  | { status: 'success'; data: string[] }
  | { status: 'error'; error: Error };

function render(s: State) {
  switch (s.status) {
    case 'loading':
      return '加载中';
    case 'success':
      return s.data.join(',');   // 这里 s 已收窄为 success 分支
    case 'error':
      return s.error.message;
    default: {
      const unreachable: never = s; // 穷尽检查
      return unreachable;
    }
  }
}
```

`default` 分支里把 `s` 赋给 `never`：如果以后给 `State` 加了新状态却忘了处理，这里会编译报错。

### 类型谓词与断言函数

把判断逻辑抽成函数后，TS 默认不知道函数返回 `true` 意味着什么。用 `x is T` 形式的返回类型（类型谓词）告诉它：

```ts
function isString(x: unknown): x is string {
  return typeof x === 'string';
}

const values: unknown[] = ['a', 1, 'b'];
const strings = values.filter(isString); // string[]
```

还有一种 `asserts` 形式，函数正常返回就表示条件成立，否则应抛错：

```ts
function assertIsDefined<T>(v: T): asserts v is NonNullable<T> {
  if (v === undefined || v === null) throw new Error('值不能为空');
}
```

类型谓词的正确性由函数实现保证，TS 不会检查函数体是否真的符合声明。写错了等于在骗编译器。

## interface 与 type

两者都能描述对象类型，大部分场景可以互换：

```ts
interface Point { x: number; y: number }
type Point2 = { x: number; y: number };
```

区别主要在这几点：

| 方面 | `interface` | `type` 别名 |
| --- | --- | --- |
| 能描述的东西 | 只能描述对象（含函数、类的形状） | 任何类型：联合、元组、原始类型、映射类型、条件类型等 |
| 扩展方式 | `extends`，属性冲突时直接报错 | `&` 交叉，属性冲突时得到 `never` |
| 声明合并 | 同名 interface 会自动合并 | 同名重复声明直接报错 |
| 实现 | 类可以 `implements` | 类也可以 `implements` 对象形状的 type |

声明合并常用于给第三方类型"打补丁"，比如扩展全局 `Window`：

```ts
declare global {
  interface Window {
    __APP_VERSION__: string;
  }
}
export {};
```

一个简单的取舍：需要联合、元组、类型运算时只能用 `type`；描述对象形状、需要被扩展或合并时用 `interface`。团队内统一即可，不必纠结。

## 泛型与约束

泛型就是"类型参数"，让函数、类、类型在使用时再确定具体类型：

```ts
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

first([1, 2]);     // T 推断为 number
first(['a']);      // T 推断为 string
```

用 `extends` 约束类型参数必须满足某种形状：

```ts
function getLength<T extends { length: number }>(x: T) {
  return x.length;
}

getLength('abc');
getLength([1, 2]);
// getLength(123); // 报错：number 没有 length
```

配合 `keyof` 可以写出"只能取对象上真实存在的键"的函数：

```ts
function pick<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: 'a', age: 1 };
pick(user, 'name');  // string
// pick(user, 'foo'); // 报错
```

泛型参数可以有默认值：`interface Response<T = unknown> { data: T }`。一个判断标准：如果类型参数只出现一次，不参与输入和输出之间的关联，通常就不需要泛型。

## keyof、typeof 与索引访问类型

这三个操作符是从已有类型"派生"新类型的基础。

```ts
const defaults = { theme: 'light', size: 14 };

// typeof：在类型位置取一个值的类型
type Defaults = typeof defaults;      // { theme: string; size: number }

// keyof：取对象类型所有键组成的联合
type Key = keyof Defaults;            // 'theme' | 'size'

// 索引访问：取某个属性的类型
type Size = Defaults['size'];         // number
type Values = Defaults[keyof Defaults]; // string | number
```

数组也能索引访问，`T[number]` 取元素类型。和 `as const` 配合，可以从一个常量数组派生出联合类型，做到"值和类型只写一份"：

```ts
const ROLES = ['admin', 'editor', 'viewer'] as const;
type Role = (typeof ROLES)[number]; // 'admin' | 'editor' | 'viewer'
```

注意类型位置的 `typeof` 和 JS 运行时的 `typeof` 是两回事：前者得到类型，后者得到一个字符串。

## 常用工具类型

TS 内置了一批工具类型，覆盖了大部分日常的类型变换需求：

| 工具类型 | 作用 | 示例 |
| --- | --- | --- |
| `Partial<T>` | 所有属性变可选 | 更新接口的参数 |
| `Required<T>` | 所有属性变必选 | 合并默认值之后的配置 |
| `Readonly<T>` | 所有属性变只读 | 不可变状态 |
| `Pick<T, K>` | 只保留指定的键 | `Pick<User, 'id' \| 'name'>` |
| `Omit<T, K>` | 去掉指定的键 | `Omit<User, 'password'>` |
| `Record<K, V>` | 键为 K、值为 V 的对象 | `Record<Role, string[]>` |
| `Exclude<U, E>` | 从联合 U 中去掉可赋给 E 的成员 | `Exclude<'a' \| 'b', 'a'>` 得 `'b'` |
| `Extract<U, E>` | 从联合 U 中保留可赋给 E 的成员 | `Extract<string \| number, number>` 得 `number` |
| `NonNullable<T>` | 去掉 `null` 和 `undefined` | |
| `ReturnType<F>` | 函数返回值类型 | `ReturnType<typeof fetchUser>` |
| `Parameters<F>` | 函数参数组成的元组 | `Parameters<typeof fn>[0]` |
| `Awaited<T>` | 递归解开 Promise | `Awaited<ReturnType<typeof fetchUser>>` |
| `InstanceType<C>` | 构造函数的实例类型 | |

```ts
interface User {
  id: string;
  name: string;
  password: string;
}

type PublicUser = Omit<User, 'password'>;
type UserPatch = Partial<Omit<User, 'id'>>;

async function fetchUser() {
  return { id: '1', name: 'a' };
}
type Fetched = Awaited<ReturnType<typeof fetchUser>>; // { id: string; name: string }
```

`Omit` 的第二个参数不会检查键是否真的存在于 `T` 上，拼错了也不报错，这点和 `Pick` 不同。

## 映射类型与条件类型

工具类型本身就是用映射类型和条件类型写出来的，理解这两个就能自己写类型变换。

### 映射类型

语法 `{ [K in Keys]: ... }`，遍历一组键生成新对象类型。`Partial` 的实现就是：

```ts
type MyPartial<T> = {
  [K in keyof T]?: T[K];
};
```

可以用 `+` / `-` 增减 `?` 和 `readonly` 修饰符，`Required` 就是 `-?`：

```ts
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
```

用 `as` 子句可以重映射键名：

```ts
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type G = Getters<{ name: string }>; // { getName: () => string }
```

这里用到了模板字面量类型和内置的 `Capitalize`。

### 条件类型

语法 `T extends U ? X : Y`，像类型层面的三元表达式：

```ts
type IsString<T> = T extends string ? true : false;

type A = IsString<'a'>;  // true
type B = IsString<1>;    // false
```

当 `T` 是裸类型参数、传入的是联合类型时，条件类型会**分发**：对联合的每个成员分别计算再合并结果。`Exclude` 正是利用了这一点：

```ts
type MyExclude<U, E> = U extends E ? never : U;
type R = MyExclude<'a' | 'b' | 'c', 'a'>; // 'b' | 'c'
```

不想分发时，把两边用方括号包起来：`[T] extends [U] ? X : Y`。

### infer

在条件类型的 `extends` 子句里用 `infer` 声明一个待推断的类型变量，匹配成功后就能在真值分支使用它：

```ts
type ElementOf<T> = T extends (infer E)[] ? E : never;
type E1 = ElementOf<string[]>; // string

type MyReturnType<F> = F extends (...args: any[]) => infer R ? R : never;
type R1 = MyReturnType<() => number>; // number

type UnwrapPromise<T> = T extends Promise<infer V> ? V : T;
type V1 = UnwrapPromise<Promise<string>>; // string
```

类型编程能力很强，但可读性下降得也快。业务代码里优先用内置工具类型组合，复杂类型留给库作者。

## 类型断言与 satisfies

**类型断言** `value as T` 告诉编译器"我比你更清楚它的类型"。它不做任何运行时转换，也不做校验：

```ts
const el = document.getElementById('app') as HTMLDivElement;
```

断言只允许在两个类型"有重叠"时使用，`'a' as number` 会报错；强行 `x as unknown as T` 可以绕过，但这基本等于放弃类型检查。另一种常见断言是非空断言 `el!`，表示"这里一定不是 null/undefined"，同样没有运行时保障。

**`satisfies`** 解决的是另一类问题：既想检查值符合某个类型，又不想丢掉推断出的更精确的类型。

```ts
type Theme = Record<string, string | [number, number, number]>;

// 用类型注解：检查通过，但 primary 的类型被拓宽成 string | [...]
const t1: Theme = { primary: '#000', accent: [0, 0, 0] };
// t1.primary.toUpperCase(); // 报错：可能是元组

// 用 satisfies：检查通过，且保留了每个属性的具体类型
const t2 = { primary: '#000', accent: [0, 0, 0] } satisfies Theme;
t2.primary.toUpperCase();    // OK，类型是 string
```

三者的区别可以这样记：

| 写法 | 是否检查 | 最终类型 |
| --- | --- | --- |
| `const x: T = v` | 检查 v 是否可赋给 T | T |
| `const x = v as T` | 只检查是否有重叠 | T |
| `const x = v satisfies T` | 检查 v 是否可赋给 T | v 的推断类型 |

## tsconfig 关键选项

`tsconfig.json` 决定编译器怎么检查和输出。用 `npx tsc --init` 可以生成一份带注释的模板。最需要关注的选项：

| 选项 | 作用 |
| --- | --- |
| `strict` | 一次打开一组严格检查，包括 `noImplicitAny`、`strictNullChecks`、`strictFunctionTypes`、`strictBindCallApply`、`strictPropertyInitialization`、`noImplicitThis`、`useUnknownInCatchVariables`、`alwaysStrict` 等。新项目应当开启。 |
| `noUncheckedIndexedAccess` | 不在 `strict` 里。开启后 `arr[i]`、`obj[key]` 的类型会带上 `undefined`，能防住越界访问。 |
| `target` | 输出的 JS 语法版本，决定哪些语法需要降级。 |
| `lib` | 可用的内置 API 类型，如 `DOM`、`ES2022`。不写时根据 `target` 推导。 |
| `module` / `moduleResolution` | 模块格式和模块解析规则。Node.js 项目用 `NodeNext`；交给 Vite、webpack 等打包器处理的项目用 `moduleResolution: "Bundler"`。 |
| `esModuleInterop` | 改善 CommonJS 模块的默认导入互操作。 |
| `isolatedModules` / `verbatimModuleSyntax` | 保证每个文件能被单独转译。用 esbuild、SWC、Babel 等单文件转译工具时应开启。 |
| `skipLibCheck` | 跳过 `.d.ts` 文件的检查，能明显加快编译，常规开启。 |
| `noEmit` | 只做类型检查不输出文件。打包器负责转译时常用。 |
| `outDir` / `rootDir` / `declaration` | 输出目录、源码根目录、是否生成 `.d.ts`。写库时需要。 |
| `paths` | 路径别名。注意它只影响类型检查，运行时或打包器需要同步配置。 |

:::caution
`strict` 包含的检查项会随 TS 版本增加，升级 TS 后可能出现新的类型错误，这是预期行为。
:::

## 类型声明放在哪里

业务项目里类型的组织方式没有标准答案，常见做法：

- **就近放置**：类型和使用它的代码放在同一文件或同一模块目录，需要复用时导出。改代码时类型就在旁边，最容易维护。
- **按领域集中**：一组模块共享的类型（如接口响应结构）放在该领域的 `types.ts` 里，用 `import type` 引用。
- **全局声明文件**：`.d.ts` 里用 `declare global` 或不带 import/export 的声明，适合给环境变量、全局对象、无类型的第三方模块补类型（如 `declare module '*.svg'`）。不宜把业务类型都塞进全局，会造成命名冲突且难以追踪来源。

接口类型可以从 OpenAPI 等接口描述文件自动生成，避免手写和后端不一致。

至于 `any`：严格模式下 `noImplicitAny` 会拦住隐式 `any`，显式 `any` 可以用 lint 规则（如 typescript-eslint 的 `no-explicit-any`）限制。确实不知道类型时用 `unknown`。

## 在 Node.js 项目中使用 TypeScript

先安装依赖并生成配置：

```bash
npm init -y
npm i -D typescript @types/node
npx tsc --init
```

`@types/node` 提供 Node.js 内置模块（`fs`、`path` 等）的类型。TypeScript 装成项目的开发依赖，不要依赖全局安装，保证团队成员和 CI 用的是同一个版本。

运行 TS 代码有几种方式：

| 方式 | 说明 |
| --- | --- |
| `tsc` 编译后运行 | `npx tsc` 输出 JS 到 `outDir`，再 `node dist/index.js`。生产部署最稳妥的方式。 |
| `tsx` | 基于 esbuild，只转译不检查类型，启动快，`npx tsx src/index.ts` 直接运行，支持 watch。 |
| `ts-node` | 较早的方案，默认会做类型检查，因此较慢；可配置为只转译。 |
| Node.js 内置类型擦除 | 较新版本的 Node.js 可以直接 `node index.ts`，原理是把类型注解删掉后执行，不做类型检查。 |

Node.js 内置的类型擦除只支持"删掉类型后就是合法 JS"的语法，`enum`、带运行时代码的 `namespace`、构造函数参数属性（`constructor(private x: number)`）这类需要代码转换的语法默认不支持。导入时要写真实的 `.ts` 扩展名，纯类型的导入要用 `import type`。TS 提供了 `erasableSyntaxOnly` 选项，开启后会在编译期拦住这些不可擦除的语法。

无论用哪种方式运行，类型检查都要单独做，通常在 CI 或提交前执行：

```bash
npx tsc --noEmit
```

一份适用于 ESM Node.js 项目的最小配置：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

配合 `package.json` 里的 `"type": "module"`。在 `NodeNext` 模式下用 `tsc` 编译时，相对导入要写编译后的扩展名 `.js`（如 `import { a } from './a.js'`），这是 Node.js ESM 解析规则的要求，TS 会正确映射到对应的 `.ts` 文件。

## 小结

- 外部输入用 `unknown` 接住并收窄，不用 `any`；`never` 可以配合判别联合做穷尽检查。
- 联合类型使用前要收窄：`typeof`、`in`、`instanceof`、判别字段、类型谓词。
- `interface` 支持声明合并，`type` 能表达联合、映射、条件等任意类型；对象形状两者都可以。
- 泛型配合 `extends` 约束和 `keyof` 使用；内置工具类型基于映射类型和条件类型实现，`infer` 用来从结构中提取类型。
- `as` 只是告诉编译器结论，不做校验；`satisfies` 做检查同时保留精确类型。
- 新项目开启 `strict`；Node.js 项目用 `NodeNext`，运行方式可选 `tsc` 编译、`tsx` 或内置类型擦除，类型检查用 `tsc --noEmit` 单独执行。

## 参考

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript：Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript：Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
- [TypeScript：Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)
- [TypeScript：TSConfig Reference](https://www.typescriptlang.org/tsconfig)
- [Node.js：Running TypeScript Natively](https://nodejs.org/en/learn/typescript/run-natively)
