"""Session 5C before/after pairs for the owner: 5B captures from git 929acfb (before) next to the current
docs/conquest/session5c captures (after) -> docs/conquest/session5c/before-after/*.png. Run from the repo root:
  python3 dev/tools/session5c-pairs.py"""
import io,os,subprocess
from PIL import Image,ImageDraw,ImageFont
D='docs/conquest/session5c';os.makedirs(D+'/before-after',exist_ok=True)
try:F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',20)
except Exception:F=ImageFont.load_default()
def old(path):return Image.open(io.BytesIO(subprocess.check_output(['git','show','929acfb:'+path]))).convert('RGB')
def pair(name,b,a):
    ims=[b,a];h=max(i.height for i in ims);ims=[i.resize((int(i.width*h/i.height),h)) for i in ims]
    W=sum(i.width for i in ims)+30;o=Image.new('RGB',(W,h+40),(5,8,14));x=10;d=ImageDraw.Draw(o)
    for lab,i in zip(('BEFORE · 5B','AFTER · 5C'),ims):o.paste(i,(x,36));d.text((x,8),lab,fill=(255,211,107) if 'AFTER' in lab else (160,180,200),font=F);x+=i.width+10
    o.save(f'{D}/before-after/{name}.png',optimize=True)
cur=lambda n:Image.open(f'{D}/{n}.png').convert('RGB')
pair('default-camera-cc10',old('docs/conquest/session5/cc10-town-390-high.png'),cur('default-camera-cc10-crater-390'))
pair('build-menu',old('docs/conquest/base-ui/build-menu-scrolled-390x700.png'),cur('tab-build-half-390x700'))
pair('walls-tab',old('docs/conquest/base-ui/wall-tools-390x700.png'),cur('tab-walls-half-390x700'))
pair('turrets-weapons-tab',old('docs/conquest/base-ui/turret-list-390x700.png'),cur('tab-weapons-half-390x700'))
pair('share-card',old('docs/conquest/session5/share-card.png'),cur('share-card-cc1'))
au=cur('before/audit-evidence');w=au.width//4;a1,a2=cur('pad-diorama-cc1-390'),cur('pad-diorama-cc10-390');h=max(a1.height,a2.height)
c=Image.new('RGB',(a1.width+a2.width+10,h),(5,8,14));c.paste(a1,(0,0));c.paste(a2,(a1.width+10,0))
pair('world-pad-cc1-vs-cc10',au.crop((0,0,2*w,au.height)),c)

pair('hub-hero',old('docs/conquest/session5/hub-390.png'),cur('hub-hero-town-cc10-390'))
h1,h2=cur('home-sector-drive-cc1-390'),cur('home-sector-drive-cc10-390');c2=Image.new('RGB',(h1.width+h2.width+10,max(h1.height,h2.height)),(5,8,14));c2.paste(h1,(0,0));c2.paste(h2,(h1.width+10,0))
pair('home-sector-drive-cc1-vs-cc10',old('docs/conquest/session5/cc10-town-390-high.png'),c2)
print(sorted(os.listdir(D+'/before-after')))
