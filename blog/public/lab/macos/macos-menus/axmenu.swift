import AppKit
import ApplicationServices
// 辅助功能 API 读菜单。只读，唯一的「动作」是 press：只用来点开菜单探针自己的菜单栏项。
// axmenu dump <pid> <out.json> [x y]  读一个进程的菜单栏和当前打开的菜单（位置、尺寸、标题、快捷键）；
//                                     给了屏幕坐标就读这个点下面的那个菜单（弹出式菜单不挂在应用元素下面）
// axmenu press <pid> <菜单标题>        按下这个进程菜单栏上的一项（只对 menus 探针自己用）
// axmenu search <pid> <x> <y> <词> <out.json>  在这个点下的菜单（探针自己的帮助菜单）的搜索框里填词，读结果表
// axmenu apps <out.json>               只读：所有在跑的 com.apple.* 前台应用的菜单栏结构
//                                     只读顶层项；「窗口」菜单在最后一个分隔线处截断（后面是用户的窗口标题）
let a = CommandLine.arguments
AXUIElementSetMessagingTimeout(AXUIElementCreateSystemWide(), 1.5)
func attr<T>(_ e: AXUIElement, _ n: String) -> T? {
  var v: CFTypeRef?
  guard AXUIElementCopyAttributeValue(e, n as CFString, &v) == .success, let x = v else { return nil }
  return x as? T
}
func frame(_ e: AXUIElement) -> [String: Double]? {
  guard let pv: AXValue = attr(e, kAXPositionAttribute), let sv: AXValue = attr(e, kAXSizeAttribute) else { return nil }
  var p = CGPoint.zero, s = CGSize.zero
  AXValueGetValue(pv, .cgPoint, &p); AXValueGetValue(sv, .cgSize, &s)
  return ["x": Double(p.x), "y": Double(p.y), "w": Double(s.width), "h": Double(s.height)]
}
func kids(_ e: AXUIElement) -> [AXUIElement] { attr(e, kAXChildrenAttribute) ?? [] }
func role(_ e: AXUIElement) -> String { attr(e, kAXRoleAttribute) ?? "" }
// 修饰键：AX 的编码 0 = 只有 ⌘；1 ⇧，2 ⌥，4 ⌃，8 不含 ⌘。换成系统显示顺序 ⌃⌥⇧⌘
func mods(_ m: Int) -> String {
  var s = ""
  if m & 4 != 0 { s += "⌃" }; if m & 2 != 0 { s += "⌥" }; if m & 1 != 0 { s += "⇧" }; if m & 8 == 0 { s += "⌘" }
  return s
}
func item(_ e: AXUIElement, withFrame: Bool) -> [String: Any] {
  var d: [String: Any] = ["role": role(e)]
  let t: String = attr(e, kAXTitleAttribute) ?? ""
  // 菜单项标题里引号中的内容可能是用户的文件名，一律隐去
  d["title"] = t.replacingOccurrences(of: "“[^”]*”", with: "“<隐去>”", options: .regularExpression)
  if let en: Bool = attr(e, kAXEnabledAttribute) { d["enabled"] = en }
  let ch: String = attr(e, "AXMenuItemCmdChar") ?? ""
  if !ch.isEmpty { d["shortcut"] = mods((attr(e, "AXMenuItemCmdModifiers") as Int?) ?? 0) + ch }
  if let vk: Int = attr(e, "AXMenuItemCmdVirtualKey"), ch.isEmpty, vk > 0 { d["virtualKey"] = vk }
  if let mk: String = attr(e, "AXMenuItemMarkChar"), !mk.isEmpty { d["mark"] = mk }
  let ks = kids(e)
  if !ks.isEmpty { d["childRoles"] = ks.map(role) }
  if t.isEmpty && ks.isEmpty && ch.isEmpty { d["separatorLike"] = true }
  if withFrame, let f = frame(e) { d["frame"] = f }
  return d
}
func menuDump(_ m: AXUIElement, withFrame: Bool, cutAtLastSeparator: Bool = false) -> [String: Any] {
  var items = kids(m).filter { role($0) == "AXMenuItem" }
  if cutAtLastSeparator, let last = items.lastIndex(where: { ((attr($0, kAXTitleAttribute) as String?) ?? "").isEmpty && kids($0).isEmpty }) {
    items = Array(items[..<last])
  }
  var d: [String: Any] = ["items": items.map { item($0, withFrame: withFrame) }]
  if withFrame, let f = frame(m) { d["frame"] = f }
  if cutAtLastSeparator { d["truncatedAtLastSeparator"] = true }
  return d
}
func write(_ obj: Any, _ path: String) {
  let data = try! JSONSerialization.data(withJSONObject: obj, options: [.prettyPrinted, .sortedKeys])
  try! data.write(to: URL(fileURLWithPath: path))
}

switch a[1] {
case "press":
  let app = AXUIElementCreateApplication(pid_t(a[2])!)
  guard let bar: AXUIElement = attr(app, kAXMenuBarAttribute) else { exit(1) }
  for it in kids(bar) where (attr(it, kAXTitleAttribute) as String?) == a[3] {
    AXUIElementPerformAction(it, kAXPressAction as CFString); exit(0)
  }
  exit(2)
case "dump":
  let app = AXUIElementCreateApplication(pid_t(a[2])!)
  var out: [String: Any] = [:]
  if let bar: AXUIElement = attr(app, kAXMenuBarAttribute) {
    out["menuBar"] = ["frame": frame(bar) as Any, "items": kids(bar).map { ["title": (attr($0, kAXTitleAttribute) as String?) ?? "", "frame": frame($0) as Any] }]
    // 菜单栏上打开着的那个菜单
    for it in kids(bar) {
      for m in kids(it) where role(m) == "AXMenu" {
        let vis: [AXUIElement] = attr(m, "AXVisibleChildren") ?? []
        if !vis.isEmpty || (attr(it, kAXSelectedAttribute) as Bool?) == true { out["openMenuBarMenu"] = ["title": (attr(it, kAXTitleAttribute) as String?) ?? "", "menu": menuDump(m, withFrame: true)] }
      }
    }
  }
  if a.count > 5, let x = Float(a[4]), let y = Float(a[5]) {
    var hit: AXUIElement?
    if AXUIElementCopyElementAtPosition(AXUIElementCreateSystemWide(), x, y, &hit) == .success, var e = hit {
      var hops = 0
      while role(e) != "AXMenu", hops < 6, let p: AXUIElement = attr(e, kAXParentAttribute) { e = p; hops += 1 }
      if role(e) == "AXMenu" { out["menuAtPoint"] = menuDump(e, withFrame: true) } else { out["hitRole"] = role(e) }
    }
  }
  write(out, a[3])
case "search":
  var hit: AXUIElement?
  guard AXUIElementCopyElementAtPosition(AXUIElementCreateSystemWide(), Float(a[3])!, Float(a[4])!, &hit) == .success, var e = hit else { exit(1) }
  var hops = 0
  while role(e) != "AXMenu", hops < 6, let p: AXUIElement = attr(e, kAXParentAttribute) { e = p; hops += 1 }
  func find(_ x: AXUIElement, _ r: String, _ depth: Int) -> AXUIElement? {
    if role(x) == r { return x }
    if depth == 0 { return nil }
    for k in kids(x) { if let f = find(k, r, depth - 1) { return f } }
    return nil
  }
  guard let tf = find(e, "AXTextField", 3) else { exit(2) }
  AXUIElementSetAttributeValue(tf, kAXFocusedAttribute as CFString, kCFBooleanTrue)
  AXUIElementSetAttributeValue(tf, kAXValueAttribute as CFString, a[5] as CFString)
  usleep(1_200_000)
  // 结果表里每一行能读到的文字
  func texts(_ x: AXUIElement, _ depth: Int) -> [String] {
    var t: [String] = []
    for n in [kAXTitleAttribute, kAXValueAttribute, kAXDescriptionAttribute] { if let v: String = attr(x, n), !v.isEmpty { t.append(v) } }
    if depth > 0 { for k in kids(x) { t += texts(k, depth - 1) } }
    return t
  }
  var rows: [[String]] = []
  if let table = find(e, "AXTable", 3) { for r in kids(table) where role(r) == "AXRow" { rows.append(texts(r, 4)) } }
  write(["query": a[5], "fieldValue": (attr(tf, kAXValueAttribute) as String?) ?? "", "rows": rows], a[6])
case "apps":
  var out: [[String: Any]] = []
  for ra in NSWorkspace.shared.runningApplications where ra.activationPolicy == .regular && (ra.bundleIdentifier ?? "").hasPrefix("com.apple.") {
    let app = AXUIElementCreateApplication(ra.processIdentifier)
    guard let bar: AXUIElement = attr(app, kAXMenuBarAttribute) else { continue }
    let tops = kids(bar)
    var d: [String: Any] = ["bundle": ra.bundleIdentifier ?? "", "menuBarTitles": tops.map { (attr($0, kAXTitleAttribute) as String?) ?? "" }]
    if let f = frame(bar) { d["menuBarFrame"] = f }
    var menus: [String: Any] = [:]
    for (i, it) in tops.enumerated() {
      let t: String = attr(it, kAXTitleAttribute) ?? ""
      if i == 0 { continue } // 苹果菜单
      // 只读标准菜单：应用菜单、文件、编辑、格式、显示、窗口、帮助。历史记录、书签、前往这类菜单里是用户数据，不读
      let std = ["文件", "编辑", "格式", "显示", "窗口", "帮助", "File", "Edit", "Format", "View", "Window", "Help"]
      if i != 1 && !std.contains(t) { continue }
      guard let m = kids(it).first(where: { role($0) == "AXMenu" }) else { continue }
      // 窗口菜单截断，避免读到窗口标题
      let isWindow = t == "窗口" || t == "Window"
      menus[t] = menuDump(m, withFrame: false, cutAtLastSeparator: isWindow)
    }
    d["menus"] = menus
    out.append(d)
  }
  write(out, a[2])
default: exit(64)
}
