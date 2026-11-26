import AppKit
// 读截图里一块圆角矩形的左上角（截图是 2x，输出 px 和 pt）。
// edge <png> <x0> <y0> <x1> <y1> <tol>
//   底色取 (x0, y0) 那个像素；从 y0 到 y1 逐行，从 x0 往右找第一个和底色差超过 tol 的像素。
//   输出每行的起点，再按 45° 方向反推等效圆角半径（同 probe/pixels.swift 的 corner）。
// edge <png> at <x> <y>   某个像素的颜色（sRGB）
// edge <png> find <x0> <y0> <x1> <y1> <hex> <tol>
//   同上，但每行找第一个不透明、且和 <hex> 差不超过 tol 的像素（用来找浅色玻璃的白色描边，跳过窗口外的透明角）
let a = CommandLine.arguments
guard let img = NSImage(contentsOfFile: a[1]), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("读不了 \(a[1])"); exit(1) }
let W = cg.width, H = cg.height
var buf = [UInt8](repeating: 0, count: W * H * 4)
let ctx = CGContext(data: &buf, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))
func px(_ x: Int, _ y: Int) -> [Int] { let i = (y * W + x) * 4; return [Int(buf[i]), Int(buf[i+1]), Int(buf[i+2]), Int(buf[i+3])] }
func hex(_ p: [Int]) -> String { String(format: "#%02X%02X%02X", p[0], p[1], p[2]) }
if a[2] == "at" { print(hex(px(Int(a[3])!, Int(a[4])!))); exit(0) }
let findMode = a[2] == "find"
let o = findMode ? 3 : 2
let x0 = Int(a[o])!, y0 = Int(a[o+1])!, x1 = Int(a[o+2])!, y1 = Int(a[o+3])!
let tol = Int(a[findMode ? o+5 : o+4])!
var bg = px(x0, y0)
if findMode { let h = Int(a[o+4].replacingOccurrences(of: "#", with: ""), radix: 16)!; bg = [(h >> 16) & 255, (h >> 8) & 255, h & 255, 255] }
func diff(_ p: [Int]) -> Int { max(abs(p[0] - bg[0]), abs(p[1] - bg[1]), abs(p[2] - bg[2])) }
func hit(_ p: [Int]) -> Bool { findMode ? (p[3] > 200 && diff(p) <= tol) : diff(p) > tol }
var starts: [Int] = []
for y in y0...y1 { var x = x0; while x <= x1 && !hit(px(x, y)) { x += 1 }; starts.append(x <= x1 ? x : -1) }
let found = starts.enumerated().filter { $0.element >= 0 }
guard let top = found.first, let edgeX = found.map({ $0.element }).min() else { print("没找到"); exit(0) }
// 以「最左的起点」为左边、「第一行有颜色的」为顶边，k 行之后起点 == 左边 + 0 …… 找对角线上的交点
var k = 0
while top.offset + k < starts.count, starts[top.offset + k] >= 0, starts[top.offset + k] - edgeX > k { k += 1 }
let eq = Double(k) / (1 - 1 / 2.0.squareRoot())
print("bg \(hex(bg)) top y=\(y0 + top.offset)px left x=\(edgeX)px")
print("starts:", starts.map(String.init).joined(separator: ","))
print(String(format: "45° 等效圆角半径约 %.0fpx = %.1fpt", eq, eq / 2))
