### [Microsoft Edge可以用localhost访问但无法用IP访问](https://my.oschina.net/u/4000302/blog/3042858)

+ 原因：默认访问规则的限制，Windows Apps 在默认状态下无法访问本地回环端口
+ 解决方案： 管理员方式在 cmd中运行：CheckNetIsolation LoopbackExempt -a -n=Microsoft.MicrosoftEdge_8wekyb3d8bbwe

### Edge不能通过createObjectURL生成的blob链接下载的问题

+ 解决方案：msSaveOrOpenBlob（msSaveBlob）方法允许用户在客户端上保存文件 -- eg: if('msSaveOrOpenBlob' in navigator) window.navigator.msSaveOrOpenBlob(blob, filename) return