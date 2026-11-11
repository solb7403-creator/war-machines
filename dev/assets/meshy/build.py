#!/usr/bin/env python3
"""LUNAR: War Machines — Meshy model pipeline (Session 5E-1).

One rerunnable script; every setting lives in config.json next to it.

    python dev/assets/meshy/build.py                 # everything
    python dev/assets/meshy/build.py --only vanguard  # one item (comma list allowed)
    python dev/assets/meshy/build.py --src DIR        # folder holding the owner's original Meshy GLBs

For each item: orient + size to the game, split the moving parts, decimate to LIGHT and FULL, UV-unwrap, bake
normal / AO / colour masks from the original high-poly, write meshopt + WebP GLBs and the manifest.
The originals are never written to the repository.
"""
import argparse
import glob
import hashlib
import json
import os
import sys
import tempfile
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib import glbio, geom, rcast, bake, gltfout, lowpoly  # noqa: E402


def default_cache():
    return os.path.join(tempfile.gettempdir(), 'lunar-meshy-cache')


def log(*a):
    print(*a, flush=True)


def find_source(src_dir, match):
    hits = [p for p in sorted(glob.glob(os.path.join(src_dir, '*.glb'))) if match.lower() in os.path.basename(p).lower() and not os.path.basename(p).startswith('._')]
    if len(hits) != 1:
        raise SystemExit(f'source "{match}": expected 1 file in {src_dir}, found {len(hits)}')
    return hits[0]


def yaw_matrix(deg):
    a = np.radians(deg); c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


class High:
    """The original model in game space with everything the bake samples from it."""

    def __init__(self, item, cfg, src_dir, cache_dir, light=False):
        path = find_source(src_dir, item['src'])
        self.path = path; self.src_bytes = os.path.getsize(path)
        V, F, info = glbio.load_mesh(path, want_uv=bool(item.get('textured')))
        self.src_tris = len(F)
        self.tex = None
        if item.get('textured') and 'uv' in info:   # a Meshy-textured source: keep per-corner UVs and its own maps
            uv = info['uv']
            V, Fw, first, okf = geom.weld(V, F, tol=1e-6)
            self.uvc = uv[F[okf]]                    # (faces, 3, 2)
            F = Fw
            self.tex = glbio.load_textures(path)
        R = yaw_matrix(item.get('yaw', 0))
        V = V @ R.T
        fit = item.get('fit', {})
        mn, mx = V.min(0), V.max(0)
        origin = np.array([(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2])   # default: centred on the ground
        s = fit.get('scale', 1.0)
        if 'length' in fit:
            s = fit['length'] / (mx[0] - mn[0])
        if fit.get('mode') == 'weapon':   # base ring centre -> origin, muzzle at the game's tip distance
            low = V[:, 1] < mn[1] + 0.05 * (mx[1] - mn[1])
            origin = np.array([(V[low, 0].min() + V[low, 0].max()) / 2, mn[1], (V[low, 2].min() + V[low, 2].max()) / 2])
            # refine on the ring's own round wall (the bounding box is off whenever the body overhangs the ring)
            from lib import segment as sg
            fn0, fa0 = geom.face_normals(V, F); c0 = V[F].mean(1)
            hgt = mx[1] - mn[1]; rad = max(V[low, 0].max() - V[low, 0].min(), V[low, 2].max() - V[low, 2].min()) / 2
            cand = sg.find_wheels(c0[:, [0, 2, 1]], fn0[:, [0, 2, 1]], fa0, (mn[1], mn[1] + fit.get('ringBand', 0.12) * hgt, origin[2] - 0.3 * rad, origin[2] + 0.3 * rad, origin[0] - 0.3 * rad, origin[0] + 0.3 * rad),
                                  rmin=0.5 * rad, rmax=1.25 * rad, min_sep=rad, max_wheels=1, res=0.004, thresh=0.5)
            if cand:
                origin[0], origin[2] = cand[0][0], cand[0][1]
            s = fit['tip'] / (mx[0] - origin[0])
        if fit.get('mode') == 'footprint':   # town item: fit inside w x d (metres), keep proportions
            s = min(fit['w'] / (mx[0] - mn[0]), fit['d'] / (mx[2] - mn[2])) * fit.get('fill', 1.0)
        if 'origin' in fit:   # explicit [x, z] in source units after yaw (e.g. a chassis turret-ring centre)
            origin[0], origin[2] = fit['origin']
        off = np.array(fit.get('offset', [0, 0, 0]), float)
        V = (V - origin) * s + off
        self.scale = s
        M = np.eye(4); M[:3, :3] = R * s; M[:3, 3] = off - origin * s
        self.matrix = M   # source space -> game model space
        self.V = V; self.F = F
        self.FN, self.FA = geom.face_normals(V, F)
        self.C = V[F].mean(1)
        self.ring = None
        if item['kind'] == 'chassis' and 'origin' not in fit and not item.get('ring', {}).get('skip'):
            # the turret mount: a ring of vertical wall on the upper hull. Its centre becomes the model origin (the game's
            # turret socket and hitbox centre), its top the socket height
            from lib import segment as sg
            h = V[:, 1].max(); hw = np.abs(V[:, 2]).max()
            C2 = self.C[:, [0, 2, 1]]; N2 = self.FN[:, [0, 2, 1]]
            rc = item.get('ring', {})
            up = (self.FN[:, 1] > 0.9) & (self.C[:, 1] > 0.3 * h) & (np.abs(self.C[:, 2]) < 0.6 * hw)
            hist, edges = np.histogram(self.C[up, 1], bins=np.arange(0.3 * h, h + 0.01, 0.01), weights=self.FA[up])
            deck0 = float(edges[int(hist.argmax())]) + 0.005    # the main deck: the largest level surface of the upper hull
            self.deck0 = deck0
            ymin = rc.get('yMin', deck0 - 0.02)
            cand = sg.find_wheels(C2, N2, self.FA, (ymin, rc.get('yMax', ymin + 0.3), -0.6 * hw, 0.6 * hw, V[:, 0].min() * 0.7, V[:, 0].max() * 0.7), rmin=rc.get('rMin', 0.22), rmax=rc.get('rMax', 0.62), min_sep=0.3, max_wheels=3, thresh=0.5)
            if cand:
                cx, cz, r = max(cand, key=lambda c: c[2]) if not rc.get('first') else cand[0]
                cz = 0.0 if abs(cz) < 0.04 else cz
                V = V - [cx, 0, cz]; M[:3, 3] -= [cx, 0, cz]
                self.V = V; self.C = V[F].mean(1); self.matrix = M
                top = (np.hypot(self.C[:, 0], self.C[:, 2]) < r * 0.95) & (self.FN[:, 1] > 0.9) & (self.C[:, 1] > ymin) & (self.C[:, 1] < ymin + 0.3)
                hist, edges = np.histogram(self.C[top, 1], bins=60, weights=self.FA[top])
                ty = float(edges[np.flatnonzero(hist > 0.2 * hist.max())[-1] + 1]) if top.any() else h
                self.ring = dict(r=float(r), ty=ty, offset=[float(cx), float(cz)])
        self.N = geom.vertex_normals(V, F)
        self.scene = rcast.Scene(V, F)
        self.diag = float(np.linalg.norm(V.max(0) - V.min(0)))
        g = cfg['bake']
        key = hashlib.sha1(json.dumps([os.path.basename(path), self.src_bytes, item.get('yaw', 0), fit, g, bool(item.get('textured')), len(V)], sort_keys=True).encode()).hexdigest()[:16]
        cpath = os.path.join(cache_dir, f"{item['id']}-{key}.npz")
        t = time.time()
        if light:   # inspection only: no AO / curvature
            return
        if os.path.exists(cpath):
            z = np.load(cpath); self.ao = z['ao']; self.cur = z['cur']
        else:
            self.ao = geom.vertex_ao(self.scene, V, self.N, rays=g['aoRays'], maxdist=g['aoDistance'] * self.diag)
            A = geom.adjacency(F, len(V))
            self.ao = geom.smooth_scalar(A, self.ao, iters=g.get('aoSmooth', 2))
            self.cur = geom.smooth_scalar(A, geom.vertex_curvature(V, F, self.N), iters=g.get('curvatureSmooth', 3))
            os.makedirs(cache_dir, exist_ok=True); np.savez_compressed(cpath, ao=self.ao.astype(np.float32), cur=self.cur.astype(np.float32))
        tpath = cpath.replace('.npz', '-thick.npy')
        if os.path.exists(tpath):
            self.thick = np.load(tpath)
        else:   # local thickness: how far the solid extends behind each face
            prim, tt, _, _ = self.scene.cast(self.C - self.FN * 1e-4, -self.FN, self.diag)
            self.thick = np.where(prim >= 0, tt, self.diag).astype(np.float32); np.save(tpath, self.thick)
        log(f'  high: {len(F)} tris, AO+curvature+thickness {time.time() - t:.1f}s')


# ---------------------------------------------------------------- parts -----------------------------------------------
class Seg:
    """Per-face part ids on the high-poly plus the capped mesh of every part."""
    pass


def track_units(H, tcfg):
    """Ground-contact clusters = one unit per track (two for a normal tank, four for a four-pod chassis)."""
    from scipy import ndimage
    C = H.C; h = H.V[:, 1].max()
    ground = C[:, 1] < tcfg.get('groundBand', 0.035)
    res = 0.02
    x0, z0 = H.V[:, 0].min(), H.V[:, 2].min()
    nx = int((H.V[:, 0].max() - x0) / res) + 2; nz = int((H.V[:, 2].max() - z0) / res) + 2
    occ = np.zeros((nx, nz), bool)
    occ[((C[ground, 0] - x0) / res).astype(int), ((C[ground, 2] - z0) / res).astype(int)] = True
    it = int(tcfg.get('joinGap', 0.12) / res)
    occ = ndimage.binary_closing(np.pad(occ, it + 1), iterations=it)[it + 1:-it - 1, it + 1:-it - 1]   # padded: a unit on the grid border is not eroded
    lab, n = ndimage.label(occ)
    units = []
    for k in range(1, n + 1):
        ix, iz = np.where(lab == k)
        if len(ix) < 12:
            continue
        bx = (x0 + ix.min() * res, x0 + (ix.max() + 1) * res); bz = (z0 + iz.min() * res, z0 + (iz.max() + 1) * res)
        g = (C[:, 1] < tcfg.get('shoeBand', 0.08)) & (C[:, 0] >= bx[0] - 0.05) & (C[:, 0] <= bx[1] + 0.05) & (C[:, 2] >= bz[0] - 0.08) & (C[:, 2] <= bz[1] + 0.08)
        units.append(dict(x=(float(C[g, 0].min()), float(C[g, 0].max())), z=(float(C[g, 2].min()), float(C[g, 2].max()))))
    return units


def wheel_radius(scene, cx, cy, z0, z1, rmax):
    best = 0.0
    for z in np.linspace(z0, z1, 7)[1:-1]:
        ang = np.radians([25, 35, 45, 55, 125, 135, 145, 155, 205, 215, 225, 235, 305, 315, 325, 335])
        d = np.c_[np.cos(ang), np.sin(ang), np.zeros(len(ang))]
        o = np.tile([cx, cy, z], (len(ang), 1))
        prim, t, _, _ = scene.cast(o, d, rmax)
        ok = (prim >= 0)
        ok[ok] &= (scene.fn[prim[ok]] * d[ok]).sum(1) > 0      # leaving the solid
        if ok.sum() >= 6:
            best = max(best, float(np.median(t[ok])))
    return best


def belt_tile(elems, total, circles, idx, sP, nP, outward, belt, H, tcfg):
    """Find the belt's link pitch on the bottom run and pick the cleanest single link there.
    Returns dict(mask over all faces, pitch (stretched so a whole number fits the loop), count, s0) or None."""
    bottom = max((e for e in elems if e['kind'] == 'line'), key=lambda e: -e['d'][0] * e['len'])   # the long run travelling -x
    if bottom['d'][0] > -0.9:
        return None
    sb0, sb1 = bottom['s'], bottom['s'] + bottom['len']
    isb = belt[idx]
    on = isb & (sP >= sb0) & (sP <= sb1)
    if on.sum() < 500:
        return None
    res = 0.002
    nb = int((sb1 - sb0) / res)
    b = np.clip(((sP[on] - sb0) / res).astype(int), 0, nb - 1)
    w = H.FA[idx][on] * np.clip(outward[on], 0, 1)          # outer tread surface only
    num = np.bincount(b, weights=w * nP[on], minlength=nb); den = np.bincount(b, weights=w, minlength=nb)
    prof = np.where(den > 0, num / np.maximum(den, 1e-12), np.nan)
    ok = ~np.isnan(prof)
    prof = np.interp(np.arange(nb), np.flatnonzero(ok), prof[ok]) if ok.sum() > nb // 2 else None
    if prof is None:
        return None
    pz = prof - prof.mean()
    lo, hi = int(tcfg.get('pitchMin', 0.03) / res), min(int(tcfg.get('pitchMax', 0.3) / res), nb // 3)
    corr = np.array([np.corrcoef(pz[:-k], pz[k:])[0, 1] for k in range(lo, hi)])
    if not len(corr) or np.nanmax(corr) < tcfg.get('periodicity', 0.45):
        return None
    # the first strong peak (not a multiple of the pitch)
    best = np.nanmax(corr); k = None
    for i in range(1, len(corr) - 1):
        if corr[i] >= 0.85 * best and corr[i] >= corr[i - 1] and corr[i] >= corr[i + 1]:
            k = i; break
    if k is None:
        k = int(np.nanargmax(corr))
    # sub-bin pitch from a multi-period lag
    p0 = (lo + k) * res
    m = max(1, int((nb * res * 0.5) / p0))
    kk = int(round(m * p0 / res)); rng = range(max(lo, kk - 6), min(nb - 2, kk + 7))
    cm = [np.corrcoef(pz[:-j], pz[j:])[0, 1] for j in rng]
    p0 = (list(rng)[int(np.nanargmax(cm))] * res) / m
    count = int(round(total / p0)); pitch = total / count
    # candidate links start at tread gaps (profile minima); take the one farthest from any wheel contact
    contacts = [bottom['s'] + (bottom['p'][0] - c[0]) for c in circles if abs((c[1] - c[2]) - bottom['p'][1]) < 0.02]
    sm = np.convolve(prof, np.ones(5) / 5, mode='same')
    k0 = int(np.argmin(sm[: int(p0 / res)]))
    best_s, best_d = None, -1
    j = 0
    while sb0 + k0 * res + (j + 1) * p0 < sb1:
        sa = sb0 + k0 * res + j * p0
        d = min([abs(sa + p0 / 2 - c) for c in contacts] or [1.0])
        d = min(d, sa - sb0, sb1 - (sa + p0))
        if d > best_d:
            best_d, best_s = d, sa
        j += 1
    if best_s is None:
        return None
    ov = 0.04 * p0
    mask = np.zeros(len(belt), bool)
    mask[idx[isb & (sP >= best_s - ov) & (sP < best_s + p0 + ov) & (sP >= sb0) & (sP <= sb1)]] = True
    return dict(mask=mask, pitch=float(pitch), pitch0=float(p0), count=count, s0=float(best_s), corr=float(best))


def segment(item, cfg, H):
    from lib import segment as sg
    S = Seg(); C = H.C; FN = H.FN; nf = len(H.F)
    part = np.zeros(nf, np.int32)
    parts = [dict(name='body', kind='static')]
    taken = np.zeros(nf, bool)

    def add(mask, spec):
        mask = mask & ~taken
        if not mask.any():
            log(f"    ! part {spec['name']} selected no faces"); return None
        part[mask] = len(parts); taken[mask] = True; parts.append(spec); return len(parts) - 1

    tcfg = item.get('tracks')
    S.tracks = []
    if tcfg:
        tcfg = {} if tcfg == 'auto' else tcfg
        dz = tcfg.get('zPad', 0.02)
        units = tcfg.get('units') or track_units(H, tcfg)
        for ui, u in enumerate(units):
            zc = (u['z'][0] + u['z'][1]) / 2; side = 1 if zc > 0 else -1
            ch = 'driveR' if side > 0 else 'driveL'
            band = (u['z'][0] - dz, u['z'][1] + dz, 0.0, tcfg.get('top', 0.5), u['x'][0] - 0.05, u['x'][1] + 0.05)
            wheels = u.get('wheels') or sg.find_wheels(C, FN, H.FA, band, rmin=tcfg.get('rMin', 0.05), rmax=tcfg.get('rMax', 0.3), thresh=tcfg.get('thresh', 0.25))
            wheels = [list(w) for w in wheels if w[2] >= tcfg.get('rKeep', 0.045)]
            if not u.get('wheels'):
                # the tyre radius is measured directly: rays from the axle leave the wheel's solid at its tread
                # (probed at several depths across the wheel and several angles clear of the belt contact)
                wheels = [(w[0], w[1], max(w[2], wheel_radius(H.scene, w[0], w[1], band[0] + dz, band[1] - dz, rmax=min(tcfg.get('rMax', 0.3), w[1] - 0.004)))) for w in wheels]
                for i, w in enumerate(wheels):   # wheels on one axle line share a radius
                    row = [v[2] for v in wheels if abs(v[1] - w[1]) < 0.03]
                    if len(row) >= 3:
                        wheels[i] = (w[0], w[1], float(np.median(row)))
            shrink = tcfg.get('wheelShrink', 0.0)
            circles = [(w[0], w[1], w[2] - shrink) for w in wheels]
            elems, total = sg.hull_of_circles(circles)
            inband = (C[:, 2] >= band[0]) & (C[:, 2] <= band[1]) & (C[:, 0] >= band[4] - 0.1) & (C[:, 0] <= band[5] + 0.1)
            wmask_all = np.zeros(nf, bool)
            for wi, (wx, wy, wr) in enumerate(circles):
                m = inband & (np.hypot(C[:, 0] - wx, C[:, 1] - wy) < wr)
                wmask_all |= m
                wspec = dict(name=f'wheel{ui}_{wi}', kind='screw', pivot=[wx, wy, zc], axis=[0, 0, 1], angle=dict(ch=ch, k=-1.0 / wr), selfAO=True, uniformTexels=True, role='wheel', minTris=dict(light=90, full=500))
                if str(ui) in tcfg.get('parents', {}):
                    wspec['parent'] = tcfg['parents'][str(ui)]
                add(m, wspec)
            idx = np.flatnonzero(inband & ~wmask_all & ~taken)
            sP, nP, aP, dP = sg.path_project(elems, total, C[idx][:, :2])
            below = C[idx][:, 1] < min(c[1] - c[2] for c in circles)   # under the wheels: pure belt
            n_out = float(np.percentile(nP[below], 99.9)) + 0.012 if below.any() else 0.08
            n_out = tcfg.get('tOut', n_out)
            t_in = tcfg.get('tIn', 0.03)
            # a surface that faces the belt from outside (the underside of a fender over the top run) is not belt
            outward = -np.sin(aP) * FN[idx, 0] + np.cos(aP) * FN[idx, 1]
            facing = (outward < -0.55) & (nP > tcfg.get('core', 0.5) * n_out)
            belt = np.zeros(nf, bool); belt[idx[(nP >= -t_in) & (nP <= n_out) & ~facing]] = True
            spec = dict(name=f'belt{ui}', kind='track', travel=dict(ch=ch, k=1.0), path=dict(elems=elems, length=total), selfAO=True, uniformTexels=True, role='belt', z=zc)
            if str(ui) in tcfg.get('parents', {}):
                spec['parent'] = tcfg['parents'][str(ui)]
            # one link of the bottom run, repeated around the whole path: where the belt was fused to wheels and fenders
            # the original has no surface at all, and a belt that travels has to be whole everywhere
            tile = belt_tile(elems, total, circles, idx, sP, nP, outward, belt, H, tcfg) if tcfg.get('tile', True) else None
            if tile is not None:
                drop = belt & ~tile['mask']
                part[drop & ~taken] = -1; taken |= drop
                belt = tile['mask']; spec['tile'] = {k2: tile[k2] for k2 in ('pitch', 'count', 's0', 'pitch0')}
            bi = add(belt, spec)
            S.tracks.append(dict(unit=u, wheels=circles, length=total, nOut=n_out, tIn=t_in, side=side, belt=bi))
            if tile is not None:
                log(f"    belt {ui}: link pitch {tile['pitch0']:.4f} -> {tile['count']} links of {tile['pitch']:.4f} (periodicity {tile['corr']:.2f})")
            log(f"    track unit {ui}: side {side:+d} z {u['z'][0]:.2f}..{u['z'][1]:.2f}, {len(circles)} wheels r {[round(c[2], 3) for c in circles]}, path {total:.2f}, belt n {-t_in:.3f}..{n_out:.3f}")
    tw = item.get('turret')
    S.tips = []
    if tw:
        if tw.get('ringTop'):   # the base ring stays with the hull while the turret turns
            add(C[:, 1] < tw['ringTop'], dict(name='ring', kind='screw', pivot=[0, 0, 0], axis=[0, 1, 0], angle=dict(ch='aim', k=-1.0)))
        for bi, b in enumerate(tw.get('barrels', [])):
            by, bz, br = b['y'], b['z'], b['r']
            if b.get('refine', True):   # centre the axis on the barrel's own cylinder surfaces
                near = (C[:, 0] > b['x'] + 0.03) & (np.hypot(C[:, 1] - by, C[:, 2] - bz) < br) & (np.abs(FN[:, 0]) < 0.25)
                if near.sum() > 200:
                    C2 = C[:, [1, 2, 0]]; N2 = FN[:, [1, 2, 0]]
                    cand = sg.find_wheels(C2[near], N2[near], H.FA[near], (b['x'], 1e3, bz - br, bz + br, by - br, by + br), rmin=0.02, rmax=br, min_sep=br, max_wheels=1, res=0.002)
                    if cand and np.hypot(cand[0][0] - by, cand[0][1] - bz) < 0.4 * br:
                        by, bz = cand[0][0], cand[0][1]
            m = (C[:, 0] > b['x']) & (np.hypot(C[:, 1] - by, C[:, 2] - bz) < br)
            if b.get('xMax'):
                m &= C[:, 0] < b['xMax']
            spec = dict(name=f'barrel{bi}', kind='screw', pivot=[b['x'], by, bz], axis=[1, 0, 0], slide=dict(ch=f"recoil{b.get('channel', bi)}", k=-b.get('recoil', 0.1)))
            if b.get('spin'):
                spec['angle'] = dict(ch='spin', k=b['spin']); spec['selfAO'] = True; spec['uniformTexels'] = True
            if add(m, spec) is not None and b.get('tip', True):
                S.tips.append([float(C[m & (part == len(parts) - 1), 0].max()), float(by), float(bz)])
    for pc in item.get('parts', []):
        m = sg.select(pc['select'], C, FN)
        spec = {k: v for k, v in pc.items() if k != 'select'}
        spec.setdefault('kind', 'screw' if ('angle' in spec or 'slide' in spec) else 'static')
        add(m, spec)
    S.part = part; S.parts = parts
    # ---- material regions
    from lib.paint import RID
    region = np.full(nf, RID['armor'], np.int32)
    look = dict(cfg['looks'][item.get('look', 'common')]); look.update(item.get('lookOverride', {}))
    if look.get('bodyRegion'):
        region[:] = RID[look['bodyRegion']]
    for k, spec in enumerate(parts):
        r = spec.get('region') or {'belt': 'track', 'wheel': 'wheel'}.get(spec.get('role')) or (look.get('barrelRegion') if spec['name'].startswith('barrel') else None) or (look.get('ringRegion') if spec['name'] == 'ring' else None)
        if r:
            region[part == k] = RID[r]
    at = item.get('autoTrim', cfg.get('autoTrimTown') if item['kind'] == 'town' else cfg.get('autoTrim'))
    if at and hasattr(H, 'thick'):   # thin stand-alone details (handles, rails, hooks, antennas) are bare metal, thin armour sheets stay paint
        thin = (H.thick < at['thickness']) & np.isin(region, [RID['armor'], RID['armor2']])
        if thin.any():
            import scipy.sparse as sp
            import scipy.sparse.csgraph as cg
            es, f0, f1, cnt = geom.edge_faces(H.F)
            m = (cnt == 2) & thin[f0] & thin[np.maximum(f1, 0)]
            A = sp.coo_matrix((np.ones(m.sum(), np.int8), (f0[m], f1[m])), shape=(nf, nf))
            nc, lab = cg.connected_components(A, directed=False)
            area = np.bincount(lab, weights=H.FA * thin, minlength=nc)
            small = thin & (area[lab] < at['maxArea']) & (area[lab] > at.get('minArea', 0.0))
            region[small] = RID['trim']
    S.glow_colors = []
    gcol = np.full(nf, -1, np.int32)
    for rc in item.get('regions', []):
        if 'partShell' in rc:   # a radial shell around a part's own (refined) axis: {"part": "barrel0", "r0": .12, "r1": .2, "t": [t0, t1] along the axis from the pivot}
            ps = rc['partShell']; sp = next(pp for pp in parts if pp['name'] == ps['part'])
            pv = np.array(sp['pivot'], float); ax = np.array(sp['axis'], float); ax /= np.linalg.norm(ax)
            t = (C - pv) @ ax; rad = np.linalg.norm(C - pv - t[:, None] * ax, axis=1)
            m = (rad >= ps.get('r0', 0)) & (rad <= ps['r1'])
            if 't' in ps:
                m &= (t >= ps['t'][0]) & (t <= ps['t'][1])
        else:
            m = sg.select(rc['select'], C, FN)
        if rc.get('onlyParts'):
            m &= np.isin(part, [i for i, pp in enumerate(parts) if pp['name'] in rc['onlyParts'] or pp.get('role') in rc['onlyParts']])
        if rc.get('onlyRegion'):
            m &= np.isin(region, [RID[x] for x in rc['onlyRegion']])
        region[m] = RID[rc['region']]
        if rc.get('color'):
            S.glow_colors.append(rc['color']); gcol[m] = len(S.glow_colors) - 1
    S.region = region; S.gcol = gcol
    return S


def wheel_liner(V, spec, shrink=0.985):
    """A tread band of revolution just under a wheel's own tread. Where the wheel was fused to the belt its tread is
    missing and the cap is a flat chord; the band keeps the wheel round there when it turns (elsewhere it sits hidden
    under the real surface). Only the tread: the wheel's faces (hubs, bolts, dish) are never covered."""
    px, py, pz = spec['pivot']
    r = np.hypot(V[:, 0] - px, V[:, 1] - py); z = V[:, 2]
    z0, z1 = np.percentile(z, 1), np.percentile(z, 99)
    pad = (z1 - z0) * 0.04
    edges = np.linspace(z0 + pad, z1 - pad, 25)
    prof = []
    for a, b in zip(edges[:-1], edges[1:]):
        m = (z >= a) & (z < b)
        if m.sum() >= 8:
            prof.append((float(np.percentile(r[m], 99)) * shrink, (a + b) / 2))
    if len(prof) < 4:
        return None
    return geom.lathe(prof, (px, py), segments=64)


def belt_liner(V, spec, inset=0.004):
    """The belt's inner face as one clean band along the path, a hair inside the real inner face. It only shows through
    the openings left where road wheels were fused onto the belt, so the belt stays whole as it travels."""
    from lib import segment as sg
    el = spec['path']['elems']; L = spec['path']['length']
    z0, z1 = np.percentile(V[:, 2], 2), np.percentile(V[:, 2], 98)
    pad = (z1 - z0) * 0.06
    ns = max(48, int(L / 0.02))
    s = np.linspace(0, L, ns, endpoint=False)
    P, _ = sg.path_point(el, L, s, np.full(ns, inset))
    zs = np.linspace(z0 + pad, z1 - pad, 4)
    Vn = np.zeros((ns * len(zs), 3)); F = []
    for j, z in enumerate(zs):
        Vn[j * ns:(j + 1) * ns] = np.c_[P, np.full(ns, z)]
    for j in range(len(zs) - 1):
        for i in range(ns):
            a = j * ns + i; b = j * ns + (i + 1) % ns; c = a + ns; d = b + ns
            F.append((a, c, b)); F.append((b, c, d))
    F = np.array(F, np.int64)
    # face the inside of the loop
    cen = np.r_[P.mean(0), 0]
    fn = np.cross(Vn[F[:, 1]] - Vn[F[:, 0]], Vn[F[:, 2]] - Vn[F[:, 0]])
    to_c = cen - Vn[F].mean(1); to_c[:, 2] = 0
    if (fn * to_c).sum() < 0:
        F = F[:, ::-1]
    return Vn, F


def part_meshes(H, S):
    """Closed mesh per part over a shared vertex array: cut openings are capped (extra faces, no extra vertices) and
    wheels get a lathe liner. src = high-poly face of each face, -1 for caps and liners."""
    Vg = [H.V]; base = len(H.V); out = []
    for k, spec in enumerate(S.parts):
        fid = np.flatnonzero(S.part == k)
        Fk = H.F[fid]
        extra = []
        if len(S.parts) > 1 and len(Fk):
            role = spec.get('role')
            for lp in (geom.boundary_loops(Fk) if not spec.get('tile') else []):
                # running gear only gets flat caps on flat openings (axle side); its bent openings are where wheel
                # and belt were fused and are covered by the liners below
                t = geom.cap_loop(H.V, lp, planar=0.12 if role in ('wheel', 'belt') else None)
                if len(t):
                    extra.append(t)
            ln = wheel_liner(H.V[np.unique(Fk)], spec) if role == 'wheel' else belt_liner(H.V[np.unique(Fk)], spec) if role == 'belt' and not spec.get('tile') else None
            if ln is not None:
                Vg.append(ln[0]); extra.append(ln[1] + base); base += len(ln[0])
        ncap = sum(len(c) for c in extra)
        F2 = np.vstack([Fk] + extra) if extra else Fk
        out.append(dict(F=F2, src=np.r_[fid, np.full(ncap, -1)], capFaces=ncap))
    return np.vstack(Vg), out


_VIEW_DIRS = None


def view_dirs(n=32):
    """Directions a camera can look from: the upper hemisphere (the game never looks up at a tank from below ground)."""
    global _VIEW_DIRS
    if _VIEW_DIRS is None:
        i = np.arange(n) + 0.5
        y = i / n * 0.98 + 0.01
        phi = i * 2.399963229728653
        r = np.sqrt(1 - y * y)
        _VIEW_DIRS = np.c_[r * np.cos(phi), y, r * np.sin(phi)]
    return _VIEW_DIRS


def face_visibility(scene, V, F, eps):
    """Fraction of camera directions from which each low-poly face can be seen (0 = never visible)."""
    fn, _ = geom.face_normals(V, F)
    c = V[F].mean(1) + fn * eps
    D = view_dirs()
    vis = np.zeros(len(F))
    for d in D:
        facing = fn @ d > 0.08
        idx = np.flatnonzero(facing)
        if not len(idx):
            continue
        prim, _, _, _ = scene.cast(c[idx], np.broadcast_to(d, (len(idx), 3)), 1e3)
        vis[idx[prim < 0]] += 1
    return vis / len(D)


def split_normals(V, F, xa, uvx, crease):
    """Final vertices = unique (atlas vertex, crease group) pairs."""
    _, Fc, Nc, _ = geom.crease_split(V, F, crease)
    key = xa.astype(np.int64) * (int(Fc.max()) + 1) + Fc
    _, first, inv = np.unique(key.ravel(), return_index=True, return_inverse=True)
    return V[F.ravel()[first]], Nc[Fc.ravel()[first]], uvx[xa.ravel()[first]], inv.reshape(-1, 3)


def prepare(item, cfg, H):
    """Segment once per item: capped part meshes, per-part scenes and per-vertex bake data on the shared vertex array."""
    S = segment(item, cfg, H)
    Vg, pm = part_meshes(H, S)
    nv0 = len(H.V); nv = len(Vg)
    N = np.zeros((nv, 3)); N[:nv0] = H.N
    ao = np.full(nv, cfg['bake'].get('capAO', 0.3)); ao[:nv0] = H.ao
    cur = np.zeros(nv); cur[:nv0] = H.cur
    g = cfg['bake']
    for k, (spec, m) in enumerate(zip(S.parts, pm)):
        used = np.unique(m['F'])
        remap = np.full(nv, -1, np.int64); remap[used] = np.arange(len(used))
        m['V'] = Vg[used]; m['Fl'] = remap[m['F']]; m['used'] = used
        m['scene'] = rcast.Scene(m['V'], m['Fl'])
        capv = used[used >= nv0]
        if len(capv):
            vn = geom.vertex_normals(m['V'], m['Fl'][m['src'] < 0])
            N[capv] = vn[remap[capv]]
        if spec.get('selfAO'):   # a spinning / travelling part only keeps the occlusion that moves with it
            a = geom.vertex_ao(m['scene'], m['V'], N[used], rays=g['aoRays'], maxdist=g['aoDistance'] * H.diag)
            a = geom.smooth_scalar(geom.adjacency(m['Fl'], len(used)), a, iters=g.get('aoSmooth', 2))
            keep = used < nv0
            ao[used[keep]] = a[keep]
        fn, fa = geom.face_normals(m['V'], m['Fl'])
        m['area'] = float(fa[m['src'] >= 0].sum())
    cur = cur * (H.diag / 3.0)   # curvature relative to model size, so wear thresholds mean the same on a tank and a building
    S.Vg = Vg; S.N = N; S.ao = ao; S.cur = cur; S.pm = pm
    S.meta = item_meta(item, cfg, H, S)
    return S


def top_y(H, x, z, fallback=0.0):
    prim, t, _, _ = H.scene.cast(np.array([[x, 50.0, z]]), np.array([[0.0, -1.0, 0.0]]), 100.0)
    return float(50.0 - t[0]) if prim[0] >= 0 else fallback


def item_meta(item, cfg, H, S):
    """What the game needs besides the mesh: socket height, muzzle tips, measured dimensions, seats for game-drawn add-ons."""
    V = H.V; mn, mx = V.min(0), V.max(0)
    look = dict(cfg['looks'][item.get('look', 'common')]); look.update(item.get('lookOverride', {}))
    meta = {}
    if item['kind'] == 'chassis':
        L = float(mx[0] - mn[0])
        ty = H.ring['ty'] if H.ring else float(mx[1])
        tz = float(np.mean([abs(t['unit']['z'][0] + t['unit']['z'][1]) / 2 for t in S.tracks])) if S.tracks else float(mx[2] * 0.75)
        tw = float(np.mean([abs(t['unit']['z'][1] - t['unit']['z'][0]) for t in S.tracks])) if S.tracks else 0.3
        th = float(np.mean([max(c[1] + c[2] for c in t['wheels']) + t['nOut'] for t in S.tracks])) if S.tracks else float(mx[1] * 0.5)
        rr = H.ring['r'] if H.ring else 0.45
        ann = (np.hypot(H.C[:, 0], H.C[:, 2]) > rr * 1.1) & (np.hypot(H.C[:, 0], H.C[:, 2]) < rr * 1.7) & (H.FN[:, 1] > 0.9)
        deck = getattr(H, 'deck0', None) or (float(np.average(H.C[ann, 1], weights=H.FA[ann])) if ann.any() else ty - 0.06)
        fy = top_y(H, -0.13, tz, th + 0.05)
        meta.update(ty=ty, ringRadius=rr, ringOffset=H.ring['offset'] if H.ring else [0, 0],
                    visual=dict(len=L, trackZ=tz, trackW=tw, h=th, deck=deck, ring=ty, x0=float(mn[0]), x1=float(mx[0]), fit=[-0.13, fy, tz - 0.02]),
                    track=[max(0.1, (L - th) / 2), th / 2 + 0.005, th / 2 + 0.03, 0],
                    plateSockets=dict(front=[float(mx[0]) - 0.12, th * 0.74, 0], left=[-0.04, th * 0.6, -(tz + tw / 2 + 0.045)], right=[-0.04, th * 0.6, tz + tw / 2 + 0.045]))
        sk = item.get('sockets', {})
        xc = float(mn[0]) + 0.13 * L
        cores = sk.get('cores') or [[xc, None, z] for z in (-0.25, 0.0, 0.25)]
        team = sk.get('team') or [[float(mn[0]) + 0.34 * L, None, sgn * (tz - 0.02)] for sgn in (-1, 1)]
        for lst in (cores, team):
            for p in lst:
                if p[1] is None:
                    p[1] = top_y(H, p[0], p[2], deck)
        meta['sockets'] = dict(cores=[[float(v) for v in p] for p in cores], team=[[float(v) for v in p] for p in team])
        meta['lunar'] = dict(wisps=[[float(mn[0]) + 0.06 * L, top_y(H, float(mn[0]) + 0.06 * L, sgn * 0.28, deck), sgn * 0.28] for sgn in (-1, 1)], channels=[])
        meta['halos'] = [[float(v) for v in h[:3]] + list(h[3:]) for h in item.get('halos', [])]
    elif item['kind'] in ('weapon', 'moon'):
        tips = item.get('tips') or S.tips or [[float(mx[0]), float((mn[1] + mx[1]) / 2), 0.0]]
        gc = look.get('glow', '#88d8f1')
        body = (H.C[:, 0] < (tips[0][0] * 0.45)) & (H.C[:, 1] > (item.get('turret', {}).get('ringTop', 0.1)))
        width = float(np.percentile(np.abs(H.C[body, 2]), 97)) if body.any() else 0.46
        meta.update(tips=[[float(v) for v in t] for t in tips], barrels=len(S.tips),
                    halos=item.get('halos') or [[t[0], t[1], t[2], gc, 0.13] for t in tips],
                    visual=dict(tip=float(tips[0][0]), y=float(np.mean([t[1] for t in tips])), width=width, bore=float(item.get('turret', {}).get('barrels', [{}])[0].get('r', 0.1)) * 0.6))
    else:
        meta.update(size=[float(x) for x in (mx - mn)])
        if S.tips:
            meta['tips'] = S.tips
        ri = next((i for i, p in enumerate(S.parts) if p['name'] == 'ring'), None)
        if ri is not None:   # a turret: the head turns about the centre of the pedestal's neck (top band of the fixed base)
            from lib import segment as sg
            top = item['turret']['ringTop']
            m = (S.part == ri) & (H.C[:, 1] > 0.55 * top)
            pv = [float(np.average(H.C[m, 0], weights=H.FA[m])), float(np.average(H.C[m, 2], weights=H.FA[m]))] if m.any() else [0.0, 0.0]
            rad = float(np.percentile(np.hypot(H.C[m, 0] - pv[0], H.C[m, 2] - pv[1]), 95)) if m.any() else 1.0
            cand = sg.find_wheels(H.C[m][:, [0, 2, 1]], H.FN[m][:, [0, 2, 1]], H.FA[m], (0.55 * top, top, pv[1] - 0.4 * rad, pv[1] + 0.4 * rad, pv[0] - 0.4 * rad, pv[0] + 0.4 * rad),
                                  rmin=0.3 * rad, rmax=1.3 * rad, min_sep=rad, max_wheels=1, res=max(0.01, rad / 60), thresh=0.5) if m.sum() > 200 else []
            if cand:
                pv = [float(cand[0][0]), float(cand[0][1])]
            meta['pivot'] = item.get('pivot', pv); meta['headFrom'] = float(top)
            meta['recoil'] = float(max([b.get('recoil', 0) for b in item['turret'].get('barrels', [])] or [0.2]))
    meta.update(item.get('meta', {}))
    return meta


def part_budgets(S, total, q):
    reps = np.array([spec.get('tile', {}).get('count', 1) for spec in S.parts], float)   # a tiled belt is drawn `count` times
    w = np.array([max(m['area'] * r, 1e-9) ** 0.85 for m, r in zip(S.pm, reps)])
    share = w / w.sum() * total
    floor = np.array([spec.get('minTris', {}).get(q, 40 if q == 'light' else 200) for spec in S.parts], float)
    floor = np.minimum(floor, [len(m['Fl']) * r for m, r in zip(S.pm, reps)])
    for _ in range(4):   # respect floors, rescale the rest
        low = share < floor
        if not low.any():
            break
        rest = total - floor[low].sum()
        share[low] = floor[low]
        share[~low] *= max(rest, 1.0) / max(share[~low].sum(), 1e-9)
    return np.maximum((share / reps).astype(int), 12)


def build_quality(item, cfg, H, S, q, out_dir):
    from lib import segment as sg
    Q = cfg['quality'][q]; kind = cfg['kinds'][item['kind']]
    budget = int(item.get('tris', {}).get(q, kind['tris'][q]))
    res = int(item.get('texture', {}).get(q, kind['texture'][q]))
    t0 = time.time()
    budgets = part_budgets(S, budget, q)
    groups = []; gpart = []
    for k, (spec, m) in enumerate(zip(S.parts, S.pm)):
        V, F = lowpoly.simplify(m['V'], m['Fl'], int(budgets[k]), max_error=Q['maxError'])
        if spec.get('uniformTexels'):
            hidden = np.zeros(len(F), bool)
        else:   # texel density follows what a camera can ever see: hidden faces (belly, inner faces) get a fraction
            hidden = face_visibility(H.scene, V, F, 4e-3 * H.diag) <= Q.get('hiddenBelow', 0.0)
        for mask, sc in ((~hidden, 1.0), (hidden, Q.get('hiddenTexelScale', 0.35))):
            if mask.any():
                v2, f2, _ = geom.compact(V, F[mask])
                groups.append((v2, f2, geom.vertex_normals(V, F)[np.unique(F[mask])], sc)); gpart.append(k)
    un, ainfo = bake.unwrap(groups, res, padding=Q['padding'], chart=Q.get('chart'), mode=Q.get('unwrap', 'axis'))
    Vs, Ns, UVs, Fs, Ps = [], [], [], [], []; base = 0
    for (v2, f2, _, _), (vmap, xa, uvx), k in zip(groups, un, gpart):
        v3, n3, uv3, f3 = split_normals(v2, f2, xa, uvx, Q['creaseAngle'])
        Vs.append(v3); Ns.append(n3); UVs.append(uv3); Fs.append(f3 + base); Ps.append(np.full(len(v3), k)); base += len(v3)
    V = np.vstack(Vs); N = np.vstack(Ns); uv = np.vstack(UVs); F = np.vstack(Fs); vpart = np.concatenate(Ps)
    t1 = time.time()
    # ---- bake: every texel looks up the high-poly surface of its own part
    ss = int(Q.get('supersample', 1)); W = res * ss
    tri, bary = bake.rasterize(uv, F, W, W)
    cov, P, Nn, T, B = bake.texel_frames(V, F, N, uv, tri, bary)
    tpart = vpart[F[tri[cov], 0]]
    cage = Q['cage'] * H.diag
    n_t = len(P); nh = Nn.copy(); ao = np.ones(n_t); cur_t = np.zeros(n_t); hit = np.zeros(n_t, bool); src_face = np.full(n_t, -1, np.int64)
    keep_base = np.full((n_t, 3), 0.2); keep_mr = np.tile([0.6, 0.0], (n_t, 1))
    for k, m in enumerate(S.pm):
        idx = np.flatnonzero(tpart == k)
        if not len(idx):
            continue
        prim, bu, bv, _ = bake.project(m['scene'], P[idx], Nn[idx], cage, cage * 2)
        ok = prim >= 0
        gf = m['used'][m['Fl'][np.maximum(prim, 0)]]        # global vertex ids of the hit triangle
        w0 = (1 - bu - bv)[:, None]; w1 = bu[:, None]; w2 = bv[:, None]
        n2 = S.N[gf[:, 0]] * w0 + S.N[gf[:, 1]] * w1 + S.N[gf[:, 2]] * w2
        n2 /= np.maximum(np.linalg.norm(n2, axis=1, keepdims=True), 1e-20)
        nh[idx[ok]] = n2[ok]
        ao[idx[ok]] = (S.ao[gf[:, 0]] * w0[:, 0] + S.ao[gf[:, 1]] * w1[:, 0] + S.ao[gf[:, 2]] * w2[:, 0])[ok]
        cur_t[idx[ok]] = (S.cur[gf[:, 0]] * w0[:, 0] + S.cur[gf[:, 1]] * w1[:, 0] + S.cur[gf[:, 2]] * w2[:, 0])[ok]
        if H.tex is not None:   # textured source: colour / roughness / metal from its maps, normal detail from its normal map
            sf = m['src'][np.maximum(prim, 0)]; real = ok & (sf >= 0)
            if real.any():
                fi = sf[real]; uvc = H.uvc[fi]
                b0 = w0[real]; b1 = w1[real]; b2 = w2[real]
                uvh = uvc[:, 0] * b0 + uvc[:, 1] * b1 + uvc[:, 2] * b2
                ii = idx[real]
                if H.tex['base'] is not None:
                    keep_base[ii] = glbio.sample(H.tex['base'], uvh) * np.array(H.tex['factors']['base'][:3])
                if H.tex['mr'] is not None:
                    mr = glbio.sample(H.tex['mr'], uvh); keep_mr[ii, 0] = mr[:, 1] * H.tex['factors']['roughness']; keep_mr[ii, 1] = mr[:, 2] * H.tex['factors']['metallic']
                if H.tex['normal'] is not None:
                    tri = H.F[fi]; Pa, Pb, Pc = H.V[tri[:, 0]], H.V[tri[:, 1]], H.V[tri[:, 2]]
                    e1 = Pb - Pa; e2 = Pc - Pa
                    du1 = uvc[:, 1, 0] - uvc[:, 0, 0]; dv1 = uvc[:, 1, 1] - uvc[:, 0, 1]; du2 = uvc[:, 2, 0] - uvc[:, 0, 0]; dv2 = uvc[:, 2, 1] - uvc[:, 0, 1]
                    det = du1 * dv2 - du2 * dv1; det = np.where(np.abs(det) < 1e-20, 1e-20, det)
                    Pu = (e1 * dv2[:, None] - e2 * dv1[:, None]) / det[:, None]; Pv = (e2 * du1[:, None] - e1 * du2[:, None]) / det[:, None]
                    Ns = n2[real]
                    Tt = np.cross(Pv, Ns); Bt = np.cross(Ns, Pu)
                    sg_ = np.sign((np.cross(Pu, Pv) * Ns).sum(1)); sg_[sg_ == 0] = 1
                    Tt *= sg_[:, None]; Bt *= sg_[:, None]
                    sc = 1.0 / np.sqrt(np.maximum(np.maximum((Tt * Tt).sum(1), (Bt * Bt).sum(1)), 1e-30))
                    nm = glbio.sample(H.tex['normal'], uvh) * 2 - 1
                    nw = Tt * sc[:, None] * nm[:, 0:1] + Bt * sc[:, None] * (-nm[:, 1:2]) + Ns * nm[:, 2:3]
                    nw /= np.maximum(np.linalg.norm(nw, axis=1, keepdims=True), 1e-20)
                    nh[ii] = nw
        hit[idx[ok]] = True
        src_face[idx[ok]] = m['src'][prim[ok]]
    mt = bake.solve_tangent(T, B, Nn, nh)
    # ---- surface synthesis
    from lib import paint
    look = dict(cfg['looks'][item.get('look', 'common')]); look.update(item.get('lookOverride', {}))
    capreg = np.array([paint.RID['wheel'] if sp.get('role') == 'wheel' else paint.RID['track'] if sp.get('role') == 'belt' else paint.RID['dark'] for sp in S.parts])
    region = np.where(src_face >= 0, S.region[np.maximum(src_face, 0)], capreg[tpart])
    extra = {}
    if S.glow_colors:
        pal = np.array([paint.to_lin(paint.srgb(c)) for c in S.glow_colors] + [paint.to_lin(paint.srgb(look.get('glow', '#ffffff')))])
        extra['glowColor'] = pal[np.where(src_face >= 0, S.gcol[np.maximum(src_face, 0)], -1)]
    rho = np.zeros(n_t)
    for k, spec in enumerate(S.parts):
        if spec.get('role') == 'wheel':
            sel = tpart == k
            rho[sel] = np.hypot(P[sel, 0] - spec['pivot'][0], P[sel, 1] - spec['pivot'][1]) * abs(spec['angle']['k'])
    extra['wheelRho'] = rho; extra['keepBase'] = keep_base; extra['keepMR'] = keep_mr
    b_lin, orm_t, mask_t = paint.synthesize(region, P, nh, ao, cur_t, look, extra, seed=cfg.get('seed', 7403) + sum(map(ord, item['id'])))
    maps = {'nrm': (mt, (0, 0, 1)), 'base': (b_lin, (0.2, 0.2, 0.2)), 'orm': (orm_t, (1, 0.6, 0)), 'mask': (mask_t, (0, 0, 0))}
    out = {}
    full = []
    for key, (vals, fill) in maps.items():
        a = np.zeros((W, W, 3)); a[...] = fill; a[cov] = vals; full.append(a)
    full = bake.dilate(full, cov)
    for key, a in zip(maps.keys(), full):
        if ss > 1:
            a = a.reshape(res, ss, res, ss, 3).mean((1, 3))
        out[key] = a
    nrm = out['nrm'] / np.maximum(np.linalg.norm(out['nrm'], axis=2, keepdims=True), 1e-20)
    u8 = lambda a: np.round(a * 255).clip(0, 255).astype(np.uint8)
    wq = Q['webpQuality']
    tex = {'normal': (gltfout.encode_image(u8(nrm * [1, -1, 1] * 0.5 + 0.5), wq['normal']), 'image/webp'),
           'base': (gltfout.encode_image(u8(paint.to_srgb(out['base'])), wq['base']), 'image/webp'),
           'orm': (gltfout.encode_image(u8(out['orm']), wq['orm']), 'image/webp'),
           'mask': (gltfout.encode_image(u8(out['mask']), wq['mask']), 'image/webp')}
    # ---- belts made of one repeated link: copy the baked link around the path (same UVs, so one link's texels serve all)
    track_sn = {}
    for k, spec in enumerate(S.parts):
        tl = spec.get('tile')
        if not tl:
            continue
        vi = np.flatnonzero(vpart == k)
        fi = np.flatnonzero(vpart[F[:, 0]] == k)
        el = spec['path']['elems']; L = spec['path']['length']
        s0, n0, a0, _ = sg.path_project(el, L, V[vi][:, :2])
        rel = (s0 - tl['s0']) * (tl['pitch'] / tl['pitch0'])          # stretch the link so a whole number closes the loop
        local = np.full(len(V), -1, np.int64); local[vi] = np.arange(len(vi))
        Fl = local[F[fi]]
        newV, newN, newUV, newF, newS, newA = [], [], [], [], [], []
        nxy = N[vi][:, :2]
        for i in range(tl['count']):
            si = (tl['s0'] + rel + i * tl['pitch']) % L
            pxy, ang = sg.path_point(el, L, si, n0)
            da = ang - a0; c, sn = np.cos(da), np.sin(da)
            nn = N[vi].copy(); nn[:, 0] = nxy[:, 0] * c - nxy[:, 1] * sn; nn[:, 1] = nxy[:, 0] * sn + nxy[:, 1] * c
            newV.append(np.c_[pxy, V[vi][:, 2]]); newN.append(nn); newUV.append(uv[vi]); newS.append(si); newA.append(ang)
            newF.append(Fl + i * len(vi))
        keepv = vpart != k; keepf = vpart[F[:, 0]] != k
        remap = np.full(len(V), -1, np.int64); remap[keepv] = np.arange(keepv.sum())
        base_n = int(keepv.sum())
        V = np.vstack([V[keepv]] + newV); N = np.vstack([N[keepv]] + newN); uv = np.vstack([uv[keepv]] + newUV)
        F = np.vstack([remap[F[keepf]]] + [f + base_n for f in newF])
        vpart = np.r_[vpart[keepv], np.full(len(vi) * tl['count'], k)]
        track_sn[k] = (np.concatenate(newS), np.tile(n0, tl['count']), np.concatenate(newA))
    # ---- motion attribute + part table
    mot = np.zeros((len(V), 4), np.uint16); mot[:, 0] = vpart
    table = []
    for k, spec in enumerate(S.parts):
        row = {key: spec[key] for key in ('name', 'kind', 'pivot', 'axis', 'angle', 'slide', 'glow', 'travel', 'role', 'decor', 'parent') if key in spec}
        if spec['kind'] == 'track':
            vi = np.flatnonzero(vpart == k)
            el = spec['path']['elems']; L = spec['path']['length']
            if k in track_sn:
                s0, n0, a0 = track_sn[k]; err = 0.0
            else:
                s0, n0, a0, _ = sg.path_project(el, L, V[vi][:, :2])
                back, _ = sg.path_point(el, L, s0, n0)
                err = float(np.abs(back - V[vi][:, :2]).max()) if len(vi) else 0.0
            nlo, nhi = float(n0.min()) - 1e-4, float(n0.max()) + 1e-4
            mot[vi, 1] = np.round(s0 / L * 65535).clip(0, 65535)
            mot[vi, 2] = np.round((n0 - nlo) / (nhi - nlo) * 65535).clip(0, 65535)
            mot[vi, 3] = np.round((a0 % (2 * np.pi)) / (2 * np.pi) * 65535).clip(0, 65535)
            if spec.get('tile'):
                row['links'] = spec['tile']['count']
            row['path'] = dict(length=L, n=[nlo, nhi], restError=err,
                               elems=[[0 if e['kind'] == 'line' else 1, e['s'], e['len']] + ([e['p'][0], e['p'][1], e['d'][0], e['d'][1]] if e['kind'] == 'line' else [e['c'][0], e['c'][1], e['r'], e['a0']]) for e in el])
        table.append(row)
    name = f"{item['id']}-{q}"
    low_faces = lowpoly.reduced_indices(V, N, uv, F, Q['lowRatio'], Q.get('lowError', 0.03)) if Q.get('lowRatio') else None
    st = gltfout.write_glb(os.path.join(out_dir, name + '.glb'), V, N, uv, F, mot=mot, textures=tex, name=name, low_faces=low_faces,
                           extras={'v': 1, 'id': item['id'], 'kind': item['kind'], 'quality': q, 'parts': table, 'meta': S.meta, 'lowIndex': low_faces is not None, 'look': {k: look[k] for k in ('paintA', 'paintB', 'glow', 'rarity') if k in look}})
    st.update(charts=int(ainfo['charts']), texture=res, missed=float((~hit).mean()), coverage=float(cov.mean()), parts=len(S.parts), seconds=round(time.time() - t0, 1),
              hash=hashlib.sha1(open(os.path.join(out_dir, name + '.glb'), 'rb').read()).hexdigest()[:10])
    log(f"  {q}: {st['tris']} tris {st['verts']} verts, {len(S.parts)} parts, {ainfo['charts']} charts, {res}px cover {cov.mean():.2f}, miss {st['missed']:.4f}, "
        f"{st['bytes'] / 1024:.0f} KB (geo {st['geometryBytes'] / 1024:.0f} KB), decimate+unwrap {t1 - t0:.1f}s bake {time.time() - t1:.1f}s")
    return st


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--config', default=os.path.join(HERE, 'config.json'))
    ap.add_argument('--src', default=os.environ.get('MESHY_SRC', os.path.join(HERE, 'source')))
    ap.add_argument('--out', default=None)
    ap.add_argument('--only', default='')
    ap.add_argument('--quality', default='')
    ap.add_argument('--cache', default=default_cache())
    ap.add_argument('--warm', action='store_true', help='only compute and cache the per-source AO / curvature / thickness')
    ap.add_argument('--set', action='append', default=[], help='override a config value, e.g. --set quality.light.padding=2')
    a = ap.parse_args()
    cfg = json.load(open(a.config))
    for kv in a.set:
        k, v = kv.split('=', 1); node = cfg; ks = k.split('.')
        for kk in ks[:-1]:
            node = node[int(kk)] if isinstance(node, list) else node[kk]
        node[ks[-1]] = json.loads(v)
    out_dir = a.out or os.path.normpath(os.path.join(HERE, cfg['output']))
    os.makedirs(out_dir, exist_ok=True)
    only = [x for x in a.only.split(',') if x]
    quals = [x for x in a.quality.split(',') if x] or list(cfg['quality'].keys())
    mpath = os.path.join(out_dir, 'manifest.json')
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {'version': cfg['version'], 'items': {}}
    manifest['version'] = cfg['version']
    for item in cfg['items']:
        if only and item['id'] not in only:
            continue
        log(f"[{item['id']}]")
        H = High(item, cfg, a.src, a.cache)
        if a.warm:
            continue
        rec = manifest['items'].setdefault(item['id'], {})
        ext = H.V.max(0) - H.V.min(0)
        rec.update(kind=item['kind'], source=os.path.basename(H.path), sourceTris=H.src_tris, sourceBytes=H.src_bytes, game=item.get('game'),
                   sourceToGame=[float(x) for x in H.matrix.T.ravel()], length=float(ext[0]), height=float(ext[1]), width=float(ext[2]))
        S = prepare(item, cfg, H)
        rec['parts'] = [p['name'] for p in S.parts]; rec['meta'] = S.meta
        for q in quals:
            rec[q] = build_quality(item, cfg, H, S, q, out_dir)
    json.dump(manifest, open(mpath, 'w'), indent=1, sort_keys=True)
    log('manifest', mpath)


if __name__ == '__main__':
    main()
