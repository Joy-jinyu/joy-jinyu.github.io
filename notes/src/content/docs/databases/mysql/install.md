---
title: MySQL 安装与基础配置
description: 在 Linux、macOS、Windows 和 Docker 中安装 MySQL，完成初始化与 root 密码设置，创建用户并授权，配置 utf8mb4 字符集和远程访问，以及常用管理命令和 mysqldump 备份恢复。
---

这篇覆盖从零搭起一个可用的 MySQL 实例所需的步骤：选一种方式安装，完成初始化和 root 密码设置，创建应用专用账号，配置字符集和远程访问，最后是日常管理和备份恢复。不同版本和发行版之间的默认值差别较多，文中涉及版本差异的地方只做定性说明，以对应版本的官方文档为准。

## 安装方式

### Linux：包管理器

```bash
# Debian / Ubuntu
sudo apt update
sudo apt install mysql-server

sudo systemctl enable --now mysql
systemctl status mysql

# RHEL 系（Rocky、AlmaLinux 等），服务名是 mysqld
sudo dnf install mysql-server
sudo systemctl enable --now mysqld
systemctl status mysqld
```

发行版自带源中的 MySQL 版本可能不是最新的，有些发行版默认提供的是 MariaDB（MySQL 的分支，大部分用法兼容，但并不完全相同）。需要特定版本时，可以按 MySQL 官方文档添加官方的 APT 或 Yum 软件源再安装。

安装后建议执行安全加固脚本：

```bash
sudo mysql_secure_installation
```

它会引导你设置 root 密码策略、删除匿名用户、禁止 root 远程登录、删除测试数据库。

### macOS

```bash
brew install mysql
brew services start mysql
mysql_secure_installation
```

也可以从官网下载 DMG 安装包，安装过程中设置 root 密码，并在"系统设置"中管理服务。

### Windows

两种方式：

- **MySQL Installer**：官方提供的图形化安装程序，按向导选择组件、设置 root 密码和 Windows 服务，最省事。
- **ZIP 免安装版**：解压后手动配置，步骤如下（以管理员身份打开命令行）：

```bat
:: 1. 把解压目录下的 bin 加入 PATH，或在 bin 目录中执行以下命令

:: 2. 初始化数据目录，生成的 root 临时密码会打印在控制台
mysqld --initialize --console

:: 3. 安装为 Windows 服务并启动
mysqld --install
net start mysql

:: 4. 用临时密码登录后修改密码
mysql -u root -p
```

ZIP 版的配置文件 `my.ini` 放在 MySQL 根目录下，Windows 路径中的反斜杠要写成 `/` 或 `\\`：

```ini
[mysqld]
port=3306
basedir=C:/mysql
datadir=C:/mysql/data
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
default-storage-engine=INNODB
max_connections=200

[client]
port=3306
default-character-set=utf8mb4
```

如果要自定义 `datadir`，应在执行 `--initialize` **之前**写好配置，否则数据目录会初始化到默认位置。

### Docker

开发和测试环境用 Docker 最方便，不污染本机环境：

```bash
docker run -d --name mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD='change-me' \
  -e MYSQL_DATABASE=app \
  -e MYSQL_USER=app \
  -e MYSQL_PASSWORD='app-pass' \
  -v mysql-data:/var/lib/mysql \
  mysql:8.4 \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_unicode_ci

docker exec -it mysql mysql -u root -p
```

- `MYSQL_ROOT_PASSWORD`：root 密码，首次启动时必须提供（或使用镜像文档中的其他选项）。
- `MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD`：首次启动时自动创建数据库和用户，并授予该用户这个库的全部权限。
- `-v mysql-data:/var/lib/mysql`：把数据保存在数据卷中，删除容器后数据仍在。
- 这些环境变量只在数据目录为空、首次初始化时生效，之后修改不会改变已有的密码和用户。
- 镜像标签应写明主版本，不要用 `latest`，以免拉取到新的大版本导致数据目录不兼容。

## 初始化与 root 密码

不同安装方式下，root 的初始状态不同：

| 情况 | root 初始状态 |
| --- | --- |
| `mysqld --initialize` | 生成随机临时密码，打印到错误日志或控制台（`--console`），首次登录后必须修改 |
| `mysqld --initialize-insecure` | root 没有密码，仅适合本地测试 |
| Ubuntu 等发行版的 apt 安装 | root 通常使用 `auth_socket` 插件认证：用 `sudo mysql` 即可登录，不需要密码 |
| Docker 官方镜像 | 使用 `MYSQL_ROOT_PASSWORD` 指定的密码 |

Linux 上查找临时密码：

```bash
sudo grep 'temporary password' /var/log/mysqld.log
```

登录后修改密码：

```sql
ALTER USER 'root'@'localhost' IDENTIFIED BY '新的强密码';
```

MySQL 可能启用了密码校验组件（`validate_password`），过于简单的密码会被拒绝。

## 创建用户与授权

应用程序不应该使用 root 账号连接数据库，而是为每个应用创建专用账号，只授予需要的权限。

MySQL 中用户由 **用户名 + 主机** 共同确定，`'app'@'localhost'` 和 `'app'@'%'` 是两个不同的用户：

| 主机部分 | 含义 |
| --- | --- |
| `localhost` | 只能从本机连接 |
| `192.168.1.%` | 只能从该网段连接 |
| `10.0.0.5` | 只能从指定 IP 连接 |
| `%` | 任意主机 |

```sql
-- 创建数据库
CREATE DATABASE app DEFAULT CHARACTER SET utf8mb4;  -- 不写 COLLATE 时用 utf8mb4 的默认排序规则

-- 创建用户
CREATE USER 'app'@'192.168.1.%' IDENTIFIED BY '强密码';

-- 授予 app 库的读写权限
GRANT SELECT, INSERT, UPDATE, DELETE ON app.* TO 'app'@'192.168.1.%';

-- 需要建表、改表结构时再加上
GRANT CREATE, ALTER, INDEX, DROP ON app.* TO 'app'@'192.168.1.%';

-- 只读账号
CREATE USER 'reader'@'%' IDENTIFIED BY '强密码';
GRANT SELECT ON app.* TO 'reader'@'%';

-- 查看与回收权限
SHOW GRANTS FOR 'app'@'192.168.1.%';
REVOKE DELETE ON app.* FROM 'app'@'192.168.1.%';

-- 修改密码、删除用户
ALTER USER 'app'@'192.168.1.%' IDENTIFIED BY '新密码';
DROP USER 'reader'@'%';
```

注意：

- MySQL 8.0 起，`GRANT` 语句不再能顺带创建用户，必须先 `CREATE USER` 再 `GRANT`。旧资料中 `GRANT ALL ON *.* TO 'u'@'%' IDENTIFIED BY 'pwd'` 的写法在新版本中会报错。
- 用 `GRANT`、`CREATE USER` 等语句修改权限会立即生效，不需要 `FLUSH PRIVILEGES`。只有直接修改 `mysql` 系统库中的权限表时才需要它。
- MySQL 8.0 起默认的认证插件是 `caching_sha2_password`。一些较老的客户端库不支持它，会报认证插件相关的错误，应优先升级客户端，而不是把用户改回旧的认证方式。

## 字符集：使用 utf8mb4

MySQL 中的 `utf8` 并不是完整的 UTF-8：它每个字符最多只用 3 个字节，存不了 emoji 和部分生僻字（它们需要 4 个字节）。这个 `utf8` 实际上是 `utf8mb3` 的别名，已被官方标记为弃用。**应始终使用 `utf8mb4`**，它才是完整的 UTF-8 实现。旧配置中的 `character-set-server=utf8` 应改为 `utf8mb4`。

MySQL 8.0 起默认字符集已经是 `utf8mb4`，但从旧版本升级或迁移过来的库、表可能仍是旧字符集，需要检查：

```sql
SHOW VARIABLES LIKE 'character_set%';
SHOW VARIABLES LIKE 'collation%';
SHOW CREATE TABLE users;
```

排序规则（collation）决定了字符串的比较和排序方式。名称中 `ci` 表示不区分大小写，`cs` 区分大小写，`bin` 按二进制比较。同一个库中的表和列最好使用相同的排序规则，否则联表比较时可能报排序规则冲突的错误。MySQL 8.0 起 utf8mb4 的默认排序规则是 `utf8mb4_0900_ai_ci`，基于更新的 Unicode 版本；本文配置示例里的 `utf8mb4_unicode_ci` 兼容性更好，适合要和旧版本或 MariaDB 共用数据的场景。没有这类需求时，直接沿用默认值即可。

客户端连接时也要指定字符集，例如连接串中带上 `charset=utf8mb4`，否则可能在传输过程中出现乱码。

## 远程访问

默认安装通常只允许本机连接。开启远程访问需要同时满足三个条件：

1. **监听地址**：MySQL 要监听在可被访问的网卡上。查看 `bind-address` 配置，如果是 `127.0.0.1` 就只接受本机连接。修改配置文件（Debian/Ubuntu 通常在 `/etc/mysql/mysql.conf.d/mysqld.cnf`）：

   ```ini
   [mysqld]
   bind-address = 0.0.0.0
   ```

   改完后重启服务：`sudo systemctl restart mysql`。

2. **用户的主机部分**：要有允许从远程地址登录的用户，比如 `'app'@'192.168.1.%'`。`'app'@'localhost'` 无法从远程登录。

3. **防火墙与安全组**：服务器防火墙（`ufw`、`firewalld`）和云服务商的安全组要放行 3306 端口，并尽量只对特定 IP 放行。

验证：

```bash
ss -tlnp | grep 3306                   # 确认监听地址
mysql -h 服务器IP -u app -p             # 从远程机器测试连接
```

安全建议：不要把 3306 端口暴露在公网；不允许 root 远程登录；需要远程管理时优先通过 SSH 隧道连接：

```bash
ssh -L 3307:127.0.0.1:3306 user@server
# 然后本地连接 127.0.0.1:3307
```

## 常用管理命令

```bash
mysql -u root -p                     # 登录
mysql -h host -P 3306 -u app -p app  # 指定主机、端口、数据库
mysql -u root -p -e "SHOW DATABASES;"   # 执行单条语句
```

```sql
SELECT VERSION();                    -- 查看版本
SHOW DATABASES;                      -- 列出数据库
USE app;                             -- 切换数据库
SHOW TABLES;                         -- 列出表
DESC users;                          -- 查看表结构
SHOW CREATE TABLE users\G            -- 查看建表语句，\G 按列竖向显示
SELECT user, host FROM mysql.user;   -- 列出用户
SHOW PROCESSLIST;                    -- 查看当前连接和正在执行的语句
KILL 123;                            -- 结束某个连接
SHOW VARIABLES LIKE 'max_connections';
SHOW STATUS LIKE 'Threads_connected';
```

配置文件的读取位置可以用 `mysqld --verbose --help | grep -A 1 "Default options"` 查看，多个文件按顺序读取，后读取的配置覆盖前面的。

## 备份与恢复

### mysqldump 逻辑备份

`mysqldump` 把数据导出成 SQL 语句，适合中小规模的数据库：

```bash
# 备份单个数据库
mysqldump -u root -p --single-transaction --routines --triggers --events app > app.sql

# 备份多个数据库 / 所有数据库
mysqldump -u root -p --single-transaction --databases app blog > dbs.sql
mysqldump -u root -p --single-transaction --all-databases > all.sql

# 只导出表结构 / 只导出数据
mysqldump -u root -p --no-data app > schema.sql
mysqldump -u root -p --no-create-info app > data.sql

# 压缩
mysqldump -u root -p --single-transaction app | gzip > app.sql.gz
```

参数说明：

- `--single-transaction`：在一个一致性快照事务中导出，对 InnoDB 表不会锁表，线上备份必须加。对 MyISAM 等非事务表不起作用。
- `--routines`、`--triggers`、`--events`：同时导出存储过程和函数、触发器、事件（其中触发器默认就会导出）。
- `--databases`：导出文件中会包含 `CREATE DATABASE` 和 `USE` 语句；不加时只导出表，恢复时需要先指定目标库。

### 恢复

```bash
# 恢复到指定数据库（备份时未使用 --databases）
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS app DEFAULT CHARACTER SET utf8mb4;"
mysql -u root -p app < app.sql

# 备份文件中包含建库语句时
mysql -u root -p < dbs.sql

# 从压缩文件恢复
gunzip < app.sql.gz | mysql -u root -p app
```

也可以登录后执行 `SOURCE /path/to/app.sql;`。

### 备份建议

- 不要在命令行中直接写 `-p密码`，会留在 shell 历史和进程列表中。脚本中可以使用 `mysql_config_editor` 保存登录信息，或使用权限为 `600` 的选项文件。
- 定期执行，并保留多个历史版本，存放到另一台机器或对象存储中。
- **定期演练恢复**：没有验证过能恢复的备份不算可靠的备份。
- 数据量很大时，逻辑备份和恢复都很慢，可以考虑物理备份工具，或结合二进制日志（binlog）做时间点恢复。

## 小结

- Linux 用包管理器安装，macOS 用 Homebrew，Windows 用 MySQL Installer 或 ZIP 版，开发环境推荐 Docker 并固定主版本标签。
- 初始化后先处理 root 密码：临时密码在日志中，Ubuntu 的 apt 安装可能使用 `auth_socket`，用 `sudo mysql` 登录。
- 先 `CREATE USER` 再 `GRANT`，用户名和主机共同确定一个账号，应用使用最小权限的专用账号。
- 始终使用 `utf8mb4`，MySQL 的 `utf8` 存不了 4 字节字符。
- 远程访问需要同时配置监听地址、用户主机和防火墙，生产环境避免暴露 3306 端口。
- 用 `mysqldump --single-transaction` 备份 InnoDB 数据库，并定期演练恢复。

## 参考

- [MySQL 参考手册：安装](https://dev.mysql.com/doc/refman/8.4/en/installing.html)
- [MySQL 参考手册：初始化数据目录](https://dev.mysql.com/doc/refman/8.4/en/data-directory-initialization.html)
- [MySQL 参考手册：CREATE USER](https://dev.mysql.com/doc/refman/8.4/en/create-user.html)
- [MySQL 参考手册：GRANT](https://dev.mysql.com/doc/refman/8.4/en/grant.html)
- [MySQL 参考手册：utf8mb4 字符集](https://dev.mysql.com/doc/refman/8.4/en/charset-unicode-utf8mb4.html)
- [MySQL 参考手册：mysqldump](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html)
