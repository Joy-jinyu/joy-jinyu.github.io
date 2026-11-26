import AppKit
import CoreText
// 文字与颜色篇的探针。
// typecolor data            读字体（文字样式、加粗变体、字距、光学尺寸）、SF Symbols 尺寸、当前进程看到的强调色，输出 JSON
// typecolor shoot <目录>    开几个窗口，浅色 / 深色各截一张，并在截图上读色块像素，写 <目录>/shots.json
// 强调色：用启动参数 -AppleAccentColor <n> 只改本进程读到的值（参数域），不碰系统设置。
func r(_ x: CGFloat, _ k: Double = 100) -> Double { (Double(x) * k).rounded() / k }
func hex(_ c: NSColor) -> String {
  guard let s = c.usingColorSpace(.sRGB) else { return "n/a" }
  let h = String(format: "#%02X%02X%02X", Int((s.redComponent * 255).rounded()), Int((s.greenComponent * 255).rounded()), Int((s.blueComponent * 255).rounded()))
  return s.alphaComponent < 0.999 ? h + String(format: " a=%.3f", s.alphaComponent) : h
}
func weightName(_ w: CGFloat) -> String {
  let t: [(String, NSFont.Weight)] = [("ultraLight", .ultraLight), ("thin", .thin), ("light", .light), ("regular", .regular), ("medium", .medium), ("semibold", .semibold), ("bold", .bold), ("heavy", .heavy), ("black", .black)]
  return t.min(by: { abs($0.1.rawValue - w) < abs($1.1.rawValue - w) })!.0
}
func traitsWeight(_ f: NSFont) -> CGFloat { ((f.fontDescriptor.object(forKey: .traits) as? [NSFontDescriptor.TraitKey: Any])?[.weight] as? CGFloat) ?? 0 }
let styles: [(String, NSFont.TextStyle)] = [("largeTitle", .largeTitle), ("title1", .title1), ("title2", .title2), ("title3", .title3), ("headline", .headline), ("body", .body), ("callout", .callout), ("subheadline", .subheadline), ("footnote", .footnote), ("caption1", .caption1), ("caption2", .caption2)]
let lm = NSLayoutManager()

// 系统字体在某个字号下的排版宽度：同一串字的整行宽度除以字号（每 em 多宽）。
// SF 的光学尺寸轴 opsz 最小 17，17 pt 及以下字形不变，这一段每 em 宽度的变化就是系统自动加的字距；
// 换算成相对 12 pt（HIG 表里字距为 0 的字号）每个字符多出的 1/1000 em，和 HIG 的 tracking 表对照。
let sample = "Hamburgefonstiv Hamburgefonstiv"
func emWidth(_ size: CGFloat) -> Double {
  let line = CTLineCreateWithAttributedString(NSAttributedString(string: sample, attributes: [.font: NSFont.systemFont(ofSize: size)]))
  return CTLineGetTypographicBounds(line, nil, nil, nil) / Double(size)
}
func tracking(_ size: CGFloat) -> [String: Double] {
  var opsz: Double = -1
  if let v = CTFontCopyVariation(NSFont.systemFont(ofSize: size) as CTFont) as? [NSNumber: NSNumber] { opsz = v[NSNumber(value: 0x6F70737A)]?.doubleValue ?? -1 } // 'opsz'
  let e = emWidth(size), e12 = emWidth(12)
  let per1000 = (e - e12) / Double(sample.count) * 1000
  return ["size": Double(size), "emWidth": (e * 10000).rounded() / 10000, "vs12Per1000em": (per1000 * 10).rounded() / 10, "opsz": opsz]
}

func dataMode() {
  var out: [String: Any] = [:]
  var ts: [String: Any] = [:]
  for (n, t) in styles {
    let f = NSFont.preferredFont(forTextStyle: t, options: [:])
    let bd = f.fontDescriptor.withSymbolicTraits(.bold)
    let fb = NSFont(descriptor: bd, size: f.pointSize) ?? f
    ts[n] = ["size": r(f.pointSize), "weight": weightName(traitsWeight(f)), "lineHeight": r(lm.defaultLineHeight(for: f)),
             "emphasizedName": fb.fontName]
  }
  out["textStyles"] = ts
  out["tracking"] = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 22, 26, 34, 48].map { tracking(CGFloat($0)) }
  let body = NSFont.systemFont(ofSize: 13)
  out["systemFont13"] = ["familyName": body.familyName ?? "", "fontName": body.fontName, "capHeight": r(body.capHeight), "xHeight": r(body.xHeight), "ascender": r(body.ascender), "descender": r(body.descender)]
  // SF Symbols：同一个文字样式下三档 scale、几档 weight 的图像尺寸
  var sym: [String: Any] = [:]
  for name in ["folder", "magnifyingglass", "square.and.arrow.up", "gearshape"] {
    var m: [String: Any] = [:]
    for (sn, sc) in [("small", NSImage.SymbolScale.small), ("medium", .medium), ("large", .large)] {
      let cfg = NSImage.SymbolConfiguration(pointSize: 13, weight: .regular, scale: sc)
      let img = NSImage(systemSymbolName: name, accessibilityDescription: nil)!.withSymbolConfiguration(cfg)!
      m[sn] = ["w": r(img.size.width), "h": r(img.size.height), "alignmentRect": ["x": r(img.alignmentRect.origin.x), "y": r(img.alignmentRect.origin.y), "w": r(img.alignmentRect.width), "h": r(img.alignmentRect.height)]]
    }
    sym[name] = m
  }
  out["symbols13pt"] = sym
  // 当前进程看到的强调色相关颜色
  var acc: [String: Any] = ["AppleAccentColor": UserDefaults.standard.object(forKey: "AppleAccentColor") ?? NSNull(), "AppleHighlightColor": UserDefaults.standard.object(forKey: "AppleHighlightColor") ?? NSNull()]
  for (an, a) in [("light", NSAppearance.Name.aqua), ("dark", .darkAqua)] {
    var m: [String: String] = [:]
    NSAppearance(named: a)!.performAsCurrentDrawingAppearance {
      for (n, c) in [("controlAccentColor", NSColor.controlAccentColor), ("selectedContentBackgroundColor", .selectedContentBackgroundColor), ("keyboardFocusIndicatorColor", .keyboardFocusIndicatorColor), ("selectedTextBackgroundColor", .selectedTextBackgroundColor), ("linkColor", .linkColor), ("systemBlue", .systemBlue)] { m[n] = hex(c) }
    }
    acc[an] = m
  }
  out["accent"] = acc
  let d = try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .sortedKeys])
  FileHandle.standardOutput.write(d)
}

// ---------- 截图模式 ----------
class Flipped: NSView { override var isFlipped: Bool { true } }
// 色块：自己画的实心块，用来读像素。名字 → 颜色
let swatchColors: [(String, NSColor)] = [
  ("windowBackgroundColor", .windowBackgroundColor), ("controlBackgroundColor", .controlBackgroundColor), ("textBackgroundColor", .textBackgroundColor), ("underPageBackgroundColor", .underPageBackgroundColor),
  ("labelColor", .labelColor), ("secondaryLabelColor", .secondaryLabelColor), ("tertiaryLabelColor", .tertiaryLabelColor), ("quaternaryLabelColor", .quaternaryLabelColor),
  ("separatorColor", .separatorColor), ("controlAccentColor", .controlAccentColor), ("selectedContentBackgroundColor", .selectedContentBackgroundColor), ("unemphasizedSelectedContentBackgroundColor", .unemphasizedSelectedContentBackgroundColor),
  ("linkColor", .linkColor), ("systemBlue", .systemBlue), ("systemRed", .systemRed), ("systemGreen", .systemGreen),
]
final class SwatchView: Flipped {
  var rects: [(String, NSRect)] = []
  override func draw(_ dirty: NSRect) {
    // 左边 40pt 宽的一条不画，露出窗口自己的底色
    rects = []
    for (i, (n, c)) in swatchColors.enumerated() {
      let rc = NSRect(x: 60 + CGFloat(i % 4) * 70, y: 16 + CGFloat(i / 4) * 50, width: 56, height: 36)
      c.setFill(); rc.fill(); rects.append((n, rc))
    }
  }
}

func label(_ s: String, _ font: NSFont, _ color: NSColor) -> NSTextField {
  let t = NSTextField(labelWithString: s); t.font = font; t.textColor = color; t.sizeToFit(); return t
}

func shootMode(_ dir: String) {
  let app = NSApplication.shared
  app.setActivationPolicy(.regular)
  var wins: [(String, NSWindow)] = []
  func win(_ name: String, _ size: NSSize, _ v: NSView) -> NSWindow {
    let w = NSWindow(contentRect: NSRect(origin: .zero, size: size), styleMask: [.titled], backing: .buffered, defer: false)
    w.title = name; w.contentView = v; w.isReleasedWhenClosed = false
    wins.append((name, w)); return w
  }
  // 1. 色块
  let sv = SwatchView(frame: NSRect(x: 0, y: 0, width: 360, height: 220))
  _ = win("swatches", sv.frame.size, sv)
  // 2. 四级文字色 + 分隔线 + 链接
  let lv = Flipped(frame: NSRect(x: 0, y: 0, width: 300, height: 176))
  var y: CGFloat = 16
  for (n, c) in [("labelColor 主要内容", NSColor.labelColor), ("secondaryLabelColor 次要说明", .secondaryLabelColor), ("tertiaryLabelColor 不可用、占位", .tertiaryLabelColor), ("quaternaryLabelColor 水印", .quaternaryLabelColor)] {
    let t = label(n, .systemFont(ofSize: 13), c); t.frame.origin = NSPoint(x: 20, y: y); lv.addSubview(t); y += 24
  }
  let sep = NSBox(frame: NSRect(x: 20, y: y + 4, width: 260, height: 1)); sep.boxType = .custom; sep.borderWidth = 0; sep.fillColor = .separatorColor; lv.addSubview(sep); y += 16
  let link = label("linkColor 链接", .systemFont(ofSize: 13), .linkColor); link.frame.origin = NSPoint(x: 20, y: y); lv.addSubview(link); y += 24
  let acc = label("controlAccentColor 强调色", .systemFont(ofSize: 13), .controlAccentColor); acc.frame.origin = NSPoint(x: 20, y: y); lv.addSubview(acc)
  _ = win("labels", lv.frame.size, lv)
  // 3. 文字样式表
  let tv = Flipped(frame: NSRect(x: 0, y: 0, width: 360, height: 0))
  y = 14
  for (n, t) in styles {
    let f = NSFont.preferredFont(forTextStyle: t, options: [:])
    let l = label("\(n)  \(Int(f.pointSize)) pt", f, .labelColor); l.frame.origin = NSPoint(x: 20, y: y); tv.addSubview(l)
    y += max(l.frame.height, lm.defaultLineHeight(for: f)) + 6
  }
  tv.setFrameSize(NSSize(width: 360, height: y + 10))
  _ = win("textstyles", tv.frame.size, tv)
  // 4. SF Symbols 和文字：同字号三档 scale；同 weight 和错配 weight
  let syv = Flipped(frame: NSRect(x: 0, y: 0, width: 360, height: 150))
  func symRow(_ y: CGFloat, _ text: String, _ weight: NSFont.Weight, _ symWeight: NSFont.Weight, _ scales: [NSImage.SymbolScale]) {
    var x: CGFloat = 20
    for sc in scales {
      let img = NSImage(systemSymbolName: "folder", accessibilityDescription: nil)!.withSymbolConfiguration(.init(pointSize: 13, weight: symWeight, scale: sc))!
      let iv = NSImageView(image: img); iv.contentTintColor = .labelColor; iv.frame = NSRect(origin: NSPoint(x: x, y: y + (16 - img.size.height) / 2), size: img.size); syv.addSubview(iv)
      x += img.size.width + 4
    }
    let l = label(text, .systemFont(ofSize: 13, weight: weight), .labelColor); l.frame.origin = NSPoint(x: x + 2, y: y); syv.addSubview(l)
  }
  symRow(16, "Documents（small / medium / large）", .regular, .regular, [.small, .medium, .large])
  symRow(48, "Documents（同为 regular）", .regular, .regular, [.medium])
  symRow(80, "Documents（同为 bold）", .bold, .bold, [.medium])
  symRow(112, "Documents（文字 regular，符号 ultraLight）", .regular, .ultraLight, [.medium])
  _ = win("symbols", syv.frame.size, syv)
  // 5. 玻璃：左白右黑的内容上放两块玻璃，一块不着色、一块用强调色着色
  let gv = Flipped(frame: NSRect(x: 0, y: 0, width: 360, height: 130))
  let white = NSBox(frame: NSRect(x: 0, y: 0, width: 180, height: 130)); white.boxType = .custom; white.borderWidth = 0; white.fillColor = .white; gv.addSubview(white)
  let black = NSBox(frame: NSRect(x: 180, y: 0, width: 180, height: 130)); black.boxType = .custom; black.borderWidth = 0; black.fillColor = NSColor(srgbRed: 0.1, green: 0.1, blue: 0.1, alpha: 1); gv.addSubview(black)
  var glassFrames: [String: NSRect] = [:]
  for (i, tinted) in [false, true].enumerated() {
    for (j, x) in [CGFloat(30), 210].enumerated() {
      let g = NSGlassEffectView(frame: NSRect(x: x, y: 20 + CGFloat(i) * 56, width: 120, height: 36))
      g.cornerRadius = 18
      if tinted { g.tintColor = .controlAccentColor }
      let c = NSView(frame: g.bounds)
      let t = label("Label", .systemFont(ofSize: 13, weight: .medium), .labelColor); t.frame.origin = NSPoint(x: 40, y: (36 - t.frame.height) / 2); c.addSubview(t)
      g.contentView = c
      gv.addSubview(g)
      glassFrames["\(tinted ? "tinted" : "plain")-\(j == 0 ? "onWhite" : "onBlack")"] = g.frame
    }
  }
  _ = win("glass", gv.frame.size, gv)

  for (i, (_, w)) in wins.enumerated() { w.setFrameTopLeftPoint(NSPoint(x: 60 + i * 40, y: 860 - i * 40)) }
  app.activate(ignoringOtherApps: true)
  var meta: [String: Any] = [:]
  func shot(_ w: NSWindow, _ file: String) -> String {
    let path = "\(dir)/\(file).png"
    let p = Process(); p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
    p.arguments = ["-x", "-o", "-l", String(w.windowNumber), path]; try? p.run(); p.waitUntilExit(); return path
  }
  // 截图转到 sRGB 再读像素（截图本身是 Display P3）
  func readPixels(_ path: String, _ pts: [(String, NSPoint)]) -> [String: String] {
    guard let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return [:] }
    let W = cg.width, H = cg.height
    var buf = [UInt8](repeating: 0, count: W * H * 4)
    let ctx = CGContext(data: &buf, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))
    var m: [String: String] = [:]
    for (n, p) in pts {
      let x = Int(p.x * 2), y = Int(p.y * 2)
      guard x >= 0, y >= 0, x < W, y < H else { continue }
      let i = (y * W + x) * 4
      m[n] = String(format: "#%02X%02X%02X", buf[i], buf[i + 1], buf[i + 2])
    }
    return m
  }
  func titlebar(_ w: NSWindow) -> CGFloat { w.frame.height - w.contentLayoutRect.height }
  func run(_ appearances: [(String, NSAppearance.Name)], _ done: @escaping () -> Void) {
    guard let (an, a) = appearances.first else { done(); return }
    app.appearance = NSAppearance(named: a)
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
      var m: [String: Any] = ["appActive": app.isActive]
      for (n, w) in wins {
        w.makeKeyAndOrderFront(nil); RunLoop.current.run(until: Date().addingTimeInterval(0.4))
        let path = shot(w, "\(n)-\(an)")
        m["\(n).isKey"] = w.isKeyWindow
        if n == "swatches" {
          let tb = titlebar(w)
          var pts: [(String, NSPoint)] = [("windowBackground(未绘制区)", NSPoint(x: 20, y: tb + 100))]
          for (sn, rc) in sv.rects { pts.append((sn, NSPoint(x: rc.midX, y: tb + rc.midY))) }
          m["swatchPixels"] = readPixels(path, pts)
          m["titlebarHeight"] = r(tb)
        }
        if n == "glass" {
          let tb = titlebar(w)
          var pts: [(String, NSPoint)] = []
          for (gn, f) in glassFrames { pts.append(("\(gn).fill", NSPoint(x: f.minX + 20, y: tb + f.midY))) }
          m["glassFill"] = readPixels(path, pts)
          m["glassFrames"] = glassFrames.mapValues { ["x": r($0.minX), "y": r($0.minY), "w": r($0.width), "h": r($0.height)] }
        }
      }
      meta[an] = m
      run(Array(appearances.dropFirst()), done)
    }
  }
  DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
    run([("light", .aqua), ("dark", .darkAqua)]) {
      let front = NSWorkspace.shared.frontmostApplication?.localizedName ?? "?"
      meta["frontmostAtEnd"] = front
      let d = try! JSONSerialization.data(withJSONObject: meta, options: [.prettyPrinted, .sortedKeys])
      try! d.write(to: URL(fileURLWithPath: "\(dir)/shots.json"))
      app.terminate(nil)
    }
  }
  DispatchQueue.main.asyncAfter(deadline: .now() + 9.5) { app.terminate(nil) } // 保险：10 秒内一定退出
  app.run()
}

// ---------- 活动窗口模式（打成 .app 用 open 启动，截图由终端里的 shoot.sh 代拍） ----------
// typecolor active <目录> <标签> [light|dark]：一个窗口放系统控件，浅色、深色各请求一次截图（写 <标签>-<外观>.req，内容是窗口号）
final class Rows: NSObject, NSTableViewDataSource, NSTableViewDelegate {
  let items = ["Selected row", "Another row"]
  func numberOfRows(in t: NSTableView) -> Int { items.count }
  func tableView(_ t: NSTableView, viewFor c: NSTableColumn?, row: Int) -> NSView? {
    let v = NSTableCellView(); let tf = NSTextField(labelWithString: items[row]); v.addSubview(tf); v.textField = tf
    tf.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([tf.leadingAnchor.constraint(equalTo: v.leadingAnchor, constant: 4), tf.centerYAnchor.constraint(equalTo: v.centerYAnchor)])
    return v
  }
}
let rows = Rows()
func activeMode(_ dir: String, _ tag: String, _ only: String?) {
  let app = NSApplication.shared
  app.setActivationPolicy(.regular)
  let v = Flipped(frame: NSRect(x: 0, y: 0, width: 380, height: 236))
  func put(_ c: NSView, _ x: CGFloat, _ y: CGFloat) { c.frame.origin = NSPoint(x: x, y: y); v.addSubview(c) }
  let cancel = NSButton(title: "Cancel", target: nil, action: nil); cancel.bezelStyle = .push; cancel.sizeToFit(); put(cancel, 20, 16)
  let ok = NSButton(title: "OK", target: nil, action: nil); ok.bezelStyle = .push; ok.keyEquivalent = "\r"; ok.sizeToFit(); ok.frame.size.width = max(ok.frame.width, 72); put(ok, 120, 16)
  let cb = NSButton(checkboxWithTitle: "Checkbox", target: nil, action: nil); cb.state = .on; cb.sizeToFit(); put(cb, 220, 20)
  let sw = NSSwitch(); sw.state = .on; sw.sizeToFit(); put(sw, 20, 58)
  let seg = NSSegmentedControl(labels: ["One", "Two", "Three"], trackingMode: .selectOne, target: nil, action: nil); seg.selectedSegment = 0; seg.sizeToFit(); put(seg, 90, 58)
  let sl = NSSlider(value: 0.6, minValue: 0, maxValue: 1, target: nil, action: nil); sl.frame.size = NSSize(width: 100, height: 24); put(sl, 260, 58)
  let sc = NSScrollView(frame: NSRect(x: 20, y: 98, width: 340, height: 56)); let tv = NSTableView(); tv.style = .inset; tv.headerView = nil
  let col = NSTableColumn(identifier: .init("c")); col.width = 300; tv.addTableColumn(col); tv.dataSource = rows; tv.delegate = rows; tv.rowHeight = 24
  sc.documentView = tv; sc.drawsBackground = false; tv.backgroundColor = .clear; v.addSubview(sc)
  let link = NSTextField(labelWithString: "linkColor"); link.textColor = .linkColor; link.sizeToFit(); put(link, 24, 164)
  for (i, tinted) in [false, true].enumerated() {
    let g = NSGlassEffectView(frame: NSRect(x: 20 + CGFloat(i) * 130, y: 186, width: 120, height: 36)); g.cornerRadius = 18
    if tinted { g.tintColor = .controlAccentColor }
    let c = NSView(frame: g.bounds); let t = NSTextField(labelWithString: tinted ? "Tinted" : "Glass"); t.font = .systemFont(ofSize: 13, weight: .medium); t.sizeToFit()
    t.frame.origin = NSPoint(x: (120 - t.frame.width) / 2, y: (36 - t.frame.height) / 2); c.addSubview(t); g.contentView = c; v.addSubview(g)
  }
  let w = NSWindow(contentRect: v.frame, styleMask: [.titled, .closable], backing: .buffered, defer: false)
  w.title = "accent: \(tag)"; w.contentView = v; w.isReleasedWhenClosed = false
  w.setFrameTopLeftPoint(NSPoint(x: 120, y: 820))
  var meta: [String: Any] = ["AppleAccentColor": UserDefaults.standard.object(forKey: "AppleAccentColor") ?? NSNull()]
  func step(_ list: [(String, NSAppearance.Name)]) {
    guard let (an, a) = list.first else {
      let d = try! JSONSerialization.data(withJSONObject: meta, options: [.prettyPrinted, .sortedKeys])
      try! d.write(to: URL(fileURLWithPath: "\(dir)/\(tag).json")); app.terminate(nil); return
    }
    app.appearance = NSAppearance(named: a)
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) {
      tv.selectRowIndexes([0], byExtendingSelection: false)
      w.makeKeyAndOrderFront(nil); app.activate(ignoringOtherApps: true)
      RunLoop.current.run(until: Date().addingTimeInterval(0.4))
      meta[an] = ["appActive": app.isActive, "isKey": w.isKeyWindow, "controlAccentColor": hex(NSColor.controlAccentColor)]
      let png = "\(dir)/\(tag)-\(an).png"
      try? String(w.windowNumber).write(toFile: "\(dir)/\(tag)-\(an).req", atomically: true, encoding: .utf8)
      let deadline = Date().addingTimeInterval(3)
      while !FileManager.default.fileExists(atPath: png) && Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.1)) }
      step(Array(list.dropFirst()))
    }
  }
  // 前台只在启动那一刻稳拿到，所以可以只拍一种外观：第 4 个参数写 light 或 dark
  let all: [(String, NSAppearance.Name)] = [("light", .aqua), ("dark", .darkAqua)]
  DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { step(only == nil ? all : all.filter { $0.0 == only }) }
  DispatchQueue.main.asyncAfter(deadline: .now() + 9.5) { app.terminate(nil) }
  app.run()
}

// typecolor appearance：打印本进程的 effectiveAppearance，用来验证 -AppleInterfaceStyle 这类启动参数能不能改外观
func appearanceMode() {
  let app = NSApplication.shared
  DispatchQueue.main.async { print(app.effectiveAppearance.name.rawValue); exit(0) }
  app.run()
}

let args = CommandLine.arguments
if args.count > 1 && args[1] == "data" { dataMode() }
else if args.count > 2 && args[1] == "shoot" { shootMode(args[2]) }
else if args.count > 1 && args[1] == "appearance" { appearanceMode() }
else if args.count > 3 && args[1] == "active" { activeMode(args[2], args[3], args.count > 4 && !args[4].hasPrefix("-") ? args[4] : nil) }
else { print("用法：typecolor data | typecolor shoot <目录> | typecolor active <目录> <标签>") }
