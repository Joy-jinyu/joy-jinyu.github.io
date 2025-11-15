### [用户体验报告](https://developers.google.com/web/tools/chrome-user-experience-report/, https://www.w3.org/webperf/)

[追踪和优化性能的几个重要指标：](https://web.dev/i18n/zh/user-centric-performance-metrics/)

+ `First Paint - FP` 
+ `First Contentful Paint - FCP` 首次内容绘制
+ `DOMContentLoaded`
+ `onload`
+ `First Input Delay - FID` 首次输入延迟
+ `Largest Contentful Paint- LCP` 最大内容绘制
+ `Cumulative Layout Shift- CLS` 累计布局偏移
+ `Time to First Byte- TTFB`
+ `Notification Permissions`
+ `Effective Connection Type`
+ `Device Type`
+ `Country`
+ `Data format`
+ `Time to interactive - TTI` 可交互时间
+ `Total blocking time - TBT` 总阻塞时间

### 网页载入速度检测工具

+ [PageSpeed Tools](https://developers.google.com/speed/docs/insights) - Google

  Google 和 Firefox有同名插件

+ `Tslow` - 雅虎

### `PageSpeed Tools`

`PageSpeed`的分析基于一个分为五类的最佳实践列表：

\* 优化缓存——让你应用的数据和逻辑完全避免使用网络

\* 减少回应时间——减少一连串请求-响应周期的数量

\* 减小请求大小——减少上传大小

\* 减小有效负荷大小——减小响应、下载和缓存页面的大小

\* 优化浏览器渲染——改善浏览器的页面布局

### [优化的基本规则](https://developers.google.com/speed/docs/insights/OptimizeCSSDelivery)

#### 阻碍呈现的往返次数

+ 避免着陆页重定向
+ 清除阻碍呈现的`javascript` 和 `css`内容
+ 使用浏览器缓存
+ 有限加载可见内容
+ 缩短服务器响应时间

#### 响应大小

+ 启用压缩功能
+ 缩减资源大小
+ 优化图片