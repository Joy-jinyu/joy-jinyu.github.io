---
title: React 协调与 Fiber
description: 从虚拟 DOM 和 diff 的启发式规则讲起，说明栈协调的问题、Fiber 架构的动机与结构、render 与 commit 两个阶段，以及优先级调度和并发特性。
---

React 每次更新都要回答一个问题：新的 UI 描述和旧的相比改了什么、该怎么最省事地改到 DOM 上。这篇先讲虚拟 DOM 和 diff 的三条启发式规则，再说明早期"栈协调"为什么会卡顿，进而引出 Fiber 架构：可中断的渲染、双缓冲树、render 与 commit 两个阶段、优先级调度，以及 `startTransition` 等并发特性。重点在于理解设计思路，React 内部实现会随版本调整，具体函数名不作展开。

## 虚拟 DOM

组件返回的 JSX 会变成 React 元素，也就是一棵普通 JS 对象组成的树，描述"界面应该长什么样"。这棵树常被称为虚拟 DOM。

引入这层描述的意义主要有两点：

- **声明式编程**：开发者只描述某个状态下 UI 的样子，不用手写"从旧界面变到新界面"的 DOM 操作。由 React 负责比对和更新。
- **与平台解耦**：同一套描述可以渲染到浏览器 DOM（react-dom）、原生组件（React Native）或其他目标。

需要澄清一个常见说法："虚拟 DOM 比直接操作 DOM 快"。这并不准确。手写精确的 DOM 操作一定比"先生成虚拟树、再 diff、再更新"少做工作。虚拟 DOM 的价值是在保持声明式写法的前提下，让更新性能"足够好"，并且不需要开发者自己追踪改动。

## 协调与 diff

协调（reconciliation）是 React 比较新旧两棵树、找出差异的过程。

完整比较两棵任意树并求出最少的编辑操作，已知算法的复杂度是 O(n³)。对一个上千节点的界面来说完全不可接受。React 基于两个假设，把复杂度降到 O(n)：

1. 类型不同的两个元素会产生完全不同的树；
2. 开发者可以用 `key` 告诉 React 哪些子元素在多次渲染中是稳定的。

由此得到三条规则。

### 规则一：只做同层比较

React 只比较同一层级、同一位置的节点，不会跨层级寻找可复用的节点。如果一个节点从 A 的子级移动到了 B 的子级，React 不会识别为"移动"，而是在原位置删除、在新位置重新创建。

实际界面中跨层级移动节点很少见，这个假设几乎不损失什么，却省去了大量的比较。

### 规则二：类型不同直接替换

同一位置上，如果元素类型变了（`<div>` 变成 `<span>`，或组件 `A` 变成组件 `B`），React 不会继续比较它们的子树，而是直接卸载旧的整棵子树（包括其中所有组件的 state），挂载新的子树。

类型相同时：

- DOM 元素：保留同一个 DOM 节点，只更新变化的属性，再递归处理子节点。
- 组件：保留组件实例和它的 state，用新的 props 重新渲染。

这条规则带来一个容易忽略的后果：**不要在组件内部定义组件**。

```tsx
function Parent() {
  // 每次 Parent 渲染都会创建一个新的 Child 函数
  function Child() {
    const [text, setText] = useState('');
    return <input value={text} onChange={(e) => setText(e.target.value)} />;
  }
  return <Child />;
}
```

每次渲染 `Child` 都是一个新函数，类型不同，React 会把它卸载再重建，输入框的内容每次都会丢失。应把组件定义放到顶层。

### 规则三：用 key 匹配列表中的子元素

对于一组子元素，如果没有 key，React 只能按位置一一对比。在列表头部插入一项时，每个位置的内容都"变了"，所有项都要更新，而且各项的 state 会错位。

有了 key，React 可以知道新列表中的某一项对应旧列表中的哪一项，于是能复用节点、只做移动、插入和删除。具体做法上，React 会先按顺序比对新旧子元素，遇到对不上的情况，再把剩余的旧子元素按 key 建立映射，供新子元素查找复用。这也是 key 只需在兄弟节点之间唯一的原因。

key 的用法和用下标作 key 的问题，见 [React 核心概念与 Hooks](/notes/fronted/language/react/notes.html)。

## 栈协调的问题

React 16 之前的协调器被称为栈协调器（stack reconciler）。它通过递归遍历组件树完成 diff：父组件渲染、递归处理子组件、再递归处理孙组件……整个过程依赖 JS 调用栈，一旦开始就必须一口气执行完。

问题在于 JS 是单线程的。如果一棵大树的协调要花 100 毫秒，这 100 毫秒内主线程被完全占住，浏览器无法响应用户输入，也无法绘制新的帧，用户就会感到卡顿和掉帧。

React 15 的架构可以分为两层：

- **协调器（Reconciler）**：找出哪些组件发生了变化；
- **渲染器（Renderer）**：把变化应用到宿主环境（比如 DOM）。

在 React 15 中两者是交替进行的：找到一处变化就更新一处 DOM。即使想中途停下来，也会留下"更新了一半"的界面，所以递归的过程也不能被安全地打断。

## Fiber 架构

React 16 重写了协调器，核心目标是让渲染工作**可以拆分、可以中断、可以恢复，并且可以按优先级调度**。

### 两个瓶颈

影响界面快速响应的因素有两类：

- **CPU 瓶颈**：组件多、计算量大、设备性能弱，渲染工作超过一帧的时间，导致掉帧。对策是时间切片：把渲染工作切成小块，每做一小段就检查是否该把主线程让给浏览器。
- **I/O 瓶颈**：需要等待网络请求等异步数据。对策是 Suspense：在数据就绪前显示占位内容，并且可以让旧界面多保留一会儿，避免闪烁。

### 新的三层架构

- **调度器（Scheduler）**：管理任务的优先级，决定什么时候执行哪个任务，并在适当时机让出主线程。
- **协调器（Reconciler）**：基于 Fiber 结构，把原来的递归改成可中断的循环，逐个处理节点，找出变化并打上标记。
- **渲染器（Renderer）**：根据标记一次性更新 DOM。

与 React 15 不同，协调器只负责标记变化，不会立即修改 DOM。整棵树都处理完后，才交给渲染器统一提交。这就保证了中断协调过程不会留下半成品界面。

### 为什么不用 requestIdleCallback

浏览器原生的 `requestIdleCallback` 可以在帧的空闲时间执行任务，看起来正好适合。但 React 没有直接使用它，原因包括：部分浏览器不支持；它的触发频率不稳定，空闲时间少时可能很久才触发一次，切到后台标签页时还会被大幅降频。

React 自己实现了调度器：在浏览器环境下利用宏任务（如 `MessageChannel`）安排工作，每执行一个很短的时间片就检查是否需要让出主线程，把控制权交还给浏览器处理输入和绘制，然后在下一个宏任务里继续。宏任务、绘制时机等背景见 [执行机制与事件循环](/notes/fronted/language/javascript/eventLoop.html)。

### Fiber 节点

Fiber 有几层含义：一种架构；一个数据结构，每个组件或 DOM 元素对应一个 Fiber 节点；一个工作单元，保存该节点要做的更新。

Fiber 节点上的主要信息：

| 类别 | 内容 |
| --- | --- |
| 身份 | 节点类型（`type`，如 `'div'` 或组件函数）、`key` |
| 树结构 | `return` 指向父节点，`child` 指向第一个子节点，`sibling` 指向下一个兄弟节点 |
| 宿主实例 | `stateNode`，对 DOM 元素来说就是真实的 DOM 节点 |
| 状态 | 新旧 props、`memoizedState`（函数组件的 Hooks 链表就挂在这里） |
| 副作用 | 标记该节点需要插入、更新、删除等 |
| 调度 | 该节点上待处理更新的优先级 |
| 双缓冲 | `alternate`，指向另一棵树中对应的节点 |

用 `child` / `sibling` / `return` 三个指针把树串成链表，是可中断的关键。递归遍历依赖调用栈保存"走到哪了"，中断就丢失了现场；而链表遍历只需要记住"当前处理到哪个 Fiber"，下次从这个节点继续即可：

```text
处理当前节点
有 child → 进入 child
没有 child → 当前节点完成，有 sibling 就转到 sibling
没有 sibling → 回到 return（父节点），父节点完成，再找父节点的 sibling
```

代价是每个节点要多存几个指针，用一些内存换来了遍历过程的可控。

### 双缓冲树

React 同时维护两棵 Fiber 树：

- **current 树**：对应当前屏幕上显示的内容；
- **workInProgress 树**：正在内存中构建的新树。

两棵树中对应的节点通过 `alternate` 互相指向。更新时，React 基于 current 树构建 workInProgress 树，尽量复用已有的节点对象。构建完成并提交到 DOM 后，只需要把根节点指向 workInProgress 树，它就成为新的 current 树。

这和图形渲染中的双缓冲是同一个思路：在后台画好下一帧，再一次性切换，用户看不到绘制到一半的画面。构建过程被中断或者废弃也没关系，current 树和屏幕都没有受到影响。

## render 阶段与 commit 阶段

一次更新分为两个阶段：

| | render 阶段 | commit 阶段 |
| --- | --- | --- |
| 做什么 | 调用组件函数，diff，构建 workInProgress 树，标记副作用 | 根据标记修改 DOM，执行生命周期和 Effect |
| 能否中断 | 在并发模式下可以中断、恢复、废弃重来 | 不可中断，同步执行完 |
| 是否可见 | 不影响屏幕 | 修改真实 DOM |

注意 "render 阶段" 指的是 React 计算新树的过程，并不是"渲染到屏幕"。旧资料里把这一阶段叫作"调度阶段"并不准确，调度是调度器的职责。

因为 render 阶段可能被中断后重新执行，同一个组件函数可能被调用多次。这就是组件函数必须是纯函数、副作用必须放进 Effect 或事件处理函数的根本原因。

commit 阶段又可以粗分为三步：

1. DOM 修改之前：例如读取更新前的 DOM 信息（class 组件的 `getSnapshotBeforeUpdate`）。
2. 修改 DOM：执行插入、更新、删除。
3. DOM 修改之后：此时 ref 已指向新节点，同步执行 `useLayoutEffect` 和 class 组件的 `componentDidMount` / `componentDidUpdate`，然后浏览器才有机会绘制。

`useEffect` 的回调不在这一流程中同步执行，而是被安排到之后，通常在浏览器绘制之后才运行，因此它不会阻塞画面更新。

## 优先级与并发特性

### 优先级

不同来源的更新紧急程度不同：

- 用户输入、点击：需要立即响应，优先级高；
- 根据输入过滤出的大列表、切换标签后的新内容：晚一点出现也可以接受，优先级低。

React 内部会为每次更新分配优先级。早期的实现用"过期时间"表示优先级，后来改为基于位运算的 lanes 模型，能更灵活地表示和合并多种优先级。高优先级的更新到来时，正在进行的低优先级渲染可以被打断，先处理高优先级的更新，之后再重新处理低优先级的部分。

### 并发渲染

React 18 起，通过 `createRoot` 创建的根节点支持并发渲染。并发不是"多线程"，仍然只有一个 JS 线程，而是指 React 可以同时准备多个版本的 UI，并在它们之间切换、中断、丢弃。

并发能力不是对所有更新都启用的。普通的 `setState` 仍按原有的方式处理；只有使用了下面这些并发特性的更新，React 才会以可中断的方式渲染。

### startTransition 与 useTransition

把一次更新标记为"过渡"，表示它不紧急：

```tsx
const [query, setQuery] = useState('');
const [list, setList] = useState(allItems);
const [isPending, startTransition] = useTransition();

function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
  setQuery(e.target.value); // 紧急：输入框要立即显示
  startTransition(() => {
    setList(filter(allItems, e.target.value)); // 不紧急：可以被打断
  });
}
```

用户连续输入时，输入框始终流畅，过滤结果的渲染如果还没完成又来了新的输入，旧的那次渲染会被放弃。`isPending` 可以用来显示加载提示。不在组件内时可以直接用 `startTransition` 函数。

过渡更新不能用来控制输入框本身的值，因为输入需要同步响应。

### useDeferredValue

当你拿不到 setState 的调用点（比如值来自 props）时，可以延迟一个值：

```tsx
const deferredQuery = useDeferredValue(query);
// 用 deferredQuery 渲染耗时的列表，配合 memo 使用效果更明显
```

React 会先用旧值完成一次快速渲染，再在后台用新值渲染，新值的渲染同样可以被打断。

### Suspense

`Suspense` 允许组件在数据或代码未就绪时"挂起"，由最近的 `Suspense` 边界显示 `fallback`。和过渡更新结合时，React 可以选择保留旧界面，直到新内容准备好，而不是先闪一下加载状态。

### 自动批处理

React 18 起，无论更新来自事件处理函数、`setTimeout` 还是 Promise 回调，同一时机内的多次 setState 都会合并为一次渲染。在此之前，只有 React 事件处理函数里的更新会被批处理。

## 与 Vue 3 的对比

Vue 3 在编译期分析模板，标记出哪些节点是静态的、哪些属性可能变化（静态提升、补丁标记等），运行时 diff 可以跳过静态部分。React 没有走这条路。

主要原因是两者的写法不同。Vue 的模板语法受限，编译器能准确知道哪些部分是动态的。React 组件用 JSX 写，JSX 就是 JavaScript，任何地方都可能是动态表达式，难以在编译期做同样精确的静态分析。React 的路线是从运行时调度入手（Fiber、并发特性），保证即使计算量大也不阻塞交互。近年的 React Compiler 则从另一个角度利用编译期信息：自动为组件和计算结果加上缓存，减少不必要的重新渲染，而不是改变 diff 方式。

两种思路各有侧重，不存在绝对的高下。

:::tip
理解 Fiber 不需要背内部函数名，抓住三点就够了：渲染工作拆成以 Fiber 节点为单位的小块，用链表遍历实现可中断；render 阶段只计算不改 DOM，所以可以中断和重来；commit 阶段同步完成，保证用户看到的界面始终完整。
:::

## 小结

- 虚拟 DOM 让 UI 可以声明式描述，并与渲染平台解耦；它的价值不在于"比 DOM 快"。
- diff 基于三条启发式规则：只比较同层、类型不同直接替换整棵子树、用 key 匹配列表子元素，把复杂度降到 O(n)。
- 栈协调递归执行、无法中断，大树更新会长时间占用主线程。
- Fiber 用 `child` / `sibling` / `return` 链表代替递归，配合 current 与 workInProgress 双缓冲树，实现可中断、可恢复的渲染。
- render 阶段可能被中断或重复执行，因此组件必须是纯函数；commit 阶段同步修改 DOM，`useLayoutEffect` 在绘制前执行，`useEffect` 通常在绘制后执行。
- React 18 的并发特性（`useTransition`、`useDeferredValue`、Suspense）让不紧急的更新可以被打断，保持交互流畅。

## 参考

- [React（旧版文档）：协调](https://legacy.reactjs.org/docs/reconciliation.html)
- [React：保留和重置 state](https://react.dev/learn/preserving-and-resetting-state)
- [React：渲染和提交](https://react.dev/learn/render-and-commit)
- [React：useTransition](https://react.dev/reference/react/useTransition)
- [React：useDeferredValue](https://react.dev/reference/react/useDeferredValue)
- [React：Suspense](https://react.dev/reference/react/Suspense)
