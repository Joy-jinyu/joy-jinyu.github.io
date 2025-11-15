### 概念

PostCSS 接收一个 CSS 文件并提供了一个 API 来分析、修改它的规则（通过把 CSS 规则转换成一个[抽象语法树](https://zh.wikipedia.org/wiki/抽象語法樹)的方式）。在这之后，这个 API 便可被许多[插件](https://github.com/postcss/postcss/blob/main/README-cn.md#插件)利用来做有用的事情

>+ 具体语法树（分析树 - Parse Tree）
>+ 抽象语法树（AST - Abstract Async Tree）
>
>[语法分析器](https://zh.wikipedia.org/wiki/語法分析器)创建出分析树，然后从分析树生成AST。一旦AST被创建出来，在后续的处理过程中，比如[语义分析](https://zh.wikipedia.org/wiki/语义分析)阶段，会添加一些信息
>
>**一个现代编译器的主要工作流程：**
>
>[源代码](https://zh.wikipedia.org/wiki/源代码)（source code）→ [预处理器](https://zh.wikipedia.org/wiki/预处理器)（preprocessor）→ [编译器](https://zh.wikipedia.org/wiki/编译器)（compiler）→ [汇编程序](https://zh.wikipedia.org/wiki/汇编程序)（assembler）→ [目标代码](https://zh.wikipedia.org/wiki/目标代码)（object code）→ [链接器](https://zh.wikipedia.org/wiki/链接器)（linker）→ [可执行文件](https://zh.wikipedia.org/wiki/執行檔)（executables）