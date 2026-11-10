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
