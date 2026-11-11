#!/usr/bin/env python3
"""Measured views of one item in game space (after orient + fit), optionally coloured by part.

    python dev/assets/meshy/look.py chassis-vanguard-0 --src DIR --out DIR [--views side,top,front] [--parts]
        [--box x0,y0,z0,x1,y1,z1] [--ppu 400] [--clip z=0.9]
"""
import argparse
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build  # noqa: E402
from lib import rcast, views  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('item'); ap.add_argument('--src', default=os.path.join(HERE, 'source')); ap.add_argument('--out', default='.')
    ap.add_argument('--views', default='side,top,front'); ap.add_argument('--parts', action='store_true'); ap.add_argument('--regions', action='store_true')
    ap.add_argument('--box', default=''); ap.add_argument('--ppu', type=float, default=400); ap.add_argument('--clip', default='')
    ap.add_argument('--config', default=os.path.join(HERE, 'config.json')); ap.add_argument('--cache', default=build.default_cache())
    a = ap.parse_args()
    cfg = json.load(open(a.config))
    item = next(i for i in cfg['items'] if i['id'] == a.item)
    H = build.High(item, cfg, a.src, a.cache, light=True)
    lo, hi = H.V.min(0) - 0.03, H.V.max(0) + 0.03
    if a.box:
        b = [float(x) for x in a.box.split(',')]; lo, hi = np.array(b[:3]), np.array(b[3:])
    colors = None
    if a.parts or a.regions:
        seg = build.segment(item, cfg, H)
        colors = views.part_colors(seg.part if a.parts else seg.region)
        for i, p in enumerate(seg.parts):
            print(i, p['name'], int((seg.part == i).sum()), 'faces')
    clip = None
    if a.clip:
        ax, val = a.clip.split('='); clip = ('xyz'.index(ax), float(val))
    os.makedirs(a.out, exist_ok=True)
    for v in a.views.split(','):
        im = views.ortho(H.scene, v, lo, hi, ppu=a.ppu, colors=colors, clip=clip)
        p = os.path.join(a.out, f"{a.item}_{v}{'_parts' if a.parts else '_regions' if a.regions else ''}.png"); im.save(p); print(p, im.size)


if __name__ == '__main__':
    main()
