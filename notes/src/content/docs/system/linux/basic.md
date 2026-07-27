---
title: Linux 常用命令
description: 前端工程师日常会用到的 Linux 命令：目录结构、文件操作、文本查看与搜索、权限、进程、网络、磁盘、压缩、管道与重定向、环境变量，以及 ssh 和 scp。
---

部署服务、排查线上问题、写 CI 脚本时，免不了要在 Linux 终端里操作。这篇按用途整理最常用的命令和参数，每个命令只列高频用法，详细选项可以用 `man <命令>` 或 `<命令> --help` 查看。示例以 Bash 为准，大部分在 macOS 的终端中也能使用（部分参数有差异）。

## 目录结构

Linux 遵循文件系统层次结构标准（FHS），所有内容都挂在根目录 `/` 下：

| 目录 | 用途 |
| --- | --- |
| `/bin`、`/sbin` | 基础命令（`ls`、`cp`）和系统管理命令（`shutdown`）；很多发行版中它们已链接到 `/usr/bin`、`/usr/sbin` |
| `/boot` | 内核和引导程序 |
| `/dev` | 设备文件，如磁盘 `/dev/sda`、空设备 `/dev/null` |
| `/etc` | 系统和软件的配置文件，如 `/etc/passwd`（用户信息）、`/etc/shadow`（密码哈希）、`/etc/nginx/` |
| `/home` | 普通用户的家目录，如 `/home/alice` |
| `/root` | root 用户的家目录 |
| `/lib`、`/lib64` | 系统程序使用的共享库 |
| `/media`、`/mnt` | 可移动设备的自动挂载点；手动挂载的临时挂载点 |
| `/opt` | 第三方软件的安装位置 |
| `/proc`、`/sys` | 内核提供的虚拟文件系统，反映进程和硬件信息，如 `/proc/cpuinfo` |
| `/run` | 运行时数据，如 PID 文件，重启后清空 |
| `/srv` | 对外提供服务的数据 |
| `/tmp` | 临时文件，所有用户可写，可能在重启时被清空 |
| `/usr` | 用户程序和只读数据，`/usr/bin`、`/usr/lib`、`/usr/local`（本机手动安装的软件） |
| `/var` | 经常变化的数据，如日志 `/var/log`、缓存、数据库文件 |
| `/lost+found` | 文件系统检查（fsck）时找回的文件碎片 |

`/snap` 是 Ubuntu 上 snap 包的安装目录，不属于标准目录；`/data` 之类则是使用者自行创建的。

## 文件与目录

```bash
pwd                    # 当前所在目录
cd /var/log            # 切换目录；cd ~ 回家目录，cd - 回上一个目录
ls -lah                # 列出文件：详细信息、包含隐藏文件、人类可读的大小
mkdir -p a/b/c         # 递归创建目录
touch file.txt         # 创建空文件或更新修改时间
cp -r src/ dest/       # 复制目录
mv old.txt new.txt     # 移动或重命名
rm file.txt            # 删除文件
rm -r dir/             # 删除目录
ln -s /opt/app/bin/app /usr/local/bin/app   # 创建软链接
```

:::danger
`rm` 删除的文件不会进入回收站。`rm -rf` 使用变量拼接路径时要格外小心，变量为空时 `rm -rf "$DIR/"` 可能变成删除根目录下的内容。脚本里可以用 `set -u` 让未定义变量直接报错。
:::

## 查看与搜索文本

```bash
cat file.txt               # 输出整个文件
less file.log              # 分页查看：空格翻页，/关键词 搜索，n 下一个，q 退出
head -n 20 file.txt        # 前 20 行
tail -n 50 app.log         # 后 50 行
tail -f app.log            # 持续输出新增内容，看实时日志常用
wc -l file.txt             # 统计行数
```

### grep：按内容搜索

```bash
grep "error" app.log            # 包含 error 的行
grep -i "error" app.log         # 忽略大小写
grep -n "error" app.log         # 显示行号
grep -v "debug" app.log         # 反选：不包含 debug 的行
grep -r "TODO" src/             # 递归搜索目录
grep -E "error|warn" app.log    # 扩展正则
grep -C 3 "Exception" app.log   # 同时显示前后 3 行上下文
```

在代码仓库中搜索，`ripgrep`（命令 `rg`）速度更快，并且默认忽略 `.gitignore` 中的文件，可以单独安装使用。

### find：按文件名和属性搜索

```bash
find . -name "*.log"                     # 按名称
find . -type d -name node_modules        # 只找目录
find /var/log -mtime -1                  # 最近 1 天内修改过的
find . -size +100M                       # 大于 100MB 的文件
find . -name "*.tmp" -delete             # 找到后删除
find . -name "*.js" -exec wc -l {} +     # 对结果执行命令
```

### 其他文本处理

```bash
sort file.txt | uniq -c | sort -rn   # 统计重复行并按次数排序
cut -d ',' -f 1 data.csv             # 按逗号分隔取第 1 列
awk '{print $1}' access.log          # 取每行第 1 个字段
sed -n '10,20p' file.txt             # 打印第 10 到 20 行
sed -i 's/old/new/g' file.txt        # 原地替换（macOS 上要写 sed -i '' ...）
dos2unix deploy.sh                   # 把 Windows 换行（CRLF）转为 Unix 换行（LF），需单独安装
```

## 权限

`ls -l` 输出的第一列表示文件类型和权限：

```text
-rwxr-xr-- 1 alice dev 1024 Jan 1 10:00 deploy.sh
```

| 位置 | 含义 |
| --- | --- |
| 第 1 位 | 文件类型：`-` 普通文件，`d` 目录，`l` 软链接 |
| 第 2–4 位 | 所有者（user）权限 |
| 第 5–7 位 | 所属组（group）权限 |
| 第 8–10 位 | 其他人（others）权限 |

`r`、`w`、`x` 分别表示读、写、执行，对应数字 4、2、1，三者相加就是一组权限的数字表示。上例为 `754`。

对目录来说，含义略有不同：`r` 表示能列出目录内容，`w` 表示能在目录中创建、删除、重命名文件，`x` 表示能进入目录（`cd`）和访问其中的文件。

```bash
chmod 755 deploy.sh      # rwxr-xr-x
chmod +x deploy.sh       # 给所有人加执行权限
chmod u+x,g-w file       # 所有者加执行，组去掉写
chmod -R 644 dir/        # 递归修改（注意会把目录的 x 也去掉，通常不是想要的结果）
chown alice:dev file     # 修改所有者和组
chown -R www-data:www-data /var/www/site
```

常见权限：脚本 `755`，普通文件 `644`，私钥文件 `600`（ssh 要求私钥只能被所有者读写）。

`sudo` 以 root 身份执行命令。不要为了省事给目录 `777` 权限，那意味着任何用户都能修改其中的文件。

## 进程

```bash
ps aux                       # 查看所有进程
ps aux | grep node           # 找到 node 相关进程
pgrep -fl node               # 更直接地按名称找进程
top                          # 实时查看 CPU、内存占用，按 q 退出；htop 更友好（需安装）
kill 12345                   # 发送 SIGTERM，请求进程正常退出
kill -9 12345                # 发送 SIGKILL，强制结束，进程无法做清理
pkill -f "node server.js"    # 按命令行匹配结束进程
```

优先使用 `kill`（SIGTERM），给程序处理退出逻辑的机会，进程无响应时才用 `kill -9`。

### 后台运行

```bash
node server.js &                               # 放到后台，终端关闭时可能被结束
nohup node server.js > app.log 2>&1 &          # 忽略挂断信号，退出终端后继续运行
jobs                                           # 查看当前终端的后台任务
fg %1                                          # 把任务调回前台
```

`nohup` 只适合临时使用。长期运行的服务应交给 systemd 或 PM2 这类进程管理工具，它们能在崩溃后自动重启、开机自启，见 [Linux 软件安装与管理](/notes/system/linux/soft.html)。

## 网络

```bash
curl https://example.com                   # 发送 GET 请求
curl -I https://example.com                # 只看响应头
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"test"}' https://api.example.com/users
curl -o file.zip https://example.com/a.zip # 下载保存为文件
curl -L https://example.com                # 跟随重定向
curl -v https://example.com                # 打印详细过程，排查 TLS、头部问题

ping -c 4 example.com                      # 测试连通性，发送 4 个包
ss -tlnp                                   # 查看监听中的 TCP 端口及对应进程
ss -tnp                                    # 查看已建立的 TCP 连接
lsof -i :3000                              # 查看谁占用了 3000 端口
dig example.com                            # 查询 DNS 解析
```

`ss` 是 `netstat` 的现代替代，很多新系统默认不再安装 `netstat`。旧笔记中的 `netstat -tanlp` 用于查看 TCP 连接和监听端口及其所属进程（并非"查看正在运行的进程"），对应的新写法就是 `ss -tanp`。查看端口对应的进程信息通常需要 root 权限。

## 磁盘

```bash
df -h                    # 各分区的容量和使用率
du -sh *                 # 当前目录下每一项占用的空间
du -sh node_modules      # 某个目录的总大小
du -h --max-depth=1 /var | sort -h   # 一级子目录按大小排序（macOS 用 -d 1）
free -h                  # 内存使用情况
```

磁盘满时，常见的罪魁祸首是 `/var/log` 下的日志、Docker 镜像和容器（`docker system df` 查看）、构建缓存。

## 压缩与解压

`tar` 用于打包，结合 gzip 等压缩：

```bash
tar -czvf dist.tar.gz dist/         # 打包并用 gzip 压缩
tar -xzvf dist.tar.gz               # 解压到当前目录
tar -xzvf dist.tar.gz -C /opt/app   # 解压到指定目录
tar -tzvf dist.tar.gz               # 只查看内容不解压
```

参数含义：`c` 创建、`x` 解包、`t` 列出、`z` 使用 gzip、`v` 显示过程、`f` 指定文件名（`f` 后面紧跟文件名）。新版 GNU tar 解压时可以自动识别压缩格式，`-xf` 即可。

zip 格式：

```bash
zip -r site.zip dist/
unzip site.zip -d target/
```

## 管道与重定向

每个进程默认有三个标准流，用文件描述符表示：

| 编号 | 名称 | 默认指向 |
| --- | --- | --- |
| 0 | 标准输入 stdin | 键盘 |
| 1 | 标准输出 stdout | 终端 |
| 2 | 标准错误 stderr | 终端 |

```bash
cmd > out.txt          # 标准输出写入文件（覆盖）
cmd >> out.txt         # 追加
cmd 2> err.txt         # 标准错误写入文件
cmd > all.log 2>&1     # 标准输出和标准错误都写入 all.log
cmd &> all.log         # Bash 中的简写，效果同上
cmd > /dev/null 2>&1   # 丢弃所有输出
cmd < input.txt        # 从文件读取标准输入
cmd1 | cmd2            # 管道：cmd1 的标准输出作为 cmd2 的标准输入
cmd | tee out.txt      # 同时输出到终端和文件
```

`2>&1` 的意思是"把 2 号描述符重定向到 1 号当前指向的地方"，所以顺序很重要：`> file 2>&1` 两者都进文件；`2>&1 > file` 则标准错误仍输出到终端。

`/dev/null` 是一个空设备，写入它的数据都会被丢弃。

组合示例：

```bash
# 统计访问日志中请求最多的 10 个 IP
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10
```

## 环境变量

```bash
echo $PATH                     # 查看变量
env                            # 列出所有环境变量
export NODE_ENV=production     # 设置并导出给子进程
NODE_ENV=test npm test         # 只对这一条命令生效
unset NODE_ENV                 # 删除变量
which node                     # 查看命令的实际路径
```

`export` 只在当前 shell 会话中有效。要永久生效，写入 shell 的配置文件：Bash 是 `~/.bashrc`（登录 shell 读 `~/.bash_profile` 或 `~/.profile`），Zsh 是 `~/.zshrc`。修改后执行 `source ~/.bashrc` 立即生效。

`PATH` 决定了 shell 去哪些目录查找命令，追加目录时保留原值：

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## ssh 与 scp

```bash
ssh user@192.0.2.10               # 登录远程服务器
ssh -p 2222 user@host             # 指定端口
ssh user@host "df -h"             # 远程执行一条命令

ssh-keygen -t ed25519 -C "me@example.com"   # 生成密钥对
ssh-copy-id user@host                       # 把公钥添加到服务器的 ~/.ssh/authorized_keys
```

配置了公钥后即可免密登录。在 `~/.ssh/config` 中为常用服务器起别名：

```text
Host web
    HostName 192.0.2.10
    User deploy
    Port 22
    IdentityFile ~/.ssh/id_ed25519
```

之后 `ssh web` 即可登录。

文件传输：

```bash
scp dist.tar.gz web:/opt/app/          # 上传
scp web:/var/log/app.log ./            # 下载
scp -r dist/ web:/opt/app/             # 上传目录
rsync -avz --delete dist/ web:/var/www/site/   # 增量同步，部署静态资源常用
```

`rsync` 只传输变化的部分，大目录反复同步时比 `scp` 快很多。注意 `dist/` 带斜杠表示同步目录里的内容，不带斜杠表示同步目录本身。

安全建议：服务器上关闭密码登录、禁止 root 直接登录，只允许密钥认证；私钥文件权限设为 `600`。

## 小结

- 记住几个关键目录：配置在 `/etc`，日志在 `/var/log`，自装软件在 `/usr/local` 或 `/opt`，临时文件在 `/tmp`。
- 查日志用 `tail -f`、`less`、`grep`，找文件用 `find`，统计用管道组合 `sort`、`uniq`、`awk`。
- 权限位 `rwx` 对应 4、2、1，常用 `755`、`644`、`600`，避免 `777`。
- 结束进程优先 `kill`（SIGTERM），长期服务交给 systemd 或 PM2，而不是 `nohup`。
- 查端口用 `ss -tlnp` 或 `lsof -i`，`2>&1` 的顺序决定重定向结果。
- 远程操作用密钥登录的 ssh，传文件用 `scp` 或 `rsync`。

## 参考

- [GNU Coreutils 手册](https://www.gnu.org/software/coreutils/manual/)
- [GNU Bash 参考手册](https://www.gnu.org/software/bash/manual/)
- [OpenSSH 手册页](https://www.openssh.com/manual.html)
- [curl 文档](https://curl.se/docs/)
