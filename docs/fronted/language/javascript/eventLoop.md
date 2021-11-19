## 原理

+ 先执行一个宏任务、再执行所有的微任务（反复这个循环）

## [异步任务](https://juejin.im/post/6844903901578133512)

+ 宏任务（Macro-Task）：参与事件循环的异步任务（别的线程里面完成的 -- 怎么理解？）
   + eg: I/O、request-Animation-Frame、set-Timeout、set-Interval、set-Immediate
+ 微任务（Micro-Task）：不参与事件循环的["异步"](https://juejin.im/post/6844903877477662727)(假异步)任务 -（同一个事件循环中，比宏任务优先级高、主线程任务完成后立即执行， 没有在别的线程里完成）
   + eg: process_next-Tick (node.js)、[Mutation-Observer](https://developer.mozilla.org/zh-CN/docs/Web/API/MutationObserver)、Promise

## 拓展

+ [Chrome事件循环（Event-Loop)]((https://juejin.im/post/6844903704156438536))
+ 事件驱动（Event Driven) - ([发布订阅模式/观察者模式](https://www.jianshu.com/p/9f2c8ae57cac))
+ 消息循环（Message-Loop）
+ 运行循环（Run-Loop）
+ [Mutation Events](https://www.jianshu.com/p/b5c9e4c7b1e1) - 是在 [DOM3](https://www.w3.org/TR/DOM-Level-3-Events/)中定义
+ [Mutation-Observer](https://developer.mozilla.org/zh-CN/docs/Web/API/MutationObserver) - 是在 DOM4 中定义