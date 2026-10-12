---
title: 移动端跨平台开发概览
description: 对比原生、Hybrid、React Native、Flutter、小程序几类移动端方案的原理与取舍，并整理移动端 H5 开发绕不开的 viewport、像素比、触摸事件与安全区域。
---

移动端开发的核心问题是"用什么技术把界面画到手机屏幕上、怎么调用系统能力"。不同方案的差别，归根到底在于**谁负责渲染**和**业务代码怎么和原生层通信**。这篇先讲清几类主流方案的原理和对比，给出选型思路，再整理移动端 H5 页面的几个基础要点。

## 方案总览

### 原生开发

用平台官方的语言和 UI 框架开发：iOS 用 Swift / Objective-C，配合 UIKit 或 SwiftUI；Android 用 Kotlin / Java，配合 View 体系或 Jetpack Compose。

- 渲染：直接使用系统控件，体验和性能都是上限。
- 能力：系统 API 第一时间可用，不需要任何桥接。
- 代价：两端各写一套，人力和维护成本翻倍；发版要走应用商店审核。

### Hybrid（WebView + JSBridge）

App 里内嵌一个 WebView（iOS 的 WKWebView、Android 的 WebView），页面用 HTML/CSS/JS 写，本质上是一个运行在 App 里的网页。

需要调用原生能力（拍照、支付、获取登录态）时，通过 JSBridge 通信。常见实现方式：

| 方向 | 常见做法 |
| --- | --- |
| JS 调原生 | 原生向 WebView 注入对象（Android 的 `addJavascriptInterface`、iOS 的 `WKScriptMessageHandler`，JS 侧通过 `window.webkit.messageHandlers.xxx.postMessage` 调用）；早期也有拦截自定义 URL Scheme 的做法 |
| 原生调 JS | 原生执行一段 JS 字符串，如 Android 的 `evaluateJavascript`、iOS 的 `evaluateJavaScript` |

调用通常是异步的：JS 发消息时带一个回调 ID，原生处理完后再执行 JS 把结果按 ID 交回去。

```js
// 一个最小化的 JSBridge 封装思路
const callbacks = new Map();
let seq = 0;

function callNative(method, params) {
  return new Promise((resolve) => {
    const id = ++seq;
    callbacks.set(id, resolve);
    window.webkit.messageHandlers.bridge.postMessage({ id, method, params });
  });
}

// 原生处理完后执行：window.__onNativeResult(id, data)
window.__onNativeResult = (id, data) => {
  callbacks.get(id)?.(data);
  callbacks.delete(id);
};
```

- 优点：一套代码多端运行，页面可以热更新，不用发版；前端技术栈直接复用。
- 缺点：渲染性能、手势、动画和原生有差距；首屏要加载资源，常需要离线包、预加载 WebView 等优化。

### React Native

用 React 写组件，但最终渲染的是**原生控件**而不是 DOM。JS 代码运行在 JS 引擎里（官方默认使用为 RN 优化的 Hermes 引擎），组件树经过协调后，由原生层创建对应的 iOS/Android 视图。

通信机制经历过一次大改：

- 旧架构：JS 与原生之间通过异步的 Bridge 传递序列化后的 JSON 消息，高频交互（如手势跟随、长列表滚动）容易成为瓶颈。
- 新架构：通过 JSI（JavaScript Interface）让 JS 直接持有 C++ 对象的引用，可以同步调用；渲染层换成 Fabric，原生模块换成 TurboModules（按需加载）。

特点：React 开发者上手快，体验接近原生；但两端控件行为不完全一致，涉及复杂原生能力时仍需要写原生代码，升级版本时依赖库的兼容性是常见痛点。

### Flutter

Flutter 用 Dart 语言开发，**不使用系统控件**，而是由自带的渲染引擎直接在一块画布上绘制所有界面（引擎早期基于 Skia，新版本在移动端逐步切换到 Impeller）。

- 渲染：自绘，因此两端像素级一致，动画和复杂界面的性能好。
- 编译：开发时 Dart 跑在 JIT 模式，支持热重载；发布时 AOT 编译成机器码。
- 调原生：通过 Platform Channel（`MethodChannel` 等）与原生代码通信。
- 代价：需要学 Dart；界面不是系统控件，"原生感"要靠组件库模拟（Material、Cupertino）；包体积比纯原生大一些；嵌入已有原生 App 需要额外工作。

环境和语言部分见 [Flutter 环境搭建](/notes/fronted/mobile/flutter/environment.html)、[Dart 基础概念](/notes/fronted/mobile/flutter/dart/basic.html)。

### 小程序

以微信小程序为代表，运行在宿主 App 提供的容器里。典型架构是**逻辑层和渲染层分离**：

- 逻辑层：运行 JS，没有 DOM，不能直接操作页面。
- 渲染层：用 WebView（部分场景用原生组件或自研渲染）渲染模板（WXML）和样式（WXSS）。
- 两层通过宿主中转通信，逻辑层用 `setData` 把数据发给渲染层。

这样设计是为了管控：宿主可以限制开发者能调用的能力，保证安全。代价是 `setData` 有通信开销，数据量大、调用频繁时会卡顿；各家平台的 API 不统一，需要借助多端框架（如 Taro、uni-app）统一。

## 方案对比

| 维度 | 原生 | Hybrid | React Native | Flutter | 小程序 |
| --- | --- | --- | --- | --- | --- |
| 语言 | Swift / Kotlin 等 | HTML/CSS/JS | JS/TS + React | Dart | JS + 平台模板语法 |
| 渲染方式 | 系统控件 | WebView | 系统控件 | 自绘引擎 | WebView 为主，部分原生组件 |
| 性能 | 最好 | 较弱 | 接近原生 | 接近原生 | 中等 |
| 多端一致性 | 各写各的 | 高 | 中（控件差异） | 高（像素一致） | 平台间不一致 |
| 动态更新 | 需发版 | 随时更新 | 可做 JS 包热更新（受商店政策约束） | 官方不支持代码热更新 | 平台审核后更新 |
| 调原生能力 | 直接调用 | JSBridge | 原生模块 | Platform Channel | 只能用平台开放的 API |
| 适合场景 | 核心体验、重度系统能力 | 活动页、频繁变化的业务 | 已有 React 团队的 App | 重 UI、要求两端一致 | 依托宿主流量的轻应用 |

## 选型建议

没有通用最优解，常见的判断顺序：

1. **业务形态**：依托某个超级 App 的流量做轻应用，选小程序；独立 App 再往下看。
2. **团队栈**：团队主要是 Web/React 开发者，RN 或 Hybrid 的学习成本最低；愿意投入学 Dart，Flutter 的一致性和性能更好。
3. **更新频率**：运营活动、规则经常变的页面，用 H5 嵌在 App 里最灵活。
4. **体验要求**：首页、核心交易流程、相机音视频这类对性能和系统能力要求高的部分，用原生。

实际项目大多是混合的：原生做骨架和核心页面，H5 承载运营和长尾页面，部分模块用 RN 或 Flutter。要提前设计好原生与各技术栈之间的路由、登录态和通信协议。

## 移动端 H5 常见要点

无论 Hybrid 还是浏览器访问，移动端 H5 都绕不开以下几点。

### viewport

移动浏览器默认会把页面按一个较宽的"布局视口"（常见 980px）渲染再缩小显示，导致文字很小。需要用 meta 标签声明：

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

- `width=device-width`：布局视口宽度等于设备的 CSS 像素宽度。
- `initial-scale=1`：初始不缩放。
- `viewport-fit=cover`：让页面铺满整个屏幕（包括刘海、圆角区域），配合安全区域使用。

不建议随意加 `user-scalable=no` 禁止缩放，这会影响视力不好的用户使用。声明了 `width=device-width` 之后，早期移动浏览器为了判断双击缩放而加的约 300ms 点击延迟也不再存在，不需要再引入 FastClick 一类的库。

### 设备像素比

`window.devicePixelRatio`（DPR）表示 1 个 CSS 像素对应多少个物理像素。DPR 为 3 的手机上，`width: 100px` 实际占用 300 个物理像素。

常见影响：

- **图片模糊**：位图要按 DPR 提供高倍图，用 `srcset` 让浏览器挑选：

  ```html
  <img src="logo.png" srcset="logo.png 1x, logo@2x.png 2x, logo@3x.png 3x" alt="logo" />
  ```

- **1px 边框偏粗**：CSS 的 `1px` 在高 DPR 屏上是多个物理像素。常见做法是用伪元素画线再 `transform: scaleY(0.5)` 之类缩放，或直接接受设计上的差异。
- **适配方案**：现在更推荐直接用 `vw`、`rem` + 媒体查询或容器查询做布局；早年流行的根据 DPR 动态改 viewport 缩放的方案已不推荐。响应式相关见[媒体查询与响应式](/notes/fronted/language/css/media.html)。

### 触摸事件

| 事件 | 触发时机 |
| --- | --- |
| `touchstart` | 手指触摸屏幕 |
| `touchmove` | 手指在屏幕上移动 |
| `touchend` | 手指离开屏幕 |
| `touchcancel` | 触摸被系统打断（如来电） |

事件对象上的 `touches`（当前屏幕上所有触点）、`targetTouches`（当前元素上的触点）、`changedTouches`（本次变化的触点）用来获取坐标。`touchend` 时手指已经离开，要从 `changedTouches` 取坐标。

几点实践：

- 新代码优先使用 **Pointer Events**（`pointerdown` / `pointermove` / `pointerup`），一套代码同时处理鼠标、触摸和触控笔。
- 只监听不阻止默认行为的滚动类事件，注册时加 `{ passive: true }`，浏览器不用等回调执行完就能滚动，减少卡顿。
- 想禁止某个区域的默认手势（如画板区域禁止页面滚动和缩放），用 CSS 的 `touch-action: none` 比在事件里 `preventDefault()` 更可靠。

```js
el.addEventListener(
  'touchmove',
  (e) => {
    const { clientX, clientY } = e.touches[0];
    // 记录坐标，不调用 preventDefault
  },
  { passive: true },
);
```

### 安全区域

全面屏手机有刘海、圆角和底部手势条，内容放到这些区域会被遮挡。设置 `viewport-fit=cover` 后，可以用 CSS 环境变量拿到四个方向的安全距离：

```css
.page {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

/* 底部固定按钮：至少留 12px，有手势条时再加上安全距离 */
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
}
```

`env()` 支持第二个参数作为回退值，如 `env(safe-area-inset-bottom, 0px)`。早期 iOS 上曾短暂使用 `constant()` 写法，现在只需写 `env()`。在 App 内嵌 WebView 时，原生容器是否已经处理过状态栏和底部区域会影响结果，需要和原生约定好由谁来留白。

## 小结

- 各方案的本质区别在渲染方（系统控件、WebView、自绘引擎）和通信方式（直接调用、JSBridge、JSI、Platform Channel）。
- Hybrid 依赖 JSBridge 调原生，灵活可热更新，但性能受 WebView 限制。
- React Native 渲染原生控件，新架构用 JSI 取代异步 Bridge；Flutter 自绘界面，两端一致性最好。
- 小程序逻辑层与渲染层分离，`setData` 的通信开销是性能关键。
- 移动端 H5 要处理好 viewport 声明、DPR 带来的图片和边框问题、触摸与 Pointer 事件，以及 `env(safe-area-inset-*)` 安全区域。

## 参考

- [MDN：viewport meta 标签](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Viewport_meta_tag)
- [MDN：Window.devicePixelRatio](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/devicePixelRatio)
- [MDN：Touch events](https://developer.mozilla.org/zh-CN/docs/Web/API/Touch_events)
- [MDN：Pointer events](https://developer.mozilla.org/zh-CN/docs/Web/API/Pointer_events)
- [MDN：env()](https://developer.mozilla.org/zh-CN/docs/Web/CSS/env)
- [React Native 官方文档](https://reactnative.dev/)
- [Flutter 官方文档](https://docs.flutter.dev/)
