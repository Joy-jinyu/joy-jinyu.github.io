### **`Webpack`**

---



|                        keyword                         |                       description                        |
| :----------------------------------------------------: | :------------------------------------------------------: |
|                        `chalk`                         |                                                          |
|                        `semver`                        |                                                          |
|                    `child_process`                     |                                                          |
|                         `opn`                          |                    调用浏览器打开网址                    |
|     [`eslint`](https://cn.eslint.org/docs/rules/)      | <details><summary>代码规则校验</summary>sadasd</details> |
| [npx](http://www.ruanyifeng.com/blog/2019/02/npx.html) |                          见引用                          |
|                         moment                         |                   时间戳和时间转换使用                   |
|                          yarn                          |                          见引用                          |
|                                                        |                                                          |

### 引用

---

#### `eslint`

#### `npx`

##### 调用项目安装的模块

+ 原理：会到`node_modules/.bin`路径和环境变量`$PATH`里面，检查命令是否存在

##### 避免全局安装模块

+ 原理：会将依赖包下载到一个临时目录，使用以后再删掉

##### 使用不同的node版本

+ 用法：`npx node@0.12.8 -v`
+ 原理：从 npm 下载这个版本的`node`,使用后再删掉

##### 执行`Git Hub`上的源码模块

+ 注意：远程代码必须是一个模块，即必须包含`package.json`和入口脚本

##### 参数

+ `--no-install`: 强制使用本地模块，不下载远程模块
+ `--ignore-existing`：强制使用远程模块，不使用本地模块
+ `-p`：指定要安装的模块
+ `-c`：指定所有命令都由`npx`执行，将环境变量带入要执行的命令（npm 的环境变量带入 npx 命令）

#### yarn

```shell
npm i -g yarn
yarn config set global-folder ""
yarn config set cache-folder ""
yarn global dir
yarn global bin
yarn config set registry https://registry.npm.taobao.com
```

