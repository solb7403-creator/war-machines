"""UV unwrap (xatlas) and high-to-low baking of tangent-space normals plus per-texel surface data.

The tangent frame is the one three.js builds at runtime when a mesh has no tangent attribute (the screen-space
cotangent frame of the UVs around the interpolated normal), so a baked normal map reproduces the high-poly normal
exactly instead of approximately. The green channel is stored in the glTF convention (the loader flips it back).
"""
import numpy as np
import xatlas
from numba import njit
from scipy import ndimage


_AXES = np.array([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], float)
_PLANE = [((0, 0, 1), (0, 1, 0)), ((0, 0, -1), (0, 1, 0)), ((1, 0, 0), (0, 0, 1)), ((1, 0, 0), (0, 0, -1)), ((-1, 0, 0), (0, 1, 0)), ((1, 0, 0), (0, 1, 0))]


def axis_charts(V, F, relax=4, keep=0.5):
    """Charts for hard-surface meshes: every face is projected flat along the axis it faces, and edge-connected faces
    sharing an axis form one chart. A chart is a height field over its plane, so it never folds, and a crinkly decimated
    mesh yields a few large charts instead of thousands of slivers. Returns (chart id per face, V2, F2, UV2, src vertex)."""
    from . import geom
    fn, fa = geom.face_normals(V, F)
    dots = fn @ _AXES.T
    lab = dots.argmax(1)
    es, f0, f1, cnt = geom.edge_faces(F)
    m = cnt == 2
    e0, e1 = f0[m], f1[m]
    nf = len(F)
    for _ in range(relax):   # majority vote among edge neighbours, only onto an axis the face still clearly faces
        votes = np.zeros((nf, 6))
        np.add.at(votes, (e0, lab[e1]), fa[e1]); np.add.at(votes, (e1, lab[e0]), fa[e0])
        votes[np.arange(nf), lab] += fa * 0.9
        votes[dots < keep] = -1
        new = votes.argmax(1)
        ok = votes[np.arange(nf), new] > 0
        lab = np.where(ok, new, lab)
    import scipy.sparse as sp
    import scipy.sparse.csgraph as cg
    same = lab[e0] == lab[e1]
    A = sp.coo_matrix((np.ones(same.sum(), np.int8), (e0[same], e1[same])), shape=(nf, nf))
    nc, chart = cg.connected_components(A, directed=False)
    key = chart[:, None].astype(np.int64) * len(V) + F
    uq, first, inv = np.unique(key.ravel(), return_index=True, return_inverse=True)
    src = F.ravel()[first]
    F2 = inv.reshape(-1, 3)
    cl = np.repeat(lab, 3)[first]
    V2 = V[src]
    UV2 = np.zeros((len(V2), 2))
    for a in range(6):
        mk = cl == a
        if mk.any():
            UV2[mk, 0] = V2[mk] @ np.array(_PLANE[a][0], float); UV2[mk, 1] = V2[mk] @ np.array(_PLANE[a][1], float)
    return chart, V2, F2, UV2, src


def unwrap(meshes, resolution, padding=4, chart=None, mode='axis'):
    """Unwrap several meshes into ONE atlas. meshes: list of (V, F, N, texel_scale). texel_scale < 1 gives a mesh
    proportionally fewer texels (hidden faces). mode 'axis' = axis-projected charts packed by xatlas; 'xatlas' = its own
    charts. Returns per mesh (source vertex of each atlas vertex, faces, uv in 0..1), plus atlas info."""
    atlas = xatlas.Atlas(); srcs = []
    for V, F, N, sc in meshes:
        if mode == 'axis':
            _, V2, F2, UV2, src = axis_charts(V, F)
            atlas.add_mesh((V2 * sc).astype(np.float32), F2.astype(np.uint32), N[src].astype(np.float32), (UV2 * sc).astype(np.float32))
            srcs.append((src, F2))
        else:
            atlas.add_mesh((V * sc).astype(np.float32), F.astype(np.uint32), N.astype(np.float32))
            srcs.append((None, F))
    co = xatlas.ChartOptions(); po = xatlas.PackOptions()
    co.max_iterations = 2
    if mode == 'axis':
        co.use_input_mesh_uvs = True
    for k, v in (chart or {}).items():
        setattr(co, k, v)
    po.resolution = int(resolution); po.padding = int(padding); po.bilinear = True; po.blockAlign = False; po.bruteForce = False
    po.create_image = False
    atlas.generate(chart_options=co, pack_options=po)
    if atlas.atlas_count != 1:
        raise RuntimeError(f'atlas overflowed into {atlas.atlas_count} pages')
    out = []
    for i, (src, F2) in enumerate(srcs):
        vmap, idx, uv = atlas[i]
        vmap = vmap.astype(np.int64); idx = idx.astype(np.int64).reshape(-1, 3)
        assert np.array_equal(vmap[idx], F2), 'xatlas reordered faces'
        out.append((vmap if src is None else src[vmap], idx, uv.astype(np.float64)))
    return out, {'width': atlas.width, 'height': atlas.height, 'charts': atlas.chart_count, 'utilization': float(atlas.utilization)}


@njit(cache=True)
def _raster(uv, F, W, H, tri, bary):
    for f in range(F.shape[0]):
        x0 = uv[F[f, 0], 0] * W; y0 = uv[F[f, 0], 1] * H
        x1 = uv[F[f, 1], 0] * W; y1 = uv[F[f, 1], 1] * H
        x2 = uv[F[f, 2], 0] * W; y2 = uv[F[f, 2], 1] * H
        den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(den) < 1e-12:
            continue
        xa = int(np.floor(min(x0, x1, x2) - 0.5)); xb = int(np.ceil(max(x0, x1, x2) + 0.5))
        ya = int(np.floor(min(y0, y1, y2) - 0.5)); yb = int(np.ceil(max(y0, y1, y2) + 0.5))
        for y in range(max(0, ya), min(H, yb + 1)):
            for x in range(max(0, xa), min(W, xb + 1)):
                px = x + 0.5; py = y + 0.5
                l0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / den
                l1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / den
                l2 = 1.0 - l0 - l1
                m = min(l0, l1, l2)
                if m >= -1e-6:
                    tri[y, x] = f; bary[y, x, 0] = l0; bary[y, x, 1] = l1
                elif tri[y, x] < 0 and m > bary[y, x, 2]:   # nearest-miss candidate for edge texels (kept only if nothing covers it)
                    bary[y, x, 2] = m; bary[y, x, 3] = f; bary[y, x, 4] = l0; bary[y, x, 5] = l1


def rasterize(uv, F, W, H, edge=0.75):
    """Per-texel triangle id and barycentrics; texels within `edge` of a chart border take the nearest triangle (clamped)."""
    tri = np.full((H, W), -1, np.int64)
    bary = np.zeros((H, W, 6)); bary[..., 2] = -1e9
    _raster(uv.astype(np.float64), F.astype(np.int64), W, H, tri, bary)
    # promote near-miss texels (bary of the closest triangle, clamped to the triangle) so chart borders are fully covered
    near = (tri < 0) & (bary[..., 2] > -edge / 8.0) & (bary[..., 3] >= 0)
    tri[near] = bary[..., 3][near].astype(np.int64)
    b0 = np.where(near, bary[..., 4], bary[..., 0]); b1 = np.where(near, bary[..., 5], bary[..., 1])
    b = np.stack([b0, b1, 1 - b0 - b1], -1)
    b = np.clip(b, 0, 1); b /= np.maximum(b.sum(-1, keepdims=True), 1e-12)
    return tri, b


def dilate(maps, mask):
    """Fill texels outside `mask` with the nearest covered texel (all maps share the lookup)."""
    idx = ndimage.distance_transform_edt(~mask, return_distances=False, return_indices=True)
    return [m[idx[0], idx[1]] for m in maps]


def texel_frames(V, F, N, UV, tri, bary):
    """Position, interpolated normal and the three.js derivative tangent frame for each covered texel."""
    cov = tri >= 0
    f = tri[cov]; b = bary[cov]
    i0, i1, i2 = F[f, 0], F[f, 1], F[f, 2]
    P = V[i0] * b[:, 0:1] + V[i1] * b[:, 1:2] + V[i2] * b[:, 2:3]
    Nn = N[i0] * b[:, 0:1] + N[i1] * b[:, 1:2] + N[i2] * b[:, 2:3]
    Nn /= np.maximum(np.linalg.norm(Nn, axis=1, keepdims=True), 1e-20)
    e1 = V[i1] - V[i0]; e2 = V[i2] - V[i0]
    du1 = UV[i1, 0] - UV[i0, 0]; dv1 = UV[i1, 1] - UV[i0, 1]
    du2 = UV[i2, 0] - UV[i0, 0]; dv2 = UV[i2, 1] - UV[i0, 1]
    det = du1 * dv2 - du2 * dv1
    det = np.where(np.abs(det) < 1e-20, 1e-20, det)
    Pu = (e1 * dv2[:, None] - e2 * dv1[:, None]) / det[:, None]
    Pv = (e2 * du1[:, None] - e1 * du2[:, None]) / det[:, None]
    # cotangent frame around the interpolated normal (matches three's getTangentFrame up to its common scale)
    T = np.cross(Pv, Nn); B = np.cross(Nn, Pu)
    sgn = np.sign((np.cross(Pu, Pv) * Nn).sum(1)); sgn[sgn == 0] = 1
    T *= sgn[:, None]; B *= sgn[:, None]
    s = 1.0 / np.sqrt(np.maximum(np.maximum((T * T).sum(1), (B * B).sum(1)), 1e-30))
    return cov, P, Nn, T * s[:, None], B * s[:, None]


def solve_tangent(T, B, N, n_world):
    """Tangent-space vector m with normalize(T*mx + B*my + N*mz) == n_world."""
    M = np.stack([T, B, N], axis=2)            # columns
    det = np.linalg.det(M)
    bad = np.abs(det) < 1e-9
    M[bad] = np.eye(3)
    m = np.linalg.solve(M, n_world[..., None])[..., 0]
    m[bad] = (0, 0, 1)
    m /= np.maximum(np.linalg.norm(m, axis=1, keepdims=True), 1e-20)
    flip = m[:, 2] < 0.02                      # a normal map cannot face away from the surface
    m[flip, 2] = 0.02
    m /= np.maximum(np.linalg.norm(m, axis=1, keepdims=True), 1e-20)
    return m


def project(scene, P, Nn, cage, depth):
    """Find the high-poly point seen from each low-poly texel: first front face met travelling inward from the cage,
    falling back to the nearest surface in either direction."""
    o = P + Nn * cage
    prim, t, u, v = scene.cast_front(o, -Nn, cage + depth)
    miss = prim < 0
    if miss.any():   # retry outward from the surface (low-poly sunk below the high-poly further than the cage)
        p2, t2, u2, v2 = scene.cast(P[miss] - Nn[miss] * 1e-4, Nn[miss], cage * 4)
        prim[miss] = p2; u[miss] = u2; v[miss] = v2; t[miss] = cage - t2
    return prim, u, v, t - cage
