"""Mesh utilities for the Meshy pipeline: welding, normals, creases, boundary caps, per-vertex AO / curvature."""
import numpy as np
import scipy.sparse as sp
import scipy.sparse.csgraph as cg


def face_normals(V, F):
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    a = np.linalg.norm(n, axis=1)
    return n / np.maximum(a, 1e-20)[:, None], a * 0.5


def vertex_normals(V, F):
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    vn = np.zeros((len(V), 3))
    for k in range(3):
        np.add.at(vn, F[:, k], n)
    return vn / np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-20)


def weld(V, F, tol=1e-6):
    key = np.round(V / tol).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.ravel()
    F2 = inv[F]
    ok = (F2[:, 0] != F2[:, 1]) & (F2[:, 1] != F2[:, 2]) & (F2[:, 0] != F2[:, 2])
    return V[first], F2[ok], first, ok


def compact(V, F):
    """Drop unreferenced vertices. Returns V2, F2, old-index-of-new."""
    used = np.unique(F)
    remap = np.full(len(V), -1, np.int64); remap[used] = np.arange(len(used))
    return V[used], remap[F], used


def components(F, nv):
    A = sp.coo_matrix((np.ones(len(F) * 3, np.int8), (F.ravel(), np.roll(F, 1, axis=1).ravel())), shape=(nv, nv))
    nc, lab = cg.connected_components(A, directed=False)
    return nc, lab


def edge_faces(F):
    """Undirected edges with the faces on each side: (edges (m,2), f0, f1) with f1 = -1 on a boundary; only manifold pairs."""
    e = np.vstack([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    fid = np.tile(np.arange(len(F)), 3)
    es = np.sort(e, axis=1)
    key = es[:, 0].astype(np.int64) * (int(F.max()) + 1) + es[:, 1]
    order = np.argsort(key, kind='stable')
    key = key[order]; fid = fid[order]; es = es[order]
    start = np.r_[True, key[1:] != key[:-1]]
    idx = np.flatnonzero(start)
    cnt = np.diff(np.r_[idx, len(key)])
    f0 = fid[idx]
    f1 = np.where(cnt >= 2, fid[np.minimum(idx + 1, len(fid) - 1)], -1)
    return es[idx], f0, f1, cnt


def boundary_loops(F):
    """Ordered boundary vertex loops (each following the face winding of the open edge)."""
    e = np.vstack([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    nv = int(F.max()) + 1
    key = e[:, 0].astype(np.int64) * nv + e[:, 1]
    rkey = e[:, 1].astype(np.int64) * nv + e[:, 0]
    open_ = ~np.isin(key, rkey)
    be = e[open_]
    nxt = {}
    for a, b in be:
        nxt.setdefault(int(a), []).append(int(b))
    loops = []
    used = set()
    for a0, b0 in be:
        a0 = int(a0); b0 = int(b0)
        if (a0, b0) in used:
            continue
        loop = [a0]; cur = b0; used.add((a0, b0)); guard = 0
        while cur != a0 and guard < 10_000_000:
            guard += 1
            loop.append(cur)
            cand = [c for c in nxt.get(cur, []) if (cur, c) not in used]
            if not cand:
                break
            used.add((cur, cand[0])); cur = cand[0]
        if cur == a0 and len(loop) >= 3:
            loops.append(np.array(loop, np.int64))
    return loops


def cap_loops(V, F, loops):
    """Close each boundary loop with a centroid fan (winding opposite to the open edge, so the cap faces outward)."""
    newV = [V]; newF = [F]; base = len(V); capF = []
    for lp in loops:
        c = V[lp].mean(0)
        newV.append(c[None]); ci = base; base += 1
        a = lp; b = np.roll(lp, -1)
        f = np.c_[b, a, np.full(len(lp), ci)]
        newF.append(f); capF.append(len(f))
    V2 = np.vstack(newV); F2 = np.vstack(newF)
    is_cap = np.zeros(len(F2), bool); is_cap[len(F):] = True
    return V2, F2, is_cap


def crease_split(V, F, angle_deg=40.0):
    """Split vertices along edges sharper than angle_deg. Returns V2, F2, N2 (per-vertex normals), src (old vertex of new)."""
    fn, fa = face_normals(V, F)
    nf = len(F)
    es, f0, f1, cnt = edge_faces(F)
    smooth = (f1 >= 0) & (cnt == 2)
    cosang = np.zeros(len(es)); cosang[smooth] = (fn[f0[smooth]] * fn[f1[smooth]]).sum(1)
    smooth &= cosang > np.cos(np.radians(angle_deg))
    es, f0, f1 = es[smooth], f0[smooth], f1[smooth]
    # corner node id = face*3 + k ; union the two faces' corners at each endpoint of a smooth edge
    def corner(f, v):
        tri = F[f]
        k = np.argmax(tri == v[:, None], axis=1)
        return f * 3 + k
    rows = np.r_[corner(f0, es[:, 0]), corner(f0, es[:, 1])]
    cols = np.r_[corner(f1, es[:, 0]), corner(f1, es[:, 1])]
    A = sp.coo_matrix((np.ones(len(rows), np.int8), (rows, cols)), shape=(nf * 3, nf * 3))
    nc, lab = cg.connected_components(A, directed=False)
    F2 = lab.reshape(nf, 3)
    src = np.zeros(nc, np.int64); src[lab] = F.ravel()
    # angle-weighted normals
    N2 = np.zeros((nc, 3))
    P = V[F]
    for k in range(3):
        a = P[:, (k + 1) % 3] - P[:, k]; b = P[:, (k + 2) % 3] - P[:, k]
        ang = np.arccos(np.clip((a * b).sum(1) / np.maximum(np.linalg.norm(a, axis=1) * np.linalg.norm(b, axis=1), 1e-20), -1, 1))
        np.add.at(N2, F2[:, k], fn * ang[:, None])
    N2 /= np.maximum(np.linalg.norm(N2, axis=1, keepdims=True), 1e-20)
    return V[src], F2, N2, src


def adjacency(F, nv):
    r = np.r_[F[:, 0], F[:, 1], F[:, 2], F[:, 1], F[:, 2], F[:, 0]]
    c = np.r_[F[:, 1], F[:, 2], F[:, 0], F[:, 0], F[:, 1], F[:, 2]]
    A = sp.coo_matrix((np.ones(len(r), np.float32), (r, c)), shape=(nv, nv)).tocsr()
    A.data[:] = 1
    return A


def smooth_scalar(A, x, iters=2, lam=0.6):
    deg = np.maximum(np.asarray(A.sum(1)).ravel(), 1)
    for _ in range(iters):
        x = (1 - lam) * x + lam * (A @ x) / deg
    return x


def _hemi_dirs(k, rng):
    u1 = (np.arange(k) + rng.random(k)) / k
    u2 = rng.random(k)
    r = np.sqrt(u1); phi = 2 * np.pi * u2
    return np.c_[r * np.cos(phi), r * np.sin(phi), np.sqrt(1 - u1)]


def vertex_ao(scene, V, N, rays=32, maxdist=0.3, bias=1e-3, seed=7403, chunk=60000):
    """Cosine-weighted ambient occlusion per vertex (1 = open, 0 = fully occluded) with a distance falloff."""
    rng = np.random.default_rng(seed)
    nv = len(V)
    up = np.where(np.abs(N[:, 1:2]) < 0.9, np.array([[0, 1.0, 0]]), np.array([[1.0, 0, 0]]))
    T = np.cross(up, N); T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-20)
    B = np.cross(N, T)
    ao = np.zeros(nv)
    dirs = _hemi_dirs(rays, rng)
    for s in range(0, nv, chunk):
        e = min(nv, s + chunk); m = e - s
        rot = rng.random(m) * 2 * np.pi
        cr, sr = np.cos(rot)[:, None], np.sin(rot)[:, None]
        lx = dirs[None, :, 0] * cr - dirs[None, :, 1] * sr
        ly = dirs[None, :, 0] * sr + dirs[None, :, 1] * cr
        lz = np.broadcast_to(dirs[None, :, 2], lx.shape)
        d = lx[..., None] * T[s:e, None] + ly[..., None] * B[s:e, None] + lz[..., None] * N[s:e, None]
        o = np.broadcast_to((V[s:e] + N[s:e] * bias)[:, None], d.shape)
        prim, t, _, _ = scene.cast(o.reshape(-1, 3), d.reshape(-1, 3), maxdist)
        occ = np.where(prim >= 0, 1.0 - (t / maxdist) ** 2, 0.0).reshape(m, rays)
        ao[s:e] = 1.0 - occ.mean(1)
    return ao


def vertex_curvature(V, F, N):
    """Signed mean-curvature proxy per vertex: > 0 on convex edges/corners, < 0 in grooves (unit: 1/length)."""
    e = np.vstack([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    d = V[e[:, 1]] - V[e[:, 0]]
    dn = N[e[:, 1]] - N[e[:, 0]]
    l2 = np.maximum((d * d).sum(1), 1e-20)
    k = (dn * d).sum(1) / l2
    cur = np.zeros(len(V)); cnt = np.zeros(len(V))
    np.add.at(cur, e[:, 0], k); np.add.at(cur, e[:, 1], k)
    np.add.at(cnt, e[:, 0], 1); np.add.at(cnt, e[:, 1], 1)
    return cur / np.maximum(cnt, 1)


def _simplify_loop(P, tol):
    """Douglas-Peucker on a closed 3D polyline; returns kept indices (in order)."""
    n = len(P)
    if n <= 8:
        return np.arange(n)
    a = 0; b = int(np.argmax(np.linalg.norm(P - P[0], axis=1)))
    keep = np.zeros(n, bool); keep[[a, b]] = True
    stack = [(a, b), (b, n)]
    while stack:
        i, j = stack.pop()
        if j - i < 2:
            continue
        p0 = P[i]; p1 = P[j % n]
        seg = p1 - p0; L = np.linalg.norm(seg)
        q = P[i + 1:j] - p0
        d = np.linalg.norm(q - np.outer(q @ seg / max(L * L, 1e-30), seg), axis=1) if L > 1e-12 else np.linalg.norm(q, axis=1)
        k = int(d.argmax())
        if d[k] > tol:
            m = i + 1 + k; keep[m] = True; stack.append((i, m)); stack.append((m, j))
    return np.flatnonzero(keep)


def cap_loop(V, loop, tol=0.0015, max_pts=220, planar=None):
    """Triangles closing one boundary loop without adding vertices: the loop is thinned, projected on its best-fit
    plane and ear-clipped, so the cap never pokes outside the opening (a centroid fan does on bent or concave loops).
    Winding is opposite to the open edge so the cap faces outward. Returns (m,3) vertex indices."""
    P = V[loop]
    kp = _simplify_loop(P, tol)
    while len(kp) > max_pts:
        tol *= 1.6; kp = _simplify_loop(P, tol)
    if len(kp) < 3:
        return np.zeros((0, 3), np.int64)
    idx = loop[kp]; Q = V[idx]
    c = Q.mean(0)
    _, sv, vt = np.linalg.svd(Q - c, full_matrices=False)
    if planar is not None and np.abs((Q - c) @ vt[2]).max() > planar * max(np.linalg.norm(Q - c, axis=1).max(), 1e-9):
        return np.zeros((0, 3), np.int64)   # a bent opening: a flat cap would cut through the part
    xy = (Q - c) @ vt[:2].T
    area = 0.5 * np.sum(xy[:, 0] * np.roll(xy[:, 1], -1) - np.roll(xy[:, 0], -1) * xy[:, 1])
    if area < 0:
        xy = xy * [1, -1]            # make it counter-clockwise in the working plane
    order = list(range(len(idx))); tris = []
    guard = 0
    while len(order) > 3 and guard < 20000:
        guard += 1
        n = len(order); o = np.array(order)
        a = xy[np.roll(o, 1)]; b = xy[o]; cc = xy[np.roll(o, -1)]
        cross = (b[:, 0] - a[:, 0]) * (cc[:, 1] - a[:, 1]) - (b[:, 1] - a[:, 1]) * (cc[:, 0] - a[:, 0])
        conv = np.flatnonzero(cross > 1e-14)
        done = False
        # prefer the ear with the best shape; test containment only against reflex vertices
        reflex = o[cross <= 1e-14]
        cand = conv[np.argsort(-cross[conv] / (np.linalg.norm(cc[conv] - a[conv], axis=1) ** 2 + 1e-30))] if len(conv) else []
        for k in cand[:40]:
            A, B, C = a[k], b[k], cc[k]
            ok = True
            if len(reflex):
                Pp = xy[reflex]
                d1 = (B[0] - A[0]) * (Pp[:, 1] - A[1]) - (B[1] - A[1]) * (Pp[:, 0] - A[0])
                d2 = (C[0] - B[0]) * (Pp[:, 1] - B[1]) - (C[1] - B[1]) * (Pp[:, 0] - B[0])
                d3 = (A[0] - C[0]) * (Pp[:, 1] - C[1]) - (A[1] - C[1]) * (Pp[:, 0] - C[0])
                inside = (d1 > 1e-12) & (d2 > 1e-12) & (d3 > 1e-12)
                inside &= ~np.isin(reflex, [order[k - 1], order[k], order[(k + 1) % n]])
                ok = not inside.any()
            if ok:
                tris.append((order[k - 1], order[k], order[(k + 1) % n])); order.pop(k); done = True; break
        if not done:   # degenerate / self-crossing projection: clip the most convex corner anyway
            k = int(np.argmax(cross)); tris.append((order[k - 1], order[k], order[(k + 1) % n])); order.pop(k)
    if len(order) == 3:
        tris.append(tuple(order))
    T = idx[np.array(tris, np.int64)]
    # orient: opposite to the loop direction (the loop follows the open edge's face winding)
    pos = {int(v): i for i, v in enumerate(loop)}
    i0, i1 = pos[int(T[0, 0])], pos[int(T[0, 1])]
    fwd = ((i1 - i0) % len(loop)) < len(loop) / 2
    return T[:, ::-1] if fwd else T


def lathe(profile, pivot, axis_z=True, segments=72):
    """Closed surface of revolution around the Z axis through pivot. profile: [(r, z)] from one pole to the other."""
    pr = np.asarray(profile, float); n = len(pr)
    th = np.linspace(0, 2 * np.pi, segments, endpoint=False)
    V = np.zeros((n * segments, 3))
    for i, (r, z) in enumerate(pr):
        V[i * segments:(i + 1) * segments] = np.c_[pivot[0] + r * np.cos(th), pivot[1] + r * np.sin(th), np.full(segments, z)]
    F = []
    for i in range(n - 1):
        for j in range(segments):
            a = i * segments + j; b = i * segments + (j + 1) % segments; c = a + segments; d = b + segments
            F.append((a, b, c)); F.append((b, d, c))
    F = np.array(F, np.int64)
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    cen = V[F].mean(1) - [pivot[0], pivot[1], pr[:, 1].mean()]
    if (fn * cen).sum() < 0:
        F = F[:, ::-1]
    return V, F
