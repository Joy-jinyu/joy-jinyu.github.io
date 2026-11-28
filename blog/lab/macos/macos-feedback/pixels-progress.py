# 从 raw/progress-light.png（2x）读进度条画出来的粗细，输出 data/pixels.json。
# 用法（仓库根目录）：python3 blog/public/lab/macos/macos-feedback/pixels-progress.py <pixels 可执行文件>
# pixels 由 blog/public/lab/macos/probe/pixels.swift 编译。
import subprocess, sys, json, re, os
here = os.path.dirname(os.path.abspath(__file__))
P = sys.argv[1]
rel = 'blog/public/lab/macos/macos-feedback/raw/progress-light.png'
png = os.path.join(here, 'raw', 'progress-light.png')
def scan(x):
    out = subprocess.run([P, png, 'scan', 'x', str(x), '140', '530'], capture_output=True, text=True).stdout.splitlines()[1:]
    return [(int(m.group(1)), m.group(2)) for m in (re.match(r'(\d+)px .*: (#\w{6})', l) for l in out) if m]
def runs(pts, bg='#FFFFFF'):
    res, start = [], None
    for pos, col in pts:
        if col != bg and start is None: start = pos
        if col == bg and start is not None: res.append({'fromPx': start, 'toPx': pos, 'pt': (pos - start) / 2}); start = None
    return res
rows = ['mini', 'small', 'regular', 'large', 'extraLarge']
fill, track = runs(scan(260)), runs(scan(440))
json.dump({'source': rel, 'method': 'pixels <png> scan x <列> 140 530，2x 截图，1pt=2px；x=260 穿过条形 40% 的蓝色填充，x=440 穿过轨道',
           'barFillColumnX260': fill, 'barTrackColumnX440': track,
           'barDrawnThicknessPt': {r: f['pt'] for r, f in zip(rows, fill)}},
          open(os.path.join(here, 'data', 'pixels.json'), 'w'), ensure_ascii=False, indent=2)
