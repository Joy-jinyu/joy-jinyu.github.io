## 栈协调

### 启发

+ Diff性能突破关键在于分层对比
+ 类型一致的Node才有继续Diff的必要性
+ key帮助我们尽可能的重用同一层级的节点

### 分层对比：改变时间复杂度的决定性思路

### 类型一致：减少递归“一刀切”的思路

### key属性：重用节点的关键

### 问题

栈协调机制下的`Diff`算法，其实是**树的深度优先遍历过程**，也就是一个**同步的递归过程**，意味着一旦更新开始，根本停不下来。当处理复杂度高、体量大的虚拟`DOM`树时，栈协调需要的调和时间会很长，意味着**JavaScript 对主线程将长时间占用**，进而导致渲染卡顿、无响应等问题

---

---

## [Fiber协调](https://www.xujun.org/note-131146.html)

是实现**增量渲染**，换句话说就是把一个渲染任务分解为多个渲染任务，而后将其分散到多个帧里，是一种手段。目的，是为了实现任务的**可中断、可恢复**，并给不同的任务赋予不同的**优先级**，最终达到快速响应的体验

### Fiber核心：可中断、可恢复、不同的优先级

相对于栈协调，Fiber协调多出了调度器`Scheduler`，其更新的处理工作变成了

- 每个更新任务都会赋予一个优先级
- 当更新任务抵达调度器时，高优先级的更新任务(A)会更快地被调度进入 `Reconciler` —— **优先级**
- 此时有新的更新任务(B)，调度器会检查它优先级，若高于当前任务(A)，处于当前`Reconciler`层的A任务会被中断，调度器将B任务推入`Reconciler`层 —— **可中断**
- 当B任务完成渲染后，新一轮调度开始，之前被中断的A任务将会被重新推入`Reconciler`层，继续它的渲染 —— **可恢复**

### React架构分层和生命周期

---

---

## [理解Fiber协调](https://www.jianshu.com/p/22d4d3eed8c0)

### 博文

+ [前端工程师的自我修养：React Fiber 是如何实现更新过程可控的](https://links.jianshu.com/go?to=https%3A%2F%2Fwww.zoo.team%2Farticle%2Fabout-react-fiber)

### React如何实现快速响应

- CPU的瓶颈：当项目变得庞大、组件数量繁多、遇到**大计算量**的操作或者**设备性能不足**使得页面掉帧，导致卡顿。（引入**Time Slicing 时间分片**概念）
- IO的瓶颈：发送网络请求后，由于需要等待数据返回才能进一步操作导致不能快速响应。（引入**Suspense**概念）

### React的“先天不足” —— 听说 [Vue 3.0 采用了动静结合的 Dom diff](https://blog.csdn.net/frontend_frank/article/details/114297890)，React 为何不跟进？

### 从架构演变看不断进击的 React 都做过哪些优化？

#### React渲染页面的两个阶段

+ 调度阶段（reconciliation）：在这个阶段 React 会更新数据生成新的 Virtual DOM，然后通过Diff算法，快速找出需要更新的元素，放到更新队列中去，**得到新的更新队列**。
+ 渲染阶段（commit）：这个阶段 React 会遍历更新队列，**将其所有的变更一次性更新到DOM上**。

#### React 15 架构

React15架构可以分为两层：

- Reconciler（协调器）—— 负责找出变化的组件；
- Renderer（渲染器）—— 负责将变化的组件渲染到页面上；

在React15及以前，Reconciler采用递归的方式创建虚拟DOM，**递归过程是不能中断的**。如果组件树的层级很深，递归会占用线程很多时间，递归更新时间超过了16ms，用户交互就会卡顿。

#### React16架构

React16架构可以分为三层：

- Scheduler（调度器）—— **调度任务的优先级**，高优任务优先进入Reconciler；
- Reconciler（协调器）—— 负责找出变化的组件：**更新工作从递归变成了可以中断的循环过程。Reconciler内部采用了Fiber的架构**；
- Renderer（渲染器）—— 负责将变化的组件渲染到页面上。

#### React 17 优化

React16的**expirationTimes模型**只能区分是否`>=expirationTimes`决定节点是否更新。React17的**lanes模型**可以选定一个更新区间，并且动态的向区间中增减优先级，可以处理更细粒度的更新。

### 浏览器一帧都会干些什么以及requestIdleCallback的启示

#### 浏览器一帧都会干些什么？

目前浏览器大多是 60Hz（60帧/s），每一帧耗时也就是在 16.6ms 左右。那么在这一帧的（16.6ms） 过程中浏览器又干了些什么呢？

1. 接受输入事件

2. 执行事件回调

3. 开始一帧

4. 执行 RAF (RequestAnimationFrame)

5. 页面布局，样式计算

6. 绘制渲染

7. 执行 RIC (RequestIdelCallback)

   >RIC 事件不是每一帧结束都会执行，只有在一帧的 16.6ms 中做完了前面 6 件事儿且还有剩余时间，才会执行。如果一帧执行结束后还有时间执行 RIC 事件，那么下一帧需要在事件执行结束才能继续渲染，所以 RIC 执行不要超过 30ms，如果长时间不将控制权交还给浏览器，会影响下一帧的渲染，导致页面出现卡顿和事件响应不及时。

### requestIdleCallback 的启示

Facebook 抛弃了 requestIdleCallback 的原生 API, 实现了功能更完备的requestIdleCallbackpolyfill：

- 浏览器兼容性；
- 触发频率不稳定，受很多因素影响。比如当我们的浏览器切换tab后，之前tab注册的requestIdleCallback触发的频率会变得很低。

>

参考

+ [requestIdleCallback 的 FPS 只有 20](https://links.jianshu.com/go?to=https%3A%2F%2Fgithub.com%2Ffacebook%2Freact%2Fissues%2F13206)
+ [requestIdleCallback-后台任务调度](https://links.jianshu.com/go?to=http%3A%2F%2Fwww.zhangyunling.com%2F702.html)

### Fiber 为什么是 React 性能的一个飞跃？

#### React Fiber 中的时间分片

#### Fiber链表结构

链表相比顺序结构数据格式的**好处**就是：

1. 操作更高效，比如顺序调整、删除，只需要改变节点的指针指向就好了。
2. 不仅可以根据当前节点找到下一个节点，在多向链表中，还可以找到他的父节点或者兄弟节点。

但链表也不是完美的，**缺点**就是：

1. 比顺序结构数据更占用空间，因为每个节点对象还保存有指向下一个对象的指针。
2. 不能自由读取，必须找到他的上一个节点。

React 用**空间换时间**，更高效的操作可以方便根据优先级进行操作。同时**可以根据当前节点找到其他节点，在下面提到的挂起和恢复过程中起到了关键作用**。

### React Fiber 是如何实现更新过程可控？

Fiber核心：可中断、可恢复、不同的优先级