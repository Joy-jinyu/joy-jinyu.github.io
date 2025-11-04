1. 屏幕键盘挡住输入框

   - 方案一

     + 通过onresize检测屏幕大小变动

     + document.getElementById("xxx").scrollInitoView() 或者document.activeElement.scrollIntoView()使当前输入框滑动
     + 缺点： 
       - 可能js拿不到键盘的弹起和收起事件
       - 覆盖一层的键盘弹出方式不会触发window.resize事件和onscroll事件

   - 方案二

     + 设定当前高度只有可见高的2/3，然后控制dom的高度(Top)滑动到当前activeElement的高度（Top）
     + 缺点：
       - 如果布局有fix position可能会导致布局错乱
       - 如果点击键盘上的收起键盘按钮，会导致top无法恢复，因为没有触发输入框失去焦点事件，需要点击空白处恢复。
2. html2canvas 实现截图操作
3. ios 文件无法下载的问题
4. ios video标签兼容问题（使用断点续传的方式解决），同时注意video标签适用的文件类型
5. ios和部分机型不能使用cookies（通过服务器存储数据）
6. 
7. 支付流程：调用后台支付接口 -> 后台对接相应支付接口的sdk -> redirect到相应的支付页面（第三方） -> 完成支付调取后台接口 -> 后台返回前端的路由 -> 前端根据后台返回的单号查询支付结果
8. facebook登录: 调用后台接口 -> 后台对接相应sdk -> redirect相应的登陆界面（第三方） -> 完成认证调取后台接口 -> 后台返回前端路由 -> 后台根据相应的账号密码请求后台的登陆接口
9. facebook分享（动态添加静态资源到dom） 
10. escape()，encodeURI()，encodeURIComponent()的区别
11. 骨架屏的概念与使用
12. [下载文件响应头的Content-Disposition ](https://blog.csdn.net/candyguy242/article/details/17449191)
13. 移动端适配，动态的font-size
14. 浏览器的简单请求和复杂请求(option)
15. [can I use](https://www.caniuse.com/)
