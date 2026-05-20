---
title: Linux 软件安装与管理
description: 在 Linux 上安装和管理软件：apt 与 dnf/yum 包管理器、从源码编译安装、用 systemd 管理服务、用版本管理器安装 Node.js，以及 Nginx 的安装与静态站点、反向代理配置示例。
---

在服务器上装软件，首选发行版自带的包管理器，其次是官方提供的安装方式，最后才考虑自己编译。装好之后，长期运行的服务交给 systemd 管理。这篇按这个顺序整理常用操作，并以 Node.js 和 Nginx 为例走一遍前端部署中最常见的安装与配置。

## 包管理器

不同发行版家族使用不同的包格式和包管理器：

| 发行版 | 包格式 | 包管理器 |
| --- | --- | --- |
| Debian、Ubuntu | `.deb` | `apt`（底层 `dpkg`） |
| RHEL、CentOS Stream、Rocky Linux、AlmaLinux、Fedora | `.rpm` | `dnf`（底层 `rpm`）；较老的系统使用 `yum` |
| Alpine（常见于 Docker 镜像） | `.apk` | `apk` |

查看发行版信息：`cat /etc/os-release`。

包管理器的好处：自动处理依赖、来源可信（软件源签名校验）、可以统一升级和卸载。

### apt 常用命令

```bash
sudo apt update                 # 更新软件源索引（安装前先执行）
sudo apt upgrade                # 升级已安装的软件
sudo apt install nginx curl     # 安装
sudo apt remove nginx           # 卸载，保留配置文件
sudo apt purge nginx            # 卸载并删除配置文件
sudo apt autoremove             # 清理不再需要的依赖
apt search redis                # 搜索
apt show nginx                  # 查看包信息
apt list --installed            # 列出已安装的包
dpkg -L nginx                   # 查看某个包安装了哪些文件
```

### dnf / yum 常用命令

```bash
sudo dnf check-update           # 检查可用更新
sudo dnf upgrade                # 升级
sudo dnf install nginx          # 安装
sudo dnf remove nginx           # 卸载
dnf search redis                # 搜索
dnf info nginx                  # 查看包信息
dnf list installed              # 列出已安装的包
rpm -ql nginx                   # 查看某个包安装了哪些文件
```

在使用 `dnf` 的系统上，`yum` 命令通常仍然可用（指向 dnf），用法基本一致。RHEL 系发行版的官方软件源比较保守，很多软件需要额外启用 EPEL 源或使用软件官方提供的仓库。

### 添加第三方软件源

官方源中的版本可能偏旧。很多软件（Nginx、MySQL、Docker 等）提供自己的软件源，按其官方文档添加源和签名密钥后，就能用包管理器安装和升级新版本。只添加可信来源的软件源。

## 从源码编译安装

包管理器中没有或版本不合适时，可以从源码编译。以使用 Autotools 的传统项目为例，一般步骤：

```bash
# 1. 安装编译工具链
sudo apt install build-essential        # Debian/Ubuntu
sudo dnf groupinstall "Development Tools"   # RHEL 系

# 2. 下载并解压源码
tar -xzf foo-1.0.tar.gz
cd foo-1.0

# 3. 配置：检查依赖、生成 Makefile，--prefix 指定安装位置
./configure --prefix=/usr/local

# 4. 编译，-j 指定并行任务数
make -j"$(nproc)"

# 5. 安装到 prefix 指定的目录
sudo make install
```

注意事项：

- `configure` 报缺少某个库时，通常需要安装对应的开发包，Debian 系命名为 `libxxx-dev`，RHEL 系为 `xxx-devel`。
- 使用 CMake 的项目步骤是 `cmake -B build`、`cmake --build build`、`cmake --install build`；具体以项目的 README 为准。
- 源码安装的软件不受包管理器管理，升级和卸载都要手动处理，安全更新也需要自己跟进。如非必要，优先用包管理器或官方二进制包。

## 用 systemd 管理服务

现在主流发行版都使用 systemd 作为初始化系统和服务管理器。每个服务对应一个 unit 文件，用 `systemctl` 控制。

### 常用命令

```bash
sudo systemctl start nginx        # 启动
sudo systemctl stop nginx         # 停止
sudo systemctl restart nginx      # 重启
sudo systemctl reload nginx       # 重新加载配置（服务支持时，不中断连接）
systemctl status nginx            # 查看状态和最近日志
sudo systemctl enable nginx       # 设置开机自启
sudo systemctl enable --now nginx # 设置开机自启并立即启动
sudo systemctl disable nginx      # 取消开机自启
systemctl list-units --type=service --state=running   # 列出运行中的服务

journalctl -u nginx               # 查看某个服务的日志
journalctl -u nginx -f            # 实时跟踪日志
journalctl -u nginx --since "1 hour ago"
```

### 为 Node.js 应用编写服务

把一个 Node.js 服务注册为 systemd 服务，就能获得开机自启、崩溃自动重启和统一的日志管理。创建 `/etc/systemd/system/myapp.service`：

```ini
[Unit]
Description=My Node.js App
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/myapp
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node /opt/myapp/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload        # 修改 unit 文件后必须执行
sudo systemctl enable --now myapp
systemctl status myapp
```

要点：

- 用普通用户（`User=`）运行，不要用 root。
- `ExecStart` 中要写可执行文件的**绝对路径**。用 nvm 等版本管理器安装的 Node.js 位于用户家目录下，路径中带版本号，升级后要同步修改；服务器上运行服务时，也可以改用发行版或 NodeSource 等软件源安装的系统级 Node.js。
- 应用的标准输出和标准错误会进入 journal，用 `journalctl -u myapp` 查看。

也可以用 PM2 等 Node.js 进程管理器，它们提供集群模式、日志切割等功能，本身也可以配置为由 systemd 拉起。

## 安装 Node.js

### 推荐：使用版本管理器

开发机和需要切换多个版本的环境，推荐用版本管理器安装，不需要 `sudo`，切换版本也方便。

**nvm**（Node Version Manager）：

```bash
# 安装脚本的地址和版本号见 nvm 仓库 README，安装后重新打开终端
nvm install --lts          # 安装最新 LTS 版本
nvm install 20             # 安装指定主版本
nvm use 20                 # 切换版本
nvm alias default 20       # 设置默认版本
nvm ls                     # 查看已安装的版本
```

在项目根目录放一个 `.nvmrc` 文件写入版本号（如 `20`），进入目录后执行 `nvm use` 即可切换到项目指定的版本。

**fnm**（Fast Node Manager）用 Rust 编写，速度快，同样读取 `.nvmrc` 和 `.node-version`：

```bash
# 安装方式见 fnm 仓库 README，安装后在 shell 配置中加入：
eval "$(fnm env --use-on-cd)"   # 进入目录时自动切换版本

fnm install --lts
fnm use 20
fnm default 20
```

### 其他方式

- **系统包管理器**：`apt install nodejs` 也能装，但发行版官方源中的版本往往较旧。
- **NodeSource 等软件源**：提供各个主版本的 deb/rpm 包，适合服务器上的系统级安装。
- **官方二进制包**：从 nodejs.org 下载预编译包解压使用。

npm 包管理相关内容见 [npm 依赖管理](/notes/fronted/language/node/node_package.html)。

## Nginx 安装与基本配置

### 安装

```bash
# Debian/Ubuntu
sudo apt update && sudo apt install nginx

# RHEL 系
sudo dnf install nginx

sudo systemctl enable --now nginx
curl -I http://localhost          # 看到 Server: nginx 说明运行正常
```

需要较新版本时，可以按 nginx.org 的说明添加官方软件源。

### 配置文件位置

| 文件或目录 | 说明 |
| --- | --- |
| `/etc/nginx/nginx.conf` | 主配置文件 |
| `/etc/nginx/conf.d/*.conf` | 站点配置，主配置中通过 `include` 引入（各发行版通用） |
| `/etc/nginx/sites-available/`、`sites-enabled/` | Debian/Ubuntu 的约定：配置写在 available，用软链接放到 enabled 中启用 |
| `/var/log/nginx/` | 访问日志和错误日志 |

### 示例：部署单页应用并反向代理接口

把前端构建产物放到 `/var/www/myapp`，`/api/` 开头的请求转发给本机 3000 端口的 Node.js 服务。创建 `/etc/nginx/conf.d/myapp.conf`：

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/myapp;
    index index.html;

    # 单页应用：找不到文件时回退到 index.html，交给前端路由处理
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 带哈希的静态资源长期缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 反向代理接口
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

`proxy_pass` 的地址末尾带不带 `/` 行为不同：

- `proxy_pass http://127.0.0.1:3000;`（没有路径部分）：请求 `/api/users` 原样转发为 `/api/users`。
- `proxy_pass http://127.0.0.1:3000/;`（有路径 `/`）：匹配到的 `/api/` 前缀会被替换为 `/`，转发为 `/users`。

修改配置后：

```bash
sudo nginx -t                    # 检查配置语法，务必先执行
sudo systemctl reload nginx      # 平滑加载新配置
```

`index.html` 本身不应长期缓存，否则发版后用户拿不到新的资源引用。如果需要 WebSocket 代理，还要额外设置 `proxy_http_version 1.1` 以及 `Upgrade`、`Connection` 请求头。生产环境应配置 HTTPS，证书可以使用 Let's Encrypt 等签发。

## 用 Docker 运行服务

Redis、MySQL 这类依赖服务，也可以直接用容器运行，免去安装和环境冲突问题：

```bash
docker run -d --name redis \
  -p 6379:6379 \
  -v /srv/redis/data:/data \
  redis:7 redis-server --appendonly yes
```

- `-v` 把数据目录挂载到宿主机，容器删除后数据仍保留。
- `--appendonly yes` 开启 AOF 持久化；Redis 默认的 RDB 快照文件为数据目录下的 `dump.rdb`。
- 需要自定义配置文件时，把配置挂载进容器，并在启动命令中指定配置文件路径。
- 生产环境不要把 Redis 端口直接暴露到公网，应绑定内网地址并设置密码。

## 小结

- 优先用包管理器：Debian 系用 `apt`，RHEL 系用 `dnf`（`yum` 是旧名），安装前先更新软件源索引。
- 源码编译的一般流程是 `configure`、`make`、`make install`，但升级和卸载需要自行维护，非必要不用。
- 长期运行的服务交给 systemd：`systemctl enable --now` 启动并自启，`journalctl -u` 查看日志，改 unit 文件后要 `daemon-reload`。
- Node.js 推荐用 nvm 或 fnm 管理版本，用 `.nvmrc` 固定项目版本；服务器上的 systemd 服务注意使用绝对路径。
- Nginx 改配置先 `nginx -t` 再 `reload`；单页应用用 `try_files` 回退到 `index.html`，注意 `proxy_pass` 末尾斜杠的区别。

## 参考

- [Debian 管理员手册](https://www.debian.org/doc/manuals/debian-handbook/)
- [systemd 文档](https://systemd.io/)
- [Node.js 下载与包管理器安装](https://nodejs.org/en/download)
- [nvm](https://github.com/nvm-sh/nvm)
- [fnm](https://github.com/Schniz/fnm)
- [Nginx 文档](https://nginx.org/en/docs/)
- [Nginx：proxy_pass](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass)
