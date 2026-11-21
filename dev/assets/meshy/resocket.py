#!/usr/bin/env python3
"""Stamp the add-on anchors that are pure functions of an item's built meta into manifest.json (Session 5E-2d2).

The TURRET cheek anchors (plateSockets.turret on a chassis, cheeks on a weapon) depend only on numbers build.py already
measured (the ring, the socket height, the turret body's width), so they are added to the manifest without the source
models. The formulas are build.py's own (turret_plate_sockets, weapon_cheeks): the next real rebuild writes the same
anchors into the manifest and into each GLB's extras. The 38 built GLBs are NOT rewritten here: that would add about
75 MB of binary history for six numbers an item; the game reads the manifest before any model, so the anchors are
available from it (Meshy3D's manifest record: items[id].meta).
usage: python3 dev/assets/meshy/resocket.py [--check]"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '../../../js/assets/meshy-v1'))


def turret_plate_sockets(cx, cz, ty, rr):
    return dict(pivot=[float(cx), float(ty), float(cz)], left=[float(cx + 0.30 * rr), float(ty + 0.40 * rr), float(cz - (rr + 0.045))],
                right=[float(cx + 0.30 * rr), float(ty + 0.40 * rr), float(cz + (rr + 0.045))])


def weapon_cheeks(tip, y, width):
    return [[float(0.2 * tip), float(y), float(-(width + 0.03))], [float(0.2 * tip), float(y), float(width + 0.03)]]


def stamp(kind, meta):
    """Returns True when the meta changed."""
    before = json.dumps(meta, sort_keys=True)
    if kind == 'chassis':
        off = meta.get('ringOffset') or [0, 0]
        meta['plateSockets']['turret'] = turret_plate_sockets(off[0], off[1], meta['ty'], meta['ringRadius'])
    elif kind in ('weapon', 'moon'):
        v = meta['visual']; meta['cheeks'] = weapon_cheeks(v['tip'], v['y'], v['width'])
    return json.dumps(meta, sort_keys=True) != before


def main():
    check = '--check' in sys.argv; mpath = os.path.join(OUT, 'manifest.json'); man = json.load(open(mpath)); changed = 0
    for iid, rec in sorted(man['items'].items()):
        if rec['kind'] not in ('chassis', 'weapon', 'moon'):
            continue
        if stamp(rec['kind'], rec['meta']):
            changed += 1
    if check:
        print('resocket --check:', 'up to date' if not changed else f'{changed} records need stamping'); sys.exit(1 if changed else 0)
    json.dump(man, open(mpath, 'w'), indent=1, sort_keys=True); print(f'resocket: {changed} records stamped')


if __name__ == '__main__':
    main()
