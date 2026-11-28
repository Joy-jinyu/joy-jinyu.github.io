import AppKit
// 对比两张同一窗口的截图（2x），量某个控件周围「变了的像素」：焦点环外扩多少、环有多宽、环上的颜色。
// 用法：ringdiff <before.png> <after.png> <名字> <x> <top> <w> <h>   坐标是 pt，原点在窗口左上角（focus.json 的 frames）
// 只在控件 frame 外扩 12 pt 的范围里找差异；输出一行 JSON。
let a = CommandLine.arguments
func load(_ p: String) -> (Int, Int, [UInt8]) {
  let img = NSImage(contentsOfFile: p)!, cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil)!
  let W = cg.width, H = cg.height
  var buf = [UInt8](repeating: 0, count: W * H * 4)
  let ctx = CGContext(data: &buf, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))
  return (W, H, buf)
}
let (W, H, A) = load(a[1]), (_, _, B) = load(a[2])
let name = a[3], fx = Int(Double(a[4])! * 2), fy = Int(Double(a[5])! * 2), fw = Int(Double(a[6])! * 2), fh = Int(Double(a[7])! * 2)
let pad = 24
func diff(_ x: Int, _ y: Int) -> Bool {
  let i = (y * W + x) * 4
  return (0..<3).contains { abs(Int(A[i + $0]) - Int(B[i + $0])) > 6 }
}
func hex(_ buf: [UInt8], _ x: Int, _ y: Int) -> String { let i = (y * W + x) * 4; return String(format: "#%02X%02X%02X", buf[i], buf[i + 1], buf[i + 2]) }
var x0 = Int.max, y0 = Int.max, x1 = -1, y1 = -1, n = 0
for y in max(0, fy - pad)..<min(H, fy + fh + pad) { for x in max(0, fx - pad)..<min(W, fx + fw + pad) where diff(x, y) {
  n += 1; x0 = min(x0, x); y0 = min(y0, y); x1 = max(x1, x); y1 = max(y1, y)
} }
var out: [String: Any] = ["name": name, "diffPixels": n, "before": (a[1] as NSString).lastPathComponent, "after": (a[2] as NSString).lastPathComponent]
if n > 0 {
  out["bboxPt"] = ["x": Double(x0) / 2, "top": Double(y0) / 2, "w": Double(x1 - x0 + 1) / 2, "h": Double(y1 - y0 + 1) / 2]
  // 外扩：差异范围超出控件 frame 多少（负数表示在 frame 里面）
  out["outsetPt"] = ["left": Double(fx - x0) / 2, "top": Double(fy - y0) / 2, "right": Double(x1 + 1 - fx - fw) / 2, "bottom": Double(y1 + 1 - fy - fh) / 2]
  // 环宽：从差异范围的左边、上边沿中线往里走，连续变了的像素有几个
  let midY = (y0 + y1) / 2, midX = (x0 + x1) / 2
  var lw = 0; while x0 + lw < W && diff(x0 + lw, midY) { lw += 1 }
  var tw = 0; while y0 + tw < H && diff(midX, y0 + tw) { tw += 1 }
  out["bandPt"] = ["left": Double(lw) / 2, "top": Double(tw) / 2]
  // 左边那条带上每个像素的前后颜色（截图色，受 P3 / 壁纸影响，只作「看起来」的佐证）
  out["leftBandPixels"] = (0..<min(lw + 2, 16)).map { ["px": x0 + $0, "before": hex(A, x0 + $0, midY), "after": hex(B, x0 + $0, midY)] }
}
let d = try! JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
print(String(data: d, encoding: .utf8)!)
