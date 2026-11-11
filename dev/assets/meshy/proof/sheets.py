#!/usr/bin/env python3
"""Compose the captures of proof/app.mjs into the committed proof sheets.
    python dev/assets/meshy/proof/sheets.py <captures-dir> <out-dir>"""
import json
import sys

from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
L = ['scout0-pulse0', 'scout1-twin0', 'scout2-moon2', 'vanguard0-pulse1', 'vanguard1-twin1', 'vanguard2-siege0', 'titan0-siege1', 'titan1-pulse2', 'titan2-twin2', 'titan2-siege2']
N = ['Scout + Pulse Cannon', 'Strider + Twin Repeater', 'Phantom + Moonbeam', 'Vanguard + Arc Pulse', 'Sentinel + Storm Repeater', 'Paladin + Siege Breaker', 'Titan + Rail Breaker', 'Bulwark + Nova Pulse',
     'Colossus + Helix Repeater', 'Colossus + Titanfall']
cw, ch = 330, 270
for gfx in ('high', 'low'):
    W = Image.new('RGB', (cw * 4, (ch + 18) * len(L) + 22), (10, 14, 20)); d = ImageDraw.Draw(W)
    for j, t in enumerate(('Garage BEFORE', 'Garage AFTER (Meshy)', 'Battle BEFORE', 'Battle AFTER (Meshy)')):
        d.text((j * cw + 6, 4), t + ' · ' + gfx.upper(), fill=(255, 217, 120))
    for i, l in enumerate(L):
        y = 22 + i * (ch + 18); d.text((6, y + ch + 2), N[i], fill=(190, 205, 220))
        for j, (k, m) in enumerate((('garage', 'before'), ('garage', 'after'), ('battle', 'before'), ('battle', 'after'))):
            im = Image.open(f'{src}/{k}_{m}_{gfx}_{l}.png').convert('RGB'); im.thumbnail((cw, ch)); W.paste(im, (j * cw + (cw - im.width) // 2, y))
    W.save(f'{out}/garage_battle_{gfx}.webp', quality=86, method=6)
for c in ('scout', 'vanguard', 'titan'):
    for t in range(3):
        a = Image.open(f'{src}/paints_before_{c}{t}.png').convert('RGB'); b = Image.open(f'{src}/paints_after_{c}{t}.png').convert('RGB')
        W = Image.new('RGB', (a.width, a.height + b.height + 36), (10, 14, 20)); d = ImageDraw.Draw(W)
        d.text((6, 2), 'BEFORE (procedural)', fill=(255, 217, 120)); W.paste(a, (0, 16)); d.text((6, a.height + 20), 'AFTER (Meshy)', fill=(255, 217, 120)); W.paste(b, (0, a.height + 36))
        W.save(f'{out}/paints_{c}{t}.webp', quality=86, method=6)
r = json.load(open(f'{src}/app.json')); json.dump(r, open(f'{out}/app.json', 'w'), indent=1)
avg = lambda xs, k: round(sum(x[k] for x in xs) / len(xs), 2)
for nm in ('before', 'after'):
    for g in ('high', 'low'):
        xs = [v for k, v in r['runs'][nm]['loadouts'].items() if k.endswith(g)]
        print(nm, g, {k: avg(xs, k) for k in ('calls', 'triangles', 'programs', 'textures', 'frameMsMedian', 'frameMsP90')})
lo = r['runs']['after']['loads']
for q in ('light', 'full'):
    xs = [x for x in lo if x['q'] == q]
    print(q, 'loads', len(xs), 'avg ms', round(sum(x['ms'] for x in xs) / max(1, len(xs))), 'avg KB', round(sum(x['bytes'] for x in xs) / max(1, len(xs)) / 1024))
print('memory', r['runs']['after'].get('memory'), 'errors', len(r['errors']))
