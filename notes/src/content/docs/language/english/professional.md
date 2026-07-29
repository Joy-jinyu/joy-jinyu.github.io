---
title: 前端常用英文术语
description: 按基础、JS 与语言、框架、工程化、网络与浏览器、协作与流程分组整理前端开发中常见的英文术语，附中文译名和简短解释，便于阅读英文文档和报错信息。
---

阅读官方文档、报错信息、源码注释和英文技术讨论时，同一个词在技术语境下往往有固定含义，直接按日常词义理解容易出错。这篇按领域分组整理常见术语，每个词给出常用中文译名和一句话解释。部分词有多种译法，取社区最常用的一种。

## 基础与文档常用词

文档和报错信息里高频出现的通用词。

| 术语 | 中文 | 解释 |
| --- | --- | --- |
| built-in | 内置的 | 语言或环境自带、无需额外引入，如 built-in objects（内置对象） |
| compatible / compatibility | 兼容的 / 兼容性 | 能在某环境或与某版本一起正常工作，如 browser compatibility |
| deprecated | 已弃用的 | 仍可使用但不再推荐，将来可能移除 |
| ecosystem | 生态系统 | 围绕某技术的库、工具、社区的总和 |
| experimental | 实验性的 | 尚未稳定，API 可能变化 |
| fallback | 回退、降级方案 | 首选方案不可用时使用的替代方案 |
| manually | 手动地 | 与 automatically（自动地）相对 |
| predictable | 可预测的 | 结果确定、易于推断，常用于描述状态管理 |
| optional / required | 可选的 / 必需的 | 参数、字段是否必须提供 |
| default | 默认值 | 未显式指定时使用的值 |
| at a minimum | 至少、最低限度 | 文档中表示"最少需要做到……" |
| universally | 普遍地、通用地 | 如 universally supported（被广泛支持） |
| economical | 节省的、经济的 | 文档中多指节省资源，如节省内存 |
| tracking | 跟踪 | 如 dependency tracking（依赖跟踪）、tracking issue（跟踪问题进展的 issue） |
| troubleshoot / troubleshooting | 排查问题 / 故障排除 | 文档中解决常见问题的章节标题 |
| workaround | 变通方案、绕过方法 | 问题未根本修复时的临时解决办法 |
| caveat | 注意事项、限制 | 使用时需要留意的坑 |
| edge case | 边界情况 | 输入处于极端或少见取值时的情况 |
| boilerplate | 样板代码、模板项目 | 重复性的固定代码，或用于起步的项目模板 |
| out of the box | 开箱即用 | 不需要额外配置就能使用 |

## JS 与语言

| 术语 | 中文 | 解释 |
| --- | --- | --- |
| syntax | 语法 | 代码的书写规则；`SyntaxError` 即语法错误 |
| semantics | 语义 | 代码的含义和运行时行为 |
| expression / statement | 表达式 / 语句 | 表达式产生值，语句执行动作 |
| scope | 作用域 | 变量可被访问的范围 |
| closure | 闭包 | 函数与其创建时所在词法环境的组合，能访问外层变量 |
| hoisting | 提升 | 声明在编译阶段被移动到作用域顶部的行为 |
| context | 上下文 | 如 execution context（执行上下文） |
| prototype | 原型 | JS 对象继承属性的来源对象 |
| ancestor / descendant | 祖先 / 后代 | 原型链或 DOM 树中上层 / 下层的节点 |
| anonymous function | 匿名函数 | 没有名字的函数 |
| callback | 回调函数 | 作为参数传入、在合适时机被调用的函数 |
| higher-order function | 高阶函数 | 接收函数作为参数或返回函数的函数 |
| immutable / mutable | 不可变的 / 可变的 | 创建后能否被修改 |
| mutation | 变更、修改 | 直接修改已有数据；如 Vuex 的 mutation、DOM 的 MutationObserver |
| side effect | 副作用 | 函数除返回值外对外部产生的影响，如修改全局变量、发请求 |
| pure function | 纯函数 | 相同输入总是相同输出且无副作用的函数 |
| iterator / iterable | 迭代器 / 可迭代对象 | 能被 `for...of` 遍历的对象及其遍历机制 |
| generator | 生成器 | 用 `function*` 定义、可暂停和恢复的函数 |
| asynchronous / synchronous | 异步 / 同步 | 是否等待操作完成再继续执行 |
| promise | 期约（多直接用英文） | 表示异步操作最终结果的对象 |
| event loop | 事件循环 | 调度同步代码、宏任务、微任务的运行机制 |
| microtask / macrotask | 微任务 / 宏任务 | 事件循环中两类任务队列 |
| garbage collection | 垃圾回收 | 自动释放不再使用的内存 |
| type inference | 类型推断 | 编译器根据代码自动推导类型 |
| generic | 泛型 | 用类型参数编写可复用于多种类型的代码 |
| type assertion | 类型断言 | 告诉编译器把值当作某种类型 |
| union / intersection type | 联合类型 / 交叉类型 | `A \| B` 与 `A & B` |

## 框架

| 术语 | 中文 | 解释 |
| --- | --- | --- |
| component | 组件 | 可复用的 UI 单元 |
| props | 属性 | 父组件传给子组件的数据 |
| state | 状态 | 组件内部可变化、驱动渲染的数据 |
| render | 渲染 | 根据数据生成 UI 的过程 |
| virtual DOM | 虚拟 DOM | 用 JS 对象描述 DOM 结构，用于计算最小更新 |
| reconciliation | 协调 | React 比较新旧树、决定如何更新的过程 |
| diffing | 差异比较 | 找出新旧两份数据之间的差别 |
| hook | 钩子 | React 中以 `use` 开头、在函数组件里使用状态等能力的函数 |
| lifecycle | 生命周期 | 组件从创建、更新到销毁的各个阶段 |
| reactive / reactivity | 响应式的 / 响应式系统 | 数据变化自动触发视图更新的机制 |
| two-way binding | 双向绑定 | 视图与数据相互同步，如 Vue 的 `v-model` |
| directive | 指令 | 模板中带特殊前缀的属性，如 `v-if` |
| slot | 插槽 | 父组件向子组件内容区域分发内容的机制 |
| hydration | 注水、水合 | 在客户端为服务端渲染的 HTML 绑定事件和状态 |
| server-side rendering (SSR) | 服务端渲染 | 在服务器上生成 HTML 再发送给浏览器 |
| client-side rendering (CSR) | 客户端渲染 | 由浏览器执行 JS 生成页面内容 |
| routing / router | 路由 / 路由器 | 根据 URL 决定展示哪个页面 |
| store | 状态仓库 | 集中管理全局状态的地方 |
| middleware | 中间件 | 插在请求或动作处理流程中间的处理函数，如 Express、Redux 的中间件 |
| dispatch | 派发 | 发出一个动作（action）以触发状态更新 |

## 工程化

| 术语 | 中文 | 解释 |
| --- | --- | --- |
| bundler | 打包工具 | 把模块及依赖合并成浏览器可用的文件，如 webpack、Rollup |
| bundle / chunk | 包 / 代码块 | 打包输出的文件 / 拆分出的代码片段 |
| module | 模块 | 独立的代码单元，如 ES Module、CommonJS |
| dependency | 依赖 | 项目运行或构建所需的外部包 |
| loader / plugin | 加载器 / 插件 | webpack 中转换文件的模块 / 扩展构建流程的模块 |
| transpile / compile | 转译 / 编译 | 源码转换为同级语言（如新语法转旧语法）/ 转换为更低层的形式 |
| polyfill | 垫片 | 为旧环境补齐缺失 API 的代码 |
| tree shaking | 摇树优化 | 移除未被使用的代码 |
| code splitting | 代码分割 | 把代码拆成多个按需加载的块 |
| lazy loading | 懒加载 | 需要时才加载资源 |
| minify | 压缩、混淆 | 去掉空白、缩短变量名以减小体积 |
| source map | 源码映射 | 把构建产物映射回源码，方便调试 |
| hot module replacement (HMR) | 模块热替换 | 运行时替换修改的模块而不刷新整页 |
| lint / linter | 代码检查 / 检查工具 | 静态分析代码的风格和潜在问题，如 ESLint |
| semi（lint 规则名） | 分号 | 是 semicolon 的缩写，ESLint 中控制语句末尾是否加分号的规则 |
| comma / trailing comma | 逗号 / 尾逗号 | 尾逗号指列表最后一项后面的逗号 |
| indent / indentation | 缩进 | 行首的空白，常用 2 或 4 个空格 |
| monorepo | 单一代码仓库 | 多个项目或包放在同一个仓库中管理 |
| lockfile | 锁文件 | 锁定依赖的确切版本，如 `package-lock.json` |
| semantic versioning (semver) | 语义化版本 | `主版本.次版本.修订号` 的版本号规范 |
| continuous integration (CI) | 持续集成 | 代码提交后自动构建和测试 |
| continuous deployment / delivery (CD) | 持续部署 / 持续交付 | 自动将通过测试的代码发布上线 / 保持随时可发布 |
| unit test / e2e test | 单元测试 / 端到端测试 | 测试单个函数或组件 / 模拟用户操作测试完整流程 |
| mock | 模拟 | 用假的实现替代真实依赖，用于测试或开发 |

## 网络与浏览器

| 术语 | 中文 | 解释 |
| --- | --- | --- |
| request / response | 请求 / 响应 | HTTP 通信的两端消息 |
| header | 头部 | 请求或响应中的元信息字段 |
| payload | 载荷 | 请求或响应中实际传输的数据 |
| cross-origin | 跨源（常称跨域） | 协议、域名、端口任一不同 |
| CORS | 跨源资源共享 | 服务器声明允许哪些源访问资源的机制 |
| same-site / cross-site | 同站 / 跨站 | 按协议和可注册域名判断，与同源不同 |
| cookie | Cookie | 浏览器保存并随请求自动发送的小段数据 |
| session | 会话 | 服务端维护的用户状态 |
| cache | 缓存 | 保存资源副本以加快后续访问 |
| CDN | 内容分发网络 | 把资源分发到离用户近的节点 |
| DNS | 域名系统 | 把域名解析为 IP 地址 |
| latency / bandwidth | 延迟 / 带宽 | 数据往返耗时 / 单位时间的传输能力 |
| Ethernet | 以太网 | 常见的有线局域网技术 |
| metered connection | 按流量计费的连接 | 系统据此限制后台下载等流量消耗 |
| rendering engine | 渲染引擎 | 浏览器中负责解析和绘制页面的部分，如 Blink、WebKit |
| reflow / repaint | 重排 / 重绘 | 重新计算布局 / 重新绘制外观 |
| composite / compositing | 合成 | 把多个图层组合成最终画面 |
| viewport | 视口 | 浏览器中用于显示页面的区域 |
| DOM | 文档对象模型 | 页面结构的对象表示 |
| event bubbling / capturing | 事件冒泡 / 事件捕获 | 事件在 DOM 树中向上 / 向下传播的阶段 |
| event delegation | 事件委托 | 在父元素上统一处理子元素的事件 |
| debounce / throttle | 防抖 / 节流 | 停止触发一段时间后才执行 / 固定间隔内最多执行一次 |
| XSS | 跨站脚本攻击 | 注入恶意脚本在用户页面中执行 |
| CSRF | 跨站请求伪造 | 借用户已登录的身份发起非本意的请求 |

### CSS 中的常见词

CSS 属性名和值中的英文单词，按技术含义理解：

| 术语 | 中文 | 解释 |
| --- | --- | --- |
| skew | 倾斜 | `transform: skew()`，沿 X 或 Y 轴倾斜元素 |
| scale | 缩放 | `transform: scale()`，按比例放大或缩小 |
| rotate / translate | 旋转 / 平移 | `transform` 的另外两个常用函数 |
| iteration | 迭代、重复次数 | `animation-iteration-count`，动画播放的次数 |
| alternate | 交替 | `animation-direction: alternate`，动画正向和反向交替播放 |
| specificity | 优先级（特异性） | 选择器权重，决定规则冲突时谁生效 |
| cascade | 层叠 | 多条规则作用于同一元素时的合并与取舍机制 |
| inheritance | 继承 | 子元素沿用父元素的某些属性值 |
| pseudo-class / pseudo-element | 伪类 / 伪元素 | 如 `:hover` / `::before` |
| media query | 媒体查询 | 根据设备特征应用不同样式 |
| flexbox / grid | 弹性盒 / 网格布局 | 一维 / 二维布局模型 |

## 协作与流程

| 术语 | 中文 | 解释 |
| --- | --- | --- |
| repository (repo) | 仓库 | 存放项目代码及其历史的地方 |
| commit | 提交 | 一次被记录的代码变更 |
| branch / merge / rebase | 分支 / 合并 / 变基 | Git 中并行开发与整合变更的操作 |
| conflict | 冲突 | 两处修改了同一位置，需要手动解决 |
| pull request (PR) / merge request (MR) | 拉取请求 / 合并请求 | 申请把分支合入目标分支并进行评审 |
| code review | 代码评审 | 他人审阅代码变更 |
| LGTM | 看起来没问题 | Looks Good To Me，评审通过时的常用回复 |
| WIP | 进行中 | Work In Progress，尚未完成，暂不合并 |
| nit | 小问题 | nitpick 的缩写，评审中指不影响合并的细节建议 |
| issue | 问题单 | 用于跟踪缺陷、需求、讨论的条目 |
| bug / regression | 缺陷 / 回归问题 | 程序错误 / 原本正常的功能因新改动而出错 |
| hotfix | 紧急修复 | 绕过常规发布节奏、尽快上线的修复 |
| release / changelog | 发布 / 更新日志 | 发布的版本 / 记录各版本变更的文档 |
| breaking change | 破坏性变更 | 不向后兼容、需要使用者修改代码的变更 |
| backward compatible | 向后兼容 | 新版本仍支持旧的用法 |
| refactor | 重构 | 不改变外部行为地改进代码结构 |
| technical debt | 技术债 | 为了短期速度而留下的、日后需要偿还的设计或代码问题 |
| milestone / roadmap | 里程碑 / 路线图 | 阶段性目标 / 长期规划 |
| sprint / iteration | 冲刺 / 迭代 | 敏捷开发中的固定开发周期 |
| stakeholder | 利益相关方 | 与项目结果有关、需要沟通的人或团队 |
| ETA | 预计完成时间 | Estimated Time of Arrival |
| TBD | 待定 | To Be Determined |
| FYI | 供参考 | For Your Information |

## 小结

- 技术文档里的词常有固定含义，例如 CSS 的 iteration 是"重复次数"、alternate 是"交替"，不能按"复述""轮流"理解。
- lint 规则名多是缩写，如 `semi` 指 semicolon（分号），而不是"半"。
- 同站（same-site）与同源（same-origin）、转译（transpile）与编译（compile）这类成对概念要区分清楚。
- 协作中的缩写（LGTM、WIP、nit、TBD）在代码评审和 issue 讨论中很常见。

## 参考

- [MDN Web 文档术语表](https://developer.mozilla.org/zh-CN/docs/Glossary)
- [React 文档](https://react.dev/)
- [Vue 文档](https://vuejs.org/)
- [webpack 概念](https://webpack.js.org/concepts/)
- [Git 文档](https://git-scm.com/doc)
