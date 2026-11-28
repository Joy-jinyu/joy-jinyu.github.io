# 从 raw/ 里的原始截图（2x，Display P3）复算 data/pixels.json。
# 用法（在本目录）：python3 readings.py <pixels 可执行文件> <shape 可执行文件>
#   pixels 由 ../probe/pixels.swift 编译，shape 由 shape.swift 编译。
import json, math, re, subprocess, sys
pixels, shape = sys.argv[1], sys.argv[2]
raw = 'raw'
def run(*a): return subprocess.run(a, capture_output=True, text=True, check=True).stdout
def diag(ins):
    for k, n in enumerate(ins):
        if n <= k: return k
def r45(k): return round(k / (1 - 1 / math.sqrt(2)) / 2, 1)
out = {"note": "截图是 2x（1 pt = 2 px），都在 raw/ 里，拍摄时前台都是探针自己（见 data/front.log）。corner：45° 等效圆角半径（连续曲线圆角，只给等效值）。composite：sheet / popover 和母窗口拼在同一张截图里，用 shape 按「和背景色差 > tol」逐行找边。颜色是截图上的读数，受 P3 / 壁纸影响，只作「看起来」的佐证。",
       "corners": {}, "dim": {}, "popover": {}, "glassFallback": {}}
# 有透明角的截图：pixels corner
for f in ['appmodal-light', 'panel-light', 'hud-light']:
    t = run(pixels, f'{raw}/{f}.png', 'corner')
    rows = [int(x) for x in re.search(r'透明像素/行: (.*)', t).group(1).split(',')]
    out["corners"][f] = {"png": f'raw/{f}.png', "method": "pixels corner（透明像素）", "transparentPxPerRow": rows,
                         "radiusPt": float(re.search(r'([\d.]+)pt\s*$', t.strip()).group(1))}
# sheet：和变暗的母窗口底色比。sheet 左上角位置来自 presentation-*.json 的 frame（alert sheet 150,75 pt；窗口 sheet 80,95 pt）
for f, top, left, x1, y1, refx, refy in [('alertsheet-light', 150, 300, 420, 240, 290, 300), ('alertsheet-dark', 150, 300, 420, 240, 290, 300),
                                         ('sheet-light', 190, 160, 280, 280, 150, 450), ('sheet-dark', 190, 160, 280, 280, 150, 450)]:
    d = json.loads(run(shape, f'{raw}/{f}.png', 'rows', str(left - 10), str(x1), str(top - 10), str(y1), str(refx), str(refy), '24'))
    ins = [row[1] - left for row in d["rows"] if row[0] >= top][:24]
    k = diag(ins)
    out["corners"][f] = {"png": f'raw/{f}.png', "method": "shape rows（与变暗的母窗口底色比，tol 24）", "sheetTopLeftPx": [left, top],
                         "insetPxPerRow": ins, "diagonalRow": k, "radiusPt": r45(k)}
out["corners"]["sheet-dark"]["note"] = "深色窗口 sheet 读成 27.3，和浅色以及深色 alert sheet 的 25.6 不一致，原因没查；正文用浅色读数"
# popover：深色图（浅色下气泡和白底差别太小）。母窗口 x=120，popover 窗口 x=325 → 截图里 410 px；按钮底 192 px
d = json.loads(run(shape, f'{raw}/popover-dark.png', 'rows', '410', '942', '186', '450', '420', '200', '12'))
rows = [r for r in d["rows"] if r[1] >= 0]
arrow = [r for r in rows if 192 <= r[0] < 218]
body = [r for r in rows if r[0] >= 218]
ins = [r[1] - 436 for r in body][:24]
k = diag(ins)
out["popover"] = {"png": "raw/popover-dark.png", "method": "shape rows（与母窗口底色比，tol 12）", "anchorBottomPx": 192,
    "arrowRows": [[r[0], r[1], r[2], r[2] - r[1] + 1] for r in arrow], "arrowTipPx": arrow[0][0], "bodyTopPx": body[0][0],
    "arrowHeightPt": (body[0][0] - arrow[0][0]) / 2, "arrowWidthPtBeforeFlare": (arrow[-4][2] - arrow[-4][1] + 1) / 2,
    "arrowCenterXPt": (arrow[0][1] + arrow[0][2]) / 4, "anchorCenterXPt": 300 + 38,
    "bodyPx": {"left": min(r[1] for r in body), "right": max(r[2] for r in body), "top": body[0][0], "bottom": body[-1][0]},
    "bodyCorner": {"insetPxPerRow": ins, "diagonalRow": k, "radiusPt": r45(k)}}
def at(f, x, y): return run(pixels, f'{raw}/{f}.png', 'at', str(x), str(y)).strip().split('\n')[-1]
out["dim"] = {"pointPx": [1000, 600], "light": {f: {"png": f'raw/{f}.png', "color": at(f, 1000, 600)} for f in ['parent-light', 'popover-light', 'alertsheet-light', 'sheet-light']},
              "dark": {f: {"png": f'raw/{f}.png', "color": at(f, 1000, 600)} for f in ['popover-dark', 'alertsheet-dark', 'sheet-dark']}}
out["glassFallback"] = {"note": "单独截一个半透明窗口时，背后没有内容可透，系统填了一层不透明的灰；屏幕上它是半透明的",
                        "appmodal-light": {"png": "raw/appmodal-light.png", "color": at('appmodal-light', 260, 200)},
                        "hud-light": {"png": "raw/hud-light.png", "color": at('hud-light', 220, 200)}}
json.dump(out, open('data/pixels.json', 'w'), ensure_ascii=False, indent=1)
print({k: v["radiusPt"] for k, v in out["corners"].items()}, out["popover"]["arrowHeightPt"], out["popover"]["arrowWidthPtBeforeFlare"], out["popover"]["bodyCorner"]["radiusPt"])
