import AppKit
// 编译：swiftc -O -o extreme extreme.swift。截图先按 sRGB 画进位图再取值（和 probe/pixels.swift 一样）。
// extreme <png> x0 y0 x1 y1 dark|light：矩形（px）内离背景最远的像素（最暗或最亮）
let a = CommandLine.arguments
let cg = NSImage(contentsOfFile: a[1])!.cgImage(forProposedRect: nil, context: nil, hints: nil)!
let W = cg.width, H = cg.height
var buf = [UInt8](repeating: 0, count: W * H * 4)
let ctx = CGContext(data: &buf, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))
let x0 = Int(a[2])!, y0 = Int(a[3])!, x1 = Int(a[4])!, y1 = Int(a[5])!, dark = a[6] == "dark"
var best = dark ? 999 : -1, bp = (0,0,0)
for y in y0...y1 { for x in x0...x1 { let i = (y*W+x)*4; let l = Int(buf[i])+Int(buf[i+1])+Int(buf[i+2]); if dark ? l < best : l > best { best = l; bp = (Int(buf[i]),Int(buf[i+1]),Int(buf[i+2])) } } }
print(String(format: "#%02X%02X%02X", bp.0, bp.1, bp.2))
