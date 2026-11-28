import AppKit
// region <png> <x0> <y0> <x1> <y1>（px，左上为原点）：把截图转到 sRGB，输出这个矩形里最常见的颜色（底色）、最暗和最亮的像素（字形）
let a = CommandLine.arguments
guard a.count == 6, let img = NSImage(contentsOfFile: a[1]), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("{}"); exit(1) }
let W = cg.width, H = cg.height
var buf = [UInt8](repeating: 0, count: W * H * 4)
let ctx = CGContext(data: &buf, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))
let x0 = Int(a[2])!, y0 = Int(a[3])!, x1 = Int(a[4])!, y1 = Int(a[5])!
var count: [String: Int] = [:]; var dark = (Int.max, ""), light = (-1, "")
for y in y0..<y1 { for x in x0..<x1 {
  let i = (y * W + x) * 4; let (r, g, b) = (Int(buf[i]), Int(buf[i + 1]), Int(buf[i + 2]))
  let h = String(format: "#%02X%02X%02X", r, g, b); count[h, default: 0] += 1
  let l = r * 299 + g * 587 + b * 114
  if l < dark.0 { dark = (l, h) }
  if l > light.0 { light = (l, h) }
} }
let fill = count.max { $0.value < $1.value }!.key
print("{\"fill\": \"\(fill)\", \"darkest\": \"\(dark.1)\", \"lightest\": \"\(light.1)\"}")
