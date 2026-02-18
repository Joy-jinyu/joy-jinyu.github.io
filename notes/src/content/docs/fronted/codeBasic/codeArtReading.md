---
title: 《编写可读代码的艺术》读书笔记
description: 按原书结构整理表面层次的改进、简化循环与逻辑、重新组织代码三部分的核心观点，每条配一个前后对比的小例子。
---

《编写可读代码的艺术》（The Art of Readable Code，Dustin Boswell、Trevor Foucher 著）围绕一个核心标准展开：**代码应当让别人用最短的时间理解它**。这里的"别人"也包括几个月后的自己。这篇按书的三大部分整理要点，示例改写成 JavaScript，读完可以拿来对照检查自己的代码。

书里给出的衡量标准是"理解时间"：不是代码行数越少越好，而是读者读懂、能放心修改它所需的时间越短越好。下面各条建议都服务于这个目标。

## 第一部分：表面层次的改进

表面层次指命名、排版、注释。改动成本低，收益却很直接。

### 把信息装进名字

**选择专业、具体的词。** `get` 太泛，看不出是读缓存还是发请求；`size` 可能是元素个数，也可能是字节数。

| 泛泛的词 | 更具体的选择 |
| --- | --- |
| `get` | `fetch`（远程获取）、`load`、`compute`、`find` |
| `size` | `count`、`length`、`byteSize` |
| `stop` | `kill`（不可恢复）、`pause`（可恢复） |
| `send` | `deliver`、`dispatch`、`broadcast` |

**避免 `tmp`、`retval`、`data` 这类空泛的名字**，除非变量确实只是临时存一下、作用域只有几行。循环变量 `i`、`j` 在嵌套循环里容易混淆，可以改成带含义的名字：

```js
// 前：members[k] 和 users[j] 的下标用反了，但很难看出来
for (let i = 0; i < clubs.length; i++)
  for (let j = 0; j < clubs[i].members.length; j++)
    for (let k = 0; k < users.length; k++)
      if (clubs[i].members[k] === users[j]) { /* ... */ }

// 后：下标带上前缀，写成 members[ui] 这种错配会一眼被发现
for (let ci = 0; ci < clubs.length; ci++)
  for (let mi = 0; mi < clubs[ci].members.length; mi++)
    for (let ui = 0; ui < users.length; ui++)
      if (clubs[ci].members[mi] === users[ui]) { /* ... */ }
```

**给名字附加重要的额外信息**，最常见的是单位和状态：

```js
// 前
const start = Date.now();
setTimeout(retry, delay);

// 后
const startMs = Date.now();
setTimeout(retry, delayMs);
const unsafeHtml = input; // 尚未转义
const safeHtml = escapeHtml(unsafeHtml);
```

**名字长度跟作用域匹配**：只活几行的变量可以短，全局可见的名字要完整。缩写只用大家都懂的（`url`、`id`），项目自造的缩写新人看不懂。

**用约定俗成的词表达边界：**

| 含义 | 推荐用词 |
| --- | --- |
| 包含的上下限 | `min` / `max` |
| 包含两端的范围 | `first` / `last` |
| 包含开头、不包含结尾的范围 | `begin` / `end` |
| 布尔值 | `is`、`has`、`can`、`should` 开头，避免否定形式如 `disableSsl` |

还要注意读者对特定词的预期：大家默认 `getXxx()`、`size()` 是轻量操作，如果它内部要遍历整个列表或发请求，就应该改名为 `computeXxx()`、`countXxx()`，提醒调用者有成本。

### 不会误解的名字

命名时多问一句："这个名字会不会被理解成别的意思？"

```js
// filter 是"留下"还是"去掉"？有歧义
const result = filter(users, 'inactive');

// 明确表达
const activeUsers = excludeBy(users, 'inactive');
const inactiveUsers = selectBy(users, 'inactive');
```

### 审美：让代码排版有规律

书里的三条原则：

1. 使用一致的布局，让读者习惯之后能快速扫读。
2. 让相似的代码看上去也相似。
3. 把相关的代码分组，形成段落。

```js
// 前：对齐和顺序都随意
const user = { name: 'Tom', id: 1,
  email: 'tom@example.com' };
const admin = { id: 2, email: 'amy@example.com', name: 'Amy' };

// 后：字段顺序一致，结构一眼可比
const user  = { id: 1, name: 'Tom', email: 'tom@example.com' };
const admin = { id: 2, name: 'Amy', email: 'amy@example.com' };
```

其他建议：

- 选一个有意义的顺序并始终使用，比如表单字段的处理顺序与页面上的顺序一致。
- 声明按用途分块，块之间空一行，像文章分段。
- **一致的风格比"正确"的风格更重要**。现在这类问题大多可以交给 Prettier 这类格式化工具（上例手动对齐的等号会被 Prettier 去掉，这是可以接受的取舍）。工具配置见 [前端开发规范](/notes/fronted/codeBasic/developRule.html)。

### 该写什么样的注释

注释的目的是让读者知道代码作者知道、但从代码里看不出来的东西。

**不需要注释的：**

- 能从代码本身快速推断出的信息。
- 为了弥补糟糕命名而写的注释，应该直接改名。

```js
// 前：用注释解释名字
// 删除过期超过 n 天的记录
function clean(n) {}

// 后：名字自己说明
function deleteRecordsExpiredForDays(days) {}
```

**值得写注释的：**

- **你的思考过程（"导演评论"）**：为什么选这个方案，放弃了哪些方案。
- **代码的瑕疵**：用 `TODO`、`FIXME`、`HACK` 标出已知问题。
- **常量的来历**：`const MAX_THREADS = 8; // 超过 8 个后收益很小`。
- **读者可能踩的坑**：比如"这个函数会发邮件，测试时注意 mock"。
- **全局观注释**：文件或模块开头简单说明各部分如何配合。
- **总结性注释**：一大段代码前用一句话说明这段在做什么。

### 写出言简意赅的注释

- 避免"它""这个"等指代不清的代词。
- 精确描述函数行为，包括边界：

```js
// 前：含糊
// 返回文件的行数

// 后：精确
// 统计文件中换行符 '\n' 的个数
```

- 用输入输出的例子说明特殊情况：

```js
// 去掉 str 开头和结尾的 chars 中的字符
// 例：strip('abba/a/ba', 'ab') === '/a/'
function strip(str, chars) {}
```

- 写意图，而不是复述代码：`// 按价格从高到低展示` 比 `// 倒序遍历数组` 更有信息量。
- 对含义不明的参数，在调用处标出参数名，或干脆改为对象参数：

```js
connect(10, false);                          // 前：10 和 false 是什么？
connect({ timeoutMs: 10, useEncryption: false }); // 后
```

## 第二部分：简化循环和逻辑

这部分的目标是减少读者在脑子里同时追踪的东西：分支、嵌套、变量。

### 让控制流变得易读

**条件里变化的值放左边，常量放右边**，符合自然语言的说法：

```js
if (length >= 10) {}  // 读作"长度大于等于 10"
if (10 <= length) {}  // 不自然
```

**if/else 的顺序**：一般先处理肯定的情况、先处理简单的情况、先处理更值得注意的情况。三条有时冲突，需要权衡。

**三目运算符只用于简单的二选一**，嵌套的三目运算符不如 if/else 清楚：

```js
// 可以
const label = isVip ? '会员' : '普通用户';

// 不推荐
const fee = isVip ? (amount > 100 ? 0 : 5) : amount > 200 ? 5 : 10;
```

**避免 `do...while`**：循环条件写在后面，读者要读完循环体才知道何时结束。多数情况可以改写成 `while`。

**提前返回，减少嵌套：**

```js
// 前：层层嵌套
function submit(form) {
  if (form) {
    if (form.isValid()) {
      if (!form.isSubmitting) {
        send(form);
      }
    }
  }
}

// 后：卫语句提前返回
function submit(form) {
  if (!form) return;
  if (!form.isValid()) return;
  if (form.isSubmitting) return;
  send(form);
}
```

循环里同理，用 `continue` 跳过不需要处理的元素，避免整个循环体再缩进一层。嵌套往往是一次次修改累积出来的，修改代码时要留意：加了一个 `if` 之后，整体是否还清楚。

### 拆分超长的表达式

**引入解释变量**，给子表达式起名字：

```js
// 前
if (line.split(':')[0].trim() === 'root') {}

// 后
const username = line.split(':')[0].trim();
if (username === 'root') {}
```

**引入总结变量**，给反复出现的复杂条件起名字：

```js
// 前
if (request.userId === doc.ownerId) { /* 可编辑 */ }
if (request.userId !== doc.ownerId) { /* 只读提示 */ }

// 后
const userOwnsDocument = request.userId === doc.ownerId;
if (userOwnsDocument) {}
if (!userOwnsDocument) {}
```

**使用德摩根定律化简取反**：`!(a || b)` 等于 `!a && !b`，`!(a && b)` 等于 `!a || !b`。

```js
// 前
if (!(fileExists && !isProtected)) showError();

// 后
if (!fileExists || isProtected) showError();
```

**不要滥用短路逻辑**。把多个操作塞进一个 `&&` 链里看起来紧凑，读起来要停下来想：

```js
// 前
user && user.profile && (cache[user.id] = user.profile) && render();

// 后
if (user?.profile) {
  cache[user.id] = user.profile;
  render();
}
```

**换个角度看问题**：书中判断两个区间是否重叠的例子，正面写要考虑多种情况，反过来想"什么时候不重叠"就简单得多：

```js
// 区间为左闭右开 [begin, end)
function overlaps(a, b) {
  // a 完全在 b 左边，或完全在 b 右边，就不重叠
  if (a.end <= b.begin) return false;
  if (a.begin >= b.end) return false;
  return true;
}
```

### 变量与可读性

书中指出变量带来的三个问题：

1. 变量越多，越难同时记住它们的状态。
2. 作用域越大，需要追踪的范围越大。
3. 值变化越频繁，越难知道它当前是什么。

**去掉没有价值的临时变量：**

```js
// 前
const now = Date.now();
lastVisitTime = now;

// 后
lastVisitTime = Date.now();
```

**去掉控制流变量**，用 `break` 或提前返回代替 `done` 这类标记：

```js
// 前
let done = false;
for (const item of list) {
  if (done) break;
  if (item.isTarget) {
    handle(item);
    done = true;
  }
}

// 后
const target = list.find((item) => item.isTarget);
if (target) handle(target);
```

**缩小作用域，把定义移到使用的地方：**

```js
// 前：所有变量在函数开头声明，读者要一直记着
function report(orders) {
  let total = 0;
  let maxOrder = null;
  let text = '';
  // ...几十行之后才用到 text
}

// 后：用到时才声明
function report(orders) {
  const total = orders.reduce((sum, o) => sum + o.amount, 0);
  const maxOrder = orders.reduce((max, o) => (o.amount > max.amount ? o : max));
  const text = `合计 ${total}，最大单笔 ${maxOrder.amount}`;
  return text;
}
```

**只写一次的变量更好**：在 JS 里就是优先用 `const`。值不变的变量读者不需要追踪它的变化。

## 第三部分：重新组织代码

前两部分在语句层面做改进，第三部分讨论函数和模块的组织方式。书中给出四种方法：抽取不相关的子问题、一次只做一件事、把想法用自然语言说清楚再写代码、少写代码。

### 抽取不相关的子问题

看一个函数时，问自己：这段代码的高层目标是什么？每一行是在直接解决这个目标，还是在解决一个与之无关的子问题？如果是后者，就把它抽成独立函数。

```js
// 前：找最近的门店，计算球面距离的公式混在里面
function findClosestStore(user, stores) {
  let closest = null;
  let minDist = Infinity;
  for (const s of stores) {
    const dLat = ((s.lat - user.lat) * Math.PI) / 180;
    const dLng = ((s.lng - user.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((user.lat * Math.PI) / 180) *
        Math.cos((s.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const dist = 2 * 6371 * Math.asin(Math.sqrt(a));
    if (dist < minDist) {
      minDist = dist;
      closest = s;
    }
  }
  return closest;
}

// 后：距离计算是独立子问题，抽出去之后主函数只剩"找最小值"
function distanceKm(from, to) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

function findClosestStore(user, stores) {
  let closest = null;
  let minDist = Infinity;
  for (const store of stores) {
    const dist = distanceKm(user, store);
    if (dist < minDist) {
      minDist = dist;
      closest = store;
    }
  }
  return closest;
}
```

抽出来的通常是这几类代码：

- **纯工具代码**：字符串处理、日期格式化、深拷贝等，任何项目都可能需要。
- **通用但被埋在业务里的代码**：抽出来后常常发现别处也能复用。
- **对难用接口的包装**：比如把读写 cookie、`localStorage` 的细节封装成简单函数。

书里也提醒不要过度：抽出一堆一两行的小函数，读者反而要来回跳转。

### 一次只做一件事

一段代码同时做多件事时，先把它要做的事列出来，再分别实现：

```js
// 前：解析、校验、计算交织在一起
function checkout(input) {
  const items = JSON.parse(input);
  let total = 0;
  for (const item of items) {
    if (!item.price || item.price < 0) throw new Error('价格无效');
    total += item.price * (item.qty ?? 1);
  }
  if (total > 10000) total *= 0.9;
  return total;
}

// 后：每一段只做一件事
function checkout(input) {
  const items = JSON.parse(input);
  items.forEach(assertValidItem);
  const subtotal = sumItems(items);
  return applyDiscount(subtotal);
}

function assertValidItem(item) {
  if (!item.price || item.price < 0) throw new Error('价格无效');
}

function sumItems(items) {
  return items.reduce((sum, item) => sum + item.price * (item.qty ?? 1), 0);
}

function applyDiscount(amount) {
  return amount > 10000 ? amount * 0.9 : amount;
}
```

### 把想法变成代码

书中引用了一句话，大意是：如果你不能把一件事解释给你祖母听，说明你还没有真正理解它。写代码前，先用自然语言把逻辑讲清楚，再照着这段话写代码，往往能得到更简洁的结构。

比如"判断用户能否查看文档"，先写成大白话：

> 如果是管理员，可以查看；否则如果文档是公开的，可以查看；否则只有作者本人可以查看。

再翻译成代码：

```js
function canView(user, doc) {
  if (user.isAdmin) return true;
  if (doc.isPublic) return true;
  return doc.authorId === user.id;
}
```

这种方法在调试时同样有效：把问题讲给别人（或一只橡皮鸭）听，常常讲到一半就发现了问题。

### 少写代码

最易读的代码是不存在的代码。

- **质疑需求**：不是所有功能都值得实现。有些需求可以用更简单的版本满足，比如先做精确到天的统计，而不是精确到秒。
- **保持代码库小**：删除无用代码和没人用的功能；把通用逻辑放进工具函数，减少重复；让项目按子模块拆开，彼此独立。
- **熟悉周边的库**：很多需求标准库或现成依赖已经实现了。书中的建议是定期花点时间浏览标准库的 API，知道有什么可用。

```js
// 前：手写去重
const unique = [];
for (const x of list) {
  if (unique.indexOf(x) === -1) unique.push(x);
}

// 后：标准库已经提供
const unique = [...new Set(list)];
```

## 第四部分：精选话题

原书最后两章是两个综合案例，这里只记录要点：

- **测试与可读性**：测试代码同样要可读。把构造测试数据的重复代码抽成辅助函数，让每个测试一眼就能看出"输入是什么、期望是什么"；测试失败时的报错信息要能直接说明哪里不对；测试名要描述被测的情况。
- **设计并改进"分钟/小时计数器"**：用一个具体的数据结构问题，演示从直观但低效的实现，逐步改进到更清晰、更高效的设计，整个过程都在应用前面讲到的原则。

## 小结

- 可读性的标准是"读者理解所需的时间"，不是行数。
- 名字要具体、带单位和状态、不产生歧义；注释写代码表达不出来的东西。
- 用提前返回减少嵌套，用解释变量和总结变量拆分长表达式。
- 减少变量数量、缩小作用域、优先使用只赋值一次的变量。
- 抽取与主目标无关的子问题，一段代码一次只做一件事。
- 先用自然语言把逻辑说清楚再写代码；能复用标准库就不要自己写。

## 参考

- [MDN：JavaScript 指南](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide)
