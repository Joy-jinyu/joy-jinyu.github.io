## `Css `-- Cascading Style Sheet

### [样式的继承](https://www.cnblogs.com/nyw1983/p/12404955.html)

为一个元素设置的样式，同时也会应用到它的后代元素上去

继承是发生在祖先元素和后代元素上面

> 并不是所有的样式都会被继承，常见的有背景、布局相关的样式一般都不 会被继承。（例如 transparent、background、position相关内容）

### [Cascading](https://blog.csdn.net/Jasper917/article/details/105421710) 

浏览器用来解决冲突的一套规则

#### 解决冲突的流程

```flow
start=>start: 发生冲突
originCond=>condition: 是否来自同一样式源
originNoOpt=>operation: 选择优先级高的样式源
pointCond=>condition: 是否来自同一指定级
pointNoOpt=>operation: 选择优先级高的指定级
end=>end: 按照顺序选择顺序靠后的代码块
start->originCond
originCond(yes)->pointCond
originCond(no)->originNoOpt->pointCond
pointCond(yes)->end
pointCond(no)->pointNoOpt->end
```

#### 样式源

优先级从低到高

+ 默认源（浏览器自带的）
+ 开发源（开发者自己写的样式）
+ `!important`（基于开发者写的 只不过加了！important）

#### 指定级

##### 选择器指定级

###### 基础选择器

优先级从低到高

+ 通用选择器
+ 标签选择器
+ class选择器
+ id选择器

###### 组合选择器

组合选择器类型

+ 后代选择器
+ 并集选择器 
+ 交集选择器
+ 相邻兄弟选择器
+ 伪类选择器（ 伪类选择器(::hover)和属性选择器([type = “input”])和class选择器优先级同等）

胜出规则按 匹配 **基础选择器** 的优先级和多少来论，如

+ 匹配更多ID选择器的胜出
+ 匹配同样多的ID选择器，class选择器多的胜出
+ 依次类比~

##### 行内样式指定级

行内指定级优于选择器指定级

#### 顺序

 写在后面的代码会覆盖前面的代码