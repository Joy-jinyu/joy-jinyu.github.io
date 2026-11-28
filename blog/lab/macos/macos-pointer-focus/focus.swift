import AppKit
// 用法：打成 .app 后 open -n -W FocusProbe.app --args <输出目录> <light|dark|controls> [force]
// 量指针与焦点：焦点环（截图交给 shoot.sh）、Tab 键视图循环、选中色（活动 / 非活动）、
// 每个视图的 tracking area（谁在听悬停）、命中区（hitTest）。标准光标见 cursors.swift。
// controls 模式只截按钮、复选框、分段、弹出按钮被设成 first responder 的样子。
// 第三个参数 force：应用拿不到前台时，让窗口自称 key（isKeyWindow 返回 true），用来画出 key 窗口的外观。
let outDir = CommandLine.arguments[1]
let mode = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "light"
let force = CommandLine.arguments.contains("force")
final class KeyWin: NSWindow {
  static var force = false
  override var isKeyWindow: Bool { KeyWin.force || super.isKeyWindow }
}
let app = NSApplication.shared
app.setActivationPolicy(.regular)
if mode == "dark" { app.appearance = NSAppearance(named: .darkAqua) } else { app.appearance = NSAppearance(named: .aqua) }

func r(_ x: CGFloat) -> Double { (Double(x) * 100).rounded() / 100 }
func wait(_ s: Double) { RunLoop.current.run(until: Date().addingTimeInterval(s)) }
var shots: [String: Any] = [:]
// .app 没有录屏权限：写请求文件，终端里的 shoot.sh 按窗口号截图
func shoot(_ w: NSWindow, _ file: String) {
  let name = "\(mode)-\(file)"
  shots[name] = ["key": w.isKeyWindow, "main": w.isMainWindow, "forcedKey": KeyWin.force, "active": NSApp.isActive,
                 "firstResponder": w.firstResponder.map { String(describing: type(of: $0)) } ?? "nil"]
  let png = "\(outDir)/\(name).png", failed = png + ".failed"
  // 偶尔 screencapture 报 could not create image from window，重试一次
  for _ in 0..<2 {
    try? FileManager.default.removeItem(atPath: failed)
    try? "\(w.windowNumber) \(Int(w.frame.width * 2)) \(Int(w.frame.height * 2))".write(toFile: "\(outDir)/\(name).req", atomically: true, encoding: .utf8)
    let deadline = Date().addingTimeInterval(5)
    while !FileManager.default.fileExists(atPath: png) && !FileManager.default.fileExists(atPath: failed) && Date() < deadline { wait(0.05) }
    if FileManager.default.fileExists(atPath: png) { break }
    wait(0.3)
  }
  wait(0.05)
}

final class TB: NSObject, NSToolbarDelegate {
  let ids: [NSToolbarItem.Identifier] = [NSToolbarItem.Identifier("add"), .flexibleSpace]
  func toolbarDefaultItemIdentifiers(_ t: NSToolbar) -> [NSToolbarItem.Identifier] { ids }
  func toolbarAllowedItemIdentifiers(_ t: NSToolbar) -> [NSToolbarItem.Identifier] { ids }
  func toolbar(_ t: NSToolbar, itemForItemIdentifier id: NSToolbarItem.Identifier, willBeInsertedIntoToolbar f: Bool) -> NSToolbarItem? {
    let it = NSToolbarItem(itemIdentifier: id)
    it.label = "Add"; it.toolTip = "Add an item"
    it.image = NSImage(systemSymbolName: "plus", accessibilityDescription: "Add")
    it.isBordered = true
    it.target = NSApp; it.action = #selector(NSApplication.orderFrontStandardAboutPanel(_:))
    return it
  }
}
final class DS: NSObject, NSTableViewDataSource, NSTableViewDelegate {
  let rows = ["Inbox", "Drafts", "Sent", "Archive"]
  func numberOfRows(in t: NSTableView) -> Int { rows.count }
  func tableView(_ t: NSTableView, viewFor c: NSTableColumn?, row: Int) -> NSView? {
    let f = NSTextField(labelWithString: rows[row]); return f
  }
}
let tbd = TB(), ds = DS()

let w = KeyWin(contentRect: NSRect(x: 200, y: 200, width: 440, height: 330),
                 styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
w.title = "Focus"
let tb = NSToolbar(identifier: "focus"); tb.delegate = tbd; tb.displayMode = .iconOnly; w.toolbar = tb; w.toolbarStyle = .unified
w.isReleasedWhenClosed = false
let content = NSView(frame: NSRect(x: 0, y: 0, width: 440, height: 330))
w.contentView = content
// 内容区从标题栏下面开始；y 用「离内容区顶边」写，便于读
let top: CGFloat = 330 - 52
func place(_ v: NSView, _ x: CGFloat, _ y: CGFloat, _ wd: CGFloat? = nil) {
  (v as? NSControl)?.sizeToFit()
  let s = v.fittingSize
  v.frame = NSRect(x: x, y: top - y - s.height, width: wd ?? s.width, height: s.height)
  content.addSubview(v)
}
let field = NSTextField(string: "Hello"); field.placeholderString = "Name"
place(field, 20, 16, 180)
let search = NSSearchField(); search.placeholderString = "Search"
place(search, 220, 16, 180)
let ok = NSButton(title: "OK", target: nil, action: nil); ok.bezelStyle = .push
place(ok, 20, 56)
let cancel = NSButton(title: "Cancel", target: nil, action: nil); cancel.bezelStyle = .push
place(cancel, 90, 56)
let check = NSButton(checkboxWithTitle: "Remember me", target: nil, action: nil)
place(check, 190, 58)
let seg = NSSegmentedControl(labels: ["Day", "Week", "Month"], trackingMode: .selectOne, target: nil, action: nil); seg.selectedSegment = 0
place(seg, 20, 96)
let pop = NSPopUpButton(frame: .zero, pullsDown: false); pop.addItems(withTitles: ["Small", "Medium", "Large"])
place(pop, 220, 96)
let recessed = NSButton(title: "Recessed", target: nil, action: nil); recessed.bezelStyle = .recessed; recessed.showsBorderOnlyWhileMouseInside = true
place(recessed, 330, 58)
ok.toolTip = "Save changes"
let table = NSTableView(); table.headerView = nil; table.style = .inset
let col = NSTableColumn(identifier: .init("c")); col.width = 160; table.addTableColumn(col)
table.dataSource = ds; table.delegate = ds
let scroll = NSScrollView(frame: NSRect(x: 20, y: top - 136 - 120, width: 200, height: 120))
scroll.documentView = table; scroll.hasVerticalScroller = true
content.addSubview(scroll)
let link = NSTextField(labelWithAttributedString: NSAttributedString(string: "apple.com", attributes: [.link: URL(string: "https://www.apple.com")!]))
link.isSelectable = true; link.allowsEditingTextAttributes = true
place(link, 240, 150)
let named: [(String, NSView)] = [("textField", field), ("searchField", search), ("pushOK", ok), ("pushCancel", cancel),
                                  ("checkbox", check), ("segmented", seg), ("popUp", pop), ("recessed", recessed), ("table", table), ("link", link)]

func winRect(_ v: NSView) -> [String: Double] {
  let f = v.convert(v.bounds, to: nil)
  return ["x": r(f.minX), "top": r(w.frame.height - f.maxY), "w": r(f.width), "h": r(f.height)]
}
func nameOf(_ resp: NSResponder?) -> String {
  guard let resp = resp else { return "nil" }
  if let tv = resp as? NSTextView, tv.isFieldEditor, let d = tv.delegate as? NSView {
    return named.first { $0.1 === d }.map { $0.0 + "(fieldEditor)" } ?? "fieldEditor"
  }
  if let v = resp as? NSView { return named.first { $0.1 === v }?.0 ?? String(describing: type(of: v)) }
  return String(describing: type(of: resp))
}

var out: [String: Any] = ["mode": mode]
out["system"] = [
  "isFullKeyboardAccessEnabled": NSApp.isFullKeyboardAccessEnabled,
  "AppleKeyboardUIMode(incl. argument domain)": UserDefaults.standard.object(forKey: "AppleKeyboardUIMode") ?? "unset",
  "swipeTrackingFromScrollEvents": NSEvent.isSwipeTrackingFromScrollEventsEnabled,
  "doubleClickInterval": NSEvent.doubleClickInterval,
  "NSInitialToolTipDelay": UserDefaults.standard.object(forKey: "NSInitialToolTipDelay") ?? "unset",
]

w.autorecalculatesKeyViewLoop = true
w.makeKeyAndOrderFront(nil)
app.activate()
for _ in 0..<20 where !(NSApp.isActive && w.isKeyWindow) { wait(0.1) }
out["activatedWithin2s"] = NSApp.isActive
KeyWin.force = force
w.recalculateKeyViewLoop()
wait(0.3)
table.selectRowIndexes(IndexSet(integer: 1), byExtendingSelection: false)
out["frames"] = Dictionary(uniqueKeysWithValues: named.map { ($0.0, winRect($0.1)) })
out["canBecomeKeyView"] = Dictionary(uniqueKeysWithValues: named.map { ($0.0, $0.1.canBecomeKeyView) })
out["acceptsFirstResponder"] = Dictionary(uniqueKeysWithValues: named.map { ($0.0, $0.1.acceptsFirstResponder) })

// 1. 没有焦点的底图（先让文本框拿一次焦点再放掉，第一次建 field editor 时窗口会重建图层，截图会失败）
w.makeFirstResponder(field); wait(0.3)
w.makeFirstResponder(nil); wait(0.3)
shoot(w, "none")
// 2. 逐个设成 first responder 截图（焦点环有出现动画，等 0.4 秒）
let targets: [(String, NSView)] = mode == "controls"
  ? [("pushOK", ok), ("checkbox", check), ("segmented", seg), ("popUp", pop)]
  : [("textField", field), ("searchField", search), ("pushOK", ok), ("table", table)]
var became: [String: Any] = [:]
for (n, v) in targets {
  let ok2 = w.makeFirstResponder(v); wait(0.4)
  became[n] = ["returned": ok2, "firstResponder": nameOf(w.firstResponder)]
  shoot(w, "focus-\(n)")
}
out["makeFirstResponder"] = became
// 3. 模拟 Tab：从文本框出发连续 selectNextKeyView，记下焦点经过哪些视图
w.makeFirstResponder(field); wait(0.1)
var loop = [nameOf(w.firstResponder)]
// 合成 Tab 键（keyCode 48）只发给本窗口，走 AppKit 自己的 Tab 处理
for _ in 0..<10 {
  if let e = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [], timestamp: 0, windowNumber: w.windowNumber, context: nil,
                              characters: "\t", charactersIgnoringModifiers: "\t", isARepeat: false, keyCode: 48) { w.sendEvent(e) }
  wait(0.05); loop.append(nameOf(w.firstResponder))
}
out["tabLoop"] = loop

if mode != "controls" {
  // 4. 列表选中：列表是 first responder（强调）vs 焦点在文本框（不强调）
  w.makeFirstResponder(table); wait(0.3); shoot(w, "sel-tableFocused")
  w.makeFirstResponder(field); wait(0.3); shoot(w, "sel-fieldFocused")
  // 5. 合成悬停：对按钮的每个 tracking area，造一个带这个区域的 mouseEntered 发给区域的 owner。
  //    不是真实指针；用 showsBorderOnlyWhileMouseInside 的 recessed 按钮验证这个方法本身是否有效。
  w.makeFirstResponder(nil); wait(0.2); shoot(w, "hover-before")
  func views(_ v: NSView) -> [NSView] { [v] + v.subviews.flatMap(views) }
  let tbButtons = views(content.superview!).filter { String(describing: type(of: $0)) == "NSToolbarButton" }
  var sent: [String] = []
  for (n, b) in [("pushOK", ok as NSView), ("pushCancel", cancel), ("recessed", recessed), ("checkbox", check)] + tbButtons.map { ("toolbarButton", $0) } {
    if b.trackingAreas.isEmpty { sent.append("\(n) -> no tracking area") }
    for a in b.trackingAreas where a.options.contains(.mouseEnteredAndExited) {
      let c = b.convert(NSPoint(x: b.bounds.midX, y: b.bounds.midY), to: nil)
      if let e = NSEvent.enterExitEvent(with: .mouseEntered, location: c, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime,
                                         windowNumber: w.windowNumber, context: nil, eventNumber: 0,
                                         trackingNumber: Int(bitPattern: Unmanaged.passUnretained(a).toOpaque()), userData: nil),
         let owner = a.owner as? NSObject {
        let sel = #selector(NSResponder.mouseEntered(with:))
        let responds = owner.responds(to: sel)
        if responds { owner.perform(sel, with: e) }
        sent.append("\(n) -> owner \(String(describing: type(of: owner))) responds=\(responds) trackingArea=\(e.trackingArea === a)")
      } else { sent.append("\(n) -> owner nil") }
    }
  }
  out["hoverSent"] = sent
  wait(0.4); shoot(w, "hover-after")
  // 6. 两种「不是 key」：面板拿走键盘（本窗口仍是 main）、同应用另一个窗口成了 key 和 main
  w.makeFirstResponder(table); wait(0.1)
  KeyWin.force = false
  let panel = NSPanel(contentRect: NSRect(x: 700, y: 200, width: 200, height: 120), styleMask: [.titled, .utilityWindow], backing: .buffered, defer: false)
  panel.title = "Panel"; panel.isReleasedWhenClosed = false; panel.becomesKeyOnlyIfNeeded = false
  panel.makeKeyAndOrderFront(nil); wait(0.5)
  shoot(w, "sel-mainNotKey")
  panel.close()
  let w3 = NSWindow(contentRect: NSRect(x: 700, y: 200, width: 200, height: 120), styleMask: [.titled, .closable], backing: .buffered, defer: false)
  w3.title = "Other"; w3.isReleasedWhenClosed = false
  w3.makeKeyAndOrderFront(nil); w3.makeMain(); wait(0.5)
  shoot(w, "sel-otherWindowMain")
  w3.close()
}
out["shots"] = shots

// 7. 谁在听悬停：遍历整棵视图树（含标题栏），记下每个 tracking area 的选项
func opts(_ o: NSTrackingArea.Options) -> [String] {
  var s: [String] = []
  let m: [(NSTrackingArea.Options, String)] = [(.mouseEnteredAndExited, "enteredExited"), (.mouseMoved, "moved"), (.cursorUpdate, "cursorUpdate"),
    (.activeWhenFirstResponder, "whenFirstResponder"), (.activeInKeyWindow, "inKeyWindow"), (.activeInActiveApp, "inActiveApp"),
    (.activeAlways, "always"), (.assumeInside, "assumeInside"), (.inVisibleRect, "inVisibleRect"), (.enabledDuringMouseDrag, "duringDrag")]
  for (k, n) in m where o.contains(k) { s.append(n) }
  return s
}
var areas: [[String: Any]] = []
func walk(_ v: NSView, _ depth: Int) {
  if !v.trackingAreas.isEmpty {
    let label = named.first { $0.1 === v }?.0
    areas.append(["class": String(describing: type(of: v)), "name": label ?? "", "depth": depth, "frame": winRect(v),
                  "areas": v.trackingAreas.map { ["options": opts($0.options), "rect": [r($0.rect.minX), r($0.rect.minY), r($0.rect.width), r($0.rect.height)]] }])
  }
  for s in v.subviews { walk(s, depth + 1) }
}
if let theme = content.superview { walk(theme, 0) }
out["trackingAreas"] = areas

// 8. 命中区：控件 frame 外 1 pt、内 1 pt、复选框文字上，hitTest 落到谁
if let theme = content.superview {
  var hits: [String: Any] = [:]
  for (n, v) in [("pushOK", ok as NSView), ("checkbox", check), ("textField", field)] {
    let f = v.convert(v.bounds, to: nil)
    let pts: [(String, NSPoint)] = [("inLeft+1", NSPoint(x: f.minX + 1, y: f.midY)), ("outLeft-1", NSPoint(x: f.minX - 1, y: f.midY)),
      ("inTop-1", NSPoint(x: f.midX, y: f.maxY - 1)), ("outTop+1", NSPoint(x: f.midX, y: f.maxY + 1)),
      ("inRight-1", NSPoint(x: f.maxX - 1, y: f.midY)), ("outRight+1", NSPoint(x: f.maxX + 1, y: f.midY))]
    hits[n] = Dictionary(uniqueKeysWithValues: pts.map { p in
      let h = theme.hitTest(p.1)
      var hv = h; while let x = hv, !named.contains(where: { $0.1 === x }) { hv = x.superview }
      return (p.0, hv.map { nameOf($0) } ?? (h.map { String(describing: type(of: $0)) } ?? "nil"))
    })
  }
  out["hitTest"] = hits
}

// 9. 焦点色、选中色（本进程外观下解析成 sRGB）
func hex(_ c: NSColor) -> String {
  var res = ""
  w.contentView!.effectiveAppearance.performAsCurrentDrawingAppearance {
    let s = c.usingColorSpace(.sRGB) ?? c
    res = String(format: "#%02X%02X%02X a=%.3f", Int((s.redComponent * 255).rounded()), Int((s.greenComponent * 255).rounded()), Int((s.blueComponent * 255).rounded()), s.alphaComponent)
  }
  return res
}
out["colors"] = ["keyboardFocusIndicatorColor": hex(.keyboardFocusIndicatorColor), "controlAccentColor": hex(.controlAccentColor),
                 "selectedContentBackgroundColor": hex(.selectedContentBackgroundColor),
                 "unemphasizedSelectedContentBackgroundColor": hex(.unemphasizedSelectedContentBackgroundColor),
                 "alternateSelectedControlTextColor": hex(.alternateSelectedControlTextColor),
                 "selectedTextBackgroundColor": hex(.selectedTextBackgroundColor),
                 "unemphasizedSelectedTextBackgroundColor": hex(.unemphasizedSelectedTextBackgroundColor), "linkColor": hex(.linkColor)]


let data = try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .sortedKeys])
try! data.write(to: URL(fileURLWithPath: "\(outDir)/focus-\(mode).json"))
try? "done".write(toFile: "\(outDir)/\(mode).done", atomically: true, encoding: .utf8)
exit(0)
