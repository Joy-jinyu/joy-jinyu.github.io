# macOS 规范系列的实测材料

- 机器：MacBook（内建屏，backingScale 2），macOS 26.6.2 (25G83)，强调色为系统默认，未开增强对比度 / 减少透明度 / 减少动态效果。
- `probe/metrics.swift`：读 AppKit 的控件尺寸、字体、语义色、表格行高。`swiftc -O -o metrics metrics.swift && ./metrics > metrics.json`
- `probe/gallery.swift`：开 6 种标准窗口（无工具栏、unified、unifiedCompact、expanded、侧边栏外壳、控件画廊），量窗口外壳，并用 `screencapture -o -l` 截浅色 / 深色图。`./gallery <输出目录>`
- `probe/pixels.swift`：读截图像素（截图是 2x，1 pt = 2 px）。`corner` 子命令给 45° 等效圆角半径（窗口用的是连续曲线圆角，不是正圆）。
- `probe/fetch-hig.sh`：下载 HIG 原文 JSON 并转纯文本，用来逐字核对引用。原文不进仓库。
- `data/`：上面几个探针的原始输出。

已知限制：`NSAppearance(named: .accessibilityHighContrast*)` 下读到的颜色和普通外观完全一样，增强对比度的颜色值没法这样读出来，系列里不引用这组数据。

勘误：`data/metrics.json` 里 `controls.switch` 的五档都是 54×24，那是 NSSwitch 不在窗口里时的读数，不可用。放进窗口后五档是 36×16 / 44×20 / 54×24 / 64×28 / 80×36，见 `macos-controls/data/controls-light.json` 的 `.gallery.switch`。`textField` / `searchField` 的高度只跟字号走、不跟 controlSize 走，也见 controls 篇的数据。
