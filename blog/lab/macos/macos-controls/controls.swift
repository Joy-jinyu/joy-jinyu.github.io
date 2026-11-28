import AppKit
import SwiftUI
// 用法：controls <输出目录> [light|dark|inactive]。量控件五档尺寸、字体、系统间距、回车 / Esc、NSAlert 按钮，截探针自己的窗口（浅色 / 深色、活动 / 非活动），10 秒内退出。
// 只截自己的窗口（screencapture -o -l），不碰系统设置和别的应用。
let outDir = CommandLine.arguments[1]
let mode = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "light"   // light | dark：用 open 启动的 .app；inactive：终端直接跑
let app = NSApplication.shared
app.setActivationPolicy(.regular)
DispatchQueue.main.asyncAfter(deadline: .now() + 10) { FileHandle.standardError.write("超时退出\n".data(using: .utf8)!); exit(2) }

func r(_ x: CGFloat) -> Double { (Double(x) * 100).rounded() / 100 }
func rect(_ f: NSRect) -> [String: Double] { ["x": r(f.origin.x), "y": r(f.origin.y), "w": r(f.width), "h": r(f.height)] }
func size(_ s: NSSize) -> [String: Double] { ["w": r(s.width), "h": r(s.height)] }
func wait(_ s: Double) { RunLoop.current.run(until: Date().addingTimeInterval(s)) }
let sizes: [(String, NSControl.ControlSize)] = [("mini", .mini), ("small", .small), ("regular", .regular), ("large", .large), ("extraLarge", .extraLarge)]
var out: [String: Any] = ["os": ProcessInfo.processInfo.operatingSystemVersionString]

// ---------- 1. 不进窗口：默认字体、尺寸 ----------
// controlSize 只改外框，不改字体：比较「不设字体」和「按 systemFontSize(for:) 设字体」两种
var defaults: [String: Any] = [:]
for (n, s) in sizes {
  let b = NSButton(title: "Button", target: nil, action: nil); b.bezelStyle = .push; b.controlSize = s
  let t = NSTextField(string: "Text"); t.controlSize = s
  let c = NSButton(checkboxWithTitle: "Check", target: nil, action: nil); c.controlSize = s
  let p = NSPopUpButton(frame: .zero, pullsDown: false); p.addItem(withTitle: "Option"); p.controlSize = s
  defaults[n] = ["systemFontSizeFor": r(NSFont.systemFontSize(for: s)), "push.font": r(b.font!.pointSize), "push.fit": size(b.fittingSize), "textField.font": r(t.font!.pointSize), "checkbox.font": r(c.font!.pointSize), "popUp.font": r(p.font!.pointSize)]
}
out["defaultFont"] = defaults

// 文本框 / 搜索框 / 组合框：高度由字号决定还是由 controlSize 决定
var fieldMatrix: [String: Any] = [:]
for (kind, mk) in [("textField", { NSTextField(string: "Text") as NSControl }), ("searchField", { NSSearchField(string: "") as NSControl }), ("comboBox", { let c = NSComboBox(); c.stringValue = "Text"; return c as NSControl })] {
  var m: [String: Any] = [:]
  for (n, s) in sizes {
    var row: [String: Double] = [:]
    for f in [9.0, 11.0, 13.0, 15.0] { let c = mk(); c.controlSize = s; c.font = .systemFont(ofSize: f); row["font\(Int(f))"] = r(c.fittingSize.height) }
    m[n] = row
  }
  fieldMatrix[kind] = m
}
out["fieldHeightByFont"] = fieldMatrix

// NSSwitch：intrinsicContentSize 是否随 controlSize 变
var sw: [String: Any] = [:]
for (n, s) in sizes {
  let a = NSSwitch(); a.controlSize = s; a.invalidateIntrinsicContentSize()
  sw[n] = ["intrinsic": size(a.intrinsicContentSize), "fitting": size(a.fittingSize), "alignmentRectInsets": ["top": r(a.alignmentRectInsets.top), "bottom": r(a.alignmentRectInsets.bottom)]]
}
out["switchIntrinsic"] = sw

// ---------- 2. AppKit 自带的间距值 ----------
var spacing: [String: Any] = [:]
spacing["NSStackView.spacing"] = r(NSStackView().spacing)
let g0 = NSGridView(); spacing["NSGridView.rowSpacing"] = r(g0.rowSpacing); spacing["NSGridView.columnSpacing"] = r(g0.columnSpacing)
do {
  let a = NSView(), b = NSView(), sup = NSView()
  for v in [a, b] { v.translatesAutoresizingMaskIntoConstraints = false; sup.addSubview(v) }
  for f in ["H:|-[a]-[b]-|", "V:|-[a]-[b]-|"] { spacing["visualFormat \(f)"] = NSLayoutConstraint.constraints(withVisualFormat: f, options: [], metrics: nil, views: ["a": a, "b": b]).map { r($0.constant) } }
}
// 系统间距（equalToSystemSpacingAfter / Below）：布局后量两个控件之间实际隔了多少
func pair(_ mk: () -> NSControl, _ mk2: () -> NSControl, _ s: NSControl.ControlSize, vertical: Bool, baseline: Bool = false) -> [String: Double] {
  let sup = NSView(frame: NSRect(x: 0, y: 0, width: 600, height: 400))
  let a = mk(), b = mk2()
  for c in [a, b] { c.controlSize = s; c.font = .systemFont(ofSize: NSFont.systemFontSize(for: s)); c.translatesAutoresizingMaskIntoConstraints = false; sup.addSubview(c) }
  var cs: [NSLayoutConstraint] = [a.leadingAnchor.constraint(equalTo: sup.leadingAnchor, constant: 20), a.topAnchor.constraint(equalTo: sup.topAnchor, constant: 20)]
  if vertical {
    cs.append(b.leadingAnchor.constraint(equalTo: a.leadingAnchor))
    cs.append(baseline ? b.firstBaselineAnchor.constraint(equalToSystemSpacingBelow: a.lastBaselineAnchor, multiplier: 1) : b.topAnchor.constraint(equalToSystemSpacingBelow: a.bottomAnchor, multiplier: 1))
  } else {
    cs.append(b.leadingAnchor.constraint(equalToSystemSpacingAfter: a.trailingAnchor, multiplier: 1))
    cs.append(b.firstBaselineAnchor.constraint(equalTo: a.firstBaselineAnchor))
  }
  for c in [a, b] { if let t = c as? NSTextField, t.isBezeled { cs.append(t.widthAnchor.constraint(equalToConstant: 100)) } }
  NSLayoutConstraint.activate(cs); sup.layoutSubtreeIfNeeded()
  let fa = a.frame, fb = b.frame
  let aa = a.alignmentRect(forFrame: fa), ab = b.alignmentRect(forFrame: fb)
  if vertical {
    // 非翻转坐标：a 在上，b 在下
    return ["frameGap": r(fa.minY - fb.maxY), "alignGap": r(aa.minY - ab.maxY), "baselineToBaseline": r(fa.minY + a.lastBaselineOffsetFromBottom - (fb.maxY - b.firstBaselineOffsetFromTop)), "aH": r(fa.height), "bH": r(fb.height)]
  }
  return ["frameGap": r(fb.minX - fa.maxX), "alignGap": r(ab.minX - aa.maxX), "aW": r(fa.width), "bW": r(fb.width)]
}
let mkPush = { () -> NSControl in let b = NSButton(title: "Button", target: nil, action: nil); b.bezelStyle = .push; return b }
let mkLabel = { () -> NSControl in NSTextField(labelWithString: "Name:") }
let mkField = { () -> NSControl in NSTextField(string: "Text") }
let mkCheck = { () -> NSControl in NSButton(checkboxWithTitle: "Check", target: nil, action: nil) }
let mkPop = { () -> NSControl in let p = NSPopUpButton(frame: .zero, pullsDown: false); p.addItem(withTitle: "Option"); return p }
var sys: [String: Any] = [:]
for (n, s) in sizes {
  sys[n] = [
    "H push→push": pair(mkPush, mkPush, s, vertical: false),
    "H label→textField": pair(mkLabel, mkField, s, vertical: false),
    "H label→popUp": pair(mkLabel, mkPop, s, vertical: false),
    "H checkbox→checkbox": pair(mkCheck, mkCheck, s, vertical: false),
    "V textField↓textField": pair(mkField, mkField, s, vertical: true),
    "V push↓push": pair(mkPush, mkPush, s, vertical: true),
    "V checkbox↓checkbox": pair(mkCheck, mkCheck, s, vertical: true),
    "V popUp↓popUp": pair(mkPop, mkPop, s, vertical: true),
  ]
}
spacing["systemSpacing"] = sys
// 基线到基线的系统间距（firstBaseline equalToSystemSpacingBelow lastBaseline）在 26.6.2 上抛异常：
spacing["baselineSystemSpacing"] = "NSInternalInconsistencyException: unable to resolve symbolic constant NSLayoutAnchorConstraintSpace（NSTextField 标签之间）"
out["spacing"] = spacing

// ---------- 3. 画廊窗口 ----------
var windows: [(String, NSWindow)] = []
func makeWindow(_ name: String, _ w: CGFloat, _ h: CGFloat) -> (NSWindow, NSView) {
  let win = NSWindow(contentRect: NSRect(x: 0, y: 0, width: w, height: h), styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
  win.title = name; win.isReleasedWhenClosed = false
  let v = NSView(frame: NSRect(x: 0, y: 0, width: w, height: h)); win.contentView = v
  windows.append((name, win)); return (win, v)
}
final class Hit: NSObject { var log: [String] = []; @objc func hit(_ s: NSButton) { log.append(s.title) } }
let hit = Hit()
let rowPitch: CGFloat = 56, colPitch: CGFloat = 150
var galleryControls: [String: [String: NSControl]] = [:]
func gallery(_ name: String, _ makers: [(String, () -> NSControl)]) -> NSWindow {
  let h = CGFloat(makers.count) * rowPitch + 24
  let (win, v) = makeWindow(name, 40 + colPitch * 5, h)
  for (ri, (rn, mk)) in makers.enumerated() {
    var row: [String: NSControl] = [:]
    for (ci, (sn, s)) in sizes.enumerated() {
      let c = mk(); c.controlSize = s; c.font = .systemFont(ofSize: NSFont.systemFontSize(for: s))
      let keepW = c.frame.width; c.sizeToFit(); if keepW > 0 && (c is NSTextField || c is NSSlider) { c.frame.size.width = keepW }
      let cy = h - 12 - rowPitch * (CGFloat(ri) + 0.5)
      c.frame.origin = NSPoint(x: 20 + CGFloat(ci) * colPitch, y: (cy - c.frame.height / 2).rounded())
      v.addSubview(c); row[sn] = c
    }
    galleryControls[rn] = row
  }
  return win
}
func btn(_ t: String, _ key: String = "") -> NSButton { let b = NSButton(title: t, target: hit, action: #selector(Hit.hit(_:))); b.bezelStyle = .push; b.keyEquivalent = key; return b }
let g1 = gallery("buttons", [
  ("push", { btn("Button") }),
  ("default", { btn("Save", "\r") }),
  ("cancel", { btn("Cancel", "\u{1b}") }),
  ("destructive", { let b = btn("Delete"); b.hasDestructiveAction = true; return b }),
  ("popUp", { let p = NSPopUpButton(frame: .zero, pullsDown: false); p.addItems(withTitles: ["Option"]); return p }),
  ("pullDown", { let p = NSPopUpButton(frame: .zero, pullsDown: true); p.addItems(withTitles: ["Action", "One"]); return p }),
  ("segmented", { let s = NSSegmentedControl(labels: ["One", "Two"], trackingMode: .selectOne, target: nil, action: nil); s.selectedSegment = 0; return s }),
  ("help", { let b = NSButton(title: "", target: nil, action: nil); b.bezelStyle = .helpButton; return b }),
])
let g2 = gallery("inputs", [
  ("textField", { let t = NSTextField(string: "Text"); t.frame.size.width = 100; return t }),
  ("search", { let t = NSSearchField(string: ""); t.placeholderString = "Search"; t.frame.size.width = 110; return t }),
  ("comboBox", { let c = NSComboBox(); c.stringValue = "Text"; c.frame.size.width = 100; return c }),
  ("checkbox", { let b = NSButton(checkboxWithTitle: "Check", target: nil, action: nil); b.state = .on; return b }),
  ("radio", { let b = NSButton(radioButtonWithTitle: "Radio", target: nil, action: nil); b.state = .on; return b }),
  ("switch", { let s = NSSwitch(); s.state = .on; return s }),
  ("slider", { let s = NSSlider(value: 0.5, minValue: 0, maxValue: 1, target: nil, action: nil); s.frame.size.width = 100; return s }),
  ("stepper", { NSStepper() }),
])

// ---------- 4. 表单窗口：右对齐标签 + 控件，NSGridView 默认间距，首基线对齐 ----------
let (formWin, formView) = makeWindow("form", 420, 300)
func label(_ s: String) -> NSTextField { NSTextField(labelWithString: s) }
let nameF = NSTextField(string: "Report"), mailF = NSTextField(string: "")
mailF.placeholderString = "name@example.com"
let fmt = NSPopUpButton(frame: .zero, pullsDown: false); fmt.addItems(withTitles: ["PDF", "PNG"])
let qual = NSSlider(value: 0.7, minValue: 0, maxValue: 1, target: nil, action: nil)
let opt1 = NSButton(checkboxWithTitle: "Include metadata", target: nil, action: nil); opt1.state = .on
let opt2 = NSButton(checkboxWithTitle: "Open after export", target: nil, action: nil)
let notif = NSSwitch(); notif.state = .on; notif.controlSize = .mini
let copies = NSTextField(string: "1"); let step = NSStepper()
let copiesRow = NSStackView(views: [copies, step]); copiesRow.spacing = 4
let grid = NSGridView(views: [
  [label("Name:"), nameF], [label("Email:"), mailF], [label("Format:"), fmt], [label("Quality:"), qual],
  [label("Options:"), opt1], [NSGridCell.emptyContentView, opt2], [label("Notify:"), notif], [label("Copies:"), copiesRow],
])
grid.column(at: 0).xPlacement = .trailing
grid.rowAlignment = .firstBaseline
let cancelB = btn("Cancel", "\u{1b}"), okB = btn("Export", "\r")
let buttons = NSStackView(views: [cancelB, okB])
for v in [grid, buttons] as [NSView] { v.translatesAutoresizingMaskIntoConstraints = false; formView.addSubview(v) }
NSLayoutConstraint.activate([
  nameF.widthAnchor.constraint(equalToConstant: 220), mailF.widthAnchor.constraint(equalToConstant: 220), qual.widthAnchor.constraint(equalToConstant: 160), copies.widthAnchor.constraint(equalToConstant: 40),
  grid.leadingAnchor.constraint(equalTo: formView.leadingAnchor, constant: 20), grid.topAnchor.constraint(equalTo: formView.topAnchor, constant: 20),
  buttons.topAnchor.constraint(equalTo: grid.bottomAnchor, constant: 20), buttons.trailingAnchor.constraint(equalTo: formView.trailingAnchor, constant: -20),
  okB.widthAnchor.constraint(equalTo: cancelB.widthAnchor),
])

// ---------- 5. SwiftUI 对照：同样五档，SwiftUI 自己挑字号 ----------
let (swWin, swView) = makeWindow("swiftui", 40 + colPitch * 5, 4 * rowPitch + 24)
let swiftSizes: [(String, ControlSize)] = [("mini", .mini), ("small", .small), ("regular", .regular), ("large", .large), ("extraLarge", .extraLarge)]
struct Tog: View { @State var on = true; var body: some View { Toggle("", isOn: $on).toggleStyle(.switch).labelsHidden() } }
struct Field: View { @State var t = "Text"; var body: some View { TextField("", text: $t).frame(width: 100) } }
var swiftHosts: [String: [String: NSView]] = [:]
let swiftRows: [(String, (ControlSize) -> AnyView)] = [
  ("button", { AnyView(Button("Button") {}.controlSize($0)) }),
  ("prominent", { AnyView(Button("Save") {}.buttonStyle(.borderedProminent).controlSize($0)) }),
  ("toggleSwitch", { AnyView(Tog().controlSize($0)) }),
  ("textField", { AnyView(Field().controlSize($0)) }),
]
for (ri, (rn, mk)) in swiftRows.enumerated() {
  var row: [String: NSView] = [:]
  for (ci, (sn, s)) in swiftSizes.enumerated() {
    let hv = NSHostingView(rootView: mk(s)); let fs = hv.fittingSize
    let cy = swView.frame.height - 12 - rowPitch * (CGFloat(ri) + 0.5)
    hv.frame = NSRect(x: 20 + CGFloat(ci) * colPitch, y: (cy - fs.height / 2).rounded(), width: fs.width, height: fs.height)
    swView.addSubview(hv); row[sn] = hv
  }
  swiftHosts[rn] = row
}

// ---------- 6. NSAlert：按钮顺序、回车 / Esc 归属 ----------
func makeAlert(_ msg: String, _ titles: [String], destructive: Int?) -> NSAlert {
  let a = NSAlert(); a.messageText = msg; a.informativeText = "This can’t be undone."
  for t in titles { a.addButton(withTitle: t) }
  if let d = destructive { a.buttons[d].hasDestructiveAction = true }
  a.layout(); return a
}
let alert2 = makeAlert("Delete “Report.pdf”?", ["Delete", "Cancel"], destructive: 0)
let alert3 = makeAlert("Save changes to “Report”?", ["Save", "Don’t Save", "Cancel"], destructive: 1)
let alertR = makeAlert("Replace “Report.pdf”?", ["Replace", "Cancel"], destructive: nil)
func alertInfo(_ a: NSAlert) -> [[String: Any]] {
  a.buttons.map { b in ["title": b.title, "keyEquivalent": b.keyEquivalent == "\r" ? "Return" : b.keyEquivalent == "\u{1b}" ? "Esc" : b.keyEquivalent, "hasDestructiveAction": b.hasDestructiveAction, "keyEquivalentCommand": b.keyEquivalentModifierMask.contains(.command), "frameInWindow": rect(b.convert(b.bounds, to: nil)), "controlSize": b.controlSize.rawValue, "font": r(b.font?.pointSize ?? 0)] }
}
out["alerts"] = ["twoButtons": alertInfo(alert2), "twoButtonsNoDestructive": alertInfo(alertR), "threeButtons": alertInfo(alert3), "twoButtonsWindow": rect(alert2.window.frame), "threeButtonsWindow": rect(alert3.window.frame)]

// ---------- 记录与截图 ----------
func ctlInfo(_ c: NSView, _ win: NSWindow) -> [String: Any] {
  var d: [String: Any] = ["frameInWindow": rect(c.convert(c.bounds, to: nil)), "frame": rect(c.frame), "alignmentRect": rect(c.alignmentRect(forFrame: c.frame)), "fitting": size(c.fittingSize), "intrinsic": size(c.intrinsicContentSize), "baselineFromTop": r(c.firstBaselineOffsetFromTop), "windowHeight": r(win.frame.height)]
  if let ctl = c as? NSControl { d["font"] = r(ctl.font?.pointSize ?? 0); d["controlSize"] = ctl.controlSize.rawValue }
  return d
}
// .app 没有录屏权限：写请求文件，由终端里的 shoot.sh 代拍（inactive 模式从终端直接跑，自己拍）
func shot(_ w: NSWindow, _ file: String, key: Bool = true) -> [String: Any] {
  if key { w.makeKeyAndOrderFront(nil); w.makeFirstResponder(nil) } else { w.orderFront(nil) }
  wait(0.4)
  let state: [String: Any] = ["file": "\(file).png", "isKey": w.isKeyWindow, "appActive": NSApp.isActive, "appearance": w.effectiveAppearance.name.rawValue]
  let png = "\(outDir)/\(file).png"
  if mode == "inactive" {
    let p = Process(); p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
    p.arguments = ["-x", "-o", "-l", String(w.windowNumber), png]; try? p.run(); p.waitUntilExit()
  } else {
    try? "\(w.windowNumber)".write(toFile: "\(outDir)/\(file).req", atomically: true, encoding: .utf8)
    let deadline = Date().addingTimeInterval(3)
    while !FileManager.default.fileExists(atPath: png) && Date() < deadline { wait(0.05) }
  }
  return state
}
func key(_ w: NSWindow, _ chars: String, _ code: UInt16) -> [String] {
  hit.log = []
  let e = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: w.windowNumber, context: nil, characters: chars, charactersIgnoringModifiers: chars, isARepeat: false, keyCode: code)!
  NSApp.sendEvent(e); wait(0.05); return hit.log
}
func record() {
  var gal: [String: Any] = [:]
  for (rn, row) in galleryControls { var m: [String: Any] = [:]; for (sn, c) in row { m[sn] = ctlInfo(c, c.window!) }; gal[rn] = m }
  out["gallery"] = gal
  var sg: [String: Any] = [:]
  for (rn, row) in swiftHosts { var m: [String: Any] = [:]; for (sn, c) in row { m[sn] = ctlInfo(c, c.window!) }; sg[rn] = m }
  out["swiftui"] = sg
  var form: [String: Any] = [:]
  for (n, v) in [("nameLabel", grid.cell(atColumnIndex: 0, rowIndex: 0).contentView!), ("nameField", nameF), ("emailLabel", grid.cell(atColumnIndex: 0, rowIndex: 1).contentView!), ("emailField", mailF), ("formatLabel", grid.cell(atColumnIndex: 0, rowIndex: 2).contentView!), ("formatPopUp", fmt), ("qualityLabel", grid.cell(atColumnIndex: 0, rowIndex: 3).contentView!), ("qualitySlider", qual), ("optionsLabel", grid.cell(atColumnIndex: 0, rowIndex: 4).contentView!), ("opt1", opt1), ("opt2", opt2), ("notifyLabel", grid.cell(atColumnIndex: 0, rowIndex: 6).contentView!), ("notifySwitch", notif), ("copiesLabel", grid.cell(atColumnIndex: 0, rowIndex: 7).contentView!), ("copiesField", copies), ("stepper", step), ("cancel", cancelB), ("export", okB)] as [(String, NSView)] {
    form[n] = ctlInfo(v, formWin)
  }
  form["grid"] = ["rowSpacing": r(grid.rowSpacing), "columnSpacing": r(grid.columnSpacing), "frame": rect(grid.frame)]
  form["buttonsStackSpacing"] = r(buttons.spacing)
  out["form"] = form
}
func finish() {
  let data = try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .sortedKeys])
  try! data.write(to: URL(fileURLWithPath: "\(outDir)/controls-\(mode).json"))
  exit(0)
}

for (i, (_, w)) in windows.enumerated() { w.setFrameTopLeftPoint(NSPoint(x: 40 + i * 40, y: 860 - i * 30)) }
alert2.window.setFrameTopLeftPoint(NSPoint(x: 900, y: 800)); alert3.window.setFrameTopLeftPoint(NSPoint(x: 900, y: 500)); alertR.window.setFrameTopLeftPoint(NSPoint(x: 600, y: 500))
if mode != "inactive" { app.activate(ignoringOtherApps: true) }

DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
  app.appearance = NSAppearance(named: mode == "dark" ? .darkAqua : .aqua)
  for (_, w) in windows { w.orderFront(nil) }
  wait(0.2)
  var shots: [[String: Any]] = []
  if mode == "inactive" {
    shots.append(shot(g1, "buttons-light-inactive", key: false)); shots.append(shot(alert2.window, "alert2-light-inactive", key: false))
    app.appearance = NSAppearance(named: .darkAqua); wait(0.5)
    shots.append(shot(g1, "buttons-dark-inactive", key: false))
    record(); out["shots"] = shots; finish()
  }
  shots.append(shot(g1, "buttons-\(mode)")); shots.append(shot(g2, "inputs-\(mode)")); shots.append(shot(formWin, "form-\(mode)"))
  if mode == "light" {
    alert2.window.orderFront(nil)
    shots.append(shot(alert2.window, "alert2-light")); alert2.window.orderOut(nil)
    shots.append(shot(swWin, "swiftui-light"))
    // 回车 / Esc：表单窗口里有 Export（keyEquivalent 回车）和 Cancel（keyEquivalent Esc）
    formWin.makeKeyAndOrderFront(nil); formWin.makeFirstResponder(nil); wait(0.1)
    let k1 = key(formWin, "\r", 36)
    formWin.makeFirstResponder(nameF); wait(0.1)
    let k2 = key(formWin, "\r", 36)
    let k3 = key(formWin, "\u{1b}", 53)
    out["keys"] = ["returnNoFocus": k1, "returnTextFieldFocused": k2, "escTextFieldFocused": k3, "defaultButtonCell": formWin.defaultButtonCell?.title ?? "nil", "formWindowIsKey": formWin.isKeyWindow, "appActive": NSApp.isActive]
  }
  record(); out["shots"] = shots; finish()
}
app.run()
