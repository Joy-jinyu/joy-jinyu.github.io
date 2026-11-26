import AppKit
import ApplicationServices

var out: [String: Any] = [:]
out["os"] = ProcessInfo.processInfo.operatingSystemVersionString
out["axTrusted"] = AXIsProcessTrusted()

let app = NSApplication.shared
app.setActivationPolicy(.regular)

func r(_ x: CGFloat) -> Double { (Double(x) * 100).rounded() / 100 }
func rect(_ f: NSRect) -> [String: Double] { ["x": r(f.origin.x), "y": r(f.origin.y), "w": r(f.width), "h": r(f.height)] }

// ---------- 控件尺寸 ----------
var sizes: [(String, NSControl.ControlSize)] = [("mini", .mini), ("small", .small), ("regular", .regular), ("large", .large)]
if #available(macOS 26.0, *) { sizes.append(("extraLarge", .extraLarge)) }

func measure(_ make: () -> NSControl) -> [String: Any] {
  var res: [String: Any] = [:]
  for (name, s) in sizes {
    let c = make(); c.controlSize = s
    if let b = c as? NSButton, b.bezelStyle == .push || b.bezelStyle == .rounded { }
    c.font = NSFont.systemFont(ofSize: NSFont.systemFontSize(for: s))
    c.sizeToFit()
    let fit = c.fittingSize, intr = c.intrinsicContentSize
    res[name] = ["fitW": r(fit.width), "fitH": r(fit.height), "intrW": r(intr.width), "intrH": r(intr.height), "font": r(NSFont.systemFontSize(for: s))]
  }
  return res
}
var controls: [String: Any] = [:]
controls["push(OK)"] = measure { let b = NSButton(title: "OK", target: nil, action: nil); b.bezelStyle = .push; return b }
controls["push(Cancel)"] = measure { let b = NSButton(title: "Cancel", target: nil, action: nil); b.bezelStyle = .push; return b }
controls["checkbox"] = measure { NSButton(checkboxWithTitle: "Option", target: nil, action: nil) }
controls["radio"] = measure { NSButton(radioButtonWithTitle: "Option", target: nil, action: nil) }
controls["popUp"] = measure { let p = NSPopUpButton(frame: .zero, pullsDown: false); p.addItems(withTitles: ["Option"]); return p }
controls["textField"] = measure { let t = NSTextField(string: "Text"); return t }
controls["searchField"] = measure { NSSearchField(string: "") }
controls["comboBox"] = measure { let c = NSComboBox(); c.stringValue = "Text"; return c }
controls["segmented"] = measure { NSSegmentedControl(labels: ["One", "Two", "Three"], trackingMode: .selectOne, target: nil, action: nil) }
controls["switch"] = measure { NSSwitch() }
controls["slider"] = measure { NSSlider(value: 0.5, minValue: 0, maxValue: 1, target: nil, action: nil) }
controls["stepper"] = measure { NSStepper() }
controls["disclosure"] = measure { let b = NSButton(title: "", target: nil, action: nil); b.bezelStyle = .disclosure; b.setButtonType(.pushOnPushOff); return b }
controls["helpButton"] = measure { let b = NSButton(title: "", target: nil, action: nil); b.bezelStyle = .helpButton; return b }
controls["datePicker"] = measure { NSDatePicker() }
out["controls"] = controls

// ---------- 字体 ----------
var fonts: [String: Any] = [:]
for (n, s) in sizes { fonts["systemFontSize.\(n)"] = r(NSFont.systemFontSize(for: s)) }
fonts["systemFontSize"] = r(NSFont.systemFontSize)
fonts["smallSystemFontSize"] = r(NSFont.smallSystemFontSize)
fonts["labelFontSize"] = r(NSFont.labelFontSize)
fonts["menuFont"] = r(NSFont.menuFont(ofSize: 0).pointSize)
fonts["menuBarFont"] = r(NSFont.menuBarFont(ofSize: 0).pointSize)
fonts["titleBarFont"] = r(NSFont.titleBarFont(ofSize: 0).pointSize)
fonts["toolTipsFont"] = r(NSFont.toolTipsFont(ofSize: 0).pointSize)
fonts["messageFont"] = r(NSFont.messageFont(ofSize: 0).pointSize)
fonts["paletteFont"] = r(NSFont.paletteFont(ofSize: 0).pointSize)
let lm = NSLayoutManager()
var styles: [String: Any] = [:]
let ts: [(String, NSFont.TextStyle)] = [("largeTitle", .largeTitle), ("title1", .title1), ("title2", .title2), ("title3", .title3), ("headline", .headline), ("subheadline", .subheadline), ("body", .body), ("callout", .callout), ("footnote", .footnote), ("caption1", .caption1), ("caption2", .caption2)]
for (n, t) in ts {
  let f = NSFont.preferredFont(forTextStyle: t, options: [:])
  let w = (f.fontDescriptor.object(forKey: .traits) as? [NSFontDescriptor.TraitKey: Any])?[.weight] as? CGFloat ?? 0
  styles[n] = ["size": r(f.pointSize), "weight": r(w), "lineHeight": r(lm.defaultLineHeight(for: f)), "name": f.fontName]
}
fonts["textStyles"] = styles
out["fonts"] = fonts

// ---------- 颜色 ----------
func hex(_ c: NSColor) -> String {
  guard let s = c.usingColorSpace(.sRGB) else { return "n/a(\(c.colorSpace.localizedName ?? "?"))" }
  let R = Int((s.redComponent * 255).rounded()), G = Int((s.greenComponent * 255).rounded()), B = Int((s.blueComponent * 255).rounded())
  let a = (s.alphaComponent * 1000).rounded() / 1000
  return String(format: "#%02X%02X%02X", R, G, B) + (a < 1 ? " a=\(a)" : "")
}
let named: [(String, NSColor)] = [
  ("labelColor", .labelColor), ("secondaryLabelColor", .secondaryLabelColor), ("tertiaryLabelColor", .tertiaryLabelColor), ("quaternaryLabelColor", .quaternaryLabelColor),
  ("textColor", .textColor), ("placeholderTextColor", .placeholderTextColor), ("selectedTextColor", .selectedTextColor), ("textBackgroundColor", .textBackgroundColor),
  ("selectedTextBackgroundColor", .selectedTextBackgroundColor), ("keyboardFocusIndicatorColor", .keyboardFocusIndicatorColor), ("unemphasizedSelectedTextColor", .unemphasizedSelectedTextColor), ("unemphasizedSelectedTextBackgroundColor", .unemphasizedSelectedTextBackgroundColor),
  ("linkColor", .linkColor), ("separatorColor", .separatorColor), ("selectedContentBackgroundColor", .selectedContentBackgroundColor), ("unemphasizedSelectedContentBackgroundColor", .unemphasizedSelectedContentBackgroundColor),
  ("selectedMenuItemTextColor", .selectedMenuItemTextColor), ("gridColor", .gridColor), ("headerTextColor", .headerTextColor),
  ("controlAccentColor", .controlAccentColor), ("controlColor", .controlColor), ("controlBackgroundColor", .controlBackgroundColor), ("controlTextColor", .controlTextColor), ("disabledControlTextColor", .disabledControlTextColor),
  ("selectedControlColor", .selectedControlColor), ("selectedControlTextColor", .selectedControlTextColor), ("alternateSelectedControlTextColor", .alternateSelectedControlTextColor),
  ("windowBackgroundColor", .windowBackgroundColor), ("windowFrameTextColor", .windowFrameTextColor), ("underPageBackgroundColor", .underPageBackgroundColor),
  ("findHighlightColor", .findHighlightColor), ("highlightColor", .highlightColor), ("shadowColor", .shadowColor),
  ("systemRed", .systemRed), ("systemOrange", .systemOrange), ("systemYellow", .systemYellow), ("systemGreen", .systemGreen), ("systemMint", .systemMint), ("systemTeal", .systemTeal), ("systemCyan", .systemCyan), ("systemBlue", .systemBlue), ("systemIndigo", .systemIndigo), ("systemPurple", .systemPurple), ("systemPink", .systemPink), ("systemBrown", .systemBrown), ("systemGray", .systemGray),
  ("systemFill", .systemFill), ("secondarySystemFill", .secondarySystemFill), ("tertiarySystemFill", .tertiarySystemFill), ("quaternarySystemFill", .quaternarySystemFill), ("quinarySystemFill", .quinarySystemFill),
]
var colors: [String: Any] = [:]
let apps: [(String, NSAppearance.Name)] = [("light", .aqua), ("dark", .darkAqua), ("lightHC", .accessibilityHighContrastAqua), ("darkHC", .accessibilityHighContrastDarkAqua)]
for (an, a) in apps {
  var m: [String: String] = [:]
  NSAppearance(named: a)!.performAsCurrentDrawingAppearance { for (n, c) in named { m[n] = hex(c) } }
  colors[an] = m
}
let alt = NSColor.alternatingContentBackgroundColors
var altm: [String: [String]] = [:]
for (an, a) in apps { NSAppearance(named: a)!.performAsCurrentDrawingAppearance { altm[an] = alt.map(hex) } }
colors["alternatingContentBackgroundColors"] = altm
out["colors"] = colors
out["userAccent"] = UserDefaults.standard.object(forKey: "AppleAccentColor") ?? "default(multicolor/blue)"
out["userHighlight"] = UserDefaults.standard.string(forKey: "AppleHighlightColor") ?? "default"
out["increaseContrast"] = NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast
out["reduceTransparency"] = NSWorkspace.shared.accessibilityDisplayShouldReduceTransparency
out["reduceMotion"] = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion

// ---------- 菜单栏 / 状态栏 ----------
out["menuBarHeight"] = r(NSApp.mainMenu?.menuBarHeight ?? NSStatusBar.system.thickness)
out["statusBarThickness"] = r(NSStatusBar.system.thickness)
let scr = NSScreen.main!
out["screen"] = ["frame": rect(scr.frame), "visible": rect(scr.visibleFrame), "backingScale": r(scr.backingScaleFactor), "safeTop": r(scr.safeAreaInsets.top)]

// ---------- 表格 / 侧边栏行高 ----------
var rows: [String: Any] = [:]
for (n, s) in [("default", NSTableView.RowSizeStyle.default), ("small", .small), ("medium", .medium), ("large", .large)] as [(String, NSTableView.RowSizeStyle)] {
  let t = NSTableView(); t.style = .sourceList; t.rowSizeStyle = s
  let o = NSOutlineView(); o.style = .sourceList; o.rowSizeStyle = s
  let p = NSTableView(); p.style = .inset; p.rowSizeStyle = s
  rows[n] = ["sourceList.rowHeight": r(t.rowHeight), "sourceList.intercell": rect(NSRect(origin: .zero, size: t.intercellSpacing)), "outline.indent": r(o.indentationPerLevel), "inset.rowHeight": r(p.rowHeight)]
}
let plain = NSTableView(); plain.style = .plain
let full = NSTableView(); full.style = .fullWidth
rows["plain.rowHeight"] = r(plain.rowHeight); rows["fullWidth.rowHeight"] = r(full.rowHeight)
rows["effectiveRowHeight.sourceList.default"] = { let t = NSTableView(); t.style = .sourceList; return r(t.effectiveRowSizeStyle == .default ? -1 : CGFloat(t.effectiveRowSizeStyle.rawValue)) }()
out["tables"] = rows

let data = try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .sortedKeys])
FileHandle.standardOutput.write(data)
print()
