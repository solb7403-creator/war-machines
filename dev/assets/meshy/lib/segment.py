"""Splitting one merged Meshy mesh into its moving parts.

Parts are chosen on the original high-poly by geometric selectors (boxes, cylinders, half-spaces, combinations) and by
an automatic running-gear finder (road wheels by a Hough vote of their cylindrical surfaces, the belt as the band around
the convex hull of the wheel circles). Every cut is a surface of revolution about the part's own axis or a plane across
its travel, so the seam stays closed while the part moves, and both sides of every cut are capped."""
import numpy as np

from . import geom


# ---------------------------------------------------------------- selectors (evaluated on face centroids) -------------
def select(sel, C, FN=None):
    """Boolean mask of faces matched by a selector dict."""
    if 'and' in sel:
        m = np.ones(len(C), bool)
        for s in sel['and']:
            m &= select(s, C, FN)
        return m
    if 'or' in sel:
        m = np.zeros(len(C), bool)
        for s in sel['or']:
            m |= select(s, C, FN)
        return m
    if 'not' in sel:
        return ~select(sel['not'], C, FN)
    if 'box' in sel:
        lo, hi = np.array(sel['box'][0], float), np.array(sel['box'][1], float)
        m = np.all((C >= np.minimum(lo, hi)) & (C <= np.maximum(lo, hi)), axis=1)
    elif 'cyl' in sel:   # {"cyl": {"p0": [...], "p1": [...], "r": R, "r0": inner}}  finite cylinder between two axis points
        c = sel['cyl']; p0 = np.array(c['p0'], float); p1 = np.array(c['p1'], float)
        ax = p1 - p0; L = np.linalg.norm(ax); ax /= L
        t = (C - p0) @ ax
        rad = np.linalg.norm(C - p0 - t[:, None] * ax, axis=1)
        m = (t >= 0) & (t <= L) & (rad <= c['r']) & (rad >= c.get('r0', 0))
    elif 'plane' in sel:  # {"plane": {"n": [..], "d": k}}  keeps n.p >= d
        p = sel['plane']; m = C @ np.array(p['n'], float) >= p['d']
    elif 'sphere' in sel:
        s = sel['sphere']; m = np.linalg.norm(C - np.array(s['c'], float), axis=1) <= s['r']
    elif 'all' in sel:
        m = np.ones(len(C), bool)
    else:
        raise ValueError(f'unknown selector {sel}')
    if sel.get('mirrorZ'):
        C2 = C * [1, 1, -1]
        s2 = {k: v for k, v in sel.items() if k != 'mirrorZ'}
        m |= select(s2, C2, FN)
    return m


# ---------------------------------------------------------------- running gear ---------------------------------------
def find_wheels(C, FN, FA, band, rmin=0.05, rmax=0.4, res=0.004, min_sep=0.12, max_wheels=12, thresh=0.25):
    """Wheel axes inside a z band: every face of a cylindrical surface votes along its own normal; axes are the peaks.
    Returns [(x, y, r_rim)] sorted by x. band = (z0, z1, y0, y1, x0, x1)."""
    z0, z1, y0, y1, x0, x1 = band
    m = (C[:, 2] >= z0) & (C[:, 2] <= z1) & (C[:, 1] >= y0) & (C[:, 1] <= y1) & (C[:, 0] >= x0) & (C[:, 0] <= x1) & (np.abs(FN[:, 2]) < 0.25)
    c = C[m][:, :2]; n = FN[m][:, :2]; n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9); a = FA[m]
    nx = int((x1 - x0) / res) + 1; ny = int((y1 - y0) / res) + 1
    acc = np.zeros(nx * ny)
    for t in np.arange(rmin, rmax, res):   # centre lies inward along -normal
        p = c - n * t
        ix = np.round((p[:, 0] - x0) / res).astype(np.int64); iy = np.round((p[:, 1] - y0) / res).astype(np.int64)
        ok = (ix >= 0) & (ix < nx) & (iy >= 0) & (iy < ny)
        acc += np.bincount(ix[ok] * ny + iy[ok], weights=a[ok], minlength=nx * ny)
    from scipy import ndimage
    acc = ndimage.gaussian_filter(acc.reshape(nx, ny), 1.2)
    peaks = []
    work = acc.copy(); top = work.max()
    sep = int(min_sep / res)
    while len(peaks) < max_wheels:
        i = np.unravel_index(work.argmax(), work.shape)
        if work[i] < top * thresh:
            break
        peaks.append((x0 + i[0] * res, y0 + i[1] * res, work[i]))
        xa, xb = max(0, i[0] - sep), min(nx, i[0] + sep + 1); ya, yb = max(0, i[1] - sep), min(ny, i[1] + sep + 1)
        work[xa:xb, ya:yb] = 0
    out = []
    for px, py, _ in peaks:
        # refine the centre, then read the rim: the largest radius with a full ring of outward-facing cylinder surface
        d = c - [px, py]; r = np.linalg.norm(d, axis=1)
        radial = (d * n).sum(1) / np.maximum(r, 1e-9)
        sel = (radial > 0.92) & (r < rmax)
        if sel.sum() < 50:
            continue
        ang = np.arctan2(d[sel, 1], d[sel, 0]); rr = r[sel]; aa = a[sel]
        bins = np.arange(rmin * 0.5, rmax, res)
        area = np.array([aa[(rr >= b0) & (rr < b0 + res * 1.5)].sum() for b0 in bins])
        cover = np.array([len(np.unique((ang[(rr >= b0) & (rr < b0 + res * 1.5)] / (2 * np.pi) * 24).astype(int) % 24)) / 24.0 for b0 in bins])
        good = (cover >= 0.7) & (area >= 0.25 * area[cover >= 0.7].max()) if (cover >= 0.7).any() else np.zeros(len(bins), bool)
        if good.any():
            out.append((float(px), float(py), float(bins[good].max() + res * 1.5)))
    return sorted(out)


def hull_of_circles(circles):
    """Convex hull of circles as a closed belt path, clockwise seen from +Z (bottom run goes -x).
    circles: [(x, y, r)]. Returns elements [{'kind':'arc','c':(x,y),'r':r,'a0':start angle,'da':sweep(<0)} | {'kind':'line','p':(x,y),'d':(dx,dy),'len':L}], with 's' start lengths, and total length."""
    cs = [np.array(c, float) for c in circles]
    n = len(cs)
    if n == 1:
        c = cs[0]
        return [{'kind': 'arc', 'c': (c[0], c[1]), 'r': c[2], 'a0': -np.pi / 2, 'da': -2 * np.pi, 's': 0.0, 'len': 2 * np.pi * c[2]}], 2 * np.pi * c[2]

    def tangent(a, b):
        """External tangent from circle a to circle b that keeps both on its RIGHT... (clockwise travel => circles on the right)."""
        d = b[:2] - a[:2]; L = np.linalg.norm(d)
        if L < 1e-9 or abs(a[2] - b[2]) >= L:
            return None
        base = np.arctan2(d[1], d[0])
        # unit normal n pointing from the tangent line toward ... we want points pa = a + r_a*n, pb = b + r_b*n with travel direction t = rot(n, -90deg) for clockwise
        # condition: n . d = r_a - r_b  (same-side tangent)
        cosv = (a[2] - b[2]) / L
        phi = np.arccos(np.clip(cosv, -1, 1))
        for sgn in (1, -1):
            ang = base + sgn * phi
            nrm = np.array([np.cos(ang), np.sin(ang)])
            t = np.array([nrm[1], -nrm[0]])       # clockwise: normal rotated -90 deg
            if t @ d > 0:
                return a[:2] + a[2] * nrm, b[:2] + b[2] * nrm, nrm, t
        return None

    # gift wrap over circles, clockwise: start from the circle reaching lowest, initial normal pointing down
    start = int(np.argmin([c[1] - c[2] for c in cs]))
    order = []; cur = start; cur_ang = -np.pi / 2   # angle of the outward normal where we currently touch
    for _ in range(4 * n + 4):
        best = None
        for j in range(n):
            if j == cur:
                continue
            tg = tangent(cs[cur], cs[j])
            if tg is None:
                continue
            ang = np.arctan2(tg[2][1], tg[2][0])
            turn = (cur_ang - ang) % (2 * np.pi)     # clockwise sweep needed on the current circle
            if best is None or turn < best[0] - 1e-9 or (abs(turn - best[0]) < 1e-9 and np.linalg.norm(cs[j][:2] - cs[cur][:2]) > best[4]):
                best = (turn, j, tg, ang, np.linalg.norm(cs[j][:2] - cs[cur][:2]))
        if best is None:
            break
        order.append((cur, cur_ang, best[0], best[2]))
        cur = best[1]; cur_ang = best[3]
        if cur == start and len(order) > 1:
            break
    elems = []; s = 0.0
    # close: the first circle's arc must start where the last tangent arrives
    last_ang = cur_ang
    for k, (ci, a_in, turn, tg) in enumerate(order):
        a_start = last_ang if k == 0 else a_in
        sweep = (a_start - np.arctan2(tg[2][1], tg[2][0])) % (2 * np.pi)
        c = cs[ci]
        if sweep > 1e-9:
            elems.append({'kind': 'arc', 'c': (float(c[0]), float(c[1])), 'r': float(c[2]), 'a0': float(a_start), 'da': float(-sweep), 's': s, 'len': float(sweep * c[2])}); s += sweep * c[2]
        L = float(np.linalg.norm(tg[1] - tg[0]))
        elems.append({'kind': 'line', 'p': (float(tg[0][0]), float(tg[0][1])), 'd': (float(tg[3][0]), float(tg[3][1])), 's': s, 'len': L}); s += L
    return elems, s


def path_project(elems, total, P):
    """(s, n, tangent angle) of 2D points P relative to the belt path; n > 0 outside."""
    best_d = np.full(len(P), 1e18); S = np.zeros(len(P)); Nn = np.zeros(len(P)); A = np.zeros(len(P))
    for e in elems:
        if e['kind'] == 'line':
            p0 = np.array(e['p']); d = np.array(e['d'])
            t = np.clip((P - p0) @ d, 0, e['len'])
            q = p0 + t[:, None] * d
            nrm = np.array([-d[1], d[0]])       # outward for clockwise travel (left of travel direction)
            off = (P - q) @ nrm
            dist = np.linalg.norm(P - q, axis=1)
            s = e['s'] + t; ang = np.full(len(P), np.arctan2(d[1], d[0]))
        else:
            c = np.array(e['c']); v = P - c; r = np.linalg.norm(v, axis=1)
            a = np.arctan2(v[:, 1], v[:, 0])
            sw = (e['a0'] - a) % (2 * np.pi)
            inside = sw <= -e['da'] + 1e-9
            swc = np.where(inside, sw, np.where(sw - (-e['da']) < (2 * np.pi - sw), -e['da'], 0.0))
            aa = e['a0'] - swc
            q = c + e['r'] * np.c_[np.cos(aa), np.sin(aa)]
            dist = np.where(inside, np.abs(r - e['r']), np.linalg.norm(P - q, axis=1))
            off = r - e['r']
            s = e['s'] + swc * e['r']; ang = aa - np.pi / 2
        better = dist < best_d
        best_d = np.where(better, dist, best_d); S = np.where(better, s, S); Nn = np.where(better, off, Nn); A = np.where(better, ang, A)
    return S % total, Nn, A, best_d


def path_point(elems, total, s, n):
    """Inverse of path_project: 2D point and tangent angle at path length s, offset n."""
    s = np.asarray(s, float) % total
    out = np.zeros((len(s), 2)); ang = np.zeros(len(s))
    for e in elems:
        k = (s >= e['s']) & (s < e['s'] + e['len'] + 1e-12)
        if not k.any():
            continue
        t = s[k] - e['s']
        if e['kind'] == 'line':
            d = np.array(e['d']); nrm = np.array([-d[1], d[0]])
            out[k] = np.array(e['p']) + t[:, None] * d + n[k][:, None] * nrm; ang[k] = np.arctan2(d[1], d[0])
        else:
            a = e['a0'] - t / e['r']
            out[k] = np.array(e['c']) + (e['r'] + n[k])[:, None] * np.c_[np.cos(a), np.sin(a)]; ang[k] = a - np.pi / 2
    return out, ang
