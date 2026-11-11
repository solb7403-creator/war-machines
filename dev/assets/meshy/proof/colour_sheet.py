"""Colour sheets: each chassis and weapon's v2 reference image (docs/art/references/tanks/v2/, the owner's actual Meshy source
images) next to its stock look in the real Garage, from the captures of proof/v2.mjs (phone 3x, FULL models).
usage: python dev/assets/meshy/proof/colour_sheet.py <v2 capture dir with phone3x_garage_*.png> <out dir>
Writes colour_check_chassis_v2.webp and colour_check_weapons_v2.webp, and, when proof/v2_town.py close-ups (item_town-*.png) are
in the same dir, colour_check_town_v1.webp against docs/art/references/town-refs-v1/. The mapping image -> GLB is recorded in
docs/conquest/IMPLEMENTATION_CHECKPOINT.md (Checkpoint 32, owner correction)."""
import sys,pathlib
from PIL import Image,ImageDraw
ROOT=pathlib.Path(__file__).resolve().parents[4];REF=ROOT/'docs/art/references/tanks/v2'
cap,out=pathlib.Path(sys.argv[1]),pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
# loadout capture -> (v2 image, name); the ten proof loadouts cover all 9 chassis and all 10 weapons
CH=[('scout0-pulse0','b5ae93de','Scout'),('scout1-twin0','68556221','Strider'),('scout2-moon2','97e0789b','Phantom'),('vanguard0-pulse1','cc0abe1f','Vanguard'),('vanguard1-twin1','3dbcb303','Sentinel'),('vanguard2-siege0','ef23a11f','Paladin'),('titan0-siege1','c93ab27d','Titan'),('titan1-pulse2','72448d12','Bulwark'),('titan2-twin2','5081ec59','Colossus')]
WP=[('scout0-pulse0','2fae26ad','Pulse Cannon'),('vanguard0-pulse1','7e0a6b77','Arc Pulse'),('titan1-pulse2','bf00915f','Nova Pulse'),('scout1-twin0','a4207149','Twin Repeater'),('vanguard1-twin1','dbd6fceb','Storm Repeater'),('titan2-twin2','97c7a5ee','Helix Repeater'),('vanguard2-siege0','3c76abeb','Siege Breaker'),('titan0-siege1','6666703f','Rail Breaker'),('titan2-siege2','1c7f4122','Titanfall'),('scout2-moon2','moonbeam','Moonbeam')]
def sheet(rows,sub,cols,name):
  T=420;n=len(rows);o=Image.new('RGB',(T*2*cols,T*((n+cols-1)//cols)),(13,20,28));d=ImageDraw.Draw(o)
  for k,(g,r,label) in enumerate(rows):
    a=Image.open(REF/sub/(r+'.png')).convert('RGB');a.thumbnail((T,T));b=Image.open(cap/f'phone3x_garage_{g}.png').convert('RGB');s=min(T/b.width,T/b.height);b=b.resize((int(b.width*s),int(b.height*s)))
    x=(k%cols)*2*T;y=(k//cols)*T;o.paste(a,(x+(T-a.width)//2,y+(T-a.height)//2));o.paste(b,(x+T+(T-b.width)//2,y+(T-b.height)//2))
    d.text((x+6,y+6),f'{label}: v2 reference {r}',fill=(255,217,120));d.text((x+T+6,y+6),'stock in the Garage (phone 3x, FULL)',fill=(255,217,120))
  o.save(out/name,'WEBP',quality=86);print('wrote',out/name)
sheet(CH,'chassis',3,'colour_check_chassis_v2.webp');sheet(WP,'weapons',2,'colour_check_weapons_v2.webp')
TOWN=[('cc','2-command-center-ref','Command Center'),('reactor','9-reactor-ref','Reactor'),('refinery','10-refinery-ref','Refinery'),('storage','11-storage-depot-ref','Storage Depot'),('lab','12-science-lab-ref','Science Lab'),('shield','13-shield-generator-ref','Shield Generator'),
 ('cannon','3-cannon-turret-ref','Cannon'),('mg','4-twin-mg-ref','Twin MG'),('laser','5-laser-turret-ref','Laser'),('rocket','6-rocket-pod-ref','Rocket Pod'),('tesla','7-tesla-coil-ref','Tesla Coil'),('railgun','8-railgun-ref','Railgun')]
if all((cap/f'item_town-{t}.png').exists() for t,_,_ in TOWN):
  TREF=ROOT/'docs/art/references/town-refs-v1';T=420;cols=3;o=Image.new('RGB',(T*2*cols,T*4),(13,20,28));d=ImageDraw.Draw(o)
  for k,(t,r,label) in enumerate(TOWN):
    a=Image.open(TREF/(r+'.png')).convert('RGB');a.thumbnail((T,T));b=Image.open(cap/f'item_town-{t}.png').convert('RGB');s2=min(T/b.width,T/b.height);b=b.resize((int(b.width*s2),int(b.height*s2)))
    x=(k%cols)*2*T;y=(k//cols)*T;o.paste(a,(x+(T-a.width)//2,y+(T-a.height)//2));o.paste(b,(x+T+(T-b.width)//2,y+(T-b.height)//2))
    d.text((x+6,y+6),label+': town-refs-v1',fill=(255,217,120));d.text((x+T+6,y+6),'in the town (phone 3x, HIGH)',fill=(255,217,120))
  o.save(out/'colour_check_town_v1.webp','WEBP',quality=86);print('wrote',out/'colour_check_town_v1.webp')
