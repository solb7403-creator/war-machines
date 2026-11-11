"""Measured orthographic views (unit grid in game space) used to author and check part cuts."""
import numpy as np
from PIL import Image, ImageDraw

from . import rcast

VIEWS = {   # name: (view direction the camera looks along, screen-right axis, screen-up axis)
    'side': ((0, 0, -1), (1, 0, 0), (0, 1, 0)),      # from +Z: x right, y up
    'side-': ((0, 0, 1), (-1, 0, 0), (0, 1, 0)),     # from -Z
    'top': ((0, -1, 0), (1, 0, 0), (0, 0, -1)),      # from above: x right, -z up
    'bottom': ((0, 1, 0), (1, 0, 0), (0, 0, 1)),
    'front': ((-1, 0, 0), (0, 0, -1), (0, 1, 0)),    # from +X: -z right, y up
    'rear': ((1, 0, 0), (0, 0, 1), (0, 1, 0)),
}


def ortho(scene, view, lo, hi, ppu=400, colors=None, grid=0.1, label=0.5, clip=None, bg=34):
    """Render one axis view of the box lo..hi. clip = (axis index, value): start the rays at that plane (cross-section look)."""
    d, r, u = (np.array(a, float) for a in VIEWS[view])
    c = (np.array(lo) + np.array(hi)) / 2
    ext = np.array(hi) - np.array(lo)
    w = int(abs(ext @ r) * ppu) + 40; h = int(abs(ext @ u) * ppu) + 40
    ys, xs = np.mgrid[0:h, 0:w]
    sx = (xs + 0.5 - w / 2) / ppu; sy = (h / 2 - ys - 0.5) / ppu
    depth = abs(ext @ d) / 2 + 0.5
    o = c + sx[..., None] * r + sy[..., None] * u - d * depth
    if clip is not None:
        ax, val = clip
        o = o.copy(); o[..., ax] = val
    o = o.reshape(-1, 3); dd = np.broadcast_to(d, o.shape)
    prim, t, _, _ = scene.cast(o, dd)
    img = np.full((h * w, 3), bg, np.float32)
    hit = prim >= 0
    n = scene.fn[prim[hit]]
    n = np.where(((n * d).sum(1) > 0)[:, None], -n, n)
    L = -d + 0.5 * u + 0.35 * r; L /= np.linalg.norm(L)
    sh = 0.35 + 0.65 * np.clip(n @ L, 0, 1)
    base = colors[prim[hit]] if colors is not None else np.full((hit.sum(), 3), 0.8)
    img[hit] = np.clip(base * sh[:, None], 0, 1) ** (1 / 2.2) * 255
    im = Image.fromarray(img.reshape(h, w, 3).astype(np.uint8)); dr = ImageDraw.Draw(im)
    # grid in the two screen axes
    for axis_vec, horiz in ((r, True), (u, False)):
        ai = int(np.argmax(np.abs(axis_vec))); sgn = np.sign(axis_vec[ai])
        a0, a1 = sorted((lo[ai], hi[ai]))
        k = np.ceil(a0 / grid - 1e-6)
        while k * grid <= a1 + 1e-6:
            v = k * grid
            off = (v - c[ai]) * sgn * ppu
            major = abs(round(v / label) * label - v) < 1e-6
            col = (255, 220, 90) if major else (90, 100, 115)
            if horiz:
                x = w / 2 + off; dr.line([(x, 0), (x, h)], fill=col, width=1)
                if major:
                    dr.text((x + 2, 2), f"{'xyz'[ai]}={v:.1f}", fill=(255, 220, 90))
            else:
                y = h / 2 - off; dr.line([(0, y), (w, y)], fill=col, width=1)
                if major:
                    dr.text((2, y + 2), f"{'xyz'[ai]}={v:.1f}", fill=(255, 220, 90))
            k += 1
    return im


PALETTE = np.array([[.8, .8, .8], [.95, .35, .3], [.3, .7, .95], [.4, .85, .4], [.95, .8, .3], [.8, .45, .9], [.3, .9, .85], [.95, .6, .2], [.6, .6, .95], [.9, .5, .65],
                    [.55, .8, .3], [.5, .5, .5], [.95, .95, .5], [.4, .5, .8], [.8, .3, .6], [.3, .6, .5]])


def part_colors(part):
    return PALETTE[np.asarray(part) % len(PALETTE)]
