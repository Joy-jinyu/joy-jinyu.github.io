# 程序执行

## 基础概念

---

### 代码

计算机仅可直接执行[机器语言](https://zh.wikipedia.org/wiki/机器语言)（[指令集](https://zh.wikipedia.org/wiki/指令集架構)的一部分）

#### [指令集架构](https://zh.wikipedia.org/wiki/%E6%8C%87%E4%BB%A4%E9%9B%86%E6%9E%B6%E6%A7%8B)

---

### 翻译器

#### [编译器](https://zh.wikipedia.org/wiki/%E7%B7%A8%E8%AD%AF%E5%99%A8)

##### 主要工作流程

[源代码](https://zh.wikipedia.org/wiki/源代码)（source code）→ [预处理器](https://zh.wikipedia.org/wiki/预处理器)（preprocessor）→ [编译器](https://zh.wikipedia.org/wiki/编译器)（compiler）→ [汇编程序](https://zh.wikipedia.org/wiki/汇编程序)（assembler）→ [目标代码](https://zh.wikipedia.org/wiki/目标代码)（object code）→ [链接器](https://zh.wikipedia.org/wiki/链接器)（linker）→ [可执行文件](https://zh.wikipedia.org/wiki/執行檔)（executables），最后打包好的文件就可以给电脑去判读运行了。

##### 分类

+ 交叉编译器
+ 本地编译器

#### 优化编译器

---

### 中间语言 

#### 目的

用来帮助我们分析计算机程序。这个术语源自于[编译器](https://zh.wikipedia.org/wiki/編譯器)，在编译器将[源代码](https://zh.wikipedia.org/wiki/原始碼)编译为[目的码](https://zh.wikipedia.org/wiki/目的碼)的过程中，会先将源代码转换为一个或多个的中间表述，以方便编译器进行最佳化，并产生出目的机器的[机器语言](https://zh.wikipedia.org/wiki/机器语言)。中间语言设计一般与机器语言有三个不同之处：

- 每个指令代表仅有一个基本的操作。举例来说，在[微处理器](https://zh.wikipedia.org/wiki/微处理器)中出现的*shift-add*定址模式在中间语言不会出现。
- 指令集内可能不会包含[控制流程](https://zh.wikipedia.org/wiki/控制流程)的资讯。
- 暂存器可用的数量可能会很大，甚至没有限制。

最常见的中间语言表述形式，是[三位址码](https://zh.wikipedia.org/wiki/三位址碼)（Three address code）- C语言就是输出这种表述形式

#### 中介码

中介码（IR，intermediate representation）是一种[数据结构](https://zh.wikipedia.org/wiki/数据结构)。可在建立实际运行的CPU指令列表之前进行重组，产生许多不同架构系统的机器码。

---

### 程序执行

#### 运行时系统

**运行环境**（Runtime environment）又称“**运行时系统**”（run-time system），指一种半编译的运行码在目标机器上运行时的环境（是一种介乎[编译器](https://zh.wikipedia.org/wiki/编译器)及[直译器](https://zh.wikipedia.org/wiki/直译器) - 解释器 的运行方式。[Java](https://zh.wikipedia.org/wiki/Java)运行环境，称之为“Java Runtime Environment”（JRE））

##### 运行时

与运行时期相对的其他时期包括：[设计时期](https://zh.wikipedia.org/w/index.php?title=設计時期&action=edit&redlink=1)（design time）、[编译时期](https://zh.wikipedia.org/wiki/編譯時期)（compile time）、[链接时期](https://zh.wikipedia.org/wiki/链接期)（link time）、与[加载时期](https://zh.wikipedia.org/w/index.php?title=載入時期&action=edit&redlink=1)（load time）

#### 可执行文件

指一种内容可被电脑解释为[程序](https://zh.wikipedia.org/wiki/计算机程序)的[电脑文件](https://zh.wikipedia.org/wiki/電腦檔案)。通常可执行文件内，含有以[二进制](https://zh.wikipedia.org/wiki/二進制)编码的[微处理器](https://zh.wikipedia.org/wiki/微處理器)指令，也因此可执行文件有时称为二进制档。

##### 脚本

以[脚本语言](https://zh.wikipedia.org/wiki/腳本語言)撰写的[脚本文件](https://zh.wikipedia.org/w/index.php?title=腳本檔案&action=edit&redlink=1)，都可以是可执行文件，而且内含的资料可被人类阅读，多数以ASCII文本存档。原因是：脚本语言无需经过编译器预先[编译](https://zh.wikipedia.org/wiki/编译)，就可经过[解释器](https://zh.wikipedia.org/wiki/直譯器)（如[Perl](https://zh.wikipedia.org/wiki/Perl)、[Python](https://zh.wikipedia.org/wiki/Python)、[Shell](https://zh.wikipedia.org/wiki/Shell)）运行。

#### 解释器

解释器边解释边执行，因此依赖于解释器的程序运行速度比较缓慢。解释器的好处是它不需要重新编译整个程序，从而减轻了每次程序更新后编译的负担。相对的[编译器](https://zh.wikipedia.org/wiki/编译器)一次性将所有[源代码](https://zh.wikipedia.org/wiki/源代码)编译成二进制文件，执行时无需依赖编译器或其他额外的程序。

解释器执行程序的方法有：

1. 直接执行高级编程语言（如Shell内建的编译器）
2. 转换高级编程语言到更有效率的字节码（Bytecode），并执行字节码
3. 用解释器包含的编译器对高级语言进行编译，并指示[中央处理器](https://zh.wikipedia.org/wiki/中央处理器)执行编译后的程序（例如：[JIT](https://zh.wikipedia.org/wiki/JIT)）

#### 虚拟机

---

---

## 代码类型

---

### 源代码

源代码的最终目的是生成可以执行的[二进制](https://zh.wikipedia.org/wiki/二进制)指令，这种过程叫做编译，通过[编译器](https://zh.wikipedia.org/wiki/编译器)完成

#### 作用

+ 生成[目标代码](https://zh.wikipedia.org/wiki/目标代码)，即计算机可以识别的代码。
+ 对软件进行说明，即对软件的编写进行说明。

#### 代码组合

##### 软件移植

#### 著作权

#### 质量

+ 正确的代码
+ 可维护性
+ 好的程序风格
+ 可读性

#### 效率

+ 越高级的语言，其执行效率越低
+ 低级语言虽可提高运行效率，却会大大降低程序的开发效率

---

### 目标代码

指[计算机科学](https://zh.wikipedia.org/wiki/计算机科学)中[编译器](https://zh.wikipedia.org/wiki/编译器)或[汇编器](https://zh.wikipedia.org/wiki/汇编器)处理[源代码](https://zh.wikipedia.org/wiki/源代码)后所生成的代码，它一般由[机器代码](https://zh.wikipedia.org/wiki/机器代码)或接近于机器语言的代码组成。

#### 目标文件格式

---

### 字节码

指的是已经经过[编译](https://zh.wikipedia.org/wiki/编译)，但与特定[机器代码](https://zh.wikipedia.org/wiki/機器碼)无关，需要[解释器](https://zh.wikipedia.org/wiki/直譯器)转译后才能成为[机器代码](https://zh.wikipedia.org/wiki/機器碼)的[中间代码](https://zh.wikipedia.org/wiki/中間語言)（如：[Java bytecode](https://zh.wikipedia.org/wiki/Java_bytecode)）

---

### 机器代码

**机器语言**（machine language）是一种[指令集](https://zh.wikipedia.org/wiki/指令集)的体系。这种指令集称为**机器代码**（machine code）（**原生码**（Native Code）），是计算机的[CPU](https://zh.wikipedia.org/wiki/CPU)可直接解读的资料。

---

### 微程序

**微指令**（英语：microcode），又称**微码**，是在[CISC](https://zh.wikipedia.org/wiki/CISC)结构下，运行一些功能复杂的[指令](https://zh.wikipedia.org/wiki/指令)时，所分解一系列相对简单的指令

现代的微指令通常由[CPU](https://zh.wikipedia.org/wiki/CPU)工程师在设计阶段编写

---

---

## 编译策略

---

### 即时编译

两种传统的机器代码翻译方法——[提前编译](https://zh.wikipedia.org/w/index.php?title=提前编译&action=edit&redlink=1)（AOT）和[解释](https://zh.wikipedia.org/wiki/直譯器)——的结合

### 提前编译

### 源代码至源代码编译器

以某种[编程语言](https://zh.wikipedia.org/wiki/编程语言)的程序[源代码](https://zh.wikipedia.org/wiki/源代码)作为输入，生成以另一种编程语言构成的等效源代码的[编译器](https://zh.wikipedia.org/wiki/编译器) （如Typescript）

### 动态重编译

在执行期间，系统会[重新编译](https://zh.wikipedia.org/w/index.php?title=重新编译&action=edit&redlink=1)程序的一些部分，调整生成的代码，使其表现程序的运行时环境，并有可能利用那些传统静态[编译器](https://zh.wikipedia.org/wiki/编译器)不能获得的信息，生成更高效的代码。

---

---

## 知名运行环境

### [Android Runtime](https://zh.wikipedia.org/wiki/Android_Runtime)（ART）

### [通用语言运行库](https://zh.wikipedia.org/wiki/通用語言運行庫)（CLR）

### [crt0](https://zh.wikipedia.org/wiki/Crt0)

### [Java虚拟机](https://zh.wikipedia.org/wiki/Java虚拟机)（JVM）

### V8

[Node.js](https://zh.wikipedia.org/wiki/Node.js)

### [PyPy](https://zh.wikipedia.org/wiki/PyPy)

### [Zend引擎](https://zh.wikipedia.org/wiki/Zend引擎)

---

---

## 著名编译器及工具链

### [GNU编译器套装](https://zh.wikipedia.org/wiki/GNU_Compiler_Collection)（GCC）

### LLVM

#### [Clang](https://zh.wikipedia.org/wiki/Clang)