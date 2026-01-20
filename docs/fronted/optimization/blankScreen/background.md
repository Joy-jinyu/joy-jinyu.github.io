# 背景

## 一、从浏览器中输入URL发生了什么

>前端角度优化：发送Http请求、服务器处理请求返回Http报文、浏览器解析渲染界面。
>
>运维的角度优化：DNS解析、TCP连接、服务器开启GZip。

### DNS解析

### 1.2 TCP连接

### 1.3 发送Http请求

发送请求前，会首先检查资源是否存在缓存
- 强缓存
  + Expires(http1.0引入)
  + Cache-Control(http2.0引入)
- 协商缓存
  - Last-Modified If-Modified-Since(http1.0引入)
  - Etag If-None-Match(http1.1引入)

### 1.4 服务器处理请求返回Http报文

### 1.5 浏览器解析渲染界面

### 1.6 服务器开启Gzip

+ nginx 设置gzip： gzip_comp_level 属性值越大，压缩效果越好，取值1-9
+ 其它代理服务器

## 二、优化方案

### 2.1 Webpack 与浏览器缓存的配合 - hash

+ webpack将生成js和css的时候根据本次构建的hash生成名称中带有hash的文件。
+ 利用hash可以使用浏览器的强缓存（通过配置Cache-Control: max-age={很大的数}）来保证静态资源能够保存在浏览器中。
+ 当下一次构建时又会生成新的hash，不会因为缓存导致web引用无法更新。

### 2. 2 利用CDN（Content Delivery Network - 内容分发网络）对静态资源进行加速

+ 找到CDN最近的节点
+ 减少传播时延

### 2.3 骨架屏（基于Spa模式背景下出来的优化方案）/ Loading图片等进行占位

+ 缺点是并没有解决根本问题，用户还是不能直接看到想看的内容

### 2.4 ssr渲染

## 三、Spa使首屏加载变慢

### 3.1 直接请求Html文件过程

+ 浏览器请求到html文档并构建文档对象模型（DOM）
+ 浏览器加载样式文件，构建层叠样式模型（CSSOM）
+ 在DOM和CSSOM构建后生成渲染树
+ 根据渲染树进行Layout过程

### 3.2 Spa模式

+ 同上
+ 同上
+ 同上
+ 同上
+ 浏览器并行下载script、link等资源（非常耗时）
+ 浏览器通过V8引擎执行JS代码
+ 浏览器构建新的DOM和CSSOM，并且修改render-tree进行回流