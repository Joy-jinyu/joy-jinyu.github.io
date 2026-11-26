import AppKit
// 用法：sidebar <输出目录>。在终端里跑（截图用终端的录屏权限），10 秒内自己退出。
// 量：NSSplitViewItem 默认宽度 / 最小 / 最大、侧边栏玻璃位置、rowSizeStyle 行高与字号图标、
// 选中行（活动 / 非活动、有无焦点、浅 / 深）、工具栏项和搜索框的位置、表格样式与交替行、窄窗口的溢出与侧边栏折叠。
// 只截探针自己的窗口（screencapture -o -l），不碰系统设置；深浅色用 window.appearance 在本进程里切。
let outDir = CommandLine.arguments[1]
let app = NSApplication.shared
app.setActivationPolicy(.regular)
func r(_ x: CGFloat) -> Double { (Double(x) * 100).rounded() / 100 }
func rect(_ f: NSRect) -> [String: Double] { ["x": r(f.origin.x), "y": r(f.origin.y), "w": r(f.width), "h": r(f.height)] }
func wait(_ s: Double) { RunLoop.current.run(until: Date().addingTimeInterval(s)) }
// 视图在窗口里的位置，换成「离窗口左上角」的坐标，和截图对得上
func topLeft(_ v: NSView) -> [String: Double] {
  guard let w = v.window else { return [:] }
  let f = v.convert(v.bounds, to: nil)
  return ["x": r(f.minX), "top": r(w.frame.height - f.maxY), "w": r(f.width), "h": r(f.height)]
}
func fontInfo(_ f: NSFont?) -> [String: Any] {
  guard let f = f else { return [:] }
  let wgt = (f.fontDescriptor.object(forKey: .traits) as? [NSFontDescriptor.TraitKey: Any])?[.weight] as? Double ?? 0
  return ["name": f.fontName, "size": r(f.pointSize), "weight": (wgt * 100).rounded() / 100]
}
var meta: [String: Any] = ["os": ProcessInfo.processInfo.operatingSystemVersionString]
var shots: [String: Any] = [:]
func shot(_ w: NSWindow, _ file: String) {
  let png = "\(outDir)/\(file).png"
  for _ in 0..<3 {  // 第一次截图偶尔报 could not create image from window，重试
    let p = Process(); p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
    p.arguments = ["-x", "-o", "-l", String(w.windowNumber), png]; try? p.run(); p.waitUntilExit()
    if FileManager.default.fileExists(atPath: png) { break }
    wait(0.1)
  }
  shots[file] = ["appActive": NSApp.isActive, "key": w.isKeyWindow, "main": w.isMainWindow, "firstResponder": w.firstResponder.map { String(describing: type(of: $0)) } ?? "nil", "ok": FileManager.default.fileExists(atPath: png)]
}

// ---------- 工具栏 ----------
let idAdd = NSToolbarItem.Identifier("add"), idShare = NSToolbarItem.Identifier("share"), idInfo = NSToolbarItem.Identifier("info")
let idSearch = NSToolbarItem.Identifier("search"), idFlag = NSToolbarItem.Identifier("flag"), idTrash = NSToolbarItem.Identifier("trash")
let symbols: [String: String] = ["add": "square.and.pencil", "share": "square.and.arrow.up", "info": "info.circle", "flag": "flag", "trash": "trash"]
final class TB: NSObject, NSToolbarDelegate {
  // 前导：侧边栏开关；跟随侧边栏的分隔；中间留空；后部：两组按钮 + 搜索
  let ids: [NSToolbarItem.Identifier] = [.toggleSidebar, .sidebarTrackingSeparator, .flexibleSpace, idAdd, idFlag, idTrash, .space, idShare, idInfo, idSearch]
  func toolbarDefaultItemIdentifiers(_ t: NSToolbar) -> [NSToolbarItem.Identifier] { ids }
  func toolbarAllowedItemIdentifiers(_ t: NSToolbar) -> [NSToolbarItem.Identifier] { ids }
  func toolbar(_ t: NSToolbar, itemForItemIdentifier id: NSToolbarItem.Identifier, willBeInsertedIntoToolbar f: Bool) -> NSToolbarItem? {
    if id == idSearch { return NSSearchToolbarItem(itemIdentifier: id) }
    let it = NSToolbarItem(itemIdentifier: id)
    it.label = id.rawValue.capitalized
    it.image = NSImage(systemSymbolName: symbols[id.rawValue]!, accessibilityDescription: id.rawValue)
    it.isBordered = true
    it.target = NSApp; it.action = #selector(NSApplication.orderFrontStandardAboutPanel(_:))
    return it
  }
}
let tbd = TB()

// ---------- 侧边栏（大纲，source list） ----------
final class Side: NSObject, NSOutlineViewDataSource, NSOutlineViewDelegate {
  let groups = ["Library", "Tags"]
  let kids: [String: [String]] = ["Library": ["Inbox", "Drafts", "Sent", "Archive", "Trash"], "Tags": ["Work", "Home"]]
  let icons = ["Inbox": "tray", "Drafts": "doc", "Sent": "paperplane", "Archive": "archivebox", "Trash": "trash", "Work": "tag", "Home": "tag"]
  func outlineView(_ o: NSOutlineView, numberOfChildrenOfItem item: Any?) -> Int { item == nil ? groups.count : (kids[item as! String]?.count ?? 0) }
  func outlineView(_ o: NSOutlineView, child i: Int, ofItem item: Any?) -> Any { item == nil ? groups[i] : kids[item as! String]![i] }
  func outlineView(_ o: NSOutlineView, isItemExpandable item: Any) -> Bool { kids[item as! String] != nil }
  func outlineView(_ o: NSOutlineView, isGroupItem item: Any) -> Bool { kids[item as! String] != nil }
  func outlineView(_ o: NSOutlineView, shouldSelectItem item: Any) -> Bool { kids[item as! String] == nil }
  func outlineView(_ o: NSOutlineView, viewFor c: NSTableColumn?, item: Any) -> NSView? {
    let name = item as! String
    let v = NSTableCellView(); let tf = NSTextField(labelWithString: name)
    v.addSubview(tf); v.textField = tf; tf.translatesAutoresizingMaskIntoConstraints = false
    if let sym = icons[name] {
      let iv = NSImageView(image: NSImage(systemSymbolName: sym, accessibilityDescription: nil)!)
      v.addSubview(iv); v.imageView = iv; iv.translatesAutoresizingMaskIntoConstraints = false
      NSLayoutConstraint.activate([iv.leadingAnchor.constraint(equalTo: v.leadingAnchor, constant: 2), iv.centerYAnchor.constraint(equalTo: v.centerYAnchor), tf.leadingAnchor.constraint(equalTo: iv.trailingAnchor, constant: 6), tf.centerYAnchor.constraint(equalTo: v.centerYAnchor)])
    } else {
      NSLayoutConstraint.activate([tf.leadingAnchor.constraint(equalTo: v.leadingAnchor, constant: 2), tf.centerYAnchor.constraint(equalTo: v.centerYAnchor)])
    }
    return v
  }
}
let side = Side()

// ---------- 内容表格 ----------
final class Rows: NSObject, NSTableViewDataSource, NSTableViewDelegate {
  let n: Int
  init(_ n: Int) { self.n = n }
  func numberOfRows(in t: NSTableView) -> Int { n }
  func tableView(_ t: NSTableView, viewFor c: NSTableColumn?, row: Int) -> NSView? {
    let v = NSTableCellView(); let s: String
    switch c?.identifier.rawValue { case "name": s = "Message \(row + 1)"; case "date": s = "Nov \(row % 28 + 1)"; default: s = "\(row * 7 % 90 + 3) KB" }
    let tf = NSTextField(labelWithString: s); tf.lineBreakMode = .byTruncatingTail
    v.addSubview(tf); v.textField = tf; tf.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([tf.leadingAnchor.constraint(equalTo: v.leadingAnchor, constant: 2), tf.trailingAnchor.constraint(lessThanOrEqualTo: v.trailingAnchor), tf.centerYAnchor.constraint(equalTo: v.centerYAnchor)])
    return v
  }
}
func makeTable(_ style: NSTableView.Style?, rows: Int, alternating: Bool) -> (NSScrollView, NSTableView, Rows) {
  let sc = NSScrollView(); let t = NSTableView(); let ds = Rows(rows)
  if let s = style { t.style = s }
  for (id, title, w) in [("name", "Name", 150.0), ("date", "Date", 70.0), ("size", "Size", 60.0)] {
    let c = NSTableColumn(identifier: .init(id)); c.title = title; c.width = w; t.addTableColumn(c)
  }
  t.usesAlternatingRowBackgroundColors = alternating
  t.dataSource = ds; t.delegate = ds; sc.documentView = t; sc.hasVerticalScroller = true
  return (sc, t, ds)
}

// ---------- 窗口 ----------
struct Shell { let w: NSWindow; let split: NSSplitViewController; let sideItem: NSSplitViewItem; let contentItem: NSSplitViewItem; let ol: NSOutlineView; let table: NSTableView?; let scroll: NSScrollView }
var keep: [AnyObject] = []
func makeShell(_ name: String, dark: Bool, colorful: Bool, size: NSSize) -> Shell {
  let w = NSWindow(contentRect: NSRect(origin: .zero, size: size), styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
  w.title = colorful ? "Photos" : "Inbox"
  w.isReleasedWhenClosed = false; w.tabbingMode = .disallowed
  if dark { w.appearance = NSAppearance(named: .darkAqua) } else { w.appearance = NSAppearance(named: .aqua) }
  let split = NSSplitViewController()
  let ovc = NSViewController(); let sc = NSScrollView(); let ol = NSOutlineView(); ol.style = .sourceList; ol.rowSizeStyle = .default  // 代码建的表默认是 custom 24 pt，要显式设 .default
  let col = NSTableColumn(identifier: .init("c")); ol.addTableColumn(col); ol.outlineTableColumn = col; ol.headerView = nil
  ol.floatsGroupRows = false
  ol.dataSource = side; ol.delegate = side; sc.documentView = ol; sc.drawsBackground = false; ovc.view = sc
  let sideItem = NSSplitViewItem(sidebarWithViewController: ovc)
  let cvc = NSViewController()
  var table: NSTableView? = nil; let scroll: NSScrollView
  if colorful {
    // 彩色条纹当内容，滚到工具栏下面，看玻璃怎么透出内容
    let sv = NSScrollView(); let doc = NSView(frame: NSRect(x: 0, y: 0, width: size.width, height: 1200))
    let cols: [NSColor] = [.systemRed, .systemOrange, .systemYellow, .systemGreen, .systemTeal, .systemBlue, .systemIndigo, .systemPurple, .systemPink]
    for i in 0..<24 { let b = NSView(frame: NSRect(x: 0, y: CGFloat(i) * 50, width: size.width, height: 50)); b.wantsLayer = true; b.layer?.backgroundColor = cols[i % cols.count].cgColor; b.autoresizingMask = [.width]; doc.addSubview(b) }
    doc.autoresizingMask = [.width]
    sv.documentView = doc; sv.hasVerticalScroller = true
    if #available(macOS 26.0, *) {
      let ext = NSBackgroundExtensionView(); ext.contentView = sv; cvc.view = ext
    } else { cvc.view = sv }
    scroll = sv
  } else {
    let (sv, t, ds) = makeTable(nil, rows: 40, alternating: false); keep.append(ds)
    cvc.view = sv; table = t; scroll = sv
  }
  let contentItem = NSSplitViewItem(viewController: cvc)
  split.addSplitViewItem(sideItem); split.addSplitViewItem(contentItem)
  w.contentViewController = split; w.setContentSize(size)
  let t = NSToolbar(identifier: "tb-\(name)"); t.delegate = tbd; t.displayMode = .iconOnly; w.toolbar = t; w.toolbarStyle = .unified
  ol.expandItem(nil, expandChildren: true)
  return Shell(w: w, split: split, sideItem: sideItem, contentItem: contentItem, ol: ol, table: table, scroll: scroll)
}
let heroL = makeShell("heroL", dark: false, colorful: true, size: NSSize(width: 720, height: 400))
let heroD = makeShell("heroD", dark: true, colorful: true, size: NSSize(width: 720, height: 400))
let mainL = makeShell("mainL", dark: false, colorful: false, size: NSSize(width: 860, height: 460))
let mainD = makeShell("mainD", dark: true, colorful: false, size: NSSize(width: 860, height: 460))

// 表格样式窗口：fullWidth / inset / plain 并排，都开交替行
func makeTables(dark: Bool) -> (NSWindow, [(String, NSTableView)]) {
  let w = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 960, height: 300), styleMask: [.titled, .closable], backing: .buffered, defer: false)
  w.title = "Tables"; w.isReleasedWhenClosed = false; w.tabbingMode = .disallowed
  w.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
  let root = NSView(frame: NSRect(x: 0, y: 0, width: 960, height: 300)); w.contentView = root
  var out: [(String, NSTableView)] = []
  for (i, (n, s)) in [("fullWidth", NSTableView.Style.fullWidth), ("inset", .inset), ("plain", .plain)].enumerated() {
    let (sc, t, ds) = makeTable(s, rows: 12, alternating: true); keep.append(ds)
    sc.frame = NSRect(x: 10 + CGFloat(i) * 315, y: 10, width: 305, height: 280); root.addSubview(sc)
    out.append((n, t))
  }
  return (w, out)
}
let (tabL, tabsL) = makeTables(dark: false)
let (tabD, tabsD) = makeTables(dark: true)

// 不显示的窗口：只做布局，量侧边栏的初始宽度（preferredThicknessFraction 0.15，夹在 140 和 250 之间）
var initW: [[String: Any]] = []
for ww in [700.0, 1000.0, 1400.0, 1800.0, 2200.0] {
  let s = makeShell("init\(Int(ww))", dark: false, colorful: false, size: NSSize(width: ww, height: 400))
  s.split.view.layoutSubtreeIfNeeded()
  initW.append(["window": r(s.w.frame.width), "sidebar": r(s.sideItem.viewController.view.frame.width)])
}
meta["sidebarInitialWidth"] = initW
meta["codeBuiltOutline"] = { let o = NSOutlineView(); o.style = .sourceList; return ["rowSizeStyle": o.rowSizeStyle.rawValue, "rowHeight": r(o.rowHeight), "effectiveRowSizeStyle": o.effectiveRowSizeStyle.rawValue] }()
var coll: [[String: Any]] = []
for ww in [700.0, 560.0, 500.0] {
  let s = makeShell("coll\(Int(ww))", dark: false, colorful: false, size: NSSize(width: 800, height: 400))
  s.contentItem.minimumThickness = 400
  s.split.view.layoutSubtreeIfNeeded()
  var f = s.w.frame; f.size.width = ww; s.w.setFrame(f, display: false); s.split.view.layoutSubtreeIfNeeded()
  coll.append(["contentMin": 400, "window": r(s.w.frame.width), "sidebar": r(s.sideItem.viewController.view.frame.width), "collapsed": s.sideItem.isCollapsed])
}
meta["sidebarCollapseOnResize"] = coll
let all: [NSWindow] = [heroL.w, heroD.w, mainL.w, mainD.w, tabL, tabD]
for (i, w) in all.enumerated() { w.setFrameTopLeftPoint(NSPoint(x: 40 + i * 24, y: 920 - i * 24)); w.orderFront(nil) }
app.activate(ignoringOtherApps: true)
mainL.w.makeKeyAndOrderFront(nil)

// ---------- 量 ----------
func dumpTree(_ v: NSView, _ depth: Int, _ out: inout [[String: Any]]) {
  let cls = String(describing: type(of: v))
  if cls.range(of: "Toolbar|Search|Title|Glass|Separator|Button|ItemViewer|Overflow", options: .regularExpression) != nil, !v.isHidden {
    var d: [String: Any] = ["class": cls, "depth": depth, "frame": topLeft(v)]
    if let t = v as? NSTextField { d["string"] = t.stringValue; d["font"] = fontInfo(t.font) }
    out.append(d)
  }
  if depth < 16 { for s in v.subviews { dumpTree(s, depth + 1, &out) } }
}
func rowInfo(_ o: NSTableView, _ row: Int) -> [String: Any] {
  var d: [String: Any] = ["rect": rect(o.rect(ofRow: row))]
  if let rv = o.rowView(atRow: row, makeIfNecessary: false) { d["rowView"] = topLeft(rv) }
  if let cell = o.view(atColumn: 0, row: row, makeIfNecessary: false) as? NSTableCellView {
    d["cell"] = topLeft(cell)
    if let tf = cell.textField { d["text"] = topLeft(tf); d["font"] = fontInfo(tf.font); d["textColor"] = tf.textColor?.description ?? "nil" }
    if let iv = cell.imageView {
      d["image"] = topLeft(iv)
      if let img = iv.image { d["imageSize"] = ["w": r(img.size.width), "h": r(img.size.height)] }
      d["symbolConfiguration"] = iv.symbolConfiguration?.description ?? "nil"
      d["contentTintColor"] = iv.contentTintColor?.description ?? "nil"
    }
  }
  return d
}
func measureShell(_ s: Shell) -> [String: Any] {
  var d: [String: Any] = ["frame": rect(s.w.frame), "titlebarPlusToolbar": r(s.w.frame.height - s.w.contentLayoutRect.height)]
  d["sidebarView"] = topLeft(s.sideItem.viewController.view)
  d["contentView"] = topLeft(s.contentItem.viewController.view)
  d["sidebarCollapsed"] = s.sideItem.isCollapsed
  d["outline"] = ["effectiveStyle": s.ol.effectiveStyle.rawValue, "rowSizeStyle": s.ol.rowSizeStyle.rawValue, "effectiveRowSizeStyle": s.ol.effectiveRowSizeStyle.rawValue, "rowHeight": r(s.ol.rowHeight), "indentationPerLevel": r(s.ol.indentationPerLevel), "intercellSpacing": rect(NSRect(origin: .zero, size: s.ol.intercellSpacing)), "frame": topLeft(s.ol)]
  var rows: [[String: Any]] = []
  for i in 0..<s.ol.numberOfRows { var ri = rowInfo(s.ol, i); ri["item"] = s.ol.item(atRow: i) as? String ?? ""; rows.append(ri) }
  d["outlineRows"] = rows
  if let t = s.table {
    d["table"] = ["style": t.style.rawValue, "effectiveStyle": t.effectiveStyle.rawValue, "rowHeight": r(t.rowHeight), "intercellSpacing": rect(NSRect(origin: .zero, size: t.intercellSpacing)), "headerHeight": r(t.headerView?.frame.height ?? -1), "row0": rowInfo(t, 0), "scrollFrame": topLeft(s.scroll), "contentInsets": ["top": r(s.scroll.contentInsets.top), "left": r(s.scroll.contentInsets.left)], "automaticallyAdjustsContentInsets": s.scroll.automaticallyAdjustsContentInsets]
  }
  var tree: [[String: Any]] = []
  if let frameView = s.w.contentView?.superview { dumpTree(frameView, 0, &tree) }
  d["chrome"] = tree
  if let tb = s.w.toolbar {
    d["toolbarVisibleItems"] = (tb.visibleItems ?? []).map { $0.itemIdentifier.rawValue }
    d["toolbarItems"] = tb.items.map { $0.itemIdentifier.rawValue }
    if let st = tb.items.first(where: { $0.itemIdentifier == idSearch }) as? NSSearchToolbarItem {
      d["search"] = ["field": topLeft(st.searchField), "preferredWidthForSearchField": r(st.preferredWidthForSearchField), "font": fontInfo(st.searchField.font), "controlSize": st.searchField.controlSize.rawValue]
    }
  }
  d["split"] = ["dividerStyle": s.split.splitView.dividerStyle.rawValue, "dividerThickness": r(s.split.splitView.dividerThickness)]
  return d
}
func itemDefaults(_ i: NSSplitViewItem) -> [String: Any] {
  ["minimumThickness": r(i.minimumThickness), "maximumThickness": r(i.maximumThickness), "preferredThicknessFraction": r(i.preferredThicknessFraction), "automaticMaximumThickness": r(i.automaticMaximumThickness), "canCollapse": i.canCollapse, "canCollapseFromWindowResize": i.canCollapseFromWindowResize, "holdingPriority": r(CGFloat(i.holdingPriority.rawValue)), "titlebarSeparatorStyle": i.titlebarSeparatorStyle.rawValue]
}
meta["splitViewItemDefaults"] = [
  "sidebar": itemDefaults(NSSplitViewItem(sidebarWithViewController: NSViewController())),
  "contentList": itemDefaults(NSSplitViewItem(contentListWithViewController: NSViewController())),
  "inspector": itemDefaults(NSSplitViewItem(inspectorWithViewController: NSViewController())),
  "plain": itemDefaults(NSSplitViewItem(viewController: NSViewController())),
]

func step(_ after: Double, _ f: @escaping () -> Void) { DispatchQueue.main.asyncAfter(deadline: .now() + after, execute: f) }
DispatchQueue.main.asyncAfter(deadline: .now() + 10) { app.terminate(nil) }  // 兜底：10 秒必退
step(0.8) {
  for s in [heroL, heroD, mainL, mainD] { s.ol.selectRowIndexes([2], byExtendingSelection: false); s.w.makeFirstResponder(s.ol) }
  for s in [mainL, mainD] { s.table?.selectRowIndexes([1], byExtendingSelection: false) }
  // 内容往下滚一点，让行（彩条）跑到工具栏下面
  for s in [heroL, heroD] { s.scroll.contentView.scroll(to: NSPoint(x: 0, y: 330)); s.scroll.reflectScrolledClipView(s.scroll.contentView) }
  for s in [mainL, mainD] { if let t = s.table { t.scrollRowToVisible(0); let y = s.scroll.contentView.bounds.origin.y; s.scroll.contentView.scroll(to: NSPoint(x: 0, y: y + 60)); s.scroll.reflectScrolledClipView(s.scroll.contentView) } }
  wait(0.2)
  meta["mainL"] = measureShell(mainL); meta["heroL"] = measureShell(heroL)
  var tabs: [String: Any] = [:]
  for (n, t) in tabsL { tabs[n] = ["effectiveStyle": t.effectiveStyle.rawValue, "rowHeight": r(t.rowHeight), "intercellSpacing": rect(NSRect(origin: .zero, size: t.intercellSpacing)), "headerHeight": r(t.headerView?.frame.height ?? -1), "row0": rowInfo(t, 0), "row1": rowInfo(t, 1), "scrollFrame": topLeft(t.enclosingScrollView!)] }
  meta["tables"] = tabs

  // 活动窗口：每个窗口轮流当 key；当 key 的那一刻，别的窗口都是非活动
  mainL.w.makeKeyAndOrderFront(nil); wait(0.35); shot(mainL.w, "main-light-key")
  shot(mainD.w, "main-dark-inactive")
  mainD.w.makeKeyAndOrderFront(nil); wait(0.35); shot(mainD.w, "main-dark-key")
  shot(mainL.w, "main-light-inactive")
  // 同一个活动窗口，焦点从侧边栏挪到内容表格
  mainD.w.makeFirstResponder(mainD.table); wait(0.15); shot(mainD.w, "main-dark-tablefocus")
  mainL.w.makeKeyAndOrderFront(nil); mainL.w.makeFirstResponder(mainL.table); wait(0.35); shot(mainL.w, "main-light-tablefocus")
  heroL.w.makeKeyAndOrderFront(nil); wait(0.35); shot(heroL.w, "hero-light-key")
  heroD.w.makeKeyAndOrderFront(nil); wait(0.35); shot(heroD.w, "hero-dark-key")
  tabL.makeKeyAndOrderFront(nil); for (_, t) in tabsL { t.selectRowIndexes([2], byExtendingSelection: false) }; tabL.makeFirstResponder(tabsL[1].1); wait(0.35); shot(tabL, "tables-light-key")
  tabD.makeKeyAndOrderFront(nil); for (_, t) in tabsD { t.selectRowIndexes([2], byExtendingSelection: false) }; tabD.makeFirstResponder(tabsD[1].1); wait(0.35); shot(tabD, "tables-dark-key")

  // rowSizeStyle：代码建的表默认是 custom（rowSizeStyle 0）；.default 跟着「通用 → 侧边栏图标大小」走
  mainL.w.makeKeyAndOrderFront(nil); mainL.w.makeFirstResponder(mainL.ol)
  var sizes: [String: Any] = [:]
  for (n, st) in [("default", NSTableView.RowSizeStyle.default), ("small", .small), ("medium", .medium), ("large", .large)] {
    mainL.ol.rowSizeStyle = st; mainL.ol.reloadData(); mainL.ol.expandItem(nil, expandChildren: true); mainL.ol.selectRowIndexes([2], byExtendingSelection: false)
    wait(0.25)
    sizes[n] = ["rowSizeStyle": mainL.ol.rowSizeStyle.rawValue, "rowHeight": r(mainL.ol.rowHeight), "effectiveRowSizeStyle": mainL.ol.effectiveRowSizeStyle.rawValue, "rows": (0..<mainL.ol.numberOfRows).map { rowInfo(mainL.ol, $0) }]
    if n != "default" { shot(mainL.w, "rowsize-\(n)-light") }
  }
  meta["rowSizes"] = sizes
  mainL.ol.rowSizeStyle = .default; mainL.ol.reloadData(); mainL.ol.expandItem(nil, expandChildren: true)

  // 用代码拖分隔条：最小值挡得住，最大值默认不设
  var drags: [[String: Any]] = []
  for pos in [100.0, 400.0, 700.0] {
    mainD.split.splitView.setPosition(pos, ofDividerAt: 0); wait(0.05)
    drags.append(["asked": pos, "sidebar": r(mainD.sideItem.viewController.view.frame.width)])
  }
  meta["sidebarDrag"] = drags

  // 窄窗口：工具栏溢出、侧边栏会不会自己收起
  var f = mainL.w.frame; f.size.width = 520; mainL.w.setFrame(f, display: true); wait(0.5)
  meta["narrow"] = measureShell(mainL)
  shot(mainL.w, "main-light-narrow")
  meta["shots"] = shots
  let data = try! JSONSerialization.data(withJSONObject: meta, options: [.prettyPrinted, .sortedKeys])
  try! data.write(to: URL(fileURLWithPath: "\(outDir)/sidebar.json"))
  app.terminate(nil)
}
app.run()
