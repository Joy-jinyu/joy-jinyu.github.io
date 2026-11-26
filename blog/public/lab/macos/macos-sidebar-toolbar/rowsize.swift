import AppKit
// 不开窗口、不改系统设置：只建一个 source list 大纲视图，读 .default 解析出的档位和行高。
// 用命令行参数域临时覆盖全局偏好（只对这个进程生效）：rowsize -NSTableViewDefaultSizeMode 1|2|3
// 输出一行 JSON。审稿时写的测试（review-sidebar/src/rowsize.swift），这里改成 JSON 输出。
let o = NSOutlineView(); o.style = .sourceList; o.rowSizeStyle = .default
let mode = UserDefaults.standard.object(forKey: "NSTableViewDefaultSizeMode").map { "\($0)" } ?? "unset"
let out: [String: Any] = ["NSTableViewDefaultSizeMode": mode, "effectiveRowSizeStyle": o.effectiveRowSizeStyle.rawValue, "rowHeight": Double(o.rowHeight)]
print(String(data: try! JSONSerialization.data(withJSONObject: out, options: [.sortedKeys]), encoding: .utf8)!)
