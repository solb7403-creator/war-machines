"""Refresh the LIGHT/FULL triangle and size columns of docs/art/meshy-proof/MANIFEST.md from js/assets/meshy-v1/manifest.json
(names, sources and notes stay as written). usage: python dev/assets/meshy/proof/manifest_md.py"""
import json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[4]
M=json.load(open(ROOT/'js/assets/meshy-v1/manifest.json'))['items'];md=ROOT/'docs/art/meshy-proof/MANIFEST.md'
kb=lambda b:f'{b/1000:.0f} KB' if b<1e6 else f'{b/1e6:.2f} MB'
lines=md.read_text().split('\n');tl=tf=bl=bf=0
for i,l in enumerate(lines):
  m=re.match(r'\| (.+?) \| `([a-z0-9-]+)` \| (.+?) \| ([\d,]+) \| [\d,]+ \| [\d,]+ \| (.+?) \| .+? \| .+? \| (\d+) \|$',l)
  if not m or m.group(2) not in M:continue
  r=M[m.group(2)];L,F=r['light'],r['full'];tl+=L['tris'];tf+=F['tris'];bl+=L['bytes'];bf+=F['bytes']
  lines[i]=f"| {m.group(1)} | `{m.group(2)}` | {m.group(3)} | {m.group(4)} | {L['tris']:,} | {F['tris']:,} | {m.group(5)} | {kb(L['bytes'])} | {kb(F['bytes'])} | {len(r.get('parts',[])) or m.group(6)} |"
for i,l in enumerate(lines):
  if l.startswith('| **Total'):
    c=l.split('|');c[5]=f' **{tl:,}** ';c[6]=f' **{tf:,}** ';c[8]=f' **{bl/1e6:.1f} MB** ';c[9]=f' **{bf/1e6:.1f} MB** ';lines[i]='|'.join(c)
md.write_text('\n'.join(lines));print('MANIFEST.md refreshed: LIGHT',tl,'tris',round(bl/1e6,1),'MB; FULL',tf,'tris',round(bf/1e6,1),'MB')
