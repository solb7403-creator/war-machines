"""Surface synthesis for the untextured Meshy models: base colour, ORM and mask maps from per-texel region, baked AO,
curvature, position and normal. Nothing here is a flat fill: paint carries dirt in crevices, dust on upward faces,
streaks on walls, chipped edges down to bare metal and sparse scratches, so the baked normal detail reads as metal.

Map layout (all RGB, no alpha, so no browser premultiplies anything):
  base  sRGB, the finished factory look (a valid glTF base colour). In paint regions the shader multiplies it by
        (pilot paint / factory paint), so stock paint is this map untouched.
  orm   R ambient occlusion, G roughness, B metalness (glTF convention).
  mask  R paint amount (0 = fixed colour, 1 = paint), G glow amount, B paint tone (0 = primary, 1 = secondary/camo).
"""
import numpy as np

REGIONS = ['armor', 'armor2', 'trim', 'track', 'wheel', 'dark', 'glow', 'gold', 'lamp', 'hazard', 'steel', 'rubber', 'glass', 'keep']
RID = {n: i for i, n in enumerate(REGIONS)}


def srgb(hexstr):
    h = hexstr.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)])


def to_lin(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def _hash(ix, iy, iz, seed):
    h = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 144665) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffffff) / float(0xffffff)


def vnoise(P, freq, seed=0):
    """Smooth value noise in 0..1 at 3D points P (n,3)."""
    q = P * freq
    i = np.floor(q).astype(np.int64); f = q - i
    u = f * f * (3 - 2 * f)
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (u[:, 0] if dx else 1 - u[:, 0]) * (u[:, 1] if dy else 1 - u[:, 1]) * (u[:, 2] if dz else 1 - u[:, 2])
                out = out + w * _hash(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz, seed)
    return out


def fbm(P, freq, octaves=3, seed=0):
    a = 0.0; amp = 1.0; tot = 0.0
    for o in range(octaves):
        a = a + amp * vnoise(P, freq * 2 ** o, seed + o * 17); tot += amp; amp *= 0.5
    return a / tot


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def synthesize(region, P, N, ao, cur, look, extra=None, seed=7403):
    """Per-texel maps. region (n,) ids, P positions, N high-poly normals, ao 0..1, cur signed curvature (1/unit).
    look: palette dict. extra: optional dict with 'wheel' -> (centre xy, radius) per texel arrays, 'glowColor' (n,3) linear.
    Returns base (n,3 linear), orm (n,3), mask (n,3)."""
    n = len(region)
    base = np.zeros((n, 3)); orm = np.zeros((n, 3)); mask = np.zeros((n, 3))
    L = look
    wear_k = L.get('wear', 1.0)
    big = fbm(P, 2.2, 3, seed)               # panel-scale patchiness
    fine = fbm(P, 26.0, 3, seed + 5)         # paint grain
    micro = vnoise(P, 140.0, seed + 9)
    up = np.clip(N[:, 1], 0, 1); side = 1 - np.abs(N[:, 1])
    crev = 1 - ao                                                    # 0 open .. 1 buried
    # edge wear: convex curvature broken up by noise; cavities gather dirt
    edge = smooth(L.get('edgeStart', 40.0), L.get('edgeFull', 130.0), cur) * smooth(0.5, 0.85, 0.5 * fine + 0.5 * vnoise(P, 60.0, seed + 3) + 0.2 * (wear_k - 1))
    groove = smooth(8.0, 40.0, -cur)
    scratch = smooth(0.965, 0.99, vnoise(P * [1, 6, 1], 55.0, seed + 21)) * smooth(0.5, 0.8, big) * 0.6 * wear_k
    dust = up * smooth(0.35, 0.8, fbm(P, 5.0, 2, seed + 31)) * L.get('dust', 0.35)
    streak = side * smooth(0.55, 0.9, vnoise(P * [14, 1.2, 14], 1.0, seed + 41)) * smooth(0.2, 0.9, 1 - (P[:, 1] - P[:, 1].min()) / max(P[:, 1].max() - P[:, 1].min(), 1e-6)) * 0.35
    dirt = np.clip(0.75 * smooth(0.25, 0.85, crev) + 0.5 * groove + streak, 0, 1) * L.get('dirt', 1.0)
    steel = to_lin(srgb(L.get('bare', '#9aa0a6')))
    dustc = to_lin(srgb(L.get('dustColor', '#8f8a80')))
    dirtc = to_lin(srgb(L.get('dirtColor', '#1b1a18')))

    def fixed(sel, color, rough, metal, wear=1.0, dirt_k=1.0, bare=None):
        c = to_lin(srgb(color)) if isinstance(color, str) else color
        col = c * (0.86 + 0.28 * big[sel, None]) * (0.95 + 0.1 * micro[sel, None])
        e = np.clip(edge[sel] * wear + scratch[sel] * wear, 0, 1)[:, None]
        hi = to_lin(srgb(bare)) if bare else np.maximum(steel, c * 1.6)
        col = col * (1 - e) + hi * e * 0.9 + col * e * 0.1
        d = (dirt[sel] * dirt_k)[:, None]
        col = col * (1 - 0.75 * d) + dirtc * 0.75 * d
        du = (dust[sel] * dirt_k)[:, None]
        col = col * (1 - du) + dustc * du
        base[sel] = col
        r = rough + 0.18 * (fine[sel] - 0.5) + 0.25 * d[:, 0] + 0.2 * du[:, 0] - 0.2 * e[:, 0]
        orm[sel, 1] = np.clip(r, 0.12, 1); orm[sel, 2] = np.clip(metal * (1 - 0.6 * d[:, 0]) * (1 - 0.8 * du[:, 0]) + (1 - metal) * e[:, 0] * 0.9, 0, 1)

    # ---- paint regions: the factory colours with wear, chips punched to bare metal. The shader re-tints these texels by
    # (pilot paint / factory paint), so stock paint shows exactly this map and a boundary texel never flashes neutral grey.
    pa = to_lin(srgb(L.get('paintA', '#808890'))); pb = to_lin(srgb(L.get('paintB', L.get('paintA', '#808890'))))
    for name, tone in (('armor', 0.0), ('armor2', 1.0)):
        sel = region == RID[name]
        if not sel.any():
            continue
        t = np.full(sel.sum(), tone)
        if name == 'armor' and L.get('camo'):   # two-tone camouflage blobs on the primary armour
            blob = fbm(P[sel] * [1.0, 1.6, 1.0], L.get('camoScale', 1.7), 2, seed + 77)
            t = smooth(0.5 - 0.02, 0.5 + 0.02, blob + (L['camo'] - 0.5))
        chip = np.clip(edge[sel] * 1.0 + scratch[sel], 0, 1) * L.get('chips', 1.0)
        chip = smooth(0.35, 0.7, chip)
        lum = (1.0 + 0.27 * (big[sel] - 0.5) + 0.08 * (fine[sel] - 0.5)) * (1 - 0.55 * dirt[sel])
        col = (pa * (1 - t[:, None]) + pb * t[:, None]) * lum[:, None]
        col = col * (1 - 0.5 * dust[sel, None]) + dustc * 0.5 * dust[sel, None]
        col = col * (1 - chip[:, None]) + steel * (0.45 + 0.25 * fine[sel, None]) * chip[:, None]
        base[sel] = col
        mask[sel, 0] = 1 - chip
        mask[sel, 2] = t
        orm[sel, 1] = np.clip(L.get('paintRough', 0.56) + 0.16 * (fine[sel] - 0.5) + 0.25 * dirt[sel] + 0.25 * dust[sel] - 0.1 * chip, 0.15, 1)
        orm[sel, 2] = np.clip(chip * 0.8, 0, 1)
    # ---- reference lines (Session 5E-2a): trim and energy lines traced on the armour from the model's own geometry, so the
    # stock look carries the chosen reference's gold edges / glowing panel seams. Each rule: at 'edge' (convex creases) or
    # 'groove' (panel seams); kind 'trim' (fixed metal, never paint-tinted) or 'glow' (emissive in mask.g; the game lights it
    # faintly on stock and paints, fully on Lunar Skin). Crisp threshold, no wear noise: a line is either there or not.
    for rule in L.get('lines', []):
        sel = np.flatnonzero(np.isin(region, [RID['armor'], RID['armor2']]))
        if not len(sel):
            continue
        v = cur[sel] if rule.get('at', 'edge') == 'edge' else -cur[sel]
        on = smooth(rule.get('k0', 90.0), rule.get('k1', 160.0), v) > 0.5
        if 'yMin' in rule:
            on &= P[sel, 1] >= rule['yMin']
        if 'yMax' in rule:
            on &= P[sel, 1] <= rule['yMax']
        if rule.get('ringClear'):   # keep the turret seat clean (the weapon's base sits there)
            on &= np.hypot(P[sel, 0], P[sel, 2]) >= rule['ringClear']
        if rule.get('up') is not None:   # only faces looking up at least this much (deck lines, not the belly)
            on &= N[sel, 1] >= rule['up']
        idx = sel[on]
        if not len(idx):
            continue
        if rule.get('kind', 'trim') == 'glow':
            c = to_lin(srgb(rule.get('color', L.get('glow', '#ffffff'))))
            base[idx] = c * (0.85 + 0.15 * smooth(0.0, 0.6, ao[idx]))[:, None]
            mask[idx, 0] = 0; mask[idx, 1] = rule.get('glow', 1.0); mask[idx, 2] = 0
            orm[idx, 1] = 0.35; orm[idx, 2] = 0.0
        else:
            c = to_lin(srgb(rule.get('color', L.get('gold', '#c9a04a'))))
            base[idx] = c * (0.9 + 0.2 * big[idx, None]) * (1 - 0.35 * dirt[idx, None])
            mask[idx, 0] = 0; mask[idx, 1] = 0; mask[idx, 2] = 0
            orm[idx, 1] = np.clip(rule.get('rough', 0.3) + 0.15 * dirt[idx], 0.12, 1); orm[idx, 2] = 1.0
    fixed(region == RID['trim'], L.get('trim', '#7b838b'), L.get('trimRough', 0.42), 1.0)
    fixed(region == RID['steel'], L.get('steel', '#8c949c'), 0.4, 1.0)
    fixed(region == RID['gold'], L.get('gold', '#c9a04a'), 0.32, 1.0, wear=0.5, dirt_k=0.6)
    fixed(region == RID['dark'], L.get('dark', '#1a1c20'), 0.75, 0.3, wear=0.4)
    fixed(region == RID['rubber'], L.get('rubber', '#1d1e20'), 0.9, 0.0, wear=0.1)
    fixed(region == RID['glass'], L.get('glass', '#10202c'), 0.08, 0.6, wear=0.0, dirt_k=0.3)
    # ---- tracks: dark worn steel, dust packed into the links, polished high spots
    sel = region == RID['track']
    if sel.any():
        fixed(sel, L.get('track', '#34373c'), 0.62, 0.7, wear=0.9, dirt_k=0.7, bare=L.get('trackBare', '#5e6166'))
        pack = smooth(0.35, 0.85, crev[sel])[:, None] * 0.4
        base[sel] = base[sel] * (1 - pack) + dustc * 0.7 * pack
        orm[sel, 1] = np.clip(orm[sel, 1] + 0.25 * pack[:, 0], 0, 1); orm[sel, 2] *= (1 - pack[:, 0])
    # ---- wheels: painted discs with a dark tyre band; hubs keep paint
    sel = region == RID['wheel']
    if sel.any():
        rho = extra['wheelRho'][sel] if extra and 'wheelRho' in extra else np.zeros(sel.sum())
        tyre = smooth(L.get('tyreFrom', 0.84), L.get('tyreFrom', 0.84) + 0.03, rho)
        chip = smooth(0.45, 0.8, np.clip(edge[sel] * 0.7 + scratch[sel], 0, 1))
        lum = (0.84 + 0.2 * (big[sel] - 0.5)) * (1 - 0.6 * dirt[sel])
        col = pa * lum[:, None] * (1 - chip[:, None]) + steel * 0.6 * chip[:, None]
        rub = to_lin(srgb(L.get('rubber', '#1d1e20'))) * (0.8 + 0.4 * fine[sel, None])
        base[sel] = col * (1 - tyre[:, None]) + rub * tyre[:, None]
        mask[sel, 0] = (1 - chip) * (1 - tyre)
        orm[sel, 1] = np.clip(0.6 + 0.3 * tyre + 0.2 * dirt[sel] - 0.2 * chip, 0.15, 1)
        orm[sel, 2] = chip * (1 - tyre)
    # ---- hazard stripes (yellow / black diagonal), chipped
    sel = region == RID['hazard']
    if sel.any():
        s = np.sin((P[sel, 2] + P[sel, 1] * 0.9) * L.get('hazardFreq', 52.0))
        yel = smooth(-0.08, 0.08, s)[:, None]
        col = to_lin(srgb('#d9a514')) * yel + to_lin(srgb('#141414')) * (1 - yel)
        base[sel] = col
        fixed_sel = sel.copy()
        e = np.clip(edge[sel] + scratch[sel] * 1.5, 0, 1)[:, None]; d = dirt[sel][:, None]
        base[sel] = (col * (1 - e) + steel * e) * (1 - 0.6 * d) + dirtc * 0.6 * d
        orm[sel, 1] = np.clip(0.55 + 0.2 * d[:, 0] - 0.2 * e[:, 0], 0.15, 1); orm[sel, 2] = e[:, 0] * 0.9
    # ---- textured sources: the Meshy texture as it is
    sel = region == RID['keep']
    if sel.any() and extra and 'keepBase' in extra:
        base[sel] = extra['keepBase'][sel]
        orm[sel, 1] = np.clip(extra['keepMR'][sel, 0], 0.04, 1); orm[sel, 2] = np.clip(extra['keepMR'][sel, 1], 0, 1)
    # ---- emissive regions: colour lives in base, strength in mask.g
    for name, g, k in (('glow', 1.0, 1.0), ('lamp', 0.55, 1.0)):
        sel = region == RID[name]
        if not sel.any():
            continue
        c = extra['glowColor'][sel] if extra and 'glowColor' in extra else np.tile(to_lin(srgb(L.get('glow', '#ffffff'))), (sel.sum(), 1))
        core = 0.75 + 0.25 * smooth(0.0, 0.6, ao[sel])           # recessed parts of a channel burn a little deeper
        base[sel] = c * core[:, None]
        mask[sel, 1] = g
        orm[sel, 1] = 0.35; orm[sel, 2] = 0.0
    orm[:, 0] = ao
    return base, orm, mask
