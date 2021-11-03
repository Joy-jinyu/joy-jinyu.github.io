### 目录结构

```
|—— bin                 // 系统最基本的二进制命令文件如ls cp rm ln等等
|—— boot                // 开机程序
|—— data                //
|—— dev                 // 计算机所有的硬件设备
|—— etc                 // 大部分是设置系统的配置文件，类似windows的注册表，/etc/shadow 保存着用户的账号
|—— root                // 超级用户的默认工作目录
|—— home                // 普通用户的默认工作目录
|—— lib                 // 系统用的库，如C程序库
|—— lib64               // 含许多被 /bin/ 和 /sbin/ 中的程序使用的库文件。目录 /usr/lib/ 中含有更多用于用户程序的库文件。
|—— lost+found          // 被 fsck 用来放置零散文件（没有名称的文件）
|—— media               // 系统安装可移动媒体设备的位置  @todo 新标准
|—— mnt                 // 手动安装内容的位置
|—— opt                 // 第三方开发者用来简易地安装和卸装他们的软件包
|—— proc                //
|—— run                 //
|—— sbin                // 系统命令（例如 shutdown）的贮存位置
|—— snap                //
|—— srv                 //
|—— sys                 //
|—— temp                // 用户和程序的临时目录。 /tmp 给予所有系统用户读写权
|—— usr                 // 包括与系统用户直接有关的文件和目录，例如应用程序及支持它们的库文件
|—— val                 // 用于贮存variable（或不断改变的）文件，例如日志文件和打印机假脱机文件
```

---

### 常用命令

+ netstat -tanlp
  查看正在运行的进程

---

### **Package**

|   name   |            description            |
| :------: | :-------------------------------: |
|  `lsof`  |     `netstat` 和 `ps`的结合体     |
| `nohup`  |           后台运行程序            |
| dos2unix | 转换文件的内容格式从windows到unix |
|          |                                   |

---

### 引用

#### `nohup`

+ `/dev/null` 表示空设备文件
+ 0 表示`stdin`标准输入
+ 1 表示`stdout`标准输出
+ 2 表示`stderr`标准错误
+ `eg`:  `nohup npm run dev > /dev/null 2>&1 &exit`

