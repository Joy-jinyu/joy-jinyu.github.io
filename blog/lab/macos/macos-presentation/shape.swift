import AppKit
// 在「贴在母窗口上」的截图里量形状（sheet、popover 和背后的窗口拼在一张图里，角上没有透明像素可数）。
// shape <png> rows x0 x1 y0 y1 refx refy tol
//   对 y0..y1 每一行，在 x0..x1 里找第一个和最后一个与参考像素 (refx, refy) 颜色差 > tol 的像素（px 坐标，2x）。
// shape <png> alpha y0 y1
//   每行第一个和最后一个 alpha >= 128 的像素，用于有透明边的截图。
let a = CommandLine.arguments
guard let img = NSImage(contentsOfFile: a[1]), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("读不了 \(a[1])"); exit(1) }
let W = cg.width, H = cg.height
var buf = [UInt8](repeating: 0, count: W * H * 4)
let ctx = CGContext(data: &buf, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))
func px(_ x: Int, _ y: Int) -> [Int] { let i = (y * W + x) * 4; return [Int(buf[i]), Int(buf[i+1]), Int(buf[i+2]), Int(buf[i+3])] }
var rows: [[Int]] = []
if a[2] == "rows" {
  let x0 = Int(a[3])!, x1 = Int(a[4])!, y0 = Int(a[5])!, y1 = Int(a[6])!, ref = px(Int(a[7])!, Int(a[8])!), tol = Int(a[9])!
  for y in y0...y1 {
    var f = -1, l = -1
    for x in x0...x1 { let p = px(x, y); if abs(p[0]-ref[0]) + abs(p[1]-ref[1]) + abs(p[2]-ref[2]) > tol { if f < 0 { f = x }; l = x } }
    rows.append([y, f, l])
  }
} else {
  let y0 = Int(a[3])!, y1 = Int(a[4])!
  for y in y0...y1 { var f = -1, l = -1; for x in 0..<W where px(x, y)[3] >= 128 { if f < 0 { f = x }; l = x }; rows.append([y, f, l]) }
}
let d = try! JSONSerialization.data(withJSONObject: ["size": [W, H], "rows": rows])
print(String(data: d, encoding: .utf8)!)
