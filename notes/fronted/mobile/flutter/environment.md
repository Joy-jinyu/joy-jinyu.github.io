## Flutter开发 环境安装

### android sdk安装及配置

   + ~~[通过sdkTools下载SDK](https://www.jianshu.com/p/c3ec3cdc77b3,https://www.androiddevtools.cn/,https://www.cnblogs.com/huckleberry/p/12323901.html) （由于证书问题一直无法解决，弃用）~~
+ 下载Android studio
   + 启动Android studio下载android SDK(按默认配置安装SDK即可)

   + 配置SDK环境变量

     - 添加ANDROID_SDK_HOME：SDK安装目录（此处是androidSDKManage）
  - path添加 %ANDROID_SDK_HOME%\platform-tools;%ANDROID_SDK_HOME%\tools; 
   + 检测是否安装成功

     - 命令：adb
  - 命令：android -h
   
### dart安装及配置(flutter开发可忽略安装dart-sdk, flutter内置了)

### fluter 安装及配置

### IDE环境配置

   + [power shell 5.1安装](https://docs.microsoft.com/zh-cn/powershell/scripting/windows-powershell/wmf/setup/install-configure?view=powershell-7)
     
     -  $PSVersionTable 查看当前版本
   + [visual studio开发](https://flutter.io/using-ide-vscode/; https://flutter.dev/docs/development/tools/vs-code)
     - 安装flutter、dart插件
     - 快捷键 Ctrl + Shift + P 调出 vs的命令行
     - 输入 Flutter: New Project 然后enter确认
     - 输入项目名称
     - 选择项目路径
     
   + 项目启动
   
     - 替换 项目根目录/android/gradle/wrapper/gradle-wrapper.properties的代码
   
       ```properties
       #distributionUrl=https\://services.gradle.org/distributions/gradle-5.6.2-all.zip 这个是被替换的
       distributionUrl=file:///D:/download/gradle-6.1.1-all.zip
       
       
       #原因：默认的地址下载很慢，所以需要提前下载到本地来，然后直接引用本地文件即可
       ```
   
     - 创建移动设备
   
       + 方案一：快捷键 Ctrl + Shift + P 调出 vs的命令行 （输入 Flutter: Launch emulator然后enter确认(需要提前通过android emulator创建)）
       + 方案二：直接连接移动设备（手机）
   
     - 在项目命令行中输入flutter run 启动项目
