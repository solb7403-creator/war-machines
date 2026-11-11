#!/usr/bin/env python3
"""SSIM of the gate renders (original vs LIGHT / FULL) over the model's own bounding box, plus side-by-side sheets."""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from skimage.metrics import structural_similarity


def load(p, ss=1):
    a = np.asarray(Image.open(p).convert('RGB')).astype(np.float64)
    if ss > 1:   # linear-light box filter, like a display would integrate it
        lin = (a / 255.0) ** 2.2
        lin = lin.reshape(a.shape[0] // ss, ss, a.shape[1] // ss, ss, 3).mean((1, 3))
        a = lin ** (1 / 2.2) * 255.0
    return a


def crop_box(a, bg, pad=3):
    m = np.abs(a - bg).sum(2) > 6
    ys, xs = np.where(m)
    return max(0, ys.min() - pad), min(a.shape[0], ys.max() + pad + 1), max(0, xs.min() - pad), min(a.shape[1], xs.max() + pad + 1)


def main(gdir, item, out=None):
    res = {}
    info = json.load(open(f'{gdir}/{item}_info.json'))
    for view in ('battle', 'garage', 'desktop'):
        for yaw in (35, 215):
            ss = info['views'][view]['supersample']
            o = load(f'{gdir}/{item}_{view}_{yaw}_original_flat.png', ss)
            y0, y1, x0, x1 = crop_box(o, o[0, 0])
            for q in ('light', 'full'):
                a = load(f'{gdir}/{item}_{view}_{yaw}_{q}_normal.png', ss)
                go = o[y0:y1, x0:x1].mean(2); ga = a[y0:y1, x0:x1].mean(2)
                win = 7 if min(go.shape) >= 7 else 3
                s = structural_similarity(go, ga, data_range=255, win_size=win, gaussian_weights=False)
                res[f'{view}_{yaw}_{q}'] = round(float(s), 4)
            if out:
                ims = [Image.fromarray(load(f'{gdir}/{item}_{view}_{yaw}_{n}.png', ss).round().clip(0, 255).astype(np.uint8)).crop((x0, y0, x1, y1)) for n in ('original_flat', 'light_normal', 'full_normal')]
                k = 4 if view == 'battle' else 1
                ims = [im.resize((im.width * k, im.height * k), Image.NEAREST) for im in ims]
                W = Image.new('RGB', (sum(i.width for i in ims) + 8 * 2, ims[0].height + 22), (16, 18, 22)); x = 0
                d = ImageDraw.Draw(W)
                for im, lab in zip(ims, ('ORIGINAL high-poly', f'LIGHT  ssim {res[f"{view}_{yaw}_light"]}', f'FULL  ssim {res[f"{view}_{yaw}_full"]}')):
                    W.paste(im, (x, 22)); d.text((x + 4, 5), lab, fill=(255, 230, 120)); x += im.width + 8
                W.save(f'{out}/{item}_{view}_{yaw}.png')
    print(json.dumps(res))
    return res


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
