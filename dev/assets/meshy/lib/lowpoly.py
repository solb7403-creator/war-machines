"""Decimation of one part to a triangle budget."""
import numpy as np
import meshoptimizer as mo
from . import geom


def simplify(V, F, target_tris, max_error=0.02, lock_border=False):
    """Edge-collapse simplification that keeps original vertex positions (crisp hard-surface edges).
    max_error is relative to the mesh extent. Returns V2, F2."""
    if len(F) <= target_tris:
        return geom.compact(V, F)[:2]
    idx = np.ascontiguousarray(F, np.uint32).ravel()
    out = np.zeros_like(idx)
    opts = (mo.SIMPLIFY_LOCK_BORDER if lock_border else 0)
    n = mo.simplify(out, idx, np.ascontiguousarray(V, np.float32), target_index_count=int(target_tris) * 3, target_error=float(max_error), options=opts)
    F2 = out[:n].reshape(-1, 3).astype(np.int64)
    if len(F2) > target_tris * 1.25:   # collapses blocked by topology: allow pruning of tiny disconnected bits
        n = mo.simplify(out, idx, np.ascontiguousarray(V, np.float32), target_index_count=int(target_tris) * 3, target_error=float(max_error) * 2, options=opts | mo.SIMPLIFY_PRUNE)
        F2 = out[:n].reshape(-1, 3).astype(np.int64)
    V2, F2, _ = geom.compact(V, F2)
    return V2, F2


def reduced_indices(V, N, UV, F, ratio, max_error=0.03):
    """A second, smaller index buffer over the SAME vertices (for LOW graphics): attribute-aware collapse, so UV and
    normal seams survive and every vertex attribute (including the part index) stays valid."""
    import ctypes
    from meshoptimizer._loader import lib
    idx = np.ascontiguousarray(F, np.uint32).ravel()
    pos = np.ascontiguousarray(V, np.float32)
    att = np.ascontiguousarray(np.c_[N, UV], np.float32)
    w = np.array([0.5, 0.5, 0.5, 1.0, 1.0], np.float32)
    out = np.zeros_like(idx); err = ctypes.c_float(0)
    fp = ctypes.POINTER(ctypes.c_float); up = ctypes.POINTER(ctypes.c_uint)
    lib.meshopt_simplifyWithAttributes.restype = ctypes.c_size_t
    n = lib.meshopt_simplifyWithAttributes(out.ctypes.data_as(up), idx.ctypes.data_as(up), ctypes.c_size_t(len(idx)), pos.ctypes.data_as(fp), ctypes.c_size_t(len(pos)), ctypes.c_size_t(12),
                                           att.ctypes.data_as(fp), ctypes.c_size_t(20), w.ctypes.data_as(fp), ctypes.c_size_t(5), None,
                                           ctypes.c_size_t(int(len(idx) * ratio) // 3 * 3), ctypes.c_float(max_error), ctypes.c_uint(0), ctypes.byref(err))
    return out[:n].reshape(-1, 3).astype(np.int64)
