"""Session 5E-2b2b: review sheets from the frames dev/tests/super-vfx-capture.py saved (it must have run first, both views).
For each device (phone 390x844 at 3x, desktop 1920x1080), under the chase camera:
  family-<pulse|twin|siege>-<view>.webp   common / rare / epic (rows) x miss / normal / jackpot (columns), the blast frame
  moonfall-<view>.webp                    the legendary: miss / normal / jackpot, and its jackpot from charge to aftermath
  ladder-<view>.webp                      the rarity ladder at a NORMAL stop (common, rare, epic per family; Moonfall), and the
                                          owner's test: a PERFECT common beside a MISSED rare, a PERFECT rare beside a MISSED epic
  sequence-<view>.webp                    every super's jackpot: charge, bar stopped, blast, +0.2 s, +0.5 s, aftermath
  all-supers-<view>-<tag>.webp            with --overview only (and nothing else): all ten supers (rows) x miss / normal / jackpot,
                                          one sheet: for a LOW (--tag low) or Reduce Motion (--tag high-reduced) capture
usage: python3 dev/tests/super-sheets.py <capture dir> <out dir> [--tag high] [--boxes <report.json of another capture>] [--overview]
"""
import json, os, sys, pathlib
from PIL import Image, ImageDraw, ImageFont
SRC=pathlib.Path(sys.argv[1]);OUT=pathlib.Path(sys.argv[2]);OUT.mkdir(parents=True,exist_ok=True)
TAG=sys.argv[sys.argv.index('--tag')+1] if '--tag' in sys.argv else 'high'
REP=json.load(open(SRC/'report.json'))
BOX=json.load(open(sys.argv[sys.argv.index('--boxes')+1])) if '--boxes' in sys.argv else REP   # crops from another capture of the same scenes (a capture made before the tool saved them)
NAMES={'pulse0':'Pierce Lance (common)','pulse1':'Arc Lance (rare)','pulse2':'Sunlance (epic)','twin0':'Static Nova (common)','twin1':'Storm Nova (rare)','twin2':'Helix Nova (epic)',
 'siege0':'Siege Blast (common)','siege1':'Rail Blast (rare)','siege2':'Titanfall (epic)','moon':'Moonfall (legendary)'}
OC=['miss','normal','jackpot'];BG=(8,10,16);FG=(223,231,242)
try:FONT=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',18)
except Exception:FONT=ImageFont.load_default()
def tile(view,key,oc,label,tw,th):
    d=SRC/(view+'-'+TAG);f=d/f'{key}-{OC[oc]}-{label}.png'
    if not f.exists():return Image.new('RGB',(tw,th),BG)
    im=Image.open(f).convert('RGB').crop(tuple(BOX[view+'-'+TAG]['supers'][key+'-'+OC[oc]]['box']))
    im.thumbnail((tw,th),Image.LANCZOS);c=Image.new('RGB',(tw,th),BG);c.paste(im,((tw-im.width)//2,(th-im.height)//2));return c
def grid(cells,tw,th,path,head=None):
    # cells: rows of (image, caption)
    lab=26;rows=len(cells);cols=max(len(r) for r in cells);hh=30 if head else 0
    sh=Image.new('RGB',(cols*tw,rows*(th+lab)+hh),BG);d=ImageDraw.Draw(sh)
    if head:d.text((8,5),head,fill=(255,207,74),font=FONT)
    for r,row in enumerate(cells):
        for c,(im,cap) in enumerate(row):
            sh.paste(im,(c*tw,hh+r*(th+lab)+lab));d.text((c*tw+8,hh+r*(th+lab)+3),cap,fill=FG,font=FONT)
    sh.save(path,quality=86);print(path,sh.size)
for view in ('phone','desktop'):
    if not (SRC/(view+'-'+TAG)).exists():continue
    if '--overview' in sys.argv:
        grid([[(tile(view,k,oc,'blast',300,345),(NAMES[k].split(' (')[0]+': ' if oc==0 else '')+OC[oc].upper()) for oc in range(3)] for k in NAMES],300,345,OUT/f'all-supers-{view}-{TAG}.webp','All ten supers, '+view+', '+TAG+': miss / normal / jackpot')
        continue
    tw,th=(430,494) if view=='phone' else (430,494)
    dev='phone 390x844 @3x' if view=='phone' else 'desktop 1920x1080'
    for fam in ('pulse','twin','siege'):
        grid([[(tile(view,fam+str(t),oc,'blast',tw,th),NAMES[fam+str(t)]+': '+OC[oc].upper()) for oc in range(3)] for t in range(3)],tw,th,OUT/f'family-{fam}-{view}.webp',fam.upper()+' family, '+dev+', chase camera: rows common / rare / epic, columns miss / normal / jackpot (the blast frame)')
    grid([[(tile(view,'moon',oc,'blast',tw,th),NAMES['moon']+': '+OC[oc].upper()) for oc in range(3)],
          [(tile(view,'moon',2,l,tw,th),'jackpot: '+l) for l in ('charge','after02','aftermath')]],tw,th,OUT/f'moonfall-{view}.webp','MOONFALL, '+dev+': miss thinner / normal + thin blue electricity / jackpot + RED electricity sparking off the beam')
    grid([[(tile(view,fam+str(t),1,'blast',tw,th),NAMES[fam+str(t)]+': NORMAL') for t in range(3)]+[(tile(view,'moon',1,'blast',tw,th),NAMES['moon']+': NORMAL') if fam=='pulse' else (Image.new('RGB',(tw,th),BG),'')] for fam in ('pulse','twin','siege')]
         +[[(tile(view,'pulse0',2,'blast',tw,th),'PERFECT common (Pierce Lance)'),(tile(view,'pulse1',0,'blast',tw,th),'MISSED rare (Arc Lance)'),(tile(view,'pulse1',2,'blast',tw,th),'PERFECT rare (Arc Lance)'),(tile(view,'pulse2',0,'blast',tw,th),'MISSED epic (Sunlance)')],
           [(tile(view,'twin0',2,'blast',tw,th),'PERFECT common (Static Nova)'),(tile(view,'twin1',0,'blast',tw,th),'MISSED rare (Storm Nova)'),(tile(view,'siege1',2,'blast',tw,th),'PERFECT rare (Rail Blast)'),(tile(view,'siege2',0,'blast',tw,th),'MISSED epic (Titanfall)')]],
         tw,th,OUT/f'ladder-{view}.webp','RARITY LADDER, '+dev+': rows 1-3 a NORMAL stop per rarity; rows 4-5 a perfect lower rarity beside a missed higher one')
    sw,shh=(322,370)
    grid([[(tile(view,k,2,l,sw,shh),(NAMES[k].split(' (')[0]+' ' if c==0 else '')+l) for c,l in enumerate(('charge','lock','blast','after02','after05','aftermath'))] for k in NAMES],sw,shh,OUT/f'sequence-{view}.webp','JACKPOT sequences, '+dev+': charge, bar stopped, blast, +0.2 s, +0.5 s, aftermath')
