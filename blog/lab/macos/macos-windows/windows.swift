import AppKit
// 用法：打成 .app 后 open -n -W WindowsProbe.app --args <输出目录> [all|key-light|key-dark]；inactive 模式直接从终端跑。输出 <输出目录>/windows.json 和截图。
// 量窗口行为：活动 / 非活动外观、标题字体、系统最小尺寸、标签页栏、zoom、全屏、frameAutosave。
// 只截探针自己的窗口（screencapture -o -l），不碰系统设置。
let outDir = CommandLine.arguments[1]
let mode = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "all"
let app = NSApplication.shared
app.setActivationPolicy(.regular)
func r(_ x: CGFloat) -> Double { (Double(x) * 100).rounded() / 100 }
func rect(_ f: NSRect) -> [String: Double] { ["x": r(f.origin.x), "y": r(f.origin.y), "w": r(f.width), "h": r(f.height)] }
func wait(_ s: Double) { RunLoop.current.run(until: Date().addingTimeInterval(s)) }
// .app 没有录屏权限，截图交给终端里的 shoot.sh：这里写一个请求文件，等对方把 png 写出来
func shoot(_ num: Int, _ file: String) {
  let png = "\(outDir)/\(file).png"
  try? "\(num)".write(toFile: "\(outDir)/\(file).req", atomically: true, encoding: .utf8)
  let deadline = Date().addingTimeInterval(8)
  while !FileManager.default.fileExists(atPath: png) && Date() < deadline { wait(0.1) }
  wait(0.2)
}
func shot(_ w: NSWindow, _ file: String) { shoot(w.windowNumber, file) }

final class TB: NSObject, NSToolbarDelegate {
  let ids: [NSToolbarItem.Identifier] = [NSToolbarItem.Identifier("add"), .flexibleSpace, NSToolbarItem.Identifier("share")]
  func toolbarDefaultItemIdentifiers(_ t: NSToolbar) -> [NSToolbarItem.Identifier] { ids }
  func toolbarAllowedItemIdentifiers(_ t: NSToolbar) -> [NSToolbarItem.Identifier] { ids }
  func toolbar(_ t: NSToolbar, itemForItemIdentifier id: NSToolbarItem.Identifier, willBeInsertedIntoToolbar f: Bool) -> NSToolbarItem? {
    let it = NSToolbarItem(itemIdentifier: id)
    it.label = id.rawValue.capitalized
    it.image = NSImage(systemSymbolName: id.rawValue == "add" ? "plus" : "square.and.arrow.up", accessibilityDescription: id.rawValue)
    it.isBordered = true
    it.target = NSApp; it.action = #selector(NSApplication.orderFrontStandardAboutPanel(_:))
    return it
  }
}
let tbd = TB()

func makeWindow(_ title: String, _ size: NSSize, style: NSWindow.ToolbarStyle?) -> NSWindow {
  var mask: NSWindow.StyleMask = [.titled, .closable, .miniaturizable, .resizable]
  if style != nil { mask.insert(.fullSizeContentView) }
  let w = NSWindow(contentRect: NSRect(origin: .zero, size: size), styleMask: mask, backing: .buffered, defer: false)
  w.title = title
  if let s = style { let t = NSToolbar(identifier: title); t.delegate = tbd; t.displayMode = .iconOnly; w.toolbar = t; w.toolbarStyle = s }
  w.isReleasedWhenClosed = false
  w.tabbingMode = .disallowed
  return w
}
func titleField(_ w: NSWindow) -> NSTextField? {
  func find(_ v: NSView) -> NSTextField? {
    if let t = v as? NSTextField, t.stringValue == w.title { return t }
    for s in v.subviews { if let f = find(s) { return f } }
    return nil
  }
  return w.contentView?.superview.flatMap(find)
}
func buttons(_ w: NSWindow) -> [String: Any] {
  var d: [String: Any] = [:]
  for (bn, b) in [("close", NSWindow.ButtonType.closeButton), ("miniaturize", .miniaturizeButton), ("zoom", .zoomButton)] {
    if let v = w.standardWindowButton(b) {
      let f = v.convert(v.bounds, to: nil)
      // 换成「离窗口左上角」的坐标，便于和截图对照
      d[bn] = ["left": r(f.minX), "top": r(w.frame.height - f.maxY), "w": r(f.width), "h": r(f.height), "hidden": v.isHidden || v.alphaValue == 0, "enabled": v.isEnabled]
    }
  }
  return d
}
func shell(_ w: NSWindow) -> [String: Any] {
  var d: [String: Any] = ["frame": rect(w.frame), "contentLayoutRect": rect(w.contentLayoutRect),
                          "titlebarPlusToolbar": r(w.frame.height - w.contentLayoutRect.height), "buttons": buttons(w)]
  if let t = titleField(w) {
    let f = t.convert(t.bounds, to: nil)
    d["title"] = ["font": t.font?.fontName ?? "", "size": r(t.font?.pointSize ?? 0), "left": r(f.minX), "top": r(w.frame.height - f.maxY), "h": r(f.height)]
  }
  return d
}

var out: [String: Any] = [:]
var activeLog: [String] = []
var titleColors: [String: Any] = [:]
let screen = NSScreen.main!
out["screen"] = ["frame": rect(screen.frame), "visibleFrame": rect(screen.visibleFrame), "safeAreaTop": r(screen.safeAreaInsets.top)]

DispatchQueue.main.async {
  app.activate()

  // 1. 活动 / 非活动外观。macOS 14 起应用只有被用户（或 open）启动时才能拿到前台，之后用户点别的应用就会被抢走，
  //    所以外观单独跑：mode=key-light / key-dark 用 open 启动，只拍 key 状态；mode=inactive 从终端直接跑，应用始终在后台。
  //    截图那一刻真实的前台应用由 shoot.sh 用 lsappinfo 记在 front.log 里。
  if mode != "all" {
    let tag = mode.hasSuffix("dark") ? "dark" : "light"
    for appearance in (mode == "inactive" ? [NSAppearance.Name.aqua, .darkAqua] : [tag == "dark" ? .darkAqua : .aqua]) {
      app.appearance = NSAppearance(named: appearance)
      let t = appearance == .aqua ? "light" : "dark"
      for (name, style) in [("unified", NSWindow.ToolbarStyle.unified), ("plain", nil)] as [(String, NSWindow.ToolbarStyle?)] {
        let a = makeWindow("文稿.txt", NSSize(width: 480, height: 200), style: style)
        a.setFrameTopLeftPoint(NSPoint(x: 120, y: 860)); a.makeKeyAndOrderFront(nil); wait(0.8)
        let file = "\(name)-\(mode == "inactive" ? "inactive" : "key")-\(t)"
        activeLog.append("\(file): active=\(app.isActive) key=\(a.isKeyWindow)")
        // 标题文字用的是哪个语义色：读标题 NSTextField 的 textColor 和它在当前外观下解析出的 sRGB 值
        if let tf = titleField(a) {
          var srgb = ""
          a.effectiveAppearance.performAsCurrentDrawingAppearance {
            if let c = tf.textColor?.usingColorSpace(.sRGB) {
              srgb = String(format: "#%02X%02X%02X a=%.3f", Int((c.redComponent * 255).rounded()), Int((c.greenComponent * 255).rounded()), Int((c.blueComponent * 255).rounded()), c.alphaComponent)
            }
          }
          let cat = tf.textColor.flatMap { $0.type == .catalog ? $0.colorNameComponent : nil } ?? ""
          titleColors[file] = ["catalogName": cat, "sRGB": srgb, "alphaValue": r(tf.alphaValue), "description": tf.textColor?.description ?? ""]
        }
        shot(a, file); a.close(); wait(0.2)
      }
    }
    out["activeLog"] = activeLog
    out["titleColors"] = titleColors
    let data = try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .sortedKeys])
    try! data.write(to: URL(fileURLWithPath: "\(outDir)/appearance-\(mode).json"))
    try! data.write(to: URL(fileURLWithPath: "\(outDir)/windows.json"))
    app.terminate(nil)
    return
  }
  app.appearance = NSAppearance(named: .aqua)

  // 2. 每种外壳的标题字体与外壳尺寸
  var shells: [String: Any] = [:]
  for (name, style) in [("plain", nil), ("unified", .unified), ("unifiedCompact", .unifiedCompact), ("expanded", .expanded)] as [(String, NSWindow.ToolbarStyle?)] {
    let w = makeWindow("Title", NSSize(width: 480, height: 200), style: style)
    w.setFrameTopLeftPoint(NSPoint(x: 120, y: 860)); w.makeKeyAndOrderFront(nil); wait(0.4)
    var d = shell(w)
    // 3. 不设 minSize 时，系统允许缩到多小
    d["minSizeProperty"] = ["w": r(w.minSize.width), "h": r(w.minSize.height)]
    w.setFrame(NSRect(x: 120, y: 600, width: 1, height: 1), display: true); wait(0.3)
    d["frameAfterShrinkTo1x1"] = rect(w.frame)
    shells[name] = d
    w.close(); wait(0.2)
  }
  out["shells"] = shells

  // 4. 标签页：两个窗口合成一个标签式窗口
  var tabs: [String: Any] = [:]
  for (name, style) in [("plain", nil), ("unified", NSWindow.ToolbarStyle.unified)] as [(String, NSWindow.ToolbarStyle?)] {
    let w1 = makeWindow("第一个文稿", NSSize(width: 560, height: 220), style: style)
    let w2 = makeWindow("第二个文稿", NSSize(width: 560, height: 220), style: style)
    for w in [w1, w2] { w.tabbingMode = .preferred; w.tabbingIdentifier = "probe-\(name)" }
    w1.setFrameTopLeftPoint(NSPoint(x: 120, y: 860)); w1.makeKeyAndOrderFront(nil); wait(0.3)
    let before = shell(w1)
    w1.addTabbedWindow(w2, ordered: .above); w2.makeKeyAndOrderFront(nil); wait(0.8)
    let after = shell(w2)
    tabs[name] = ["oneTab": before, "twoTabs": after,
                  "tabBarHeight": r((after["titlebarPlusToolbar"] as! Double) - (before["titlebarPlusToolbar"] as! Double))]
    shot(w2, "tabs-\(name)-light")
    w2.close(); w1.close(); wait(0.3)
  }
  out["tabs"] = tabs

  // 5. zoom（绿灯 / 窗口 > 缩放）：没有 delegate 时 zoom 到多大
  let z = makeWindow("zoom", NSSize(width: 480, height: 300), style: .unified)
  z.setFrameTopLeftPoint(NSPoint(x: 200, y: 800)); z.makeKeyAndOrderFront(nil); wait(0.4)
  let zBefore = rect(z.frame)
  z.zoom(nil); wait(0.8)
  let zAfter = rect(z.frame); let zoomed = z.isZoomed
  z.zoom(nil); wait(0.8)
  out["zoom"] = ["before": zBefore, "afterZoom": zAfter, "isZoomed": zoomed, "afterSecondZoom": rect(z.frame)]
  z.close(); wait(0.2)

  // 6. frameAutosaveName：系统把窗口位置尺寸存成什么
  let s = makeWindow("autosave", NSSize(width: 420, height: 260), style: nil)
  s.setFrameTopLeftPoint(NSPoint(x: 160, y: 760))
  s.setFrameAutosaveName("ProbeWindow")
  s.saveFrame(usingName: "ProbeWindow")
  out["autosave"] = ["key": "NSWindow Frame ProbeWindow", "value": UserDefaults.standard.string(forKey: "NSWindow Frame ProbeWindow") ?? "", "frame": rect(s.frame)]
  UserDefaults.standard.removeObject(forKey: "NSWindow Frame ProbeWindow")
  s.close(); wait(0.2)

  // 7. 全屏：进入后量外壳，截图，再退出
  let f = makeWindow("全屏", NSSize(width: 640, height: 360), style: .unified)
  f.collectionBehavior.insert(.fullScreenPrimary)
  f.setFrameTopLeftPoint(NSPoint(x: 160, y: 800)); f.makeKeyAndOrderFront(nil); wait(0.5)
  let fBefore = shell(f)
  f.toggleFullScreen(nil); wait(3.0)
  let fIn = shell(f); let inFS = f.styleMask.contains(.fullScreen)
  shot(f, "fullscreen-unified-light")
  // 全屏时工具栏可能挪进单独的窗口：列出本进程所有窗口
  var mine: [[String: Any]] = []
  if let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] {
    for info in list where (info[kCGWindowOwnerPID as String] as? Int32) == ProcessInfo.processInfo.processIdentifier {
      let num = info[kCGWindowNumber as String] as! Int
      mine.append(["number": num, "layer": info[kCGWindowLayer as String] ?? 0, "bounds": info[kCGWindowBounds as String] ?? [:]])
      shoot(num, "fullscreen-win-\(num)")
    }
  }
  f.toggleFullScreen(nil); wait(4.0)
  out["fullscreen"] = ["before": fBefore, "inFullScreen": fIn, "styleMaskFullScreen": inFS, "ownWindowsInFullScreen": mine, "after": rect(f.frame), "afterStyleMaskFullScreen": f.styleMask.contains(.fullScreen)]
  out["activeLog"] = activeLog
  f.close()

  let data = try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .sortedKeys])
  try! data.write(to: URL(fileURLWithPath: "\(outDir)/windows.json"))
  app.terminate(nil)
}
app.run()
