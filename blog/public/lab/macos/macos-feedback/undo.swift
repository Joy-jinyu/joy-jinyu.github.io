import AppKit
// 撤销的菜单标题和合并行为。不开窗口、不抢前台。
// 用法：undo [-AppleLanguages '(zh-Hans)']   语言只影响本进程，不改系统设置。
// 输出 JSON 到 stdout。
func j(_ o: Any) -> String { String(data: try! JSONSerialization.data(withJSONObject: o, options: [.prettyPrinted, .sortedKeys]), encoding: .utf8)! }
var out: [String: Any] = ["preferredLanguages": Locale.preferredLanguages, "mainBundleLocalizations": Bundle.main.localizations]

final class Box: NSObject { @objc var v = 0 }
let um = UndoManager()
out["defaults"] = ["levelsOfUndo": um.levelsOfUndo, "groupsByEvent": um.groupsByEvent]
out["emptyTitles"] = ["undo": um.undoMenuItemTitle, "redo": um.redoMenuItemTitle]
// 手动分组，避免依赖 run loop
let box = Box()
um.groupsByEvent = false
um.beginUndoGrouping()
um.registerUndo(withTarget: box) { $0.v = 0 }
um.setActionName("Bold")
um.endUndoGrouping()
var named: [String: Any] = ["undoActionName": um.undoActionName, "undoMenuItemTitle": um.undoMenuItemTitle]
um.undo()
named["redoMenuItemTitle"] = um.redoMenuItemTitle
out["actionNameBold"] = named
out["titleFor"] = ["undo(加粗)": um.undoMenuTitle(forUndoActionName: "加粗"), "redo(加粗)": um.redoMenuTitle(forUndoActionName: "加粗"), "undo(空)": um.undoMenuTitle(forUndoActionName: "")]

// NSTextView 自带撤销：连续键入合成一步「Typing」
let tv = NSTextView(frame: NSRect(x: 0, y: 0, width: 300, height: 100))
tv.allowsUndo = true
let tum = UndoManager()
final class D: NSObject, NSTextViewDelegate { let u: UndoManager; init(_ u: UndoManager) { self.u = u }; func undoManager(for view: NSTextView) -> UndoManager? { u } }
let d = D(tum); tv.delegate = d
// 每次键入之间让 run loop 转一圈，模拟三次独立的按键事件
func spin() { RunLoop.current.run(until: Date().addingTimeInterval(0.05)) }
for ch in ["a", "b", "c"] { tv.insertText(ch, replacementRange: tv.selectedRange()); spin() }
var typing: [String: Any] = ["after3Inserts": tv.string, "undoActionName": tum.undoActionName, "undoMenuItemTitle": tum.undoMenuItemTitle]
tum.undo()
typing["afterOneUndo"] = tv.string
typing["redoMenuItemTitle"] = tum.redoMenuItemTitle
out["textViewTyping"] = typing
// 对照：不是键入的三次改动，各自一步
let um2 = UndoManager(); let b2 = Box()
for i in 1...3 { um2.registerUndo(withTarget: b2) { $0.v = i - 1 }; um2.setActionName("Step"); b2.v = i; spin() }
var steps = 0; while um2.canUndo { um2.undo(); steps += 1 }
out["nonTypingThreeChanges"] = ["undoSteps": steps]
print(j(out))
