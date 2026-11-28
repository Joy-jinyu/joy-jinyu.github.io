import CoreGraphics
import Foundation
// 用法：listwin <pid>。列出这个进程的所有窗口（含屏幕外的）：窗口号、层级、是否在屏幕上、位置尺寸（pt，原点在主屏左上）。
let pid = Int32(CommandLine.arguments[1])!
let list = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as! [[String: Any]]
for w in list where (w[kCGWindowOwnerPID as String] as? Int32) == pid {
  let b = w[kCGWindowBounds as String] as! [String: Double]
  print(w[kCGWindowNumber as String]!, "layer=\(w[kCGWindowLayer as String]!)", "onscreen=\(w[kCGWindowIsOnscreen as String] ?? false)",
        "x=\(b["X"]!) y=\(b["Y"]!) w=\(b["Width"]!) h=\(b["Height"]!)", "alpha=\(w[kCGWindowAlpha as String]!)")
}
