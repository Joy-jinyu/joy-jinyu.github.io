import AppKit
// crop <in.png> x y w h <out.png>（px，左上为原点）。sips 的 --cropOffset 0 0 会退回居中裁剪，所以自己裁。
let a = CommandLine.arguments
let cg = NSImage(contentsOfFile: a[1])!.cgImage(forProposedRect: nil, context: nil, hints: nil)!
let c = cg.cropping(to: CGRect(x: Int(a[2])!, y: Int(a[3])!, width: Int(a[4])!, height: Int(a[5])!))!
try! NSBitmapImageRep(cgImage: c).representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[6]))
