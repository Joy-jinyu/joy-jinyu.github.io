import AppKit
// 用法：gallery <输出目录>。开几种标准窗口，量窗口外壳，截图（浅色/深色），然后退出。
let outDir = CommandLine.arguments[1]
let app = NSApplication.shared
app.setActivationPolicy(.regular)
func r(_ x: CGFloat) -> Double { (Double(x) * 100).rounded() / 100 }
func rect(_ f: NSRect) -> [String: Double] { ["x": r(f.origin.x), "y": r(f.origin.y), "w": r(f.width), "h": r(f.height)] }

final class TB: NSObject, NSToolbarDelegate {
  let ids: [NSToolbarItem.Identifier] = [.toggleSidebar, .sidebarTrackingSeparator, NSToolbarItem.Identifier("add"), .flexibleSpace, NSToolbarItem.Identifier("share"), NSToolbarItem.Identifier("search")]
  func toolbarDefaultItemIdentifiers(_ t: NSToolbar) -> [NSToolbarItem.Identifier] { ids }
  func toolbarAllowedItemIdentifiers(_ t: NSToolbar) -> [NSToolbarItem.Identifier] { ids }
  func toolbar(_ t: NSToolbar, itemForItemIdentifier id: NSToolbarItem.Identifier, willBeInsertedIntoToolbar f: Bool) -> NSToolbarItem? {
    if id.rawValue == "search" { let s = NSSearchToolbarItem(itemIdentifier: id); return s }
    let it = NSToolbarItem(itemIdentifier: id)
    it.label = id.rawValue.capitalized
    it.image = NSImage(systemSymbolName: id.rawValue == "add" ? "plus" : "square.and.arrow.up", accessibilityDescription: id.rawValue)
    it.isBordered = true
    it.target = NSApp; it.action = #selector(NSApplication.orderFrontStandardAboutPanel(_:))
    return it
  }
}
let tbd = TB()

final class Side: NSObject, NSOutlineViewDataSource, NSOutlineViewDelegate {
  let items = ["Inbox", "Drafts", "Sent", "Archive", "Trash"]
  func outlineView(_ o: NSOutlineView, numberOfChildrenOfItem item: Any?) -> Int { item == nil ? items.count : 0 }
  func outlineView(_ o: NSOutlineView, child i: Int, ofItem item: Any?) -> Any { items[i] }
  func outlineView(_ o: NSOutlineView, isItemExpandable item: Any) -> Bool { false }
  func outlineView(_ o: NSOutlineView, viewFor c: NSTableColumn?, item: Any) -> NSView? {
    let v = NSTableCellView(); let tf = NSTextField(labelWithString: item as! String); let iv = NSImageView(image: NSImage(systemSymbolName: "tray", accessibilityDescription: nil)!)
    v.addSubview(iv); v.addSubview(tf); v.textField = tf; v.imageView = iv
    iv.translatesAutoresizingMaskIntoConstraints = false; tf.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([iv.leadingAnchor.constraint(equalTo: v.leadingAnchor, constant: 2), iv.centerYAnchor.constraint(equalTo: v.centerYAnchor), tf.leadingAnchor.constraint(equalTo: iv.trailingAnchor, constant: 6), tf.centerYAnchor.constraint(equalTo: v.centerYAnchor)])
    return v
  }
}
let side = Side()

var windows: [(String, NSWindow)] = []
var meta: [String: Any] = [:]
func makeWindow(_ name: String, _ size: NSSize, style: NSWindow.ToolbarStyle?, content: NSViewController? = nil) -> NSWindow {
  let w = NSWindow(contentRect: NSRect(origin: .zero, size: size), styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
  if style == nil { w.styleMask.remove(.fullSizeContentView) }
  w.title = name
  if let c = content { w.contentViewController = c; w.setContentSize(size) }
  if let s = style { let t = NSToolbar(identifier: name); t.delegate = tbd; t.displayMode = .iconOnly; w.toolbar = t; w.toolbarStyle = s }
  w.isReleasedWhenClosed = false
  windows.append((name, w)); return w
}
// 1. 无工具栏
_ = makeWindow("plain", NSSize(width: 480, height: 300), style: nil)
// 2-4. 三种工具栏样式
_ = makeWindow("unified", NSSize(width: 640, height: 320), style: .unified)
_ = makeWindow("unifiedCompact", NSSize(width: 640, height: 320), style: .unifiedCompact)
_ = makeWindow("expanded", NSSize(width: 640, height: 320), style: .expanded)
// 5. 侧边栏 + 内容（标准 Mac 应用外壳）
let split = NSSplitViewController()
let ovc = NSViewController(); let sc = NSScrollView(); let ol = NSOutlineView(); ol.style = .sourceList
let col = NSTableColumn(identifier: .init("c")); ol.addTableColumn(col); ol.outlineTableColumn = col; ol.headerView = nil
ol.dataSource = side; ol.delegate = side; sc.documentView = ol; sc.drawsBackground = false; ovc.view = sc
let sideItem = NSSplitViewItem(sidebarWithViewController: ovc)
let cvc = NSViewController(); let cv = NSView(); cvc.view = cv
let contentLabel = NSTextField(wrappingLabelWithString: "Content area. Body text uses the 13 pt system font, the default on macOS.")
contentLabel.frame = NSRect(x: 20, y: 200, width: 400, height: 40); cv.addSubview(contentLabel)
let contentItem = NSSplitViewItem(viewController: cvc)
split.addSplitViewItem(sideItem); split.addSplitViewItem(contentItem)
let shell = makeWindow("sidebar", NSSize(width: 820, height: 480), style: .unified, content: split)

// 6. 控件画廊：每行一种控件，每列一种尺寸
let gvc = NSViewController(); let gv = NSView(frame: NSRect(x: 0, y: 0, width: 760, height: 520)); gvc.view = gv
var sizes: [(String, NSControl.ControlSize)] = [("mini", .mini), ("small", .small), ("regular", .regular), ("large", .large)]
if #available(macOS 26.0, *) { sizes.append(("extraLarge", .extraLarge)) }
let makers: [(String, () -> NSControl)] = [
  ("push", { let b = NSButton(title: "Button", target: nil, action: nil); b.bezelStyle = .push; return b }),
  ("default", { let b = NSButton(title: "OK", target: nil, action: nil); b.bezelStyle = .push; b.keyEquivalent = "\r"; return b }),
  ("popUp", { let p = NSPopUpButton(frame: .zero, pullsDown: false); p.addItems(withTitles: ["Option"]); return p }),
  ("segmented", { let s = NSSegmentedControl(labels: ["One", "Two"], trackingMode: .selectOne, target: nil, action: nil); s.selectedSegment = 0; return s }),
  ("textField", { let t = NSTextField(string: "Text"); t.frame.size.width = 90; return t }),
  ("search", { let t = NSSearchField(string: ""); t.frame.size.width = 110; return t }),
  ("checkbox", { let b = NSButton(checkboxWithTitle: "Check", target: nil, action: nil); b.state = .on; return b }),
  ("switch", { let s = NSSwitch(); s.state = .on; return s }),
  ("slider", { let s = NSSlider(value: 0.5, minValue: 0, maxValue: 1, target: nil, action: nil); s.frame.size.width = 100; return s }),
]
var gal: [String: Any] = [:]
for (ri, (n, mk)) in makers.enumerated() {
  var row: [String: Any] = [:]
  for (ci, (sn, s)) in sizes.enumerated() {
    let c = mk(); c.controlSize = s; c.font = NSFont.systemFont(ofSize: NSFont.systemFontSize(for: s))
    let keepW = c.frame.width; c.sizeToFit(); if keepW > 0 && (c is NSTextField || c is NSSlider) { c.frame.size.width = keepW }
    c.frame.origin = NSPoint(x: 20 + CGFloat(ci) * 148, y: 480 - CGFloat(ri) * 52 - c.frame.height)
    gv.addSubview(c)
    row[sn] = ["frame": rect(c.frame), "alignmentRect": rect(c.alignmentRect(forFrame: c.frame)), "baselineOffset": r(c.firstBaselineOffsetFromTop)]
  }
  gal[n] = row
}
meta["gallery"] = gal
_ = makeWindow("controls", NSSize(width: 760, height: 520), style: nil, content: gvc)

for (i, (_, w)) in windows.enumerated() { w.setFrameTopLeftPoint(NSPoint(x: 40 + i * 30, y: 900 - i * 30)); w.makeKeyAndOrderFront(nil) }
app.activate(ignoringOtherApps: true)

func shot(_ w: NSWindow, _ file: String) {
  let p = Process(); p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
  p.arguments = ["-x", "-o", "-l", String(w.windowNumber), "\(outDir)/\(file).png"]; try? p.run(); p.waitUntilExit()
}
func measureAll() -> [String: Any] {
  var m: [String: Any] = [:]
  for (n, w) in windows {
    var d: [String: Any] = ["frame": rect(w.frame), "contentLayoutRect": rect(w.contentLayoutRect), "contentView": rect(w.contentView!.frame)]
    d["titlebarPlusToolbar"] = r(w.frame.height - w.contentLayoutRect.height)
    for (bn, b) in [("close", NSWindow.ButtonType.closeButton), ("miniaturize", .miniaturizeButton), ("zoom", .zoomButton)] {
      if let v = w.standardWindowButton(b) { d[bn] = rect(v.convert(v.bounds, to: nil)) }
    }
    if n == "sidebar" {
      d["sidebarWidth"] = r(sideItem.viewController.view.frame.width)
      d["sidebarMin"] = r(sideItem.minimumThickness); d["sidebarMax"] = r(sideItem.maximumThickness)
      d["rowHeight"] = r(ol.rowHeight); d["rowRect0"] = rect(ol.rect(ofRow: 0)); d["effectiveStyle"] = ol.effectiveStyle.rawValue
      if let cell = ol.view(atColumn: 0, row: 0, makeIfNecessary: false) { d["cell0InWindow"] = rect(cell.convert(cell.bounds, to: nil)) }
      d["contentLabelInWindow"] = rect(contentLabel.convert(contentLabel.bounds, to: nil))
    }
    m[n] = d
  }
  return m
}
DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
  ol.selectRowIndexes([1], byExtendingSelection: false)
  meta["windows"] = measureAll()
  app.appearance = NSAppearance(named: .aqua)
  DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
    for (n, w) in windows { w.makeKeyAndOrderFront(nil); RunLoop.current.run(until: Date().addingTimeInterval(0.4)); shot(w, "\(n)-light") }
    app.appearance = NSAppearance(named: .darkAqua)
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
      for (n, w) in windows { w.makeKeyAndOrderFront(nil); RunLoop.current.run(until: Date().addingTimeInterval(0.4)); shot(w, "\(n)-dark") }
      let data = try! JSONSerialization.data(withJSONObject: meta, options: [.prettyPrinted, .sortedKeys])
      try! data.write(to: URL(fileURLWithPath: "\(outDir)/gallery.json"))
      app.terminate(nil)
    }
  }
}
app.run()
