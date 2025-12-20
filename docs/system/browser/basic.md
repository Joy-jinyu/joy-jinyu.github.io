## 浏览器内核

### Trident(IE内核)

   + IE浏览器

### Gecko(Firefox内核)

   + Firefox浏览器

### Webkit(Safari内核)

   + Safari浏览器

### Chromium(谷歌浏览器 Blink?)

   + 基于Webkit内核的
   + 浏览器： 谷歌浏览器、360浏览器、猎豹浏览器、腾讯浏览器等

## URL最大长度

## Safari: 80000

### Opera: 190000

### Chrome: 8182

### Apache: 8182

### IIS:16384

### IE: 2038

## 获取dom元素高度和宽度

### body

   + 可见区域高：clientHeight
   + 可见区域宽：clientWidth
   + 可见区域高（包括边线的高）：offsetHeight
   + 可见区域的宽（包括边线的宽）：offsetWidth
   + 正文宽：scrollWidth
   + 正文高：scrollHeight
   + 滚动条（滑动标识）距离顶部：offsetTop
   + 滚动条（滑动标识）距离左侧：offsetLeft

### 元素

   + 实际高度：offsetHeight
   + 实际宽度：offsetWidth
   + 距离左侧：offsetLeft
   + 距离顶部：offsetTop

---

## 安全

### XSS(Cross Site Scripting) - 跨站脚本攻击

**主要原理**：嵌入恶意脚本代码到正常用户会访问到的页面

过于信任客户端提交的数据

### CSRF(Cross-site request forgery) - 跨站请求伪造

**主要原理**：攻击者盗用了你的身份，以你的名义发送恶意请求

在没有关闭相关网页的情况下，点击其他人发来的CSRF链接，利用客户端的cookie直接向服务器发送请求

### XSRF