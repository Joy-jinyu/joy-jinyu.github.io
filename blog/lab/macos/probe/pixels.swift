import AppKit
// 像素读数工具（截图是 2x，输出同时给 px 和 pt）。
// pixels <png> at x y            某个像素的 RGBA（px 坐标，左上为原点）
// pixels <png> corner             左上角圆角：每行从左数透明像素的个数，推算半径
// pixels <png> scan x|y <n> a b   沿一行(y=n)或一列(x=n)从 a 到 b 打印颜色变化点
// pixels <png> bbox r g b tol     颜色接近 (r,g,b) 的像素包围盒
let a = CommandLine.arguments
guard let img = NSImage(contentsOfFile: a[1]), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("读不了 \(a[1])"); exit(1) }
let W = cg.width, H = cg.height
var buf = [UInt8](repeating: 0, count: W * H * 4)
let ctx = CGContext(data: &buf, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))
func px(_ x: Int, _ y: Int) -> (Int, Int, Int, Int) { let i = (y * W + x) * 4; return (Int(buf[i]), Int(buf[i+1]), Int(buf[i+2]), Int(buf[i+3])) }
func hex(_ p: (Int, Int, Int, Int)) -> String { String(format: "#%02X%02X%02X a=%d", p.0, p.1, p.2, p.3) }
print("size \(W)x\(H)px")
switch a[2] {
case "at": let x = Int(a[3])!, y = Int(a[4])!; print(hex(px(x, y)))
case "corner":
  var rows: [Int] = []
  for y in 0..<min(80, H) { var n = 0; while n < W && px(n, y).3 < 128 { n += 1 }; rows.append(n); if n == 0 { break } }
  print("透明像素/行:", rows.map(String.init).joined(separator: ","))
  print("曲线范围 \(rows.count - 1)px = \(Double(rows.count - 1) / 2)pt（从顶边到左边贴齐的行数）")
  // 45° 等效半径：圆角在对角线上离角点 r(1-1/√2)，找透明像素数 == 行号的位置反推 r
  var k = 0; while k < rows.count && rows[k] > k { k += 1 }
  let eq = Double(k) / (1 - 1 / 2.0.squareRoot())
  print(String(format: "45° 等效圆角半径约 %.0fpx = %.1fpt", eq, eq / 2))
case "scan":
  let axis = a[3], n = Int(a[4])!, from = Int(a[5])!, to = Int(a[6])!
  var last = ""
  for i in from...to { let p = axis == "x" ? px(n, i) : px(i, n); let h = hex(p); if h != last { print("\(i)px (\(Double(i)/2)pt): \(h)"); last = h } }
case "bbox":
  let tr = Int(a[3])!, tg = Int(a[4])!, tb = Int(a[5])!, tol = Int(a[6])!
  var x0 = W, y0 = H, x1 = -1, y1 = -1
  for y in 0..<H { for x in 0..<W { let p = px(x, y); if p.3 > 200 && abs(p.0 - tr) <= tol && abs(p.1 - tg) <= tol && abs(p.2 - tb) <= tol { x0 = min(x0, x); y0 = min(y0, y); x1 = max(x1, x); y1 = max(y1, y) } } }
  print(x1 < 0 ? "没找到" : "bbox px x=\(x0)..\(x1) y=\(y0)..\(y1) → pt x=\(Double(x0)/2) y=\(Double(y0)/2) w=\(Double(x1-x0+1)/2) h=\(Double(y1-y0+1)/2)")
default: print("未知命令")
}
