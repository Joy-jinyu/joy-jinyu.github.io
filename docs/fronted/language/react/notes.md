

## 随记

### 核心概念

#### 声明周期

#### 表单

#### Children

#### React哲学

+ 将设计好的UI划分成组件层级
+ 用react创建一个静态版本
+ 确定UI State的最小且完整的表示
+ 确定state放置的位置
+ 添加反向数据流

---

### 高级指引

#### 无障碍

+ for 应该写为 htmlFor

#### 代码分割

+ [webpack优化](https://webpack.docschina.org/guides/code-splitting/)

+ import()

+ React.lazy

  应在 `Suspense` 组件中渲染 lazy 组件

  >`React.lazy` 和 Suspense 技术还不支持服务端渲染。如果你想要在使用服务端渲染的应用中使用，推荐 [Loadable Components](https://github.com/gregberge/loadable-components) 这个库。它有一个很棒的[服务端渲染打包指南](https://loadable-components.com/docs/server-side-rendering/)。

+ 异常捕获边界

+ 基于路由的代码分割

#### Context

#### Fragment

---

### Api

#### React

##### 组件

##### 创建React元素

##### 转换元素

##### Fragments

##### Refs

##### Suspense

##### Hooks

#### ReactDom

##### 概览

+ render
+ hydrate
+ unmounteComponentAtNode
+ findDomNode
+ createPortal

#### ReactDOMServer

#### DOM元素

##### 属性差异

+ checked
+ className
+ dangerouslySetInnerHTML
+ htmlFor
+ onChange
+ Selected
+ Style
+ value

#### [合成事件](https://zh-hans.reactjs.org/docs/events.html)

如需注册捕获阶段的事件处理函数，则应为事件名添加 `Capture`。例如，处理捕获阶段的点击事件请使用 `onClickCapture`，而不是 `onClick`。

+ onScrollCapture

---

### Hooks

#### 只在最顶层使用Hook

不要再循环、条件或嵌套函数中调用Hook

#### 只在React函数中调用Hook

不要在普通的JavaScript函数中调用Hook

---

---