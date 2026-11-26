import AppKit
// 不显示窗口，只让 NSAlert 排版（layout()），读按钮的位置和快捷键。用法：alertlayout > alert-layout.json
// 用来比较：取消按钮有没有 Esc、两个还是三个按钮、按钮标题长短，各自怎么排。
let app = NSApplication.shared
func r(_ x: CGFloat) -> Double { (Double(x) * 100).rounded() / 100 }
func key(_ s: String) -> String { s == "\r" ? "Return" : s == "\u{1b}" ? "Esc" : s }
func run(_ name: String, _ titles: [String], esc: Int? = nil, message: String = "要存储对“季度报告”所做的更改吗？", info: String = "如果不存储，你的更改将会丢失。") -> [String: Any] {
  let a = NSAlert()
  a.messageText = message; a.informativeText = info
  for t in titles { a.addButton(withTitle: t) }
  if let i = esc { a.buttons[i].keyEquivalent = "\u{1b}" }
  a.layout()
  let w = a.window
  var bs: [[String: Any]] = []
  var hasIcon = false
  func walk(_ v: NSView) {
    if v.isHidden { return }
    if let b = v as? NSButton, a.buttons.contains(b) {
      let f = b.convert(b.bounds, to: nil)
      bs.append(["title": b.title, "key": key(b.keyEquivalent), "mods": b.keyEquivalentModifierMask.rawValue, "left": r(f.minX), "top": r(w.frame.height - f.maxY), "w": r(f.width), "h": r(f.height)])
      return
    }
    if v is NSImageView { hasIcon = true }
    for s in v.subviews { walk(s) }
  }
  walk(w.contentView!)
  bs.sort { ($0["top"] as! Double, $0["left"] as! Double) < ($1["top"] as! Double, $1["left"] as! Double) }
  return ["name": name, "window": ["w": r(w.frame.width), "h": r(w.frame.height)], "iconShown": hasIcon,
          "defaultButtonCell": w.defaultButtonCell?.title ?? "nil", "buttonsTopToBottomLeftToRight": bs]
}
let long = String(repeating: "这段说明故意写得很长，用来看 alert 会不会变宽。", count: 4)
let out: [[String: Any]] = [
  run("zh-3-noEsc", ["存储", "取消", "不存储"]),
  run("zh-3-escOnCancel", ["存储", "取消", "不存储"], esc: 1),
  run("en-3", ["Save", "Cancel", "Don’t Save"]),
  run("zh-2-noEsc", ["删除", "取消"]),
  run("zh-2-escOnCancel", ["删除", "取消"], esc: 1),
  run("zh-2-longTitles", ["移到废纸篓并清空", "取消"], esc: 1),
  run("zh-1", ["好"]),
  run("zh-2-longInfo", ["删除", "取消"], esc: 1, info: long),
]
let d = try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .sortedKeys])
print(String(data: d, encoding: .utf8)!)
