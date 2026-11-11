#!/usr/bin/env python3
"""Frame sequences of every kind of motion, rendered with the game's materials and motion shader (proof/view.mjs).
    python dev/assets/meshy/proof/motion.py <built-dir (js/assets/meshy-v1)> <out-dir>"""
import json
import math
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw

built, out = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
man = json.load(open(os.path.join(built, 'manifest.json')))['items']
ty = man['chassis-vanguard-0']['meta']['ty']
W, H = 520, 340
cam_t = {'yaw': 50, 'pitch': 20, 'dist': 6.6, 'target': [0.2, 0.6, 0]}
SEQ = [
    ('aim', 'Turret aims, base ring stays with the hull (Vanguard + Pulse Cannon, FULL)', [dict(parts=[{'id': 'chassis-vanguard-0', 'q': 'full'}, {'id': 'weapon-pulse-0', 'q': 'full', 'pos': [0, ty, 0], 'yaw': a, 'ch': {'aim': math.radians(a)}}], cam=cam_t) for a in (0, 35, 70, 105, 140)]),
    ('recoil', 'Twin Repeater: barrels recoil one after the other', [dict(parts=[{'id': 'weapon-twin-0', 'q': 'full', 'ch': c}], cam={'yaw': 60, 'pitch': 18, 'dist': 4.6, 'target': [0.6, 0.3, 0]}) for c in ({}, {'recoil0': 1}, {'recoil0': .4}, {'recoil1': 1}, {'recoil1': .4})]),
    ('helix', 'Helix Repeater: rotary clusters spin (opposite ways), coils glow', [dict(parts=[{'id': 'weapon-twin-2', 'q': 'full', 'ch': {'spin': s, 'fire': 1 if s else 0}}], cam={'yaw': 35, 'pitch': 16, 'dist': 4.4, 'target': [0.9, 0.35, 0]}) for s in (0, .35, .7, 1.05, 1.4)]),
    ('tracks', 'Vanguard: belt links travel the loop, road wheels turn', [dict(parts=[{'id': 'chassis-vanguard-0', 'q': 'full', 'ch': {'driveL': d, 'driveR': d}}], cam={'yaw': 78, 'pitch': 8, 'dist': 3.0, 'target': [0.5, 0.22, 0.5]}) for d in (0, .02, .04, .06, .08)]),
    ('flex', 'Colossus: the four track pods rock on their arms while it travels', [dict(parts=[{'id': 'chassis-titan-2', 'q': 'full', 'ch': {'flex': f, 'driveL': .1 * i, 'driveR': .1 * i}}], cam={'yaw': 80, 'pitch': 8, 'dist': 6.4, 'target': [0, 0.4, 0]}) for i, f in enumerate((0, 1, 0, -1, 0))]),
    ('charge', 'Rail Breaker: beam and capacitors pulse with the shot charge', [dict(parts=[{'id': 'weapon-siege-1', 'q': 'full', 'ch': {'charge': c}}], cam={'yaw': 55, 'pitch': 20, 'dist': 4.8, 'target': [0.6, 0.3, 0]}) for c in (0, .25, .5, .75, 1)]),
    ('moon', 'Moonbeam: red core crystal and blue charge crystals charge up', [dict(parts=[{'id': 'weapon-moon', 'q': 'full', 'ch': {'charge': c}}], cam={'yaw': 55, 'pitch': 22, 'dist': 5.4, 'target': [0.6, 0.3, 0]}) for c in (0, .25, .5, .75, 1)]),
    ('pulse', 'Phantom: thrusters and energy rails breathe (pulse channel)', [dict(parts=[{'id': 'chassis-scout-2', 'q': 'full', 'ch': {'pulse': p}}], cam={'yaw': 215, 'pitch': 20, 'dist': 5.2, 'target': [0, 0.3, 0]}) for p in (.2, .4, .6, .8, 1)]),
    ('townturret', 'Town cannon: head tracks, base stays, barrel recoils', [dict(parts=[{'id': 'town-cannon', 'q': 'light', 'yaw': a, 'ch': {'aim': math.radians(a), 'recoil0': r}}], cam={'yaw': 50, 'pitch': 24, 'dist': 13, 'target': [0, 1.0, 0]}) for a, r in ((0, 0), (40, 0), (80, 0), (80, 1), (120, 0))]),
    ('towndish', 'Command Center: dish turns, beacon blinks', [dict(parts=[{'id': 'town-cc', 'q': 'light', 'ch': {'time': t, 'pulse': p}}], cam={'yaw': 50, 'pitch': 26, 'dist': 52, 'target': [0, 6, 0]}) for t, p in ((0, .2), (1.2, 1), (2.4, .2), (3.6, 1), (4.8, .2))]),
]
shots = []
for name, _, frames in SEQ:
    for i, f in enumerate(frames):
        shots.append(dict(name=f'{name}_{i}', w=W, h=H, **f))
tmp = tempfile.mkdtemp()
sp = os.path.join(tmp, 'shots.json'); json.dump(shots, open(sp, 'w'))
subprocess.run(['node', os.path.join(here, 'view.mjs'), built, tmp, sp], check=True, stdout=subprocess.DEVNULL)
os.makedirs(out, exist_ok=True)
for name, title, frames in SEQ:
    S = Image.new('RGB', (W * len(frames), H + 20), (10, 14, 20)); ImageDraw.Draw(S).text((6, 3), title, fill=(255, 217, 120))
    for i in range(len(frames)):
        S.paste(Image.open(os.path.join(tmp, f'{name}_{i}.png')).convert('RGB'), (i * W, 20))
    S.save(os.path.join(out, f'{name}.webp'), quality=84, method=6)
print('sequences', len(SEQ))
