## Cookies

### 属性

* Domain

* Expires/Max-Age(UTC时间)

* HostOnly

  默认false

  请求的主机是否必须cookie的域完全匹配

* HttpOnly
  默认false

  脚本是否无法访问Cookie

* Path

* [SameSite](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Set-Cookie/SameSite)

  - Lax(默认值-防止csrf)
    Cookies允许与顶级一起发送，并将与第三方网站发起的GET请求一起发送
  - Strict
    Cookie只会在第一方上下文中发送，不会与第三方网站发起的请求一起发送
  - None
    Cookie将在所有上下文中发送，即允许跨域发送

* Secure

  默认false

  cookie是否只通过https协议传输

---

### 数量、大小限制

#### 数量（按每个域名）

* Safari/Webkit
  没有限制，但是如果过多，会使header大小超过限制
* IE
  50
* Firefox
  50
* Opera
  30

#### 大小(字节，包含name,value和等号)

* Safari
  4097
* FIrefox
  4096
* IE
  4095

#### 保存机制

* IE
  LRU
* Opera
  LRU
* Firefox
  随机保存

---

### [作用域](https://blog.csdn.net/ergouge/article/details/8185219)

* Domain
  标识了哪些主机可以访问该Cookies
  默认为当前域名（不包含子域名）
  指定了域名的话，一般包含子域名

  > 顶级域名：只能设置为自身域名, 能获取到domain为顶级域名的cookie
  >
  > 非顶级域名：只能设置为顶级域名和自身域名，能读取到顶级域名的cookie
  
* Path
  标识哪些虚拟目录可以访问该Cookies，默认为当前虚拟目录

  > 设置 `Path=/docs`，则以下地址都会匹配：
  >
  > - `/docs`
  > - `/docs/Web/`
  > - `/docs/Web/HTTP`
  >
  > URL组成
  >
  > * 协议部分
  > * 域名部分
  > * 端口部分
  > * 虚拟目录部分
  >   从域名的第一个`/`到最后一个`/`
  > * 文件名部分
  >   从域名的最后一个`/`开始到`?`，如果没有`?`就是到最后
  > * 锚部分
  >   从`#`开始到最后都是锚部分
  > * 参数部分
  >   从`?`到`#`之间

---

### [Session和Cookies](https://blog.csdn.net/qq_36894974/article/details/105322171?utm_medium=distribute.pc_relevant_right.none-task-blog-BlogCommendFromMachineLearnPai2-1.channel_param_right&depth_1-utm_source=distribute.pc_relevant_right.none-task-blog-BlogCommendFromMachineLearnPai2-1.channel_param_right)

---