import AppKit
import ApplicationServices
// 用法：ax <pid>。只读：用辅助功能 API 量一个应用的主窗口外壳（pt，原点在窗口左上角）。
// 输出窗口尺寸、三颗按钮的位置、工具栏 / 标签页栏的位置和高度、标题是否为空。不改任何东西。
let pid = pid_t(CommandLine.arguments[1])!
let appEl = AXUIElementCreateApplication(pid)
func attr<T>(_ e: AXUIElement, _ name: String) -> T? {
  var v: CFTypeRef?
  guard AXUIElementCopyAttributeValue(e, name as CFString, &v) == .success, let val = v else { return nil }
  return val as? T
}
func point(_ e: AXUIElement) -> CGPoint? {
  guard let v: AXValue = attr(e, kAXPositionAttribute) else { return nil }
  var p = CGPoint.zero; AXValueGetValue(v, .cgPoint, &p); return p
}
func size(_ e: AXUIElement) -> CGSize? {
  guard let v: AXValue = attr(e, kAXSizeAttribute) else { return nil }
  var s = CGSize.zero; AXValueGetValue(v, .cgSize, &s); return s
}
guard let win: AXUIElement = attr(appEl, kAXMainWindowAttribute) ?? attr(appEl, kAXFocusedWindowAttribute) else { print("{\"error\":\"no window\"}"); exit(1) }
let wp = point(win)!, ws = size(win)!
var out: [String: Any] = ["window": ["w": ws.width, "h": ws.height]]
let title: String = attr(win, kAXTitleAttribute) ?? ""
out["titleLength"] = title.count
out["subrole"] = (attr(win, kAXSubroleAttribute) as String?) ?? ""
func rel(_ e: AXUIElement) -> [String: Double]? {
  guard let p = point(e), let s = size(e) else { return nil }
  return ["left": Double(p.x - wp.x), "top": Double(p.y - wp.y), "w": Double(s.width), "h": Double(s.height)]
}
for (k, a) in [("close", kAXCloseButtonAttribute), ("minimize", kAXMinimizeButtonAttribute), ("zoom", kAXZoomButtonAttribute), ("fullScreen", "AXFullScreenButton")] {
  if let b: AXUIElement = attr(win, a), let r = rel(b) { out[k] = r }
}
var bars: [[String: Any]] = []
for c in (attr(win, kAXChildrenAttribute) as [AXUIElement]?) ?? [] {
  let role: String = attr(c, kAXRoleAttribute) ?? ""
  if role == "AXToolbar" || role == "AXTabGroup", let r = rel(c) { bars.append(["role": role, "frame": r]) }
}
out["bars"] = bars
let data = try! JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
print(String(data: data, encoding: .utf8)!)
