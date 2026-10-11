## Webpack 配置方式
### 命令行配置
eg: webpack --devtool sourcemap

### 文件配置
eg: 使用webpack.config.js文件

### 搭配使用
eg: webpack --config webpack-dev.config.js 指定配置文件为webpack-dev.config.js

## 配置内容
### Entry
**content**: context: path.resolve(__dirname, 'app') 设置文件根目录，也可通过webpack --context设置
Entry类型**
string: './app/entry'
array ['./app/entry', './app/entry2'] 搭配output.library配置项使用时，只有最后一个入口文件的模块才会被导出
**Chunk的名称**
string, array类型的Entry, 只会生成一个chunk, 名字为main
object类型的Entry, 会生成多个chunk, 名字为key的名称
**动态配置Entity**
通过同步函数或者异步函数（Promise）

---

### Output

#### **filename** - 输出文件名称

内置变量名包含

+ id： chunk的唯一标识, 从0开始
+ name： chunk的名称
+ hash： chunk的唯一标识的hash值;可指定长度，默认长度为25. eg: [hash:8]
+ chunkhash： chunk内容的hash值;可指定长度，默认长度为25. eg: [chunkhash:8]
+ **tips**:  ExtractTextWebpackPlugin插件使用contenthash而不使用chunkhash的原因: 插件提取出来的内容是代码内容本身，而不是chunk
+ **chunkFileName**: 用于指定在运行过程中生成的chunk
+ 场景：使用CommonChunkPlugin或者使用import('path/module')动态加载
+ 拥有filename的内置变量名

#### path - 输出文件存放的根目录

+ 通过Node.js的path模块去获取绝对路径

​		```path: path.resolve(__dirname, 'dist_[hash]')```

+ 只有一个内置变量名:hash

#### publicPath - 配置项目发布到线上的URL前缀

+ 只有一个内置变量名:hash

#### crossOriginLoading
+ webpack输出部分代码块需要通过jsonp异步加载文件

  jsonp的原理是动态的向html中插入一个`<script src="url"></script>`标签去加载异步资源，crossOriginLoading设置插入标签的crossorigin值

> **crossorigin的取值:**
> anonymous(默认): 加载资源时不会带上用户cookies
> use-credentials: 加载资源时会带上用户cookies
>
> **tips**: 通常通过设置此值来获取异步加载的脚本执行时的详细错误信息

#### librartTarget 和 library

+ 两个通常是搭配使用
+ **libraryTarget**: 配置以何种方式导出库
+ **library**： 配置导出库的名称

#### libraryExport - 配置导出模块中的哪些子模块需要被导出

+ 只有设置了libraryTarget设置了，且为commonjs或commonjs2时才有用

---

### Module
#### 配置Loader

### Resolve

### Plugin

### DevServer

### 其它配置项

### DevTool

### 整体配置结构

### 多种配置类型