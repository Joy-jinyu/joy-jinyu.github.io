## 一、Windows安装

+ [官网](https://www.mysql.com/)下载免安装版

+ 配置`mysql`环境变量 `%MYSQL_HOME%\bin`

+ 执行`mysqld --install`进行安装

+ 执行`mysqld --initialize --console`进行初始化并且以console的方式显示出来（用于查看初始密码）

+ 执行`net start mysql`开启`mysql`服务

+ 执行`mysql -uroot -p`进行登录

+ 执行`alter user 'root'@'localhost' identified by '#{password}';` 进行密码修改

+ 执行`exit`登出再登入测试

+ 在`mysql`根目录下设置`my.ini`文件

  ```ini
  [mysqld]
  # 设置3306端口
  port=3306
  # 设置mysql数据库的数据的存放目录
  datadir=E:\\software\\mysql\\mysql-5.7.27-winx64\\Data 
  # 允许最大连接数
  max_connections=200
  # 允许连接失败的次数。这是为了防止有人从该主机试图攻击数据库系统
  max_connect_errors=10
  # 服务端使用的字符集默认为UTF8
  character-set-server=utf8
  # 创建新表时将使用的默认存储引擎
  default-storage-engine=INNODB
  [mysql]
  # 设置mysql客户端默认字符集
  default-character-set=utf8
  [client]
  # 设置mysql客户端连接服务端时默认使用的端口
  port=3306
  default-character-set=utf8
  ```

  ## End、参考文章

  +  MySQL的安装与配置——详细教程 -  Winton-H
    https://www.cnblogs.com/winton-nfs/p/11524007.html

