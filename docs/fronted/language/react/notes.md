

## 随记

### 核心概念

#### 声明周期

#### 表单

#### Children

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

### Hooks

#### 只在最顶层使用Hook

不要再循环、条件或嵌套函数中调用Hook

#### 只在React函数中调用Hook

不要在普通的JavaScript函数中调用Hook

---

---