"""Original deterministic manufacturing atlas, no third-party artwork.
Four reusable surfaces: graphite paint / brushed gold / machined steel / reinforced rubber.
RGB base is sRGB; normal and ORM (AO, roughness, metalness) are linear data.
"""
from PIL import Image,ImageDraw,ImageFilter
import random,math,pathlib,json,hashlib
OUT=pathlib.Path(__file__).resolve().parents[2]/'js/assets/hf-v1';OUT.mkdir(parents=True,exist_ok=True)
N=512;T=N//2;rng=random.Random(7403)
base=Image.new('RGB',(N,N));normal=Image.new('RGB',(N,N));orm=Image.new('RGB',(N,N))
for tile in range(4):
 # Original sparse manufacturing strokes, not a photograph or per-item duplicate texture.
 height=Image.new('L',(T,T),128);draw=ImageDraw.Draw(height)
 for i in range(95 if tile<3 else 30):
  x,y=rng.randrange(8,T-8),rng.randrange(8,T-8);length=rng.randrange(2,36)
  draw.line((x,y,min(T-2,x+length),y+rng.choice([-1,0,0,1])),fill=rng.choice([116,122,132,140]),width=1)
 if tile==3:
  for y in range(0,T,32):
   for x in range(-T,T*2,40):draw.line((x,y,x+20,y+25),fill=116,width=3)
 height=height.filter(ImageFilter.GaussianBlur(.45));pix=height.load()
 for y in range(T):
  for x in range(T):
   noise=(rng.randrange(5)-2)*.55;edge=min(x,y,T-1-x,T-1-y)
   brush=math.sin(y*.9)*1.7+math.sin(y*2.7)*.8 if tile in [1,2] else 0
   wear=max(0,1-edge/12)*9;h=pix[x,y]-128
   val=int(max(0,min(255,[220,232,228,205][tile]+noise+brush+wear+h*.5)))
   X=x+(tile%2)*T;Y=y+(tile//2)*T;base.putpixel((X,Y),(val,val,val))
   rough=[.56,.28,.37,.90][tile]+noise*.007-h*.002-wear*.004
   orm.putpixel((X,Y),(int(max(210,255-abs(h)*2)),int(max(.12,min(.98,rough))*255),[65,255,245,0][tile]))
   dx=pix[min(T-1,x+1),y]-pix[max(0,x-1),y];dy=pix[x,min(T-1,y+1)]-pix[x,max(0,y-1)]
   normal.putpixel((X,Y),(int(max(0,min(255,128-dx*1.8))),int(max(0,min(255,128-dy*1.8))),254))
files=[]
for size,quality in [(512,'high'),(128,'low')]:
 for key,im in [('base',base),('normal',normal),('orm',orm)]:
  p=OUT/(key+'-'+quality+'.png');im.resize((size,size),Image.Resampling.LANCZOS).save(p,optimize=True);files.append({'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(OUT/'manifest.json').write_text(json.dumps({'version':'hf-v2.0','license':'Original procedural project artwork; no external assets','tiles':['graphite','gold','steel','rubber'],'files':files},indent=2)+'\n')
print('Generated surface atlas bytes',sum(f['bytes'] for f in files))
