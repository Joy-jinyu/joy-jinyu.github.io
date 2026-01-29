## [四种打包工具对比](https://www.cnblogs.com/3d-gis/articles/14383795.html)

### Rollup

是一个模块打包工具，可以将按照ESM(ES2015 Module)规范编写的源码构建输出以下[格式](https://blog.whyoop.com/2018/08/01/js-modules/)：

+ **IIFE**: 自执行函数, 可通过 <script> 标签加载
+ **AMD**: 通过 RequireJS 加载
+ **CommonJS**: Node 默认的模块规范, 可通过 Webpack 加载
+ **UMD**: 兼容 IIFE, AMD, CJS 三种模块规范
+ **ESM**: ES2015 Module 规范, 可用 Webpack, Rollup 加载

#### 优点

+ 支持动态导入
+ 支持tree shaking
+ Scope Hoisting，将所有小文件生成到一个大文件中，所有代码都在同一个函数作用域里。
+ 没有其他冗余代码, 执行很快。除了必要的 `cjs`, `umd` 头外，bundle 代码基本和源码差不多，也没有奇怪的 `__webpack_require__`, `Object.defineProperty` 之类的东西

#### 缺点

+ 不支持热更新
+ 对于commonjs模块，需要额外的插件将其转化为es2015供rollup 处理
+ 无法进行公共代码拆分

#### [常用插件（编译处理各类静态资源）](https://github.com/rollup/awesome)

+ rollup-plugin-typescript2
+ rollup-plugin-babel
+ rollup-plugin-uglify
+ rollup-plugin-commonjs
+ rollup-plugin-postcss
+ rollup-plugin-img
+ rollup-plugin-json

#### 参考链接

+ https://segmentfault.com/a/1190000010628352
+ https://blog.whyoop.com/2018/08/01/js-modules/
+ https://www.cnblogs.com/tugenhua0707/p/8179686.html
+ https://www.cnblogs.com/3d-gis/articles/14383795.html

### Webpack

### Gulp

>gulp 只是个 task runner，底层只是 node 脚本，不包括模块化的能力，如果需要模块化需要引入另外的框架（比如 requirejs），而 wepack 则本身就是为了模块化而出现的，压缩合并只是它附带的功能
>
>gulp比较grunt

#### gulp常用插件

+ sass的编译（gulp-sass）
+ less编译 （gulp-less）
+ 重命名（gulp-rename）
+ 自动添加css前缀（gulp-autoprefixer）
+ 压缩css（gulp-clean-css）
+ js代码校验（gulp-jshint）
+ 合并js文件（gulp-concat）
+ 压缩js代码（gulp-uglify）
+ 压缩图片（gulp-imagemin）
+ 自动刷新页面（gulp-livereload，谷歌浏览器亲测，谷歌浏览器需安装livereload插件）
+ 图片缓存，只有图片替换了才压缩（gulp-cache）
+ 更改提醒（gulp-notify）

### tsc/babel



> .vue文件最后会被编译压缩到js文件里，最后在浏览器环境中使用；webpack、gulp等打包工具是运行在node环境的；

