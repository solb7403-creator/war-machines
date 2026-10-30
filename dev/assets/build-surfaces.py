"""Original deterministic tileable manufacturing surfaces. No third-party art. Pillow build-only.
Four 256px tiles in a 512 atlas: graphite / gold / steel / rubber. ORM = AO,Roughness,Metalness.
"""
from PIL import Image
import random,math,pathlib,json,hashlib
OUT=pathlib.Path(__file__).resolve().parents[2]/'js/assets/hf-v1';OUT.mkdir(parents=True,exist_ok=True)
N=512;T=N//2;rng=random.Random(7403)
base=Image.new('RGB',(N,N));normal=Image.new('RGB',(N,N));orm=Image.new('RGB',(N,N))
for y in range(N):
 for x in range(N):
  tile=x//T+2*(y//T);u=x%T;v=y%T;noise=rng.random();scratch=math.sin(v*.83)*.5+math.sin(v*2.7)*.2;edge=min(u,v,T-1-u,T-1-v)
  groove=abs((v%64)-32)<1.5 if tile!=3 else (u//24+v//48)%2==0
  n=(noise-.5)*(13 if tile==0 else 8);g=1 if groove else 0
  val=int(max(0,min(255,227+n+(scratch*8 if tile in [1,2] else 0)-g*(40 if tile!=3 else 18))))
  base.putpixel((x,y),(val,val,val))
  rough=[.61,.21,.29,.91][tile]+(noise-.5)*.11+g*.12
  orm.putpixel((x,y),(int(215 if groove else 255),int(min(1,rough)*255),[0,255,245,0][tile]))
  normal.putpixel((x,y),(int(128+(noise-.5)*8),int(128+(9*math.cos(v*.83) if tile in [1,2] else (18 if groove else 0))),252))
files=[]
for size,quality in [(512,'high'),(128,'low')]:
 for key,im in [('base',base),('normal',normal),('orm',orm)]:
  p=OUT/(key+'-'+quality+'.png');im.resize((size,size),Image.Resampling.LANCZOS).save(p,optimize=True);files.append({'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(OUT/'manifest.json').write_text(json.dumps({'version':'hf-v1.1','license':'Original procedural project artwork; no external assets','tiles':['graphite','gold','steel','rubber'],'files':files},indent=2)+'\n')
print('Generated surface atlas bytes',sum(f['bytes'] for f in files))
