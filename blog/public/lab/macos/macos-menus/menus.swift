import AppKit
// 用法：MenuProbe <输出目录> <axmenu 路径> <light|dark> <步骤,逗号分隔>
// 步骤：window（只拍窗口）、popup、pulldown、context（各自弹出菜单）、bar:<菜单标题>（用 axmenu press 点开自己的菜单栏项）、
//       search:<词>（点开帮助菜单，在系统的搜索框里填这个词，拍结果），
//       pop:<菜单标题>（把菜单栏里的这个菜单在窗口里弹出来：菜单栏菜单单独截图时玻璃背后没有内容，会是一块不透明的灰）。
// 搭一套标准菜单栏（应用、File、Edit、Format、View、Keys、Window、Help）和一个放着弹出 / 下拉按钮的窗口，
// 每打开一个菜单：等 0.3 秒 → 用 screencapture -o -l 只拍本进程的窗口 → 后台跑 axmenu dump 读菜单项的位置 → cancelTracking。
// 不碰别的应用、不改系统设置，9.5 秒后无论如何退出。
let a = CommandLine.arguments
let outDir = a[1], axTool = a[2], mode = a[3]
var steps = a[4].split(separator: ",").map(String.init)
let app = NSApplication.shared
app.setActivationPolicy(.regular)
app.appearance = NSAppearance(named: mode == "dark" ? .darkAqua : .aqua)
func r(_ x: CGFloat) -> Double { (Double(x) * 100).rounded() / 100 }
func rect(_ f: NSRect) -> [String: Double] { ["x": r(f.origin.x), "y": r(f.origin.y), "w": r(f.width), "h": r(f.height)] }
var meta: [String: Any] = ["mode": mode, "os": ProcessInfo.processInfo.operatingSystemVersionString]
func save() {
  let data = try! JSONSerialization.data(withJSONObject: meta, options: [.prettyPrinted, .sortedKeys])
  try! data.write(to: URL(fileURLWithPath: "\(outDir)/menus-\(mode).json"))
}
DispatchQueue.main.asyncAfter(deadline: .now() + 9.5) { meta["timedOut"] = true; save(); exit(3) }

final class Target: NSObject { @objc func noop(_ s: Any?) {} }
let tgt = Target()
let noop = #selector(Target.noop(_:))
// sel 为 nil：没有动作，系统自动置灰；target 为 nil：走响应链，没人响应也会置灰
func mi(_ t: String, _ key: String = "", _ mods: NSEvent.ModifierFlags = .command, _ sel: Selector? = noop, _ target: AnyObject? = tgt) -> NSMenuItem {
  let i = NSMenuItem(title: t, action: sel, keyEquivalent: key)
  i.keyEquivalentModifierMask = mods
  i.target = target
  return i
}
func menu(_ t: String, _ items: [NSMenuItem]) -> NSMenuItem {
  let top = NSMenuItem(title: t, action: nil, keyEquivalent: "")
  let m = NSMenu(title: t); items.forEach { m.addItem($0) }; top.submenu = m
  return top
}
func sub(_ t: String, _ items: [NSMenuItem]) -> NSMenuItem { menu(t, items) }
let sep = { NSMenuItem.separator() }
let std: AnyObject? = nil // 标准动作走响应链

let services = NSMenu(title: "Services")
let appMenu = menu("MenuProbe", [
  mi("About MenuProbe", "", [], #selector(NSApplication.orderFrontStandardAboutPanel(_:)), NSApp), sep(),
  mi("Settings…", ","), sep(),
  { let s = NSMenuItem(title: "Services", action: nil, keyEquivalent: ""); s.submenu = services; return s }(), sep(),
  mi("Hide MenuProbe", "h", .command, #selector(NSApplication.hide(_:)), NSApp),
  mi("Hide Others", "h", [.command, .option], #selector(NSApplication.hideOtherApplications(_:)), NSApp),
  mi("Show All", "", [], #selector(NSApplication.unhideAllApplications(_:)), NSApp), sep(),
  mi("Quit MenuProbe", "q"),
])
let fileMenu = menu("File", [
  mi("New Document", "n"), mi("Open…", "o"),
  sub("Open Recent", [mi("Clear Menu", "", [], nil)]), sep(),
  mi("Close", "w", .command, #selector(NSWindow.performClose(_:)), std),
  mi("Save", "s", .command, #selector(NSDocument.save(_:)), std),
  mi("Duplicate", "s", [.command, .shift], #selector(NSDocument.duplicate(_:)), std),
  mi("Rename…", "", [], #selector(NSDocument.rename(_:)), std),
  mi("Move To…", "", [], #selector(NSDocument.move(_:)), std),
  mi("Export As…", "", [], nil), sep(),
  mi("Page Setup…", "p", [.command, .shift], #selector(NSApplication.runPageLayout(_:)), std),
  mi("Print…", "p", .command, #selector(NSView.printView(_:)), std),
])
let editMenu = menu("Edit", [
  mi("Undo", "z", .command, Selector(("undo:")), std), mi("Redo", "z", [.command, .shift], Selector(("redo:")), std), sep(),
  mi("Cut", "x", .command, #selector(NSText.cut(_:)), std), mi("Copy", "c", .command, #selector(NSText.copy(_:)), std),
  mi("Paste", "v", .command, #selector(NSText.paste(_:)), std),
  mi("Paste and Match Style", "v", [.command, .option, .shift], #selector(NSTextView.pasteAsPlainText(_:)), std),
  mi("Delete", "", [], #selector(NSText.delete(_:)), std), mi("Select All", "a", .command, #selector(NSText.selectAll(_:)), std), sep(),
  sub("Find", [mi("Find…", "f"), mi("Find Next", "g"), mi("Find Previous", "g", [.command, .shift]), mi("Use Selection for Find", "e"), mi("Jump to Selection", "j")]),
  sub("Spelling and Grammar", [mi("Show Spelling and Grammar", ":"), mi("Check Document Now", ";")]),
  sub("Substitutions", [mi("Smart Quotes", "", [])]),
  sub("Transformations", [mi("Make Uppercase", "", [])]),
  sub("Speech", [mi("Start Speaking", "", [])]),
])
let formatMenu = menu("Format", [
  sub("Font", [mi("Show Fonts", "t"), mi("Bold", "b"), mi("Italic", "i"), mi("Underline", "u")]),
  sub("Text", [mi("Align Left", "{"), mi("Center", "|"), mi("Align Right", "}")]),
])
let viewMenu = menu("View", [
  mi("Show Toolbar", "t", [.command, .option], #selector(NSWindow.toggleToolbarShown(_:)), std),
  mi("Customize Toolbar…", "", [], #selector(NSWindow.runToolbarCustomizationPalette(_:)), std), sep(),
  mi("Show Sidebar", "s", [.command, .control], #selector(NSSplitViewController.toggleSidebar(_:)), std),
])
// 应用自己的菜单：用来看系统怎么画快捷键
let keysMenu = menu("Keys", [
  mi("Command Only", "k"), mi("Add Shift", "k", [.command, .shift]),
  mi("All Four Modifiers", "k", [.command, .shift, .option, .control]), sep(),
  mi("Help (Command-?)", "?"), mi("Shift-Command-Slash", "/", [.command, .shift]),
  // 关掉按键盘布局自动改写快捷键，看系统原样怎么画
  { let i = mi("Command-? Not Localized", "?"); i.allowsAutomaticKeyEquivalentLocalization = false; return i }(),
  { let i = mi("Shift-Command-/ Not Localized", "/", [.command, .shift]); i.allowsAutomaticKeyEquivalentLocalization = false; return i }(), sep(),
  mi("Unavailable Item", "", [], nil),
])
let windowMenu = menu("Window", [
  mi("Minimize", "m", .command, #selector(NSWindow.performMiniaturize(_:)), std),
  mi("Zoom", "", [], #selector(NSWindow.performZoom(_:)), std), sep(),
  mi("Bring All to Front", "", [], #selector(NSApplication.arrangeInFront(_:)), std),
])
let helpMenu = menu("Help", [mi("MenuProbe Help", "?", .command, #selector(NSApplication.showHelp(_:)), NSApp)])
let mainMenu = NSMenu(title: "Main")
[appMenu, fileMenu, editMenu, formatMenu, viewMenu, keysMenu, windowMenu, helpMenu].forEach { mainMenu.addItem($0) }
app.mainMenu = mainMenu
app.servicesMenu = services
app.windowsMenu = windowMenu.submenu
app.helpMenu = helpMenu.submenu

// 窗口：左边弹出按钮（互斥选项），右边下拉按钮（动作）
let win = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 720, height: 540), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
win.title = "MenuProbe"
win.isRestorable = false
// 用户可能停在别的应用的全屏空间里：让窗口加入当前空间，避免激活时切换空间
win.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
let cv = win.contentView!
let label = NSTextField(labelWithString: "Size:")
let popUp = NSPopUpButton(frame: .zero, pullsDown: false)
popUp.addItems(withTitles: ["Small", "Medium", "Large", "Custom…"])
popUp.selectItem(at: 1)
let pullDown = NSPopUpButton(frame: .zero, pullsDown: true)
pullDown.addItems(withTitles: ["Add", "Folder", "File", "Link"])
for v in [label, popUp, pullDown] as [NSView] { v.translatesAutoresizingMaskIntoConstraints = false; cv.addSubview(v) }
NSLayoutConstraint.activate([
  label.leadingAnchor.constraint(equalTo: cv.leadingAnchor, constant: 24),
  popUp.leadingAnchor.constraint(equalTo: label.trailingAnchor, constant: 8),
  popUp.topAnchor.constraint(equalTo: cv.topAnchor, constant: 24),
  label.firstBaselineAnchor.constraint(equalTo: popUp.firstBaselineAnchor),
  pullDown.leadingAnchor.constraint(equalTo: popUp.trailingAnchor, constant: 48),
  pullDown.centerYAnchor.constraint(equalTo: popUp.centerYAnchor),
])
let contextMenu = NSMenu(title: "")
for t in ["Open", "Get Info", "Rename", "Duplicate"] { contextMenu.addItem(mi(t)) }
contextMenu.addItem(sep())
for t in ["Copy", "Share…"] { contextMenu.addItem(mi(t)) }
contextMenu.addItem(sep())
contextMenu.addItem(mi("Move to Trash"))

// 菜单结构：标题、快捷键（按系统顺序拼成 ⌃⌥⇧⌘）、可用、隐藏、备选项
func shortcut(_ i: NSMenuItem) -> String {
  if i.keyEquivalent.isEmpty { return "" }
  let m = i.keyEquivalentModifierMask
  return (m.contains(.control) ? "⌃" : "") + (m.contains(.option) ? "⌥" : "") + (m.contains(.shift) ? "⇧" : "") + (m.contains(.command) ? "⌘" : "") + i.keyEquivalent.uppercased()
}
func tree(_ m: NSMenu, depth: Int) -> [[String: Any]] {
  m.update()
  return m.items.map { i in
    var d: [String: Any] = ["title": i.title, "enabled": i.isEnabled]
    if !i.keyEquivalent.isEmpty { d["keyEquivalent"] = i.keyEquivalent; d["autoLocalize"] = i.allowsAutomaticKeyEquivalentLocalization }
    if i.isSeparatorItem { d = ["separator": true] }
    let s = shortcut(i); if !s.isEmpty { d["shortcut"] = s }
    if i.isHidden { d["hidden"] = true }
    if i.isAlternate { d["alternate"] = true }
    // 服务菜单里是本机装的软件，只记项数
    if let sm = i.submenu, sm === services { d["submenu"] = [] as [Any]; d["submenuItemCount"] = sm.items.count; return d }
    if let sm = i.submenu { d["submenu"] = depth > 0 ? tree(sm, depth: depth - 1) : [["count": sm.items.count]]; d["submenuSize"] = ["w": r(sm.size.width), "h": r(sm.size.height)] }
    return d
  }
}

// 截图：本进程所有在屏幕上的窗口（主窗口 + 菜单窗口）
func ownWindows() -> [[String: Any]] {
  let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] ?? []
  return list.filter { ($0[kCGWindowOwnerPID as String] as? Int32) == getpid() }.map { w in
    let b = w[kCGWindowBounds as String] as? [String: Double] ?? [:]
    return ["number": w[kCGWindowNumber as String] as? Int ?? 0, "layer": w[kCGWindowLayer as String] as? Int ?? 0,
            "bounds": ["x": b["X"] ?? 0.0, "y": b["Y"] ?? 0.0, "w": b["Width"] ?? 0.0, "h": b["Height"] ?? 0.0] as [String: Double]]
  }
}
func shoot(_ num: Int, _ file: String) {
  let p = Process(); p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
  p.arguments = ["-x", "-o", "-l", String(num), "\(outDir)/\(file).png"]; try? p.run(); p.waitUntilExit()
}
var captures: [String: Any] = [:]
let t0 = Date()
func capture(_ name: String) {
  let ws = ownWindows()
  var files: [[String: Any]] = []
  for w in ws {
    let n = w["number"] as! Int, b = w["bounds"] as! [String: Double]
    if (b["h"] ?? 0) < 8 { continue }
    let f = "\(name)-\(mode)-w\(n)"
    shoot(n, f)
    files.append(w.merging(["file": f + ".png"]) { x, _ in x })
  }
  captures[name] = ["windows": files, "mainWindow": win.windowNumber, "mainFrame": rect(win.frame),
                    "t": r(CGFloat(Date().timeIntervalSince(t0))), "mouse": ["x": r(NSEvent.mouseLocation.x), "y": r(NSEvent.mouseLocation.y)]]
}
var axProc: Process?
func axDump(_ name: String) {
  let p = Process(); p.executableURL = URL(fileURLWithPath: axTool)
  p.arguments = ["dump", String(getpid()), "\(outDir)/\(name)-\(mode)-ax.json"]
  // 取最大的那个菜单窗口，读它中心点下的菜单
  let menus = ((captures[name] as? [String: Any])?["windows"] as? [[String: Any]] ?? []).filter { ($0["layer"] as? Int ?? 0) > 0 }
  if let m = menus.max(by: { (($0["bounds"] as! [String: Double])["h"]!) < (($1["bounds"] as! [String: Double])["h"]!) }) {
    let b = m["bounds"] as! [String: Double]
    p.arguments! += [String(b["x"]! + b["w"]! / 2), String(b["y"]! + b["h"]! / 2)]
  }
  try? p.run(); axProc = p
}
func press(_ title: String) {
  let p = Process(); p.executableURL = URL(fileURLWithPath: axTool)
  p.arguments = ["press", String(getpid()), title]; try? p.run()
}

var current = ""
var trackingMenu: NSMenu?
func addTimer(_ after: Double, _ f: @escaping () -> Void) {
  let t = Timer(timeInterval: after, repeats: false) { _ in f() }
  RunLoop.main.add(t, forMode: .common)
}
NotificationCenter.default.addObserver(forName: NSMenu.didBeginTrackingNotification, object: nil, queue: nil) { n in
  guard trackingMenu == nil, !current.isEmpty else { return }
  trackingMenu = n.object as? NSMenu
  let name = current
  addTimer(0.3) {
    if name.hasPrefix("search:") {
      // 先在搜索框里填词，等结果出来再拍
      let ws = ownWindows().filter { ($0["layer"] as? Int ?? 0) > 0 }
      guard let b = ws.first?["bounds"] as? [String: Double] else { trackingMenu?.cancelTracking(); return }
      let p = Process(); p.executableURL = URL(fileURLWithPath: axTool)
      p.arguments = ["search", String(getpid()), String(b["x"]! + 60), String(b["y"]! + 20), String(name.dropFirst(7)), "\(outDir)/search-\(mode)-ax.json"]
      try? p.run(); axProc = p
      func waitSearch() {
        if axProc?.isRunning == true { addTimer(0.05, waitSearch); return }
        addTimer(0.3) { capture(name); trackingMenu?.cancelTracking(); trackingMenu = nil; current = ""; DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { next() } }
      }
      waitSearch(); return
    }
    capture(name)
    axDump(name)
    func waitAX() {
      if axProc?.isRunning == true { addTimer(0.05, waitAX); return }
      trackingMenu?.cancelTracking()
      trackingMenu = nil; current = ""
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { next() }
    }
    waitAX()
  }
}
func next() {
  guard !steps.isEmpty else { finish(); return }
  let s = steps.removeFirst()
  current = s
  win.makeKeyAndOrderFront(nil)
  switch s {
  case "window":
    capture("window"); current = ""; DispatchQueue.main.async { next() }
  case "popup": popUp.performClick(nil)
  case "pulldown": pullDown.performClick(nil)
  case "context": contextMenu.popUp(positioning: nil, at: NSPoint(x: 420, y: 380), in: cv)
  default:
    if s.hasPrefix("bar:") { press(String(s.dropFirst(4))) }
    if s.hasPrefix("search:") { press("Help") }
    if s.hasPrefix("pop:"), let m = mainMenu.item(withTitle: String(s.dropFirst(4)))?.submenu {
      m.popUp(positioning: nil, at: NSPoint(x: 240, y: 470), in: cv)
    }
  }
}
func finish() {
  meta["captures"] = captures
  meta["mainMenuAfter"] = tree(mainMenu, depth: 2)
  save()
  exit(0)
}

DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
  // 窗口贴在菜单栏下面的左上角：菜单栏菜单落在自己的窗口上，玻璃背后透出来的是探针窗口，不是用户的内容
  win.setFrameTopLeftPoint(NSPoint(x: 0, y: NSScreen.main!.visibleFrame.maxY))
  meta["mouseAtStart"] = ["x": r(NSEvent.mouseLocation.x), "y": r(NSEvent.mouseLocation.y)]
  win.makeKeyAndOrderFront(nil)
  app.activate(ignoringOtherApps: true)
  // 静态读数：菜单栏、屏幕、字体、各菜单的 size、弹出 / 下拉按钮
  let scr = NSScreen.main!
  meta["menuBarHeightAPI"] = r(mainMenu.menuBarHeight)
  meta["statusBarThickness"] = r(NSStatusBar.system.thickness)
  meta["screen"] = ["frame": rect(scr.frame), "visible": rect(scr.visibleFrame), "safeTop": r(scr.safeAreaInsets.top),
                    "auxTopLeft": rect(scr.auxiliaryTopLeftArea ?? .zero), "auxTopRight": rect(scr.auxiliaryTopRightArea ?? .zero),
                    "visibleTopGap": r(scr.frame.maxY - scr.visibleFrame.maxY)]
  let mf = NSFont.menuFont(ofSize: 0), mbf = NSFont.menuBarFont(ofSize: 0)
  meta["fonts"] = ["menuFont": ["name": mf.fontName, "size": r(mf.pointSize)], "menuBarFont": ["name": mbf.fontName, "size": r(mbf.pointSize)]]
  var sizes: [String: Any] = [:]
  for it in mainMenu.items { if let m = it.submenu { sizes[it.title] = ["w": r(m.size.width), "h": r(m.size.height), "items": m.items.count] } }
  sizes["context"] = ["w": r(contextMenu.size.width), "h": r(contextMenu.size.height), "items": contextMenu.items.count]
  meta["menuSizes"] = sizes
  meta["mainMenuAtLaunch"] = tree(mainMenu, depth: 1)
  DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
    cv.layoutSubtreeIfNeeded()
    func b(_ v: NSView) -> [String: Any] { ["frameInWindow": rect(v.convert(v.bounds, to: nil)), "fitting": ["w": r(v.fittingSize.width), "h": r(v.fittingSize.height)]] }
    meta["buttons"] = ["popUp": b(popUp), "pullDown": b(pullDown), "label": b(label)]
    meta["mainFrame"] = rect(win.frame)
    next()
  }
}
app.run()
