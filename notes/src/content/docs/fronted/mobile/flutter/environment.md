---
title: Flutter 环境搭建
description: 从安装 Flutter SDK、配置 Android 与 iOS 工具链、编辑器插件，到创建运行第一个项目、热重载，以及国内镜像和常见环境问题的处理。
---

Flutter 的环境由三部分组成：Flutter SDK 本身（内置 Dart SDK）、目标平台的工具链（Android SDK、Xcode）、编辑器插件。这篇按顺序把它们装好，跑起第一个项目，并整理国内网络环境下的镜像配置和常见报错。具体的系统版本要求变化较快，以官方安装文档为准。

## 安装 Flutter SDK

Flutter SDK 已经包含 Dart SDK，**不需要单独安装 Dart**。

安装方式有两种：

1. **下载压缩包**：从官方安装页下载对应系统的 stable 版本，解压到一个路径不含空格和中文、且不需要管理员权限的目录（Windows 上不要放在 `C:\Program Files` 下）。
2. **用 Git 克隆**：

   ```bash
   git clone https://github.com/flutter/flutter.git -b stable
   ```

然后把 `flutter/bin` 加入 `PATH`：

```bash
# macOS / Linux，写入 ~/.zshrc 或 ~/.bashrc
export PATH="$HOME/development/flutter/bin:$PATH"
```

Windows 在"系统属性 → 环境变量"里编辑用户的 `Path`，加入 `<flutter 目录>\bin`。重开终端后检查：

```bash
flutter --version
dart --version   # 使用的是 Flutter 自带的 Dart
```

之后升级 SDK 用 `flutter upgrade`，切换渠道用 `flutter channel stable`。

## 用 flutter doctor 检查环境

```bash
flutter doctor        # 检查各项依赖
flutter doctor -v     # 输出详细信息，排错时用
```

它会逐项列出 Flutter、Android 工具链、Xcode、Chrome、编辑器、已连接设备等状态，`[✓]` 表示正常，`[!]` 或 `[✗]` 后面会给出修复建议。只做某一个平台时，其他平台的告警可以忽略，比如只开发 Android，Xcode 那一项报错不影响使用。

## Android 工具链

1. 安装 Android Studio，首次启动时按向导安装 Android SDK、SDK Platform、Build-Tools 和模拟器。
2. 在 SDK Manager 的 SDK Tools 中勾选 **Android SDK Command-line Tools**，`flutter doctor` 需要它。
3. 接受许可协议：

   ```bash
   flutter doctor --android-licenses
   ```

4. 如果 SDK 不在默认位置，告诉 Flutter：

   ```bash
   flutter config --android-sdk /path/to/Android/sdk
   ```

   也可以设置环境变量 `ANDROID_HOME` 指向 SDK 目录，并把 `$ANDROID_HOME/platform-tools` 加入 `PATH`，这样终端里能直接用 `adb`。

:::caution
旧教程常写 `ANDROID_SDK_HOME`，这个变量其实表示 `.android` 用户配置目录的位置，不是 SDK 路径；指向 SDK 应该用 `ANDROID_HOME`。旧教程里用 `android -h` 检查安装的方式也已过时，SDK 中的 `tools/android` 命令早已移除，用 `adb version` 和 `flutter doctor` 检查即可。
:::

设备准备：

- **模拟器**：在 Android Studio 的 Device Manager 中创建虚拟设备，或用 `flutter emulators` 列出、`flutter emulators --launch <id>` 启动。
- **真机**：手机上开启"开发者选项"和"USB 调试"，连接后用 `adb devices` 或 `flutter devices` 确认能识别。

## iOS 工具链（仅 macOS）

iOS 应用只能在 macOS 上构建。

1. 从 App Store 安装 Xcode，然后完成命令行工具配置：

   ```bash
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -runFirstLaunch
   sudo xcodebuild -license
   ```

2. 安装 CocoaPods，用于管理 iOS 端的原生依赖（插件会用到）。安装方式参考 CocoaPods 官网，常用 `brew install cocoapods` 或 `sudo gem install cocoapods`。
3. 启动模拟器：`open -a Simulator`。
4. 真机调试需要在 Xcode 中打开 `ios/Runner.xcworkspace`，配置签名团队（Signing & Capabilities）。

## 编辑器插件

| 编辑器 | 需要安装的插件 |
| --- | --- |
| VS Code | Flutter 插件（会自动安装 Dart 插件） |
| Android Studio / IntelliJ IDEA | Flutter 插件（会提示同时安装 Dart 插件） |

VS Code 中常用命令（`Ctrl/Cmd + Shift + P` 调出命令面板）：

- `Flutter: New Project`：创建项目。
- `Flutter: Select Device`：选择运行设备，状态栏右下角也可以切换。
- `Flutter: Launch Emulator`：启动已创建的模拟器。
- `F5`：以调试模式运行。

## 创建并运行第一个项目

```bash
flutter create my_app
cd my_app
flutter devices          # 查看可用设备
flutter run              # 只有一个设备时直接运行
flutter run -d chrome    # 指定设备 ID 运行
```

项目主要结构：

```text
my_app/
├── lib/main.dart       # 入口文件
├── pubspec.yaml        # 依赖与资源配置
├── android/            # Android 原生工程
├── ios/                # iOS 原生工程
├── web/ macos/ ...     # 其他平台（按创建时的平台而定）
└── test/               # 测试
```

添加依赖用 `flutter pub add <包名>`，它会修改 `pubspec.yaml` 并自动执行 `flutter pub get`。

### 构建模式

| 模式 | 命令 | 特点 |
| --- | --- | --- |
| Debug | `flutter run` | JIT 编译，支持热重载，带断言和调试信息，性能不代表真实情况 |
| Profile | `flutter run --profile` | 接近发布版的性能，保留性能分析能力，只能在真机上运行 |
| Release | `flutter run --release` / `flutter build apk`、`flutter build ipa` | AOT 编译，体积和性能最优，不能调试 |

判断性能问题一定要在 Profile 模式的真机上看，Debug 模式的卡顿不能说明问题。

## 热重载与热重启

`flutter run` 运行后，终端里可以按键操作：

| 按键 | 作用 |
| --- | --- |
| `r` | 热重载（Hot Reload） |
| `R` | 热重启（Hot Restart） |
| `q` | 退出 |
| `h` | 查看所有命令 |

编辑器里保存文件默认会触发热重载。

- **热重载**：把修改后的代码注入正在运行的 Dart VM，然后重新执行 `build` 方法，**保留应用状态**（比如计数器的值、当前页面）。
- **热重启**：重新运行整个 Dart 程序，状态丢失，但不需要重新编译原生代码，比完整重启快很多。

以下修改热重载不会生效，需要热重启：

- `main()` 函数或 `initState()` 里的逻辑（它们不会被再次执行）。
- 全局变量、静态字段的初始化表达式。
- 把类改成枚举、修改泛型类型声明等结构性变化。

修改原生代码（`android/`、`ios/` 下的文件）、新增带原生代码的插件、修改 `pubspec.yaml` 中的资源后，需要停止应用重新 `flutter run`。

## 国内网络环境

Flutter 官方文档提供了在中国大陆使用的镜像配置，通过两个环境变量把 pub 包和 SDK 资源的下载地址替换为镜像：

```bash
export PUB_HOSTED_URL=https://pub.flutter-io.cn
export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn
```

- `PUB_HOSTED_URL`：`flutter pub get` 下载 Dart 包的地址。
- `FLUTTER_STORAGE_BASE_URL`：下载引擎产物、Dart SDK 等资源的地址。

写入 shell 配置文件后需要重开终端。Windows 在环境变量里添加同名的两个变量即可。镜像地址可能调整，以官方文档"在中国网络环境下使用 Flutter"一节为准。

Android 构建还会用 Gradle 下载 Gradle 发行版和 Maven 依赖，这部分不受上面两个变量影响。下载慢时的常见处理：

- Gradle 发行版：`android/gradle/wrapper/gradle-wrapper.properties` 中的 `distributionUrl` 指定了下载地址，可以改为可访问的镜像地址，或提前下载好压缩包后改为本地 `file:///` 路径。注意版本要与原来一致，不要为了省事随意升降 Gradle 版本，否则可能与 Android Gradle Plugin 不兼容。
- Maven 依赖：在 Gradle 的仓库配置中添加镜像仓库，或配置代理。

## 常见问题

| 现象 | 处理方向 |
| --- | --- |
| `flutter` 命令找不到 | `PATH` 没配置或没重开终端，用 `which flutter`（Windows 用 `where flutter`）确认 |
| `Android license status unknown` | 执行 `flutter doctor --android-licenses` |
| `cmdline-tools component is missing` | 在 SDK Manager 安装 Android SDK Command-line Tools |
| 首次运行卡在 `Running Gradle task 'assembleDebug'...` | 多半在下载 Gradle 或依赖，检查网络、镜像或代理 |
| `CocoaPods not installed` 或 pod 安装失败 | 安装 CocoaPods；在 `ios/` 目录执行 `pod install` 查看具体报错 |
| 依赖解析冲突 | `flutter pub outdated` 查看版本；`flutter clean` 后再 `flutter pub get` |
| 设备列表为空 | 检查 USB 调试授权、`adb devices`；iOS 真机需在 Xcode 中信任设备 |

遇到奇怪的构建缓存问题，`flutter clean` 会删除 `build/` 等生成目录，是比较安全的第一步。

## 小结

- Flutter SDK 自带 Dart，安装后把 `flutter/bin` 加入 `PATH`，用 `flutter doctor` 逐项检查。
- Android 需要 Android Studio、SDK Command-line Tools 并接受许可；SDK 路径用 `ANDROID_HOME`，不是 `ANDROID_SDK_HOME`。iOS 只能在 macOS 上用 Xcode 和 CocoaPods 构建。
- 热重载保留状态、重新执行 `build`；修改 `main`、`initState`、全局初始化需要热重启，改原生代码需要重新运行。
- 性能要在 Profile 模式真机上评估。
- 国内网络通过 `PUB_HOSTED_URL` 和 `FLUTTER_STORAGE_BASE_URL` 使用镜像，Gradle 下载需要单独处理。

## 参考

- [Flutter：安装](https://docs.flutter.dev/get-started/install)
- [Flutter：在中国网络环境下使用 Flutter](https://docs.flutter.dev/community/china)
- [Flutter：热重载](https://docs.flutter.dev/tools/hot-reload)
- [Flutter：构建模式](https://docs.flutter.dev/testing/build-modes)
