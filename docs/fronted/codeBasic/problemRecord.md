### 开发问题

* 正则匹配的last Index问题

	> detail: js的正则匹配他们匹配时都是以lastIndex所指的位置作为下次检索的起始点
	>
	> solve: (1).去掉正则的 g 全局检索属性
	>
	> ​	          (2).显性设置reg.lastIndex = 0

* html的文本标签除p标签外都是行内元素，行内元素不能设置宽高

* 递归终结的必要条件，调用递归的地方要做是否终止的判断

* 如果使用基于 javaScript 的动画，尽量使用 requestAnimationFrame

* npm私服使用。

* node.js EventEmitter()的使用

* 隐藏掉滚动条

  ```css
   -ms-overflow-style: none;  // ie
   overflow: -moz-hidden-unscrollable;  // 火狐
   &::-webkit-scrollbar { // chrome
    display: none;
   }
  ```

* background-clip 和  box-sizing
* 前端文件编码问题 文档保存格式为GBK格式, 且用户的输入法为繁体英文。
  eg: onclick 最终保存的格式为��nclick，浏览器虽然最终渲染出来是onclick，但是浏览器只是识别为一个属性，而不是一个事件。(易发生在后台开发)
* eval() 用来boolean字符串转换

* Vue enter 导致界面刷新的问题
  - `onkeypress="if(event.keyCode == 13) return false;"`
  - 原理：该输入框禁止回车键
  
* Mac 浏览器记住密码后，进入页面会自动录入账号密码，并且触发input的enter事件