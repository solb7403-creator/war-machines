"""Embree ray casting helpers (bake, ambient occlusion, thickness) and a small CPU preview renderer."""
import numpy as np
from embreex import rtcore_scene as rtcs
from embreex.mesh_construction import TriangleMesh


class Scene:
    def __init__(self, V, F):
        self.V = np.ascontiguousarray(V, dtype=np.float32)
        self.F = np.ascontiguousarray(F, dtype=np.int32)
        self.scene = rtcs.EmbreeScene()
        TriangleMesh(self.scene, self.V, self.F)
        v, f = self.V.astype(np.float64), self.F
        n = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
        self.fn = n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-20)

    def cast(self, o, d, tfar=1e9, chunk=1_500_000):
        """First hit per ray: (prim, t, u, v); prim < 0 where nothing was hit."""
        o = np.ascontiguousarray(o, dtype=np.float32)
        d = np.ascontiguousarray(d, dtype=np.float32)
        n = len(o)
        prim = np.empty(n, np.int32); t = np.empty(n, np.float32); u = np.empty(n, np.float32); v = np.empty(n, np.float32)
        far = None if np.isscalar(tfar) else np.ascontiguousarray(tfar, np.float32)
        for s in range(0, n, chunk):
            e = min(n, s + chunk)
            dist = np.full(e - s, tfar, np.float32) if far is None else far[s:e]
            r = self.scene.run(o[s:e], d[s:e], output=1, dists=dist)
            prim[s:e] = r['primID']; t[s:e] = r['tfar']; u[s:e] = r['u']; v[s:e] = r['v']
        return prim, t, u, v

    def cast_front(self, o, d, tfar, max_iter=6, eps=2e-4):
        """First FRONT-facing hit along each ray (back faces are stepped through)."""
        o = np.array(o, dtype=np.float64); d = np.asarray(d, dtype=np.float64)
        n = len(o)
        prim = np.full(n, -1, np.int32); t = np.zeros(n, np.float64); u = np.zeros(n, np.float32); v = np.zeros(n, np.float32)
        left = np.full(n, tfar, np.float64) if np.isscalar(tfar) else np.array(tfar, np.float64)
        trav = np.zeros(n, np.float64)
        act = np.arange(n)
        for _ in range(max_iter):
            if not len(act):
                break
            p, tt, uu, vv = self.cast(o[act] + d[act] * trav[act][:, None], d[act], left[act])
            hit = p >= 0
            front = np.zeros(len(act), bool)
            front[hit] = (self.fn[p[hit]] * d[act][hit]).sum(1) < 0
            a = act[front]
            prim[a] = p[front]; t[a] = trav[a] + tt[front]; u[a] = uu[front]; v[a] = vv[front]
            back = hit & ~front
            b = act[back]
            step = tt[back].astype(np.float64) + eps
            trav[b] += step; left[b] -= step
            act = b[left[b] > 0]
        return prim, t, u, v


def look(eye, target, up=(0, 1, 0)):
    eye = np.array(eye, float); target = np.array(target, float)
    f = target - eye; f /= np.linalg.norm(f)
    r = np.cross(f, up); r /= np.linalg.norm(r)
    return eye, f, r, np.cross(r, f)


def render(sc, eye, target, w=640, h=480, ortho=1.0, vnorm=None, colors=None, light=(0.5, 0.9, 0.35), bg=40):
    """Orthographic preview render (uint8 RGB). colors = per-face rgb in 0..1."""
    eye, f, r, u = look(eye, target)
    ys, xs = np.mgrid[0:h, 0:w]
    px = (xs + 0.5) / w * 2 - 1; py = 1 - (ys + 0.5) / h * 2
    o = (eye + (px[..., None] * (w / h) * ortho) * r + (py[..., None] * ortho) * u).reshape(-1, 3)
    d = np.broadcast_to(f, o.shape)
    prim, t, bu, bv = sc.cast(o, d)
    hit = prim >= 0
    img = np.full((h * w, 3), bg, np.float32)
    if hit.any():
        p = prim[hit]
        if vnorm is not None:
            fi = sc.F[p]
            n = vnorm[fi[:, 0]] * (1 - bu[hit] - bv[hit])[:, None] + vnorm[fi[:, 1]] * bu[hit][:, None] + vnorm[fi[:, 2]] * bv[hit][:, None]
            n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
        else:
            n = sc.fn[p]
        n = np.where(((n * f).sum(1) > 0)[:, None], -n, n)
        L = np.array(light, float); L /= np.linalg.norm(L)
        sh = 0.55 * np.clip(n @ L, 0, 1) + 0.25 * np.clip(-(n @ f), 0, 1) + 0.25 * (0.5 + 0.5 * n[:, 1])
        base = colors[p] if colors is not None else np.full((len(p), 3), 0.78)
        img[hit] = np.clip(base * sh[:, None], 0, 1) ** (1 / 2.2) * 255
    return img.reshape(h, w, 3).astype(np.uint8)
