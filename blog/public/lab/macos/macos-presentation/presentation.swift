import AppKit
// 用法：打成 .app 后 open -n -W PresentationProbe.app --args <输出目录> light|dark|light-esc|behavior-active [只拍哪几张]；behavior 模式从终端直接跑。
// light / dark：弹出 alert（sheet 和 app 模态各一个）、窗口 sheet、popover、utility / HUD 面板，量尺寸、字体、按钮，并请 shoot.sh 截图。
// behavior / behavior-active：不截图，往自己的窗口里投递合成的点击和按键（NSApp.postEvent，只进本进程的事件队列），看模态挡住了谁；两者分别在后台 / 前台跑。
// 只截探针自己的窗口，不碰系统设置；9.5 秒看门狗强制退出。
let outDir = CommandLine.arguments[1]
let mode = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "light"
// behavior：从终端跑，应用在后台；behavior-active：用 open 启动，应用在前台
let isB = mode.hasPrefix("behavior")
// 第三个参数：只拍这几张（逗号分隔），省略就全拍。前台被抢走后补拍用
let only = CommandLine.arguments.count > 3 ? Set(CommandLine.arguments[3].split(separator: ",").map(String.init)) : nil
let app = NSApplication.shared
app.setActivationPolicy(.regular)
Thread { Thread.sleep(forTimeInterval: 9.5); try? "timeout".write(toFile: "\(outDir)/timeout-\(mode)", atomically: true, encoding: .utf8); exit(3) }.start()

func r(_ x: CGFloat) -> Double { (Double(x) * 100).rounded() / 100 }
func rect(_ f: NSRect) -> [String: Double] { ["x": r(f.origin.x), "y": r(f.origin.y), "w": r(f.width), "h": r(f.height)] }
// 在当前 run loop 模式里等（模态里也能用），不分发事件
func wait(_ s: Double) {
  let m = RunLoop.current.currentMode ?? .default
  let end = Date().addingTimeInterval(s)
  while Date() < end { _ = RunLoop.current.run(mode: m, before: end) }
}
// 非模态时用：取事件并分发，合成的点击才会真的送到窗口
func pump(_ s: Double) {
  let end = Date().addingTimeInterval(s)
  while Date() < end {
    if let e = app.nextEvent(matching: .any, until: Date().addingTimeInterval(0.02), inMode: .default, dequeue: true) { app.sendEvent(e) }
  }
}
var shotLog: [[String: Any]] = []
// .app 没有录屏权限，截图交给终端里的 shoot.sh：写请求文件，等它把 png 写出来
func shoot(_ w: NSWindow, _ name: String) {
  if let o = only, !o.contains(name) { return }
  let file = "\(name)-\(mode)"
  shotLog.append(["file": file, "window": w.windowNumber, "appActive": app.isActive, "keyWindow": app.keyWindow?.title ?? "nil"])
  let png = "\(outDir)/\(file).png"
  try? "\(w.windowNumber)".write(toFile: "\(outDir)/\(file).req", atomically: true, encoding: .utf8)
  let end = Date().addingTimeInterval(1.5)
  while !FileManager.default.fileExists(atPath: png) && !FileManager.default.fileExists(atPath: png + ".failed") && Date() < end { wait(0.05) }
}
func weight(_ f: NSFont) -> Double {
  let t = f.fontDescriptor.object(forKey: .traits) as? [NSFontDescriptor.TraitKey: Any]
  return r(CGFloat((t?[.weight] as? NSNumber)?.doubleValue ?? 0))
}
func key(_ s: String) -> String { s == "\r" ? "Return" : s == "\u{1b}" ? "Esc" : s }
// 窗口里的文字、图片、按钮，坐标换成「离窗口左上角」
func views(_ w: NSWindow) -> [[String: Any]] {
  var out: [[String: Any]] = []
  func walk(_ v: NSView) {
    if v.isHidden { return }
    let f = v.convert(v.bounds, to: nil)
    var d: [String: Any] = ["class": String(describing: type(of: v)), "left": r(f.minX), "top": r(w.frame.height - f.maxY), "w": r(f.width), "h": r(f.height)]
    if let b = v as? NSButton {
      d["title"] = b.title; d["key"] = key(b.keyEquivalent); d["destructive"] = b.hasDestructiveAction
      d["controlSize"] = b.controlSize.rawValue; d["bezel"] = b.bezelStyle.rawValue
      d["font"] = b.font?.pointSize ?? 0
      out.append(d); return
    } else if let t = v as? NSTextField {
      d["text"] = t.stringValue; d["fontName"] = t.font?.fontName ?? ""; d["size"] = r(t.font?.pointSize ?? 0)
      d["weight"] = t.font.map(weight) ?? 0; d["align"] = t.alignment.rawValue; d["editable"] = t.isEditable
      out.append(d); return
    } else if v is NSImageView {
      out.append(d); return
    }
    for s in v.subviews { walk(s) }
  }
  if let c = w.contentView { walk(c) }
  return out
}
func winButtons(_ w: NSWindow) -> [String: Any] {
  var d: [String: Any] = [:]
  for (n, t) in [("close", NSWindow.ButtonType.closeButton), ("miniaturize", .miniaturizeButton), ("zoom", .zoomButton)] {
    if let v = w.standardWindowButton(t) {
      let f = v.convert(v.bounds, to: nil)
      d[n] = ["left": r(f.minX), "top": r(w.frame.height - f.maxY), "w": r(f.width), "h": r(f.height), "hidden": v.isHidden, "enabled": v.isEnabled]
    }
  }
  return d
}
func titleFont(_ w: NSWindow) -> [String: Any]? {
  func find(_ v: NSView) -> NSTextField? {
    if let t = v as? NSTextField, t.stringValue == w.title { return t }
    for s in v.subviews { if let f = find(s) { return f } }
    return nil
  }
  guard let t = w.contentView?.superview.flatMap(find), let f = t.font else { return nil }
  let fr = t.convert(t.bounds, to: nil)
  return ["fontName": f.fontName, "size": r(f.pointSize), "weight": weight(f), "top": r(w.frame.height - fr.maxY), "h": r(fr.height)]
}
func info(_ w: NSWindow) -> [String: Any] {
  var d: [String: Any] = ["class": String(describing: type(of: w)), "number": w.windowNumber, "frame": rect(w.frame),
    "contentLayoutRect": rect(w.contentLayoutRect), "titlebar": r(w.frame.height - w.contentLayoutRect.height),
    "level": w.level.rawValue, "isKey": w.isKeyWindow, "isMain": w.isMainWindow, "buttons": winButtons(w)]
  if let t = titleFont(w) { d["titleFont"] = t }
  return d
}

// 点到就记一次；acceptsFirstMouse 为 true，排除「后台窗口第一下只激活」的干扰
final class Hit: NSView {
  var hits = 0
  override func acceptsFirstMouse(for e: NSEvent?) -> Bool { true }
  override func mouseDown(with e: NSEvent) { hits += 1 }
}
func post(_ t: NSEvent.EventType, _ w: NSWindow, _ p: NSPoint) {
  let e = NSEvent.mouseEvent(with: t, location: p, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime,
                             windowNumber: w.windowNumber, context: nil, eventNumber: 0, clickCount: 1, pressure: 1)!
  app.postEvent(e, atStart: false)
}
func click(_ v: NSView) {
  guard let w = v.window else { return }
  let f = v.convert(v.bounds, to: nil)
  let p = NSPoint(x: f.midX, y: f.midY)
  post(.leftMouseDown, w, p); post(.leftMouseUp, w, p)
}
func esc(_ w: NSWindow) {
  for t in [NSEvent.EventType.keyDown, .keyUp] {
    let e = NSEvent.keyEvent(with: t, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: w.windowNumber,
                             context: nil, characters: "\u{1b}", charactersIgnoringModifiers: "\u{1b}", isARepeat: false, keyCode: 53)!
    app.postEvent(e, atStart: false)
  }
}

final class TB: NSObject, NSToolbarDelegate {
  let ids: [NSToolbarItem.Identifier] = [NSToolbarItem.Identifier("plus"), .flexibleSpace, NSToolbarItem.Identifier("square.and.arrow.up")]
  func toolbarDefaultItemIdentifiers(_ t: NSToolbar) -> [NSToolbarItem.Identifier] { ids }
  func toolbarAllowedItemIdentifiers(_ t: NSToolbar) -> [NSToolbarItem.Identifier] { ids }
  func toolbar(_ t: NSToolbar, itemForItemIdentifier id: NSToolbarItem.Identifier, willBeInsertedIntoToolbar f: Bool) -> NSToolbarItem? {
    let it = NSToolbarItem(itemIdentifier: id)
    it.label = id.rawValue; it.image = NSImage(systemSymbolName: id.rawValue, accessibilityDescription: id.rawValue); it.isBordered = true
    return it
  }
}
let tbd = TB()
func label(_ s: String, _ font: NSFont, _ color: NSColor = .labelColor) -> NSTextField {
  let t = NSTextField(labelWithString: s); t.font = font; t.textColor = color; t.sizeToFit(); return t
}

struct Parent { let w: NSWindow; let hit: Hit; let anchor: NSButton }
func makeParent(_ title: String, toolbar: Bool) -> Parent {
  var mask: NSWindow.StyleMask = [.titled, .closable, .miniaturizable, .resizable]
  if toolbar { mask.insert(.fullSizeContentView) }
  let w = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 560, height: 340), styleMask: mask, backing: .buffered, defer: false)
  w.title = title; w.isReleasedWhenClosed = false; w.tabbingMode = .disallowed
  // 用户可能在别的空间（全屏终端）里工作：窗口出现在当前空间，不切空间，截图也拍得到
  w.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
  if toolbar { let t = NSToolbar(identifier: title); t.delegate = tbd; t.displayMode = .iconOnly; w.toolbar = t; w.toolbarStyle = .unified }
  let c = w.contentView!
  let top = w.contentLayoutRect.maxY
  let rows = ["季度报告.key", "旧版草稿.pages", "会议记录.txt", "预算表.numbers", "封面.png"]
  for (i, s) in rows.enumerated() {
    let t = label(s, .systemFont(ofSize: 13)); t.frame.origin = NSPoint(x: 24, y: top - 40 - CGFloat(i) * 28); c.addSubview(t)
  }
  let anchor = NSButton(title: "显示简介", target: nil, action: nil)
  anchor.sizeToFit(); anchor.frame.origin = NSPoint(x: 300, y: top - 44); c.addSubview(anchor)
  let hit = Hit(frame: NSRect(x: 24, y: 24, width: 120, height: 40)); c.addSubview(hit)
  return Parent(w: w, hit: hit, anchor: anchor)
}

func save() {
  out["shots"] = shotLog
  if let data = try? JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .sortedKeys]) {
    try? data.write(to: URL(fileURLWithPath: "\(outDir)/presentation-\(mode).json"))
  }
}
var out: [String: Any] = ["mode": mode, "os": ProcessInfo.processInfo.operatingSystemVersionString]
let screen = NSScreen.main!
out["screen"] = ["frame": rect(screen.frame), "visibleFrame": rect(screen.visibleFrame), "backingScale": r(screen.backingScaleFactor)]

DispatchQueue.main.async {
  if !isB { app.appearance = NSAppearance(named: mode == "dark" ? .darkAqua : .aqua) }
  app.activate()
  let P = makeParent("季度报告", toolbar: true)
  P.w.setFrameTopLeftPoint(NSPoint(x: 120, y: 880))
  let other = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 240, height: 120), styleMask: [.titled, .closable], backing: .buffered, defer: false)
  other.title = "另一个窗口"; other.isReleasedWhenClosed = false; other.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
  let otherHit = Hit(frame: other.contentView!.bounds); other.contentView!.addSubview(otherHit)
  other.setFrameTopLeftPoint(NSPoint(x: 1200, y: 880)); other.orderFront(nil)
  P.w.makeKeyAndOrderFront(nil)
  pump(0.6)
  out["parent"] = info(P.w)
  if mode == "light" { shoot(P.w, "parent") }

  // 1. alert 作为 sheet：存储 / 取消 / 不存储
  let a = NSAlert()
  a.messageText = "要存储对“季度报告”所做的更改吗？"
  a.informativeText = "如果不存储，你的更改将会丢失。"
  a.addButton(withTitle: "存储"); a.addButton(withTitle: "取消")
  a.addButton(withTitle: "不存储").hasDestructiveAction = true
  // light-esc：给「取消」手动设 Esc，看它回到竖排最下面的样子（只拍这一张）
  if mode == "light-esc" { a.buttons[1].keyEquivalent = "\u{1b}" }
  var sheetResp = -1
  a.beginSheetModal(for: P.w) { sheetResp = $0.rawValue }
  pump(0.45)
  var sa = info(a.window)
  sa["views"] = views(a.window); sa["defaultButtonCell"] = a.window.defaultButtonCell?.title ?? "nil"
  sa["buttonKeys"] = a.buttons.map { ["title": $0.title, "key": key($0.keyEquivalent)] }; sa["parentAttachedSheetIsThis"] = P.w.attachedSheet === a.window; sa["parentButtonsDuringSheet"] = winButtons(P.w); sa["appModalWindow"] = app.modalWindow?.title ?? "nil"
  if isB {
    let p0 = P.hit.hits, o0 = otherHit.hits
    click(P.hit); click(otherHit); pump(0.3)
    sa["clickParentDelivered"] = P.hit.hits > p0; sa["clickOtherWindowDelivered"] = otherHit.hits > o0
    // 别的窗口被点到以后会到前面；再按 Esc 看取消键
    a.window.makeKeyAndOrderFront(nil); pump(0.1)
    esc(a.window); pump(0.4)
    sa["escResponse"] = sheetResp; sa["escClosedSheet"] = P.w.attachedSheet == nil
    if P.w.attachedSheet != nil { P.w.endSheet(a.window) }
  } else {
    shoot(a.window, "alertsheet")
    P.w.endSheet(a.window)
  }
  out["alertSheet"] = sa; save()
  pump(0.25)

  // 2. app 模态 alert（runModal）。模态循环里只有 common 模式的定时器会跑
  let b = NSAlert()
  b.messageText = "要永久删除“旧版草稿”吗？"
  b.informativeText = "此操作无法撤销。"
  b.addButton(withTitle: "删除"); b.addButton(withTitle: "取消")
  var am: [String: Any] = [:]
  var p1 = 0, o1 = 0
  let t1 = Timer(timeInterval: 0.45, repeats: false) { _ in
    am = info(b.window); am["views"] = views(b.window); am["defaultButtonCell"] = b.window.defaultButtonCell?.title ?? "nil"
    am["buttonKeys"] = b.buttons.map { ["title": $0.title, "key": key($0.keyEquivalent)] }; am["appModalWindowIsThis"] = app.modalWindow === b.window
    if isB { p1 = P.hit.hits; o1 = otherHit.hits; click(P.hit); click(otherHit) }
    else { shoot(b.window, "appmodal") }
    // 第二个定时器在第一个做完以后再排，免得截图等待时被它插队
    let t2 = Timer(timeInterval: isB ? 0.4 : 0.05, repeats: false) { _ in
      if isB { am["clickParentDelivered"] = P.hit.hits > p1; am["clickOtherWindowDelivered"] = otherHit.hits > o1 }
      app.abortModal()
    }
    RunLoop.main.add(t2, forMode: .common)
  }
  RunLoop.main.add(t1, forMode: .common)
  am["runModalReturn"] = b.runModal().rawValue
  out["alertAppModal"] = am; save()
  pump(0.2)

  // 3. 普通窗口作为 sheet
  func makeSheet() -> NSWindow {
    let s = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 400, height: 150), styleMask: [.titled], backing: .buffered, defer: false)
    s.isReleasedWhenClosed = false
    let c = s.contentView!
    let t = label("新建文件夹", .boldSystemFont(ofSize: 13)); t.frame.origin = NSPoint(x: 20, y: 150 - 20 - t.frame.height); c.addSubview(t)
    let f = NSTextField(string: "未命名文件夹"); f.frame = NSRect(x: 20, y: 150 - 72, width: 360, height: 22); c.addSubview(f)
    let ok = NSButton(title: "创建", target: nil, action: nil); ok.keyEquivalent = "\r"; ok.sizeToFit()
    let cancel = NSButton(title: "取消", target: nil, action: nil); cancel.keyEquivalent = "\u{1b}"; cancel.sizeToFit()
    ok.frame.size.width = max(ok.frame.width, 80); cancel.frame.size.width = max(cancel.frame.width, 80)
    ok.frame.origin = NSPoint(x: 400 - 20 - ok.frame.width, y: 20); cancel.frame.origin = NSPoint(x: ok.frame.minX - 12 - cancel.frame.width, y: 20)
    c.addSubview(ok); c.addSubview(cancel)
    return s
  }
  let s = makeSheet()
  P.w.beginSheet(s)
  pump(0.45)
  var ws = info(s); ws["requestedContent"] = ["w": 400, "h": 150]
  if !isB { shoot(s, "sheet") }
  out["windowSheet"] = ws; save()
  P.w.endSheet(s); pump(0.25)
  if mode == "behavior" {
    // 无工具栏的母窗口：sheet 从哪出来
    let Q = makeParent("无工具栏", toolbar: false)
    Q.w.setFrameTopLeftPoint(NSPoint(x: 160, y: 840)); Q.w.makeKeyAndOrderFront(nil); pump(0.2)
    let s2 = makeSheet(); Q.w.beginSheet(s2); pump(0.5)
    out["windowSheetPlainParent"] = ["parent": info(Q.w), "sheet": info(s2)]
    Q.w.endSheet(s2); Q.w.close(); P.w.makeKeyAndOrderFront(nil); pump(0.2)
  }

  // 4. popover（transient），从「显示简介」按钮往下弹
  let pop = NSPopover()
  pop.behavior = .transient
  let vc = NSViewController()
  let pv = NSView(frame: NSRect(x: 0, y: 0, width: 240, height: 96))
  let l1 = label("季度报告.key", .boldSystemFont(ofSize: 13)); l1.frame.origin = NSPoint(x: 16, y: 96 - 16 - l1.frame.height); pv.addSubview(l1)
  let l2 = label("Keynote 文稿 · 2.4 MB", .systemFont(ofSize: 11), .secondaryLabelColor); l2.frame.origin = NSPoint(x: 16, y: l1.frame.minY - 6 - l2.frame.height); pv.addSubview(l2)
  let l3 = label("修改于 今天 10:12", .systemFont(ofSize: 11), .secondaryLabelColor); l3.frame.origin = NSPoint(x: 16, y: l2.frame.minY - 4 - l3.frame.height); pv.addSubview(l3)
  vc.view = pv; pop.contentViewController = vc
  pop.show(relativeTo: P.anchor.bounds, of: P.anchor, preferredEdge: .maxY)
  pump(0.4)
  var po: [String: Any] = ["contentSize": ["w": 240, "h": 96]]
  if let pw = pv.window {
    po["window"] = info(pw)
    let vf = pv.convert(pv.bounds, to: nil)
    po["contentInWindow"] = ["left": r(vf.minX), "top": r(pw.frame.height - vf.maxY), "w": r(vf.width), "h": r(vf.height)]
    let af = P.anchor.convert(P.anchor.bounds, to: nil)
    let anchorScreen = P.w.convertToScreen(af)
    po["anchorScreen"] = rect(anchorScreen)
    if !isB { shoot(pw, "popover") }
  }
  if isB {
    click(P.hit); pump(0.4)
    po["shownAfterClickOutside"] = pop.isShown
    pop.show(relativeTo: P.anchor.bounds, of: P.anchor, preferredEdge: .maxY); pump(0.4)
    if let pw = pv.window { pw.makeKey(); esc(pw); pump(0.4) }
    po["shownAfterEsc"] = pop.isShown
  }
  pop.close()
  out["popover"] = po; save()
  pump(0.2)

  // 5. 面板：utility 和 HUD
  func makePanel(_ hud: Bool) -> NSPanel {
    var mask: NSWindow.StyleMask = [.titled, .closable, .utilityWindow]
    if hud { mask.insert(.hudWindow) }
    let p = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 220, height: 120), styleMask: mask, backing: .buffered, defer: false)
    p.title = "检查器"; p.isReleasedWhenClosed = false; p.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
    return p
  }
  func defaults(_ p: NSPanel) -> [String: Any] {
    ["isFloatingPanel": p.isFloatingPanel, "level": p.level.rawValue, "hidesOnDeactivate": p.hidesOnDeactivate,
     "becomesKeyOnlyIfNeeded": p.becomesKeyOnlyIfNeeded, "canBecomeKey": p.canBecomeKey, "canBecomeMain": p.canBecomeMain,
     "worksWhenModal": p.worksWhenModal, "styleMask": p.styleMask.rawValue]
  }
  let u = makePanel(false), h = makePanel(true)
  var pn: [String: Any] = ["utilityDefaults": defaults(u), "hudDefaults": defaults(h)]
  u.becomesKeyOnlyIfNeeded = true
  let uc = u.contentView!
  let ul = label("不透明度", .systemFont(ofSize: 11)); ul.frame.origin = NSPoint(x: 16, y: 120 - 16 - ul.frame.height); uc.addSubview(ul)
  let slider = NSSlider(value: 0.7, minValue: 0, maxValue: 1, target: nil, action: nil); slider.controlSize = .small
  slider.frame = NSRect(x: 16, y: ul.frame.minY - 26, width: 188, height: 20); uc.addSubview(slider)
  let nf = NSTextField(string: "图层 1"); nf.controlSize = .small; nf.font = .systemFont(ofSize: 11)
  nf.frame = NSRect(x: 16, y: 16, width: 188, height: 19); uc.addSubview(nf)
  let hc = h.contentView!
  for (i, s) in ["时长  00:12:34", "分辨率  1920 × 1080", "帧率  29.97"].enumerated() {
    let t = label(s, .systemFont(ofSize: 11)); t.frame.origin = NSPoint(x: 16, y: 120 - 20 - t.frame.height - CGFloat(i) * 22); hc.addSubview(t)
  }
  u.setFrameTopLeftPoint(NSPoint(x: 720, y: 880)); h.setFrameTopLeftPoint(NSPoint(x: 720, y: 700))
  u.orderFront(nil); h.orderFront(nil); u.makeFirstResponder(nil)
  P.w.makeKeyAndOrderFront(nil)
  pump(0.3)
  pn["utility"] = info(u); pn["hud"] = info(h)
  if !isB { shoot(u, "panel"); if mode == "light" { shoot(h, "hud") } }
  // 点面板里的滑块：面板不该抢走键盘；点文本框：面板才成为 key
  pn["keyBefore"] = app.keyWindow?.title ?? "nil"; pn["appActive"] = app.isActive
  click(slider); pump(0.3)
  pn["keyAfterSliderClick"] = app.keyWindow?.title ?? "nil"
  click(nf); pump(0.3)
  pn["keyAfterTextFieldClick"] = app.keyWindow?.title ?? "nil"
  pn["mainAfterTextFieldClick"] = app.mainWindow?.title ?? "nil"
  out["panels"] = pn; save()

  // 顺带：英文 Cancel 和中文「取消」各自拿到什么快捷键（只 layout，不显示）
  let c1 = NSAlert(); c1.addButton(withTitle: "Delete"); c1.addButton(withTitle: "Cancel"); c1.addButton(withTitle: "Don’t Save"); c1.layout()
  let c2 = NSAlert(); c2.addButton(withTitle: "删除"); c2.addButton(withTitle: "取消"); c2.layout()
  out["cancelKeys"] = ["english": c1.buttons.map { ["title": $0.title, "key": key($0.keyEquivalent), "mods": $0.keyEquivalentModifierMask.rawValue] },
                       "chinese": c2.buttons.map { ["title": $0.title, "key": key($0.keyEquivalent), "mods": $0.keyEquivalentModifierMask.rawValue] }]
  out["shots"] = shotLog
  let data = try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .sortedKeys])
  try! data.write(to: URL(fileURLWithPath: "\(outDir)/presentation-\(mode).json"))
  try? "done".write(toFile: "\(outDir)/done-\(mode)", atomically: true, encoding: .utf8)
  exit(0)
}
app.run()
