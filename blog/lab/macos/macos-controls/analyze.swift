import AppKit
// 用法：analyze <截图.png> <controls-*.json> <gallery|swiftui|form> [阈值，默认 12] > 输出.json
// 对 json 里记下的每个控件（窗口坐标，pt），在截图（2x）上量：画出来的外框、45° 等效圆角、底色、文字墨迹、强调色区域。
let a = CommandLine.arguments
guard let img = NSImage(contentsOfFile: a[1]), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("读不了 \(a[1])"); exit(1) }
let W = cg.width, H = cg.height
var buf = [UInt8](repeating: 0, count: W * H * 4)
let ctx = CGContext(data: &buf, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))
func px(_ x: Int, _ y: Int) -> (Int, Int, Int) { let i = (y * W + x) * 4; return (Int(buf[i]), Int(buf[i+1]), Int(buf[i+2])) }
func hex(_ p: (Int, Int, Int)) -> String { String(format: "#%02X%02X%02X", p.0, p.1, p.2) }
func diff(_ p: (Int, Int, Int), _ q: (Int, Int, Int)) -> Int { max(abs(p.0 - q.0), abs(p.1 - q.1), abs(p.2 - q.2)) }
func luma(_ p: (Int, Int, Int)) -> Double { 0.2126 * Double(p.0) + 0.7152 * Double(p.1) + 0.0722 * Double(p.2) }
func pt(_ v: Int) -> Double { Double(v) / 2 }

// analyze <截图.png> box <窗口高> <x> <y> <w> <h> [阈值]：窗口坐标（pt，左下原点）矩形里，和矩形左上角像素差超过阈值的像素包围盒
if a[2] == "box" {
  let wh = Double(a[3])!, x = Double(a[4])!, y = Double(a[5])!, w = Double(a[6])!, h = Double(a[7])!, t = a.count > 8 ? Int(a[8])! : 40
  let x0 = Int(x * 2), x1 = Int((x + w) * 2), y0 = Int((wh - y - h) * 2), y1 = Int((wh - y) * 2)
  let bg = px(x0, y0); var bx0 = Int.max, by0 = Int.max, bx1 = -1, by1 = -1
  for yy in y0..<y1 { for xx in x0..<x1 where diff(px(xx, yy), bg) > t { bx0 = min(bx0, xx); by0 = min(by0, yy); bx1 = max(bx1, xx); by1 = max(by1, yy) } }
  print(bx1 < 0 ? "{\"error\":\"没找到\"}" : "{\"left\":\(pt(bx0)),\"right\":\(pt(bx1 + 1)),\"top\":\(wh - pt(by0)),\"bottom\":\(wh - pt(by1 + 1)),\"background\":\"\(hex(bg))\"}")
  exit(0)
}
let json = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: a[2]))) as! [String: Any]
let section = a[3]
let th = a.count > 4 ? Int(a[4])! : 12   // 和底色的最大通道差超过它才算「画出来的」；文本框的细边框要用 4
var items: [(String, [String: Any])] = []
if section == "form" {
  for (k, v) in json["form"] as! [String: Any] { if let d = v as? [String: Any], d["frameInWindow"] != nil { items.append((k, d)) } }
} else {
  for (row, v) in json[section] as! [String: Any] { for (sz, d) in v as! [String: Any] { items.append(("\(row).\(sz)", d as! [String: Any])) } }
}

func measure(_ d: [String: Any]) -> [String: Any] {
  let f = d["frameInWindow"] as! [String: Double], wh = d["windowHeight"] as! Double
  let padX = 10.0, padY = section == "form" ? 2.0 : 9.0
  let x0 = Int((f["x"]! - padX) * 2), x1 = Int((f["x"]! + f["w"]! + padX) * 2)
  let y0 = Int((wh - f["y"]! - f["h"]! - padY) * 2), y1 = Int((wh - f["y"]! + padY) * 2)
  guard x0 >= 0, y0 >= 0, x1 < W, y1 < H else { return ["error": "越界"] }
  let bg = px(x0, y0)
  var bx0 = Int.max, by0 = Int.max, bx1 = -1, by1 = -1
  for y in y0..<y1 { for x in x0..<x1 where diff(px(x, y), bg) > th { bx0 = min(bx0, x); by0 = min(by0, y); bx1 = max(bx1, x); by1 = max(by1, y) } }
  if bx1 < 0 { return ["error": "没找到"] }
  var res: [String: Any] = ["background": hex(bg)]
  let bw = bx1 - bx0 + 1, bh = by1 - by0 + 1
  res["drawn"] = ["x": pt(bx0) - f["x"]!, "yFromFrameTop": pt(by0) - (wh - f["y"]! - f["h"]!), "w": pt(bw), "h": pt(bh)]
  // 左上角的 45° 等效圆角：每行从外框左边数到第一个非底色像素
  var insets: [Int] = []
  for y in by0...min(by1, by0 + bh / 2) { var n = 0; while bx0 + n <= bx1 && diff(px(bx0 + n, y), bg) <= th { n += 1 }; insets.append(n) }
  var k = 0; while k < insets.count && insets[k] > k { k += 1 }
  let rEq = Double(k) / (1 - 1 / 2.0.squareRoot()) / 2
  res["cornerRadius45"] = (rEq * 10).rounded() / 10
  // 另一种读法：从顶边往下，第几行开始左边贴齐外框（圆角是正圆时约等于半径）
  let flush = insets.firstIndex(of: 0) ?? insets.count
  res["cornerRows"] = pt(flush)
  // 最小二乘拟合圆角半径：假设是正圆角，比较每行的透明宽度（AppKit 实际用连续曲线，结果是近似值）
  var best = (0.0, Double.infinity)
  for R in stride(from: 1.0, through: Double(bh) / 2 + 1, by: 0.5) {
    var e = 0.0
    for (y, n) in insets.enumerated() { let yy = Double(y) + 0.5; let pred = yy < R ? R - (R * R - (R - yy) * (R - yy)).squareRoot() : 0; e += (pred - Double(n)) * (pred - Double(n)) }
    if e < best.1 { best = (R, e) }
  }
  res["cornerRadiusFit"] = best.0 / 2
  res["halfHeight"] = pt(bh) / 2
  res["capsule"] = rEq >= pt(bh) / 2 - 1
  // 底色：外框内出现最多的非底色颜色
  var counts: [String: Int] = [:], cols: [String: (Int, Int, Int)] = [:]
  for y in by0...by1 { for x in bx0...bx1 { let p = px(x, y); if diff(p, bg) > th { let h = hex(p); counts[h, default: 0] += 1; cols[h] = p } } }
  let fillHex = counts.max { $0.value < $1.value }!.key, fill = cols[fillHex]!
  res["fill"] = fillHex
  // 文字 / 图标墨迹：和底色亮度差 > 90
  var ix0 = Int.max, iy0 = Int.max, ix1 = -1, iy1 = -1
  for y in by0...by1 { for x in bx0...bx1 where diff(px(x, y), bg) > th && abs(luma(px(x, y)) - luma(fill)) > 90 { ix0 = min(ix0, x); iy0 = min(iy0, y); ix1 = max(ix1, x); iy1 = max(iy1, y) } }
  if ix1 >= 0 { res["ink"] = ["left": pt(ix0 - bx0), "right": pt(bx1 - ix1), "top": pt(iy0 - by0), "bottom": pt(by1 - iy1), "w": pt(ix1 - ix0 + 1), "h": pt(iy1 - iy0 + 1)] }
  // 强调色（蓝）区域
  var ax0 = Int.max, ay0 = Int.max, ax1 = -1, ay1 = -1; var acc: [String: Int] = [:]
  for y in by0...by1 { for x in bx0...bx1 { let p = px(x, y); if p.2 - p.0 > 70 && p.2 > 150 { ax0 = min(ax0, x); ay0 = min(ay0, y); ax1 = max(ax1, x); ay1 = max(ay1, y); acc[hex(p), default: 0] += 1 } } }
  if ax1 >= 0 { res["accent"] = ["x": pt(ax0 - bx0), "y": pt(ay0 - by0), "w": pt(ax1 - ax0 + 1), "h": pt(ay1 - ay0 + 1), "color": acc.max { $0.value < $1.value }!.key] }
  return res
}
var out: [String: Any] = ["image": (a[1] as NSString).lastPathComponent, "section": section, "note": "pt；drawn 相对控件 frame 左上角；截图先按 sRGB 画进位图再取值"]
for (k, d) in items { out[k] = measure(d) }
let data = try! JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .sortedKeys])
FileHandle.standardOutput.write(data); print()
