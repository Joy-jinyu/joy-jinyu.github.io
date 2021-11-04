## 表面层次的改进   -  23

---

---

### 把信息装进名字  -  25

---

#### 选择专业的词

如Stop、Kill、Pause、Resume

#### 避免泛泛的名字

如temp、`retval`、迭代器（i）这样的命名。除非能找到合适的理由（没有实际含义价值）

#### 用具体的名字代替抽象的名字

+ 增加合适的形容词
+ 给名字增加单位
  如时间单位或者长度单位等等

#### 使用前缀或者后缀给名字附带信息

+ 增加合适的形容词
+ 增加名称的分类
  如`html_utf8`

#### 决定名字的长度

+ 在小作用域使用缩写的名字
+ 在大的作用域（全局作用域）使用全称名字
+ 可以输入长名字
+ 首字母缩略词和缩写要易理解
+ 丢掉没用的词

#### 利用名字的格式来表达含义

+ 上限和下限 - `Min` 和 `Max`
+ 包含的范围 - `First` 和 `Last`
+ 包含/排除范围 - `Begin` 和 `End`
+ 布尔值类型 - `Is` 和 `Has`
+ 小心用户对特定词的期望 - 用户会期望`get()`或者`size()`是轻量的方法

----

### 审美   -  52

---

#### 三个原则

+ 使用一致的风格
+ 让相似的代码看上去很相似
+ 把相关代码进行分组，行程代码块

#### 具体细节

+ 重新安排换行来保持一致和紧凑
+ 用方法整理不规则的东西
+ 在需要时使用列排序
+ 选一个有意义的顺序，始终一致地使用它
+ 把声明按块组织起来
+ 把代码分段落
+ 一致的风格比**正确**的风格更重要

---

### 该写什么样的注释  -  61

---

#### 了解什么不需要注释

+ 不要为了注释而注释
+ 不要给不好的的名字加注释 - 应该把名字改好

#### 用代码记录你的思想

+ 记录你的思想
+ 加入“导演评论”
+ 为代码中的瑕疵写注释
+ 给常量加注释

#### 站在读者的角度，去想象他们需要知道什么

+ 意料之中的提问
+ 公布可能的陷阱
+ “全局观”注释
+ 总结性注释
  做什么、怎么做、为什么

---

### 写出言简意赅的注释  -  74

---

#### 让注释保持紧凑

#### 避免使用不明确的代词

#### 润色粗糙的句子

#### 精确的描述函数的行为

#### 用输入/输出例子来说明特别的情况

#### 声明代码的意图

#### “具名函数参数”的注释 

#### 用含义丰富的词来使注释简洁

---

---

## 简化循环和逻辑  - 81

---

### 把控制流变得易读  -  83

---

#### 条件语句中参数的顺序

+ 比较的左侧  -  “被询问的”表达式，倾向于变化的值
+ 比较的右侧  -  用来做比较的表达式，倾向于常量

#### If/Else 语句块的顺序

+ 首先处理正逻辑而不是负逻辑的情况
+ 先处理掉简单的情况
+ 先处理可疑（特殊）的情况

#### 三目运算符

默认使用If/Else，最简单的情况再使用三目运算符

#### 避免Do/While循环

#### 从函数中提前返回

#### 最小化嵌套

#### 嵌套是如何积累而成的

#### 通过提前返回来减少嵌套

#### 让代码流程简单

---

### 拆分超长的表达式   -   82

---

#### 引入 额外的解释变量

#### 引入 总结变量

#### 使用 德摩根定理

#### 避免 滥用短路逻辑

#### 尽可能 拆分复杂代码

---

### 变量与可读性  -  105

---

#### 三个问题

+ 变量越多，就越难全部跟踪它们的动向
+ 变量的作用域越大，就需要跟踪它的动向越久
+ 变量改得越频繁，就越难以跟踪它的当前值

#### 减少变量

+ 没有价值的临时变量

+ 减少中间结果

+ 减少控制流变量

  > 一个好的面试问题需要引入三个变量 - 微软的 Eric Brechner

#### 把定义下移

#### 缩小变量的作用域

#### 只写一次的变量更好

---

---

## 重新组织代码  -  119

---

### 三种组织代码的方法

+ 抽取那些与程序主要目的 "不相关的子问题"
+ 重新组织代码使它一次只做一件事情
+ 先用自然语言描述代码，然后用它找到更简洁的解决方案
+ 把代码完全移除或者一开始就避免写它的那些情况

---

### 抽取不想关的子问题  -  121

---

#### 纯工具代码

#### 其它多用途代码

改进之后可以处理其它更多的业务场景 - 意外之喜

#### 创建大量通用代码

> 自顶向下编程和自底向上编程

---

### 一次只做一件事 - 132

---

#### 细化任务

---

### 把想法变成代码 - 141

> 如果你不能把一件事情解释给你祖母听，证明你还没有真正理解它 - 阿尔伯特.爱因斯坦

---

### 少写代码 - 149

---

#### 质疑和拆分你的需求

#### 保持小的代码库

+ 通过“工具”代码来减少重复代码 - 第十章
+ 减少无用代码或没用的功能
+ 项目保持分开的子项目状态

### 熟悉周边的库

只为了保持熟悉度

---

---

## 精选话题 - 157

---

### 测试与可读性 - 159

---

### 设计并改进  “分钟/小时计数器” -174

---

---

## 深入阅读 - 189

---

---