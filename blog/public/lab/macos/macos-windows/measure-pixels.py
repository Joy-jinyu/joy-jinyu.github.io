"""把窗口篇用到的截图读数汇总成 data/pixels.json。
用法（在本目录下）：python3 -I measure-pixels.py <pixels 可执行文件> <extreme 可执行文件> > data/pixels.json
读的是仓库里 raw/ 下的原始截图：gallery-*.png 来自共享探针 probe/gallery.swift，unified-*.png 来自 windows.swift 的 key-light / key-dark / inactive 三种模式。
截图是 2x：px ÷ 2 = pt。"""
import json, re, subprocess, sys

pixels, extreme = sys.argv[1:3]
gal = app = "raw"

def run(*a):
    return subprocess.run(a, capture_output=True, text=True, check=True).stdout

def corner(png):
    out = run(pixels, png, "corner")
    rows = [int(x) for x in re.search(r"透明像素/行: ([\d,]+)", out).group(1).split(",")]
    eq = re.search(r"约 (\d+)px = ([\d.]+)pt", out)
    return {"file": png.split("/")[-1], "transparentPxPerRow": rows, "equivalentRadiusPx": int(eq.group(1)), "equivalentRadiusPt": float(eq.group(2))}

def changes(png, axis, n, a, b):
    out = run(pixels, png, "scan", axis, str(n), str(a), str(b))
    return [{"px": int(m.group(1)), "color": m.group(2)} for m in re.finditer(r"^(\d+)px \([\d.]+pt\): (#[0-9A-F]{6} a=\d+)", out, re.M)]

def at(png, x, y):
    return re.search(r"(#[0-9A-F]{6}) a=", run(pixels, png, "at", str(x), str(y))).group(1)

def ext(png, x0, y0, x1, y1, mode):
    return run(extreme, png, str(x0), str(y0), str(x1), str(y1), mode).strip()

d = {"note": "截图 2x，px ÷ 2 = pt；颜色是截图按 sRGB 解出的值，受壁纸着色影响，只作「看起来」的佐证"}
d["corner"] = {n: corner(f"{gal}/gallery-{n}-light.png") for n in ["plain", "unifiedCompact", "unified", "expanded"]}
# 工具栏右上角最后一个控件（搜索框）：沿 x=1200px 竖着扫出上下边，沿控件中线横着扫出右边
d["toolbarTrailingItem"] = {
    "files": {"unified": "gallery-unified-light.png", "unifiedCompact": "gallery-unifiedCompact-light.png"},
    "unified": {"windowWidthPt": 640, "columnScanX1200": changes(f"{gal}/gallery-unified-light.png", "x", 1200, 0, 110),
                "rowScanY52": changes(f"{gal}/gallery-unified-light.png", "y", 52, 1240, 1279),
                "topPt": 8, "bottomPt": 44, "heightPt": 36, "rightEdgePt": 632, "insetPt": 8},
    "unifiedCompact": {"windowWidthPt": 640, "columnScanX1200": changes(f"{gal}/gallery-unifiedCompact-light.png", "x", 1200, 0, 90),
                       "rowScanY40": changes(f"{gal}/gallery-unifiedCompact-light.png", "y", 40, 1180, 1279),
                       "topPt": 8, "bottomPt": 32, "heightPt": 24, "rightEdgePt": 632, "insetPt": 8},
}
# 标题栏底部的分隔线：沿 x=400px 竖着扫
d["titlebarSeparator"] = {
    "unified": {"file": "gallery-unified-light.png", "columnScanX400": changes(f"{gal}/gallery-unified-light.png", "x", 400, 50, 115), "linePx": [102, 103], "linePt": 51},
    "plain": {"file": "gallery-plain-light.png", "columnScanX400": changes(f"{gal}/gallery-plain-light.png", "x", 400, 40, 75), "linePx": [62, 63], "linePt": 31},
}
# 活动 / 非活动：unified 窗口 480×200 pt，红绿灯圆心 (26,26)(49,26)(72,26) pt；标题框 x 106–165 pt、y 16.5–35.5 pt；「+」按钮 390–415 pt
states = {}
for s in ["key", "inactive"]:
    for t in ["light", "dark"]:
        png = f"{app}/unified-{s}-{t}.png"
        mode = "dark" if t == "light" else "light"
        states[f"{s}-{t}"] = {
            "file": png.split("/")[-1],
            "close": at(png, 52, 52), "minimize": at(png, 98, 52), "zoom": at(png, 144, 52),
            "titleInk": ext(png, 212, 33, 330, 71, mode), "plusIconInk": ext(png, 780, 30, 830, 75, mode),
            "titlebarBackground": at(png, 400, 20), "contentBackground": at(png, 400, 300),
        }
d["unifiedStates"] = states
# tertiaryLabelColor（共享 data/metrics.json 里的值）按 alpha 叠在截图里的窗口底色上，和非活动标题对比
def comp(fg, a, bg): return "#" + "".join("%02X" % round(a * f + (1 - a) * b) for f, b in zip(fg, bg))
d["derivedTertiaryLabelOverWindow"] = {
    "note": "tertiaryLabelColor（metrics.json）按 alpha 叠在截图里的窗口底色上，和非活动标题的截图色对比",
    "light": {"tertiaryLabelColor": "#000000 a=0.259", "over": "#FFFFFF", "composite": comp((0, 0, 0), 0.259, (255, 255, 255)), "measuredInactiveTitle": states["inactive-light"]["titleInk"]},
    "dark": {"tertiaryLabelColor": "#FFFFFF a=0.247", "over": "#222A30", "composite": comp((255, 255, 255), 0.247, (0x22, 0x2A, 0x30)), "measuredInactiveTitle": states["inactive-dark"]["titleInk"]},
}
json.dump(d, sys.stdout, ensure_ascii=False, indent=2)
