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

    def __init__(self, item, cfg, src_dir, cache_dir):
        path = find_source(src_dir, item['src'])
        self.path = path; self.src_bytes = os.path.getsize(path)
        V, F, info = glbio.load_mesh(path, want_uv=bool(item.get('textured')))
        self.src_tris = len(F)
        R = yaw_matrix(item.get('yaw', 0))
        V = V @ R.T
        fit = item.get('fit', {})
        mn, mx = V.min(0), V.max(0)
        s = fit['length'] / (mx[0] - mn[0]) if 'length' in fit else fit.get('scale', 1.0)
        c = (mn + mx) / 2
        off = np.array(fit.get('offset', [0, 0, 0]), float)
        V = (V - [c[0], mn[1], c[2]]) * s + off
        self.scale = s
        M = np.eye(4); M[:3, :3] = R * s; M[:3, 3] = off - (np.array([c[0], mn[1], c[2]]) * s)
        self.matrix = M   # source space -> game model space
        self.V = V; self.F = F
        self.N = geom.vertex_normals(V, F)
        self.scene = rcast.Scene(V, F)
        self.diag = float(np.linalg.norm(V.max(0) - V.min(0)))
        g = cfg['bake']
        key = hashlib.sha1(json.dumps([os.path.basename(path), self.src_bytes, item.get('yaw', 0), fit, g], sort_keys=True).encode()).hexdigest()[:16]
        cpath = os.path.join(cache_dir, f"{item['id']}-{key}.npz")
        t = time.time()
        if os.path.exists(cpath):
            z = np.load(cpath); self.ao = z['ao']; self.cur = z['cur']
        else:
            self.ao = geom.vertex_ao(self.scene, V, self.N, rays=g['aoRays'], maxdist=g['aoDistance'] * self.diag)
            A = geom.adjacency(F, len(V))
            self.ao = geom.smooth_scalar(A, self.ao, iters=g.get('aoSmooth', 2))
            self.cur = geom.smooth_scalar(A, geom.vertex_curvature(V, F, self.N), iters=g.get('curvatureSmooth', 3))
            os.makedirs(cache_dir, exist_ok=True); np.savez_compressed(cpath, ao=self.ao.astype(np.float32), cur=self.cur.astype(np.float32))
        log(f'  high: {len(F)} tris, AO+curvature {time.time() - t:.1f}s')


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


def build_quality(item, cfg, H, q, out_dir):
    Q = cfg['quality'][q]; kind = cfg['kinds'][item['kind']]
    budget = int(item.get('tris', {}).get(q, kind['tris'][q]))
    res = int(item.get('texture', {}).get(q, kind['texture'][q]))
    t0 = time.time()
    V, F = lowpoly.simplify(H.V, H.F, budget, max_error=Q['maxError'])
    # texel density follows what a camera can ever see: hidden faces (belly, inner track faces) get a fraction
    vis = face_visibility(rcast.Scene(V, F), V, F, 5e-4 * H.diag)
    hidden = vis <= Q.get('hiddenBelow', 0.0)
    groups = []
    for mask, sc in ((~hidden, 1.0), (hidden, Q.get('hiddenTexelScale', 0.35))):
        if mask.any():
            v2, f2, _ = geom.compact(V, F[mask])
            groups.append((v2, f2, geom.vertex_normals(v2, f2), sc))
    un, ainfo = bake.unwrap(groups, res, padding=Q['padding'], chart=Q.get('chart'), mode=Q.get('unwrap', 'axis'))
    Vs, Ns, UVs, Fs = [], [], [], []; base = 0
    for (v2, f2, _, _), (vmap, xa, uvx) in zip(groups, un):
        v3, n3, uv3, f3 = split_normals(v2, f2, xa, uvx, Q['creaseAngle'])
        Vs.append(v3); Ns.append(n3); UVs.append(uv3); Fs.append(f3 + base); base += len(v3)
    V = np.vstack(Vs); N = np.vstack(Ns); uv = np.vstack(UVs); F = np.vstack(Fs)
    t1 = time.time()
    ss = int(Q.get('supersample', 1)); W = res * ss
    tri, bary = bake.rasterize(uv, F, W, W)
    cov, P, Nn, T, B = bake.texel_frames(V, F, N, uv, tri, bary)
    cage = Q['cage'] * H.diag
    prim, bu, bv, dist = bake.project(H.scene, P, Nn, cage, cage * 2)
    hit = prim >= 0
    hf = H.F[np.maximum(prim, 0)]
    w0 = (1 - bu - bv)[:, None]; w1 = bu[:, None]; w2 = bv[:, None]
    nh = H.N[hf[:, 0]] * w0 + H.N[hf[:, 1]] * w1 + H.N[hf[:, 2]] * w2
    nh /= np.maximum(np.linalg.norm(nh, axis=1, keepdims=True), 1e-20)
    nh[~hit] = Nn[~hit]
    m = bake.solve_tangent(T, B, Nn, nh)
    ao = np.where(hit, H.ao[hf[:, 0]] * w0[:, 0] + H.ao[hf[:, 1]] * w1[:, 0] + H.ao[hf[:, 2]] * w2[:, 0], 1.0)
    nrm = np.zeros((W, W, 3)); nrm[..., 2] = 1; nrm[cov] = m
    aom = np.ones((W, W)); aom[cov] = ao
    nrm, aom = bake.dilate([nrm, aom], cov)
    if ss > 1:
        nrm = nrm.reshape(res, ss, res, ss, 3).mean((1, 3)); aom = aom.reshape(res, ss, res, ss).mean((1, 3))
    nrm /= np.maximum(np.linalg.norm(nrm, axis=2, keepdims=True), 1e-20)
    nimg = np.round((nrm * [1, -1, 1] * 0.5 + 0.5) * 255).clip(0, 255).astype(np.uint8)
    a8 = np.round(aom * 255).clip(0, 255).astype(np.uint8)
    orm = np.stack([a8, np.full_like(a8, 150), np.zeros_like(a8)], -1)
    tex = {'normal': (gltfout.encode_image(nimg, Q['webpQuality']['normal']), 'image/webp'),
           'orm': (gltfout.encode_image(orm, Q['webpQuality']['orm']), 'image/webp')}
    name = f"{item['id']}-{q}"
    st = gltfout.write_glb(os.path.join(out_dir, name + '.glb'), V, N, uv, F, textures=tex, name=name,
                           extras={'v': 1, 'id': item['id'], 'kind': item['kind'], 'quality': q})
    st.update(charts=int(ainfo['charts']), texture=res, missed=float((~hit).mean()), coverage=float(cov.mean()), hiddenFaces=float(hidden.mean()), seconds=round(time.time() - t0, 1))
    log(f"  {q}: {st['tris']} tris {st['verts']} verts, {ainfo['charts']} charts, {res}px cover {cov.mean():.2f}, hidden {hidden.mean():.2f}, miss {st['missed']:.4f}, "
        f"{st['bytes'] / 1024:.0f} KB (geo {st['geometryBytes'] / 1024:.0f} KB), decimate+unwrap {t1 - t0:.1f}s bake {time.time() - t1:.1f}s")
    return st


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--config', default=os.path.join(HERE, 'config.json'))
    ap.add_argument('--src', default=os.environ.get('MESHY_SRC', os.path.join(HERE, 'source')))
    ap.add_argument('--out', default=None)
    ap.add_argument('--only', default='')
    ap.add_argument('--quality', default='')
    ap.add_argument('--cache', default=os.path.join(tempfile.gettempdir(), 'lunar-meshy-cache'))
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
        rec = manifest['items'].setdefault(item['id'], {})
        ext = H.V.max(0) - H.V.min(0)
        rec.update(kind=item['kind'], source=os.path.basename(H.path), sourceTris=H.src_tris, sourceBytes=H.src_bytes, game=item.get('game'),
                   sourceToGame=[float(x) for x in H.matrix.T.ravel()], length=float(ext[0]), height=float(ext[1]), width=float(ext[2]))
        for q in quals:
            rec[q] = build_quality(item, cfg, H, q, out_dir)
    json.dump(manifest, open(mpath, 'w'), indent=1, sort_keys=True)
    log('manifest', mpath)


if __name__ == '__main__':
    main()
