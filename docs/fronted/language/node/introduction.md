

### 架构

#### node.js标准库 - 由 Java-Script实现
   + http(s)、net、stream、fs、events、buffer等
#### node bindings - 由 Java-Script / c++实现 1和3交换数据层
#### 支撑node.js运行的技术 - 有 C / C++实现
   + V8 （Java-Script 引擎）
   + libuv：提供了跨平台，线程池，事件池，异步 I/O 等能力
   + C-ares：提供了异步处理 DNS 相关的能力
   + http_parser、OpenSSL、zlib等：提供包括 http 解析、SSL、数据压缩等其他的能力

---

### 要点

#### 事件驱动模型
#### 非阻塞I/O（I/O 读写狭义上就是磁盘读写）模型
#### 完善Core Java-Script的功能：
   + 文件系统
   + 模块
   + 包
   + 操作系统
   + API
   + 网络通信
#### V8引擎
   + JavaScript引擎
   + 负责解释并且执行代码

---

### 场景

#### restful API
#### 实时聊天
#### 单页App
#### 总结：
   + 运用在高并发、I/O密集、业务逻辑少的场景

---

### 优点

+ 其它开发语言（Java、Php等）每个连接都会生成一个新线程，并且需要给每个线程分配内存（假如是2MB， 8GB的服务器就仅能同事允许4000个并发连接）
+ Node是每个连接在同一个node进程中运行的事件，并不会为每个连接生成一个新的线程

---

### 缺点

+ 非IO操作，只用CPU计算的操作（比如算什么斐波那契数列之类）要一个接着一个地完成，前面那个没完成，后面的只能干等。

---

### 引用

* [廖雪峰](https://www.liaoxuefeng.com/wiki/1022910821149312/1023025235359040)

