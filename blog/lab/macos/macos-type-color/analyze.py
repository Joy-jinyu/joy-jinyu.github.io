"""文字与颜色篇的数据整理。
python3 analyze.py <HIG color.json 路径>
读共享的 ../data/metrics.json 和本目录 data/ 下的探针输出，写 data/contrast.json 和 data/system-colors.json。
对比度按 WCAG 2.x 相对亮度公式；带透明度的颜色先按透明度叠在底色上再算。"""
import json, re, sys, os

here = os.path.dirname(os.path.abspath(__file__))
metrics = json.load(open(os.path.join(here, '..', 'data', 'metrics.json')))
accents = json.load(open(os.path.join(here, 'data', 'accents.json')))
pixels = json.load(open(os.path.join(here, 'data', 'pixels.json')))
shots = json.load(open(os.path.join(here, 'data', 'shots.json')))
hig = json.load(open(sys.argv[1]))


def parse(s):
    m = re.match(r'#([0-9A-F]{6})(?: a=([0-9.]+))?', s)
    h = m.group(1)
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)], float(m.group(2) or 1)


def over(fg, bg):
    (c, a), (b, _) = parse(fg), parse(bg)
    return [round(c[i] * a + b[i] * (1 - a)) for i in range(3)]


def lum(rgb):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return round((la + 0.05) / (lb + 0.05), 2)


def hexs(rgb):
    return '#%02X%02X%02X' % tuple(rgb)


out = {'method': 'WCAG 2.x 相对亮度；带透明度的前景先叠在底色上', 'text': {}, 'accentText': {}, 'measured': {}}
texts = ['labelColor', 'secondaryLabelColor', 'tertiaryLabelColor', 'quaternaryLabelColor', 'placeholderTextColor', 'linkColor', 'controlAccentColor']
for ap in ('light', 'dark'):
    c = metrics['colors'][ap]
    for bgname in ('windowBackgroundColor', 'controlBackgroundColor'):
        bg = c[bgname]
        for t in texts:
            eff = over(c[t], bg)
            out['text'].setdefault(ap, {}).setdefault(bgname, {})[t] = {'value': c[t], 'composited': hexs(eff), 'ratio': ratio(eff, parse(bg)[0])}
    # 深色窗口实际画出来的底色（被壁纸染色）上再算一次
    win = shots[ap]['swatchPixels']['windowBackground(未绘制区)']
    for t in texts:
        eff = over(c[t], win)
        out['text'][ap].setdefault('measuredWindowBackground', {'background': win})[t] = {'composited': hexs(eff), 'ratio': ratio(eff, parse(win)[0])}

white, black = [255, 255, 255], [0, 0, 0]
for name, a in accents.items():
    row = {}
    for ap in ('light', 'dark'):
        acc, sel = parse(a[ap]['controlAccentColor'])[0], parse(a[ap]['selectedContentBackgroundColor'])[0]
        row[ap] = {'controlAccentColor': a[ap]['controlAccentColor'], 'whiteOnAccent': ratio(white, acc), 'blackOnAccent': ratio(black, acc),
                   'selectedContentBackgroundColor': a[ap]['selectedContentBackgroundColor'], 'whiteOnSelected': ratio(white, sel)}
    out['accentText'][name] = row

for shot, regions in pixels.items():
    if shot.startswith('_'):
        continue
    m = {}
    for rn, r in regions.items():
        if rn == 'png':
            m['png'] = r
            continue
        fill = parse(r['fill'])[0]
        fg = r['darkest'] if lum(parse(r['darkest'])[0]) < lum(fill) - 0.2 else r['lightest']
        m[rn] = {'fill': r['fill'], 'text': fg, 'ratio': ratio(parse(fg)[0], fill)}
    out['measured'][shot] = m

json.dump(out, open(os.path.join(here, 'data', 'contrast.json'), 'w'), ensure_ascii=False, indent=2)

# 系统色：HIG 表格的值在图片的 alt 文字里（R-0,G-136,B-255）
sysc = {}
for name in ['red', 'orange', 'yellow', 'green', 'mint', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'brown']:
    ns = 'system' + name.capitalize()
    row = {}
    for ap in ('light', 'dark'):
        alt = hig['references']['colors-unified-%s-%s.png' % (name, ap)]['alt']
        rgb = [int(x) for x in re.findall(r'\d+', alt)]
        hv = hexs(rgb)
        row[ap] = {'hig': hv, 'higAlt': alt, 'measured': metrics['colors'][ap][ns], 'match': hv == metrics['colors'][ap][ns]}
    sysc[ns] = row
json.dump(sysc, open(os.path.join(here, 'data', 'system-colors.json'), 'w'), ensure_ascii=False, indent=2)
print('ok')
