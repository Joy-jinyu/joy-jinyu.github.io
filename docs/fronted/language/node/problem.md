## [问题](https://www.cnblogs.com/wxmdevelop/p/10234556.html)

+ 为什么在浏览器中运行的 Javascript 能与操作系统进行如此底层的交互？
+ nodejs既然是单线程，如何实现异步、非阻塞I/O？
   它的单线程指的是自身java-Script运行环境是单线程，node.js也没有给java-Script创建新线程的能力；**最终实际操作还是通过libuv以及它的时间循环来执行的**
+ nodejs全是异步调用和非阻塞I/O，就真的不用管并发数了吗？
   node.js的线程池（libnv的线程池）大小可以通过UV_THERADPOOL_SIZE这个环境变量来设置，或者在代码中通过process.env.UV_THERADPOOL_SIZE来重新设置，默认值为4
+ nodejs事件驱动是如何实现的？和浏览器的event loop是一回事吗？
+ nodejs擅长什么？不擅长什么？