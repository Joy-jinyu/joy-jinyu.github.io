import AppKit
// 列出 AppKit 的标准光标（图像尺寸、热点，pt），并画成一张 sRGB 的图（不截屏，直接画 NSCursor.image）。
// 用法：cursors <输出.png> > cursors.json
_ = NSApplication.shared  // 不先建 NSApplication，arrow / iBeam 的图像尺寸读出来是 0
let cursors: [(String, NSCursor)] = [("arrow", .arrow), ("iBeam", .iBeam), ("pointingHand", .pointingHand), ("openHand", .openHand),
  ("closedHand", .closedHand), ("crosshair", .crosshair), ("contextualMenu", .contextualMenu), ("dragCopy", .dragCopy),
  ("dragLink", .dragLink), ("operationNotAllowed", .operationNotAllowed), ("disappearingItem", .disappearingItem),
  ("iBeamVertical", .iBeamCursorForVerticalLayout), ("columnResize", .columnResize), ("rowResize", .rowResize),
  ("columnResize(left)", .columnResize(directions: .left)), ("frameResize(right)", .frameResize(position: .right, directions: .all)),
  ("frameResize(corner)", .frameResize(position: .bottomRight, directions: .all)), ("zoomIn", .zoomIn), ("zoomOut", .zoomOut)]
func r(_ x: CGFloat) -> Double { (Double(x) * 100).rounded() / 100 }
let list = cursors.map { ["name": $0.0, "size": [r($0.1.image.size.width), r($0.1.image.size.height)], "hotSpot": [r($0.1.hotSpot.x), r($0.1.hotSpot.y)]] }
print(String(data: try! JSONSerialization.data(withJSONObject: list, options: [.prettyPrinted]), encoding: .utf8)!)
let cell: CGFloat = 120, rowH: CGFloat = 72, cols = 3, rows = (cursors.count + cols - 1) / cols
let size = NSSize(width: cell * CGFloat(cols), height: rowH * CGFloat(rows))
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(size.width * 2), pixelsHigh: Int(size.height * 2), bitsPerSample: 8,
                           samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!.retagging(with: .sRGB)!
rep.size = size
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSColor.white.setFill(); NSRect(origin: .zero, size: size).fill()
for (i, (n, c)) in cursors.enumerated() {
  let cx = CGFloat(i % cols) * cell, cy = size.height - CGFloat(i / cols + 1) * rowH
  let im = c.image
  im.draw(in: NSRect(x: cx + (cell - im.size.width) / 2, y: cy + 18 + (rowH - 18 - im.size.height) / 2, width: im.size.width, height: im.size.height))
  let p = NSMutableParagraphStyle(); p.alignment = .center
  (n as NSString).draw(in: NSRect(x: cx, y: cy + 2, width: cell, height: 16),
    withAttributes: [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: NSColor(white: 0.3, alpha: 1), .paragraphStyle: p])
}
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
