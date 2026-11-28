#!/usr/bin/env python3
"""读 raw/ 里的截图，写 data/pixels.json。用法：python3 measure.py <pixels 可执行文件>（源码 ../probe/pixels.swift）"""
import json, os, re, subprocess, sys

here = os.path.dirname(os.path.abspath(__file__))
pixels = sys.argv[1]


def run(*args):
    return subprocess.run([pixels, *args], capture_output=True, text=True, check=True).stdout


out = {}

# 菜单窗口圆角：菜单栏菜单单独截图，角上是透明像素
f = "raw/help-menu-alone-light.png"
txt = run(os.path.join(here, f), "corner")
out["menuCorner"] = {
    "file": f,
    "cmd": "pixels corner",
    "curveSpanPt": float(re.search(r"= ([\d.]+)pt（从顶边", txt).group(1)),
    "eqRadiusPt": float(re.search(r"约 \d+px = ([\d.]+)pt", txt).group(1)),
}

# 文字离菜单左右边：File 菜单弹在探针窗口里（窗口 x=0，菜单 x=240 pt，宽 205 pt，见 data/ax/pop-File-light-ax.json）
# 沿「New Document」那一行（y=228 px）横扫，R < 0xE8 算墨迹
f = "raw/file-menu-light.png"
ax = json.load(open(os.path.join(here, "data/ax/pop-File-light-ax.json")))["menuAtPoint"]["frame"]
row = int((ax["y"] + 5 + 12 - 33) * 2)  # 菜单顶 + 5 pt 内边距 + 半行，减去窗口顶在屏幕上的 33 pt
txt = run(os.path.join(here, f), "scan", "y", str(row), str(int(ax["x"] * 2)), str(int((ax["x"] + ax["w"]) * 2) - 1))
ink = []
for line in txt.splitlines():
    m = re.match(r"(\d+)px .*#([0-9A-F]{2})", line)
    if m and int(m.group(2), 16) < 0xE8:
        ink.append(int(m.group(1)))
left_px, right_px = int(ax["x"] * 2), int((ax["x"] + ax["w"]) * 2)
# scan 只打印颜色变化点，最后一个墨迹段的结束要看它后面那个变化点
changes = [int(m.group(1)) for m in re.finditer(r"^(\d+)px", txt, re.M)]
last_ink_end = changes[changes.index(ink[-1]) + 1] - 1
out["menuTextInset"] = {
    "file": f,
    "cmd": f"pixels scan y {row} {left_px} {right_px - 1}",
    "menuFramePt": ax,
    "firstInkPx": ink[0],
    "lastInkPx": last_ink_end,
    "titleLeftInsetPt": (ink[0] - left_px) / 2,
    "shortcutRightInsetPt": (right_px - 1 - last_ink_end) / 2,
}

# 由辅助功能读数推算的几何关系（屏幕坐标，原点左上，pt）
def axj(n):
    return json.load(open(os.path.join(here, "data/ax", n)))["menuAtPoint"]
probe = json.load(open(os.path.join(here, "data/probe-light.json")))
win_top = 33  # 窗口顶在屏幕上的 y：probe-light.json 的 mainFrame 是 Cocoa 坐标，屏幕高 982，982 - 377 - 572 = 33
assert probe["screen"]["frame"]["h"] - probe["mainFrame"]["y"] - probe["mainFrame"]["h"] == win_top
def button_screen(name):
    f = probe["buttons"][name]["frameInWindow"]  # 窗口坐标，原点左下
    top = win_top + probe["mainFrame"]["h"] - (f["y"] + f["h"])
    return {"x": f["x"], "top": top, "bottom": top + f["h"], "w": f["w"]}
fm = axj("pop-File-light-ax.json")
pu, pd = axj("popup-light-ax.json"), axj("pulldown-light-ax.json")
pb, db = button_screen("popUp"), button_screen("pullDown")
sel = pu["items"][1]["frame"]
out["derived"] = {
    "menuPaddingTop": fm["items"][0]["frame"]["y"] - fm["frame"]["y"],
    "menuPaddingBottom": fm["frame"]["y"] + fm["frame"]["h"] - (fm["items"][-1]["frame"]["y"] + fm["items"][-1]["frame"]["h"]),
    "popUpButtonScreen": pb,
    "popUpSelectedRow": {"title": pu["items"][1]["title"], "top": sel["y"], "bottom": sel["y"] + sel["h"]},
    "popUpMenuWidth": pu["frame"]["w"],
    "popUpMenuLeftOfButton": pb["x"] - pu["frame"]["x"],
    "pullDownButtonScreen": db,
    "pullDownGapBelowButton": pd["frame"]["y"] - db["bottom"],
    "pullDownMenuLeftOfButton": db["x"] - pd["frame"]["x"],
}

json.dump(out, open(os.path.join(here, "data/pixels.json"), "w"), ensure_ascii=False, indent=2)
print(json.dumps(out, ensure_ascii=False, indent=2))
