import AppKit
// 把几张截图里的横条裁下来，从上到下拼成一张图；可以在某一条上画虚线框（标出控件的 frame）。
// compose <out.png> <in.png>:<x>,<y>,<w>,<h>[:<框 x,y,w,h>;<框>...] ...   全部是 px，左上为原点；框的坐标相对原图
let a = CommandLine.arguments
struct Strip { let img: CGImage; let r: CGRect; let boxes: [CGRect] }
func nums(_ s: Substring) -> [CGFloat] { s.split(separator: ",").map { CGFloat(Double($0)!) } }
var strips: [Strip] = []
for spec in a.dropFirst(2) {
  let parts = spec.split(separator: ":", omittingEmptySubsequences: false)
  let cg = NSImage(contentsOfFile: String(parts[0]))!.cgImage(forProposedRect: nil, context: nil, hints: nil)!
  let n = nums(parts[1])
  let boxes = parts.count > 2 ? parts[2].split(separator: ";").map { b -> CGRect in let v = nums(b); return CGRect(x: v[0], y: v[1], width: v[2], height: v[3]) } : []
  strips.append(Strip(img: cg.cropping(to: CGRect(x: n[0], y: n[1], width: n[2], height: n[3]))!, r: CGRect(x: n[0], y: n[1], width: n[2], height: n[3]), boxes: boxes))
}
let W = Int(strips.map { $0.r.width }.max()!), H = Int(strips.map { $0.r.height }.reduce(0, +))
let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0, space: strips[0].img.colorSpace ?? CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
// 各条宽度不同时，空出来的地方用第一条左上角的底色填上
let one = CGContext(data: nil, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
one.draw(strips[0].img.cropping(to: CGRect(x: 0, y: 0, width: 1, height: 1))!, in: CGRect(x: 0, y: 0, width: 1, height: 1))
let p = one.data!.assumingMemoryBound(to: UInt8.self)
ctx.setFillColor(CGColor(srgbRed: CGFloat(p[0]) / 255, green: CGFloat(p[1]) / 255, blue: CGFloat(p[2]) / 255, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
var top = 0
for s in strips {
  let h = Int(s.r.height)
  ctx.draw(s.img, in: CGRect(x: 0, y: H - top - h, width: Int(s.r.width), height: h))
  ctx.setStrokeColor(CGColor(red: 0.9, green: 0.2, blue: 0.5, alpha: 1)); ctx.setLineWidth(2); ctx.setLineDash(phase: 0, lengths: [6, 4])
  for b in s.boxes { ctx.stroke(CGRect(x: b.minX - s.r.minX, y: CGFloat(H - top) - (b.maxY - s.r.minY), width: b.width, height: b.height).insetBy(dx: 1, dy: 1)) }
  top += h
}
let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[1]))
