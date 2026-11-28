import SwiftUI
import AppKit
// 反馈篇的 GUI 探针。打成 .app 后：open -n -W FeedbackProbe.app --args <输出目录> shots|strings|progress [-AppleLanguages '(zh-Hans)']
// 量：进度指示器各 controlSize 的尺寸；SwiftUI Settings 场景生成的设置窗口（菜单项、标题、工具栏、按钮、切换分组时的尺寸变化）；
// 文稿窗口的标题与「已编辑」；编辑菜单里撤销项的标题；动画默认时长与「减少动态效果」的当前值。
// .app 没有录屏权限，截图交给终端里的 shoot.sh（写 <名字>.req，等对方写出 png）。10 秒内自行退出。
let outDir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : NSTemporaryDirectory()
let mode = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "strings"
let zh = Locale.preferredLanguages.first?.hasPrefix("zh") ?? false
func r(_ x: CGFloat) -> Double { (Double(x) * 100).rounded() / 100 }
func rect(_ f: NSRect) -> [String: Double] { ["x": r(f.origin.x), "y": r(f.origin.y), "w": r(f.width), "h": r(f.height)] }
func size(_ s: NSSize) -> [String: Double] { ["w": r(s.width), "h": r(s.height)] }
func wait(_ s: Double) { RunLoop.current.run(until: Date().addingTimeInterval(s)) }
var out: [String: Any] = ["lang": Locale.preferredLanguages, "mode": mode]
var log: [String] = []
func shot(_ w: NSWindow, _ name: String) {
  guard mode == "shots" || mode == "progress" else { return }
  w.makeKeyAndOrderFront(nil); wait(0.35)
  log.append("\(name) active=\(NSApp.isActive) key=\(w.isKeyWindow) appearance=\(w.effectiveAppearance.name.rawValue)")
  let png = "\(outDir)/\(name).png"
  try? "\(w.windowNumber)".write(toFile: "\(outDir)/\(name).req", atomically: true, encoding: .utf8)
  let deadline = Date().addingTimeInterval(2)
  while !FileManager.default.fileExists(atPath: png) && Date() < deadline { wait(0.05) }
}
func menuDump(_ m: NSMenu?) -> [[String: Any]] {
  (m?.items ?? []).map { i in
    var mods: [String] = []
    if i.keyEquivalentModifierMask.contains(.command) { mods.append("cmd") }
    if i.keyEquivalentModifierMask.contains(.shift) { mods.append("shift") }
    if i.keyEquivalentModifierMask.contains(.option) { mods.append("option") }
    return ["title": i.title, "key": i.keyEquivalent, "mods": mods, "enabled": i.isEnabled, "separator": i.isSeparatorItem,
            "action": i.action.map { NSStringFromSelector($0) } ?? ""]
  }
}

// MARK: 进度指示器
let sizes: [(String, NSControl.ControlSize)] = {
  var s: [(String, NSControl.ControlSize)] = [("mini", .mini), ("small", .small), ("regular", .regular), ("large", .large)]
  if #available(macOS 26.0, *) { s.append(("extraLarge", .extraLarge)) }
  return s
}()
func indicator(_ style: NSProgressIndicator.Style, _ cs: NSControl.ControlSize, indeterminate: Bool) -> NSProgressIndicator {
  let p = NSProgressIndicator()
  p.style = style; p.controlSize = cs; p.isIndeterminate = indeterminate
  p.minValue = 0; p.maxValue = 100; p.doubleValue = 40
  p.translatesAutoresizingMaskIntoConstraints = false
  return p
}
func progressWindow() -> (NSWindow, [String: Any]) {
  var data: [String: Any] = [:]
  let w = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 560, height: 300), styleMask: [.titled, .closable], backing: .buffered, defer: false)
  w.title = zh ? "进度指示器" : "Progress indicators"
  w.isReleasedWhenClosed = false
  let grid = NSGridView()
  grid.rowSpacing = 14; grid.columnSpacing = 20
  grid.translatesAutoresizingMaskIntoConstraints = false
  let head = [zh ? "controlSize" : "controlSize", zh ? "条形 · 40%" : "Bar · 40%", zh ? "条形 · 不确定" : "Bar · indeterminate", zh ? "环形 · 40%" : "Circular · 40%", zh ? "转圈" : "Spinner"]
  grid.addRow(with: head.map { let l = NSTextField(labelWithString: $0); l.font = .systemFont(ofSize: 11); l.textColor = .secondaryLabelColor; return l })
  var made: [(String, String, NSProgressIndicator)] = []
  for (n, cs) in sizes {
    let bar = indicator(.bar, cs, indeterminate: false), barI = indicator(.bar, cs, indeterminate: true)
    let pie = indicator(.spinning, cs, indeterminate: false), spin = indicator(.spinning, cs, indeterminate: true)
    bar.widthAnchor.constraint(equalToConstant: 140).isActive = true
    barI.widthAnchor.constraint(equalToConstant: 140).isActive = true
    let label = NSTextField(labelWithString: n); label.font = .systemFont(ofSize: 13)
    grid.addRow(with: [label, bar, barI, pie, spin])
    made += [(n, "bar", bar), (n, "barIndeterminate", barI), (n, "circular", pie), (n, "spinner", spin)]
    var row: [String: Any] = [:]
    for (k, p) in [("bar", bar), ("barIndeterminate", barI), ("circular", pie), ("spinner", spin)] {
      row[k] = ["intrinsic": size(p.intrinsicContentSize), "fitting": size(p.fittingSize)]
    }
    data[n] = row
  }
  for c in 1..<grid.numberOfColumns { grid.column(at: c).xPlacement = .leading }
  grid.rowAlignment = .none
  for i in 0..<grid.numberOfRows { grid.row(at: i).yPlacement = .center }
  let cv = NSView(); w.contentView = cv
  cv.addSubview(grid)
  NSLayoutConstraint.activate([grid.leadingAnchor.constraint(equalTo: cv.leadingAnchor, constant: 20), grid.topAnchor.constraint(equalTo: cv.topAnchor, constant: 20),
                               grid.trailingAnchor.constraint(lessThanOrEqualTo: cv.trailingAnchor, constant: -20), grid.bottomAnchor.constraint(equalTo: cv.bottomAnchor, constant: -20)])
  for (_, _, p) in made where p.isIndeterminate { p.startAnimation(nil) }
  w.layoutIfNeeded()
  w.setContentSize(grid.fittingSize.applying(.init(translationX: 40, y: 40)))
  w.layoutIfNeeded()
  var frames: [String: Any] = [:]
  for (n, k, p) in made { frames["\(n).\(k)"] = rect(p.frame) }
  data["laidOutFrames"] = frames
  data["usesThreadedAnimation"] = made[0].2.usesThreadedAnimation
  return (w, data)
}

// MARK: 文稿窗口
class Doc: NSDocument {
  let tv = NSTextView(frame: NSRect(x: 0, y: 0, width: 420, height: 120))
  override func makeWindowControllers() {
    let w = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 420, height: 120), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
    w.isReleasedWhenClosed = false
    tv.allowsUndo = true
    w.contentView = tv
    addWindowController(NSWindowController(window: w))
  }
  override func data(ofType typeName: String) throws -> Data { Data() }
  // 不往磁盘写任何东西
  override func autosave(withImplicitCancellability c: Bool, completionHandler: @escaping (Error?) -> Void) { completionHandler(nil) }
  override var autosavingFileType: String? { nil }
}
final class DocAuto: Doc { override class var autosavesInPlace: Bool { true } }
final class DocManual: Doc { override class var autosavesInPlace: Bool { false } }
func titlebarStrings(_ w: NSWindow) -> [String] {
  var s: [String] = []
  func walk(_ v: NSView) { if let t = v as? NSTextField, !t.stringValue.isEmpty { s.append(t.stringValue) }; v.subviews.forEach(walk) }
  if let root = w.contentView?.superview { walk(root) }
  return s
}

// MARK: 设置窗口
struct Pane: View {
  let rows: Int
  @State private var on = true
  var body: some View {
    Form {
      ForEach(0..<rows, id: \.self) { i in Toggle(zh ? "选项 \(i + 1)" : "Option \(i + 1)", isOn: $on) }
    }
    .padding(20)
    .frame(width: 420)
  }
}
struct SettingsView: View {
  var body: some View {
    TabView {
      Pane(rows: 2).tabItem { Label(zh ? "通用" : "General", systemImage: "gearshape") }
      Pane(rows: 6).tabItem { Label(zh ? "高级" : "Advanced", systemImage: "gearshape.2") }
    }
  }
}
func settingsInfo(_ w: NSWindow) -> [String: Any] {
  var d: [String: Any] = ["title": w.title, "frame": rect(w.frame), "contentLayoutRect": rect(w.contentLayoutRect),
                          "titlebarPlusToolbar": r(w.frame.height - w.contentLayoutRect.height),
                          "toolbarStyleRaw": w.toolbarStyle.rawValue, "toolbarStyleIsPreference": w.toolbarStyle == .preference,
                          "miniaturizableMask": w.styleMask.contains(.miniaturizable), "resizableMask": w.styleMask.contains(.resizable),
                          "identifier": w.identifier?.rawValue ?? "", "frameAutosaveName": w.frameAutosaveName]
  var b: [String: Any] = [:]
  for (n, t) in [("close", NSWindow.ButtonType.closeButton), ("miniaturize", .miniaturizeButton), ("zoom", .zoomButton)] {
    if let v = w.standardWindowButton(t) { b[n] = ["enabled": v.isEnabled, "hidden": v.isHidden] }
  }
  d["buttons"] = b
  if let t = w.toolbar {
    d["toolbar"] = ["displayModeRaw": t.displayMode.rawValue, "allowsUserCustomization": t.allowsUserCustomization, "isVisible": t.isVisible,
                    "selected": t.selectedItemIdentifier?.rawValue ?? "", "items": t.items.map { ["id": $0.itemIdentifier.rawValue, "label": $0.label] }]
  }
  return d
}

final class AppDelegate: NSObject, NSApplicationDelegate {
  func applicationDidFinishLaunching(_ n: Notification) {
    Timer.scheduledTimer(withTimeInterval: 9.5, repeats: false) { _ in finish("timeout") }
    Timer.scheduledTimer(withTimeInterval: 0.6, repeats: false) { _ in run() }
  }
}
func finish(_ why: String) {
  out["finish"] = why
  out["shotLog"] = log
  let data = try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .sortedKeys])
  let lang = zh ? "zh-Hans" : "en"
  try! data.write(to: URL(fileURLWithPath: "\(outDir)/\(mode == "progress" ? "progress" : "feedback")-\(lang).json"))
  try? "done".write(toFile: "\(outDir)/done", atomically: true, encoding: .utf8)
  exit(0)
}

func run() {
  NSApp.activate(ignoringOtherApps: true)
  // 动效
  out["motion"] = ["reduceMotion": NSWorkspace.shared.accessibilityDisplayShouldReduceMotion,
                   "animationContextDefaultDuration": NSAnimationContext.current.duration]
  // 菜单：SwiftUI 自动生成的应用菜单和编辑菜单
  let main = NSApp.mainMenu
  out["menuTitles"] = main?.items.map { $0.title } ?? []
  out["appMenu"] = menuDump(main?.items.first?.submenu)

  // 进度指示器
  let (pw, pdata) = progressWindow()
  out["progress"] = pdata
  pw.setFrameTopLeftPoint(NSPoint(x: 60, y: 860)); pw.makeKeyAndOrderFront(nil)
  wait(0.3)
  shot(pw, "progress-light")

  // 窗口缩放动画时长：系统按距离算
  var resize: [String: Double] = [:]
  for dh in [50, 150, 300, 600, 900, 1200] {
    var f = pw.frame; f.size.height += CGFloat(dh); f.origin.y -= CGFloat(dh)
    resize["+\(dh)pt"] = pw.animationResizeTime(f)
  }
  var motion = out["motion"] as! [String: Any]; motion["windowAnimationResizeTime"] = resize; out["motion"] = motion
  // progress 模式：只拍进度指示器的浅 / 深两张
  if mode == "progress" {
    NSApp.appearance = NSAppearance(named: .darkAqua); wait(0.3)
    shot(pw, "progress-dark")
    finish("ok")
  }

  // 设置窗口：从应用菜单里带 ⌘, 的那一项打开
  var settings: [String: Any] = [:]
  if let appMenu = main?.items.first?.submenu, let idx = appMenu.items.firstIndex(where: { $0.keyEquivalent == "," }) {
    settings["menuItem"] = appMenu.items[idx].title
    appMenu.performActionForItem(at: idx)
  }
  wait(0.8)
  if let sw = NSApp.windows.first(where: { $0.toolbar != nil && $0.isVisible && $0 != pw }) {
    sw.setFrameTopLeftPoint(NSPoint(x: 700, y: 860))
    wait(0.2)
    settings["first"] = settingsInfo(sw)
    shot(sw, "settings-1-light")
    // 切到第二个分组：点工具栏里的第二项，并逐帧记录窗口高度
    if let t = sw.toolbar, t.items.count > 1, let other = t.items.first(where: { $0.itemIdentifier != t.selectedItemIdentifier }), let a = other.action {
      let t0 = Date(); var samples: [[String: Double]] = []
      NSApp.sendAction(a, to: other.target, from: other)
      settings["sendActionReturnedAfter"] = r(Date().timeIntervalSince(t0))
      while Date().timeIntervalSince(t0) < 0.6 { samples.append(["t": r(Date().timeIntervalSince(t0)), "h": r(sw.frame.height)]); wait(0.016) }
      settings["switchSamples"] = samples
    }
    settings["second"] = settingsInfo(sw)
    shot(sw, "settings-2-light")
    NSApp.appearance = NSAppearance(named: .darkAqua)
    wait(0.3)
    shot(sw, "settings-2-dark")
    shot(pw, "progress-dark")
    NSApp.appearance = nil
    sw.orderOut(nil)
  } else {
    settings["error"] = "没找到设置窗口"
    settings["windows"] = NSApp.windows.map { ["title": $0.title, "visible": $0.isVisible] }
  }
  out["settings"] = settings
  pw.orderOut(nil)

  // 文稿窗口：键入三个字，看标题和编辑菜单
  var docs: [String: Any] = [:]
  for (name, doc) in [("autosave", DocAuto() as Doc), ("manual", DocManual() as Doc)] {
    doc.makeWindowControllers()
    guard let w = doc.windowControllers.first?.window else { continue }
    w.setFrameTopLeftPoint(NSPoint(x: 60, y: 860))
    doc.showWindows(); w.makeKeyAndOrderFront(nil); w.makeFirstResponder(doc.tv)
    var d: [String: Any] = ["displayName": doc.displayName as Any, "before": ["title": w.title, "isDocumentEdited": w.isDocumentEdited, "titlebar": titlebarStrings(w)]]
    for ch in ["a", "b", "c"] { doc.tv.insertText(ch, replacementRange: doc.tv.selectedRange()); wait(0.05) }
    wait(0.3)
    let edit = main?.items.first(where: { $0.submenu?.items.contains(where: { $0.action == Selector(("undo:")) }) ?? false })?.submenu
    edit?.update()
    d["after"] = ["title": w.title, "subtitle": w.subtitle, "isDocumentEdited": w.isDocumentEdited, "hasUnautosavedChanges": doc.hasUnautosavedChanges,
                  "titlebar": titlebarStrings(w), "editMenu": menuDump(edit).prefix(3).map { $0 },
                  "sameUndoManager": doc.undoManager === w.undoManager]
    // 键入没有记到文稿的撤销管理器时，手动记一次改动，看标题栏怎么变
    doc.updateChangeCount(.changeDone); wait(0.3)
    d["afterUpdateChangeCount"] = ["title": w.title, "isDocumentEdited": w.isDocumentEdited, "titlebar": titlebarStrings(w)]
    shot(w, "doc-\(name)-light")
    docs[name] = d
    w.orderOut(nil)
  }
  out["documents"] = docs
  finish("ok")
}

@main struct FeedbackProbe: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) var delegate
  var body: some Scene {
    Settings { SettingsView() }
  }
}
