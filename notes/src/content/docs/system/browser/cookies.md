---
title: Cookie 详解
description: Cookie 的工作方式与各项属性（Domain、Path、Expires/Max-Age、Secure、HttpOnly、SameSite、Partitioned），HostOnly 的含义，第一方与第三方 Cookie，与 Session、Web Storage 的对比，以及防范 XSS 和 CSRF 的安全实践。
---

HTTP 是无状态的，服务器无法从协议本身知道两次请求是否来自同一个用户。Cookie 是浏览器替服务器保存的一小段数据，之后访问同一站点时自动带上，用来维持登录态、记住偏好、做统计等。这篇讲清 Cookie 每个属性的含义和默认行为、浏览器何时会发送 Cookie，以及使用 Cookie 时需要注意的安全问题。

## 基本工作方式

服务器通过响应头 `Set-Cookie` 设置 Cookie，一个头设置一个，多个 Cookie 就写多个头：

```http
HTTP/1.1 200 OK
Set-Cookie: sid=abc123; Path=/; HttpOnly; Secure; SameSite=Lax
Set-Cookie: theme=dark; Max-Age=2592000
```

之后浏览器向符合条件的地址发请求时，会在请求头 `Cookie` 中带上所有匹配的 Cookie（只有名和值，不带属性）：

```http
GET /api/profile HTTP/1.1
Cookie: sid=abc123; theme=dark
```

前端也可以通过 `document.cookie` 读写（`HttpOnly` 的 Cookie 除外）：

```js
document.cookie = 'theme=dark; Max-Age=2592000; Path=/';
console.log(document.cookie); // "theme=dark; ..."，只能读到名和值
```

`document.cookie` 的赋值一次只设置一个 Cookie，不会覆盖其他 Cookie。它的接口比较原始，读取时需要自己解析字符串。较新的浏览器提供了异步的 Cookie Store API（`cookieStore.get()` / `cookieStore.set()`），使用前需确认目标浏览器的支持情况。

一个 Cookie 由**名称 + Domain + Path** 唯一确定。名称相同但 Domain 或 Path 不同，会被当作两个不同的 Cookie 同时存在，这也是"明明删了 Cookie 却还在"的常见原因：删除时必须使用与设置时相同的 Domain 和 Path。

## 属性

### Domain

指定哪些主机可以接收这个 Cookie。

- **不设置 Domain**：Cookie 只发送给设置它的那个主机，**不包括子域名**。
- **设置了 Domain**：Cookie 会发送给该域名**及其所有子域名**。例如 `Domain=example.com` 的 Cookie，`www.example.com`、`api.example.com` 都能收到。

设置的值只能是当前主机名本身或它的上级域名：`a.example.com` 可以设置 `Domain=example.com`，不能设置为 `other.com`，也不能设置为 `com` 这样的公共后缀（浏览器会参考公共后缀列表，拒绝 `com`、`co.uk`、`github.io` 这类域名）。旧规范中 Domain 值前面的点（`.example.com`）在现在的规范里会被忽略，写不写效果相同。

### HostOnly

HostOnly 不是一个可以在 `Set-Cookie` 中设置的属性，而是浏览器内部记录的标志：

- 如果 `Set-Cookie` **没有**带 Domain，浏览器把这个 Cookie 标记为 host-only，只有请求的主机与设置时的主机**完全一致**才发送。
- 如果带了 Domain，host-only 为 false，按域名匹配规则发送给该域名及子域名。

在 DevTools 的 Application → Cookies 面板中看到的 Domain 列，host-only Cookie 显示为不带点的主机名。所以"为了安全，不要随便设置 Domain"：不设置反而范围最小。

### Path

指定 URL 路径前缀，只有请求路径匹配时才发送。`Path=/docs` 匹配 `/docs`、`/docs/`、`/docs/web/http`，不匹配 `/`、`/docsets`（路径要按 `/` 分段匹配）。

不设置 Path 时，默认值是当前请求 URL 的"目录部分"：例如在 `/docs/web/page.html` 的响应中设置，默认 Path 为 `/docs/web`。大多数情况下应该显式写 `Path=/`。

注意 Path 不是安全边界：同源的其他路径页面依然可以通过嵌入 iframe 等方式读到它，不要依靠 Path 隔离敏感数据。

### Expires 与 Max-Age

控制 Cookie 的有效期：

- `Expires=Wed, 21 Oct 2026 07:28:00 GMT`：过期的具体时间点，HTTP 日期格式，使用 GMT。
- `Max-Age=3600`：从现在起多少秒后过期。值为 0 或负数时立即删除。
- 两者同时存在时，`Max-Age` 优先。
- 都不设置时为**会话 Cookie**：浏览器关闭时删除。但浏览器的"恢复上次打开的页面"功能可能会让会话 Cookie 保留下来。

`Expires` 依赖客户端时钟，客户端时间不准时会出偏差，`Max-Age` 没有这个问题。浏览器也可能限制 Cookie 的最长有效期，设置很长的有效期不一定生效。

删除 Cookie 的方法就是用相同的名称、Domain、Path 再设置一次，并让它过期：

```js
document.cookie = 'theme=; Max-Age=0; Path=/';
```

### Secure

带 `Secure` 的 Cookie 只会通过 HTTPS 请求发送（`localhost` 通常被视为安全上下文作为例外，方便本地开发）。非 HTTPS 页面不能设置带 `Secure` 的 Cookie。

### HttpOnly

带 `HttpOnly` 的 Cookie 不能被 JavaScript 通过 `document.cookie` 读写，只在 HTTP 请求中自动携带。用于存放会话 ID、令牌等敏感凭据，即使页面存在 XSS 漏洞，攻击脚本也读不到它。

### SameSite

控制跨站请求时是否发送 Cookie，是防御 CSRF 的重要手段。先区分"同站"和"跨站"：

- **站点（site）** 由协议 + 可注册域名（eTLD+1）组成，比如 `https://example.com`。`https://a.example.com` 和 `https://b.example.com` 是同站的。
- 现代浏览器还会比较协议：`http://example.com` 和 `https://example.com` 视为跨站。
- 注意"同站"不同于"同源"：同源要求协议、主机、端口完全相同，范围更严格。

三个取值：

| 取值 | 行为 |
| --- | --- |
| `Strict` | 只在同站请求中发送。从其他站点点击链接跳转过来，这次请求也不会带上 Cookie |
| `Lax` | 同站请求发送；跨站时只在**顶级导航且使用安全方法（如 GET）**时发送，例如点击链接跳转。跨站的 iframe、图片、`fetch`、POST 表单提交都不发送 |
| `None` | 同站和跨站请求都发送，**必须同时设置 `Secure`**，否则 Cookie 会被拒绝 |

默认行为：没有设置 SameSite 时，Chrome 等 Chromium 系浏览器按 `Lax` 处理；但这不是所有浏览器的统一行为，各浏览器的默认值并不一致。因此最好**显式设置 SameSite**，不要依赖默认值。

选择建议：

- 会话 Cookie 一般用 `Lax`，既能防住大部分 CSRF，又不影响从外部链接进入时保持登录。
- 对安全要求很高、不需要外部链接直接进入登录态的场景，用 `Strict`。
- 确实需要在第三方上下文中使用（比如嵌入到其他站点的 iframe 组件、跨站单点登录），才用 `None; Secure`。

### Partitioned

`Partitioned` 属性用于 CHIPS（Cookies Having Independent Partitioned State，具有独立分区状态的 Cookie）。带这个属性的第三方 Cookie 会按**顶级站点**分区存储：同一个嵌入服务在 A 站和 B 站中拿到的是两份互不相通的 Cookie，可以用于嵌入组件自身的状态保持，但无法用于跨站追踪。

```http
Set-Cookie: __Host-widget=1; Secure; Path=/; SameSite=None; Partitioned
```

它要求同时设置 `Secure`。是否支持取决于浏览器，使用前应检查兼容性。

### Cookie 前缀

名称以特定前缀开头的 Cookie，浏览器会强制检查属性：

| 前缀 | 要求 |
| --- | --- |
| `__Secure-` | 必须带 `Secure`，且从 HTTPS 页面设置 |
| `__Host-` | 必须带 `Secure`、从 HTTPS 页面设置、**不能**带 Domain、`Path` 必须为 `/` |

`__Host-` 前缀可以保证这个 Cookie 只属于当前主机，不会被子域名覆盖或伪造，适合存放会话 ID。

## 大小与数量限制

Cookie 的大小和数量有限制，不同浏览器的具体数值不同：

- 单个 Cookie（名 + 值 + 属性）大约在 **4KB** 量级。规范 RFC 6265 要求浏览器至少支持每个 Cookie 4096 字节、每个域名至少 50 个 Cookie、总共至少 3000 个 Cookie，浏览器实际允许的通常不低于这些值。
- 超出限制时，浏览器会按各自的策略淘汰旧 Cookie。
- 服务器对请求头的总大小也有限制，Cookie 过多过大会导致请求失败（常见 400 或 431 错误）。

更重要的是性能：Cookie 会随每个匹配的请求发送，包括图片、脚本等静态资源。因此 Cookie 应尽量小，静态资源可以放在不带 Cookie 的独立域名下。

## 第一方与第三方 Cookie

"第一方""第三方"是相对于用户当前访问的页面（地址栏中的站点）而言的：

- **第一方 Cookie**：属于当前访问站点的 Cookie。
- **第三方 Cookie**：页面中嵌入的其他站点的资源（iframe、图片、脚本请求）所设置或携带的 Cookie。例如在 `news.com` 上加载了 `ads.com` 的广告，`ads.com` 的 Cookie 就是第三方 Cookie。

第三方 Cookie 长期被用于跨站追踪用户行为。出于隐私保护，Safari 和 Firefox 默认阻止或隔离第三方 Cookie，Chromium 系浏览器的相关策略也几经调整，用户还可以在设置中手动阻止。新开发的功能不要依赖第三方 Cookie，嵌入场景可以考虑 `Partitioned` Cookie、Storage Access API 等替代方案。

## Cookie 与 Session

Session（会话）是服务端维护用户状态的机制，Cookie 是客户端存储的机制，二者常配合使用：

1. 用户登录成功，服务器创建一条会话记录（保存在内存、Redis 或数据库中），生成随机的会话 ID。
2. 服务器通过 `Set-Cookie: sid=<会话ID>; HttpOnly; Secure; SameSite=Lax` 把 ID 交给浏览器。
3. 之后的请求自动带上 `sid`，服务器根据 ID 查找会话数据，确认用户身份。
4. 退出登录时，服务器删除会话记录，并让 Cookie 过期。

| 方面 | Cookie | Session |
| --- | --- | --- |
| 存储位置 | 浏览器 | 服务器 |
| 存储内容 | 少量字符串 | 可以存较多数据 |
| 安全性 | 内容可能被用户查看和篡改 | 数据在服务端，客户端只持有 ID |
| 服务器开销 | 无 | 需要存储，多台服务器之间要共享会话存储 |

Cookie 只是传递会话 ID 的一种载体，也可以通过 URL 参数或自定义请求头传递，但 Cookie 配合 `HttpOnly` 最安全方便。另一种常见方案是 JWT 这类自包含令牌，服务端不存会话，靠签名校验；令牌同样可以放在 `HttpOnly` Cookie 中，以免被脚本读取。

## 与 Web Storage、IndexedDB 的对比

| 方面 | Cookie | localStorage | sessionStorage | IndexedDB |
| --- | --- | --- | --- | --- |
| 容量 | 约 4KB / 个 | 通常为几 MB（按源计算） | 通常为几 MB | 大得多，受磁盘空间和浏览器配额限制 |
| 生命周期 | 按 Expires/Max-Age，或会话结束 | 永久，除非主动删除 | 标签页关闭即清除 | 永久，除非主动删除 |
| 作用范围 | 按 Domain、Path 匹配，可跨子域 | 同源 | 同源且同一标签页 | 同源 |
| 是否随请求发送 | 自动携带 | 否 | 否 | 否 |
| JS 访问 | `document.cookie`（`HttpOnly` 除外） | 同步 API | 同步 API | 异步 API |
| 数据类型 | 字符串 | 字符串 | 字符串 | 结构化数据，支持对象、二进制、索引、事务 |
| 能否在 Worker 中使用 | 不能用 `document.cookie`；Service Worker 中可用 Cookie Store API | 不能 | 不能 | 可以 |

选择建议：

- 需要服务端读取的身份凭据：`HttpOnly` Cookie。
- 前端自己使用的少量配置、偏好：`localStorage`。
- 只在当前标签页有效的临时数据（比如多步表单的中间状态）：`sessionStorage`。
- 大量数据、离线缓存、需要查询的数据：IndexedDB。

`localStorage` 中的数据任何同源脚本都能读到，**不要在其中存放令牌等敏感数据**，一旦有 XSS 就会泄露。

## 安全实践

### 防范 XSS 窃取 Cookie

XSS（跨站脚本攻击）是指攻击者设法让恶意脚本在正常用户访问的页面中执行，根源通常是把不可信的数据未经处理就输出到页面。脚本一旦执行，就可以读取 Cookie、冒充用户发请求。

- 会话 Cookie 设置 `HttpOnly`，让脚本读不到。
- 对输出到 HTML 的用户数据进行转义；避免使用 `innerHTML`、`eval` 等直接执行字符串的接口，确实需要渲染富文本时使用成熟的清洗库。
- 配置内容安全策略（CSP），限制可执行脚本的来源。

`HttpOnly` 只能防止 Cookie 被读取，攻击脚本仍然可以在页面中以用户身份发请求，所以根本上还是要防止 XSS 本身。

### 防范 CSRF

CSRF（跨站请求伪造）是指用户已登录 A 站，又访问了恶意站点 B，B 页面诱导浏览器向 A 站发请求（比如自动提交的表单），浏览器会自动带上 A 站的 Cookie，A 站误以为是用户本人的操作。攻击者并不能读取 Cookie，只是"借用"了浏览器自动携带 Cookie 的行为。旧资料中的 XSRF 是 CSRF 的另一种写法，指的是同一种攻击。

防护手段：

- **SameSite**：设置为 `Lax` 或 `Strict`，跨站的 POST 请求和子资源请求不会携带 Cookie，能防住大部分 CSRF。
- **CSRF Token**：服务器生成随机令牌嵌入页面或表单，提交时一并带上，服务器校验。恶意站点无法读取这个令牌。
- **校验 `Origin` / `Referer` 请求头**：拒绝来自非预期来源的修改类请求。
- **不要用 GET 执行修改操作**：GET 请求在 `Lax` 下的跨站顶级导航中仍会携带 Cookie。
- 关键操作（转账、修改密码）要求二次确认或重新输入密码。

### 推荐的会话 Cookie 写法

```http
Set-Cookie: __Host-sid=<随机且足够长的ID>; Path=/; Secure; HttpOnly; SameSite=Lax
```

此外：会话 ID 使用安全的随机数生成；登录成功后重新生成会话 ID，防止会话固定攻击；设置合理的有效期，退出登录时让服务端会话失效。

## 小结

- 服务器用 `Set-Cookie` 设置，浏览器在匹配的请求中通过 `Cookie` 头自动携带；名称、Domain、Path 三者确定一个 Cookie。
- 不设 Domain 时为 host-only，只发给当前主机；设了 Domain 则包含所有子域名。
- `Max-Age` 优先于 `Expires`，都不设为会话 Cookie；`Secure` 限制只走 HTTPS，`HttpOnly` 禁止脚本访问。
- SameSite 有 `Strict`、`Lax`、`None` 三个值，`None` 必须配合 `Secure`；各浏览器默认值不一致，应显式设置。
- 单个 Cookie 约 4KB，会随每个请求发送，应保持精简；新功能不要依赖第三方 Cookie。
- 身份凭据放 `HttpOnly` Cookie，配合 SameSite、CSRF Token、CSP 防范 CSRF 和 XSS。

## 参考

- [MDN：HTTP Cookie](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Cookies)
- [MDN：Set-Cookie](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Set-Cookie)
- [MDN：Web Storage API](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Storage_API)
- [MDN：IndexedDB](https://developer.mozilla.org/zh-CN/docs/Web/API/IndexedDB_API)
- [RFC 6265：HTTP State Management Mechanism](https://www.rfc-editor.org/rfc/rfc6265)
