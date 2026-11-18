"""
把 style-probe.mjs 的输出和「来源」比：页面实际画出来的值里，有哪些不在来源里。
来源：ref 组 = 参考页 run1.html 源码里出现过的颜色和它实际画出来的圆角、字号、字重、阴影；token 组 = prompt 里给的设计变量。
用法：python3 style-diff.py（在 data/ 的上一级运行），结果写到 data/diff-summary.txt。
"""
import json, re

def load(p): return json.load(open(f'data/{p}.json'))
def vals(d, k): return set(d['bag'].get(k, {}).keys())
def colors(d):
    s = set()
    for k in ['text', 'bg', 'icon']: s |= vals(d, k)
    for b in vals(d, 'border'):
        c = b.split(' ', 1)[1]
        if c not in ('None', 'null'): s.add(c)
    return {c for c in s if c and c != 'null'}

# 变量表只给了 10、16 两个圆角，胶囊形（全圆角）也算来源之外
TOKEN = {'colors': {'#b65a3c', '#ffffff', '#1c1c1a', '#5f5e59', '#e7e6e1', '#f4f4f1'}, 'radius': {'10', '16'}, 'fontSize': {'13', '15', '18'}}
run1_src = set(h.lower() for h in re.findall(r'#[0-9a-fA-F]{6}\b', open('../ai-ui-taste/run1.html').read()))
R, RD = load('run1'), load('run1-dark')
REF = {'colors': run1_src | colors(R) | colors(RD), 'radius': vals(R, 'radius'), 'fontSize': vals(R, 'fontSize'), 'fontWeight': vals(R, 'fontWeight'), 'shadow': vals(R, 'shadow') | vals(RD, 'shadow')}
out = ['页面实际画出来的值，和来源比（浅色 + 深色合并；1px 以下的隐藏元素不算）', '']
for grp, src in [('ref', REF), ('token', TOKEN)]:
    for page in [f'{pg}{rnd}' for rnd in ('', '-2') for pg in ('members', 'upgrade')]:
        p = page.replace('-2', '') + f'-{grp}' + ('-2' if page.endswith('-2') else '')
        L, D = load(p), load(p + '-dark')
        pc = colors(L) | colors(D)
        extra = sorted(c for c in pc if c.split('/')[0] not in src['colors'])
        out.append(f'== {p}')
        out.append(f'  颜色：画出 {len(pc)} 种，来源之外 {len(extra)} 种 {" ".join(extra)}')
        for k, name in [('radius', '圆角'), ('fontSize', '字号'), ('fontWeight', '字重'), ('controlHeight', '控件高度'), ('shadow', '阴影')]:
            v = sorted(vals(L, k) | vals(D, k), key=lambda x: (len(x), x))
            note = '' if k not in src else f'；来源之外 {sorted(x for x in v if x not in src[k])}'
            out.append(f'  {name}：{v}{note}')
        out.append(f'  有没有深色模式：{L["darkRule"]}')
        out.append('')
for rnd in ('', '-2'):
    out.append(f'== plain 组{"（第二轮）" if rnd else ""}：两个页面互相比')
    A, B = load('members-plain' + rnd), load('upgrade-plain' + rnd)
    for k, name in [('radius', '圆角'), ('fontSize', '字号'), ('fontWeight', '字重'), ('controlHeight', '控件高度')]:
        out.append(f'  {name}：members {sorted(vals(A, k), key=lambda x: (len(x), x))} / upgrade {sorted(vals(B, k), key=lambda x: (len(x), x))}')
    ca, cb = colors(A), colors(B)
    out.append(f'  颜色（浅色）：members {len(ca)} 种，upgrade {len(cb)} 种，两页共有 {len(ca & cb)} 种 {sorted(ca & cb)}')
    out.append('')
open('data/diff-summary.txt', 'w').write('\n'.join(out) + '\n')
print('\n'.join(out))
