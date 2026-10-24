# The cuts: main trailer (~43 s), a 15 s cut, Telegram preview clips and a thumbnail.
import os, math
import edit as E
from edit import Seg, Txt, GOLD, WHITE, MOON, ramp, lin, boom_shake, FPS

# where each super lands in its raw shot (src frame at 90 fps) - tuned from the contact sheets
HIT={'sup_moon':84,'sup_siege':132,'sup_nova':58}
PRE={'sup_siege':62}
def sup_map(shot,dur,lead=0.55,slow_from=None):
    h=HIT[shot];a=max(0,h-PRE.get(shot,48))
    # fast through the charge, 3x slow motion from just before the hit, then ease back toward real time
    return ramp([(0,a),(lead,h-6),(lead+1.05,h+26),(dur,h+26+(dur-lead-1.05)*60)])
def hit_t(lead=0.55):return lead+6/30   # output time of the hit inside a super segment (6 src frames at 1x = 0.2 s)

def menu_seg(dur,menu,txts,bg='lore_wide',bg0=20,cues=(),flash_in=0.0,card_y=1110):
    return Seg(dur,menu=menu,menu_map=lambda t:min(t*30,999),bg=(bg,lambda t,b=bg0:b+t*30),texts=txts,cues=cues,flash_in=flash_in,card_y=card_y)
BAND=lambda b,t:E.band(b,1500,1920)
def hl(txt,y=200,sz=104,fill=GOLD,t0=0.05,**kw):return Txt(txt,sz,y,t0,fill=fill,stroke=3,**kw)
def sub(txt,y=320,sz=50,fill=WHITE,t0=0.25,**kw):return Txt(txt,sz,y,t0,fill=fill,bold=False,kind='slide',stroke=2,**kw)

def SUPER(shot,dur,name,tag='SUPER',lead=0.55,low=False):
    ht=hit_t(lead);y1,y2=(1640,1760) if low else (250,370)
    def ex(b,t,ht=ht):
        if low:E.band(b,1480,1920)
        if t>=ht:E.flash(b,0.65*max(0,1-(t-ht)/0.18))
    return Seg(dur,shot,sup_map(shot,dur,lead),zoom=lambda t:1.0+0.06*max(0,min(1,(t-ht)/0.6)),shake=boom_shake(ht,36,4.5),
        texts=[Txt(tag,46,y1,0.02,fill=MOON,bold=False,track=12,kind='fade'),Txt(name,128,y2,ht-0.05,fill=GOLD,stroke=4,track=4)],
        cues=[(ht,'boom')],extra=ex)

def MODE(shot,dur,name,sub_=None,s0=0):
    return Seg(dur,shot,lin(s0,30),zoom=lambda t:1.03+0.03*t/dur,texts=[Txt(name,96,1720,0.0,fill=WHITE,stroke=4,kind='slide')]+([Txt(sub_,42,1810,0.1,fill=MOON,bold=False,kind='slide',stroke=2)] if sub_ else []),
        cues=[(0,'tick')],flash_in=0.08,extra=BAND)

def LORE(shot,dur,lines,s0=0,riser_end=None):
    tx=[Txt(l,62,1745+i*84,0.15+i*0.9,fill=WHITE,bold=False,kind='type') for i,l in enumerate(lines)]
    return Seg(dur,shot,lin(s0,30,0.8),zoom=lambda t:1.0+0.05*t/dur,letter=True,dim=0.25,texts=tx,fade_in=0.3)

def TITLE(dur,shot='title_bg'):
    return Seg(dur,shot,lin(10,30,0.6),zoom=lambda t:1.12-0.06*t/dur,dim=0.45,shake=boom_shake(0,40,4),flash_in=0.35,
        extra=E.title_extra,texts=[Txt('LUNAR',200,1040,0.0,fill=GOLD,stroke=5,track=12),Txt('WAR MACHINES',96,1200,0.12,fill=WHITE,stroke=4,track=16)],cues=[(0,'slam')])

def END(dur):return Seg(dur,card=E.end_card,cues=[(0,'slam')])

def main_cut():
    S=[]
    S.append(LORE('lore_wide',2.5,['earth fell to the parasites.']))
    S.append(Seg(2.5,'hero_tide',lin(0,30,0.8),zoom=lambda t:1.0+0.04*t/2.5,letter=True,dim=0.2,
        texts=[Txt('pilots hold the line past the moon.',58,1745,0.15,fill=WHITE,bold=False,kind='type')],cues=[(2.5,'riser')]))
    S.append(TITLE(2.1))
    S.append(menu_seg(2.5,'vs_live',[hl('REAL-TIME PVP',190),sub('live pilots. right inside telegram.',300)],cues=[(0,'whoosh')],flash_in=0.1))
    S.append(SUPER('sup_moon',2.5,'MOONFALL','SUPERS'))
    S.append(SUPER('sup_siege',2.0,'SIEGE BLAST','SUPERS',lead=0.5,low=True))
    S.append(SUPER('sup_nova',2.0,'STATIC NOVA','SUPERS',lead=0.35))
    S.append(Seg(0.9,card=lambda t:E.starfield(t),texts=[Txt('5 MODES',150,900,0.0,fill=GOLD,stroke=4,track=8),Txt('1v1  ·  2v2  ·  3v3  ·  free for all',46,1060,0.12,fill=WHITE,bold=False,kind='fade')],cues=[(0,'whoosh')]))
    S.append(MODE('mode_arena',1.25,'ARENA','last team standing'))
    S.append(MODE('mode_zone',1.25,'MOON ZONE','hold the zone'))
    S.append(MODE('mode_crystal',1.25,'CRYSTAL RUSH','grab 10. hold them.'))
    S.append(MODE('mode_bounty',1.25,'BOUNTY','hunt the biggest bounty'))
    S.append(MODE('mode_royale',1.6,'LAST STANDING','6 tanks. the ring closes.'))
    S.append(Seg(2.4,'counter',lin(0,30),zoom=lambda t:1.0,texts=[hl('EVERY TANK HAS A COUNTER',1560,74),
        Txt('SCOUT > TITAN > VANGUARD > SCOUT',52,1680,0.35,fill=WHITE,kind='slide',stroke=3)],cues=[(0,'whoosh')],extra=BAND))
    S.append(menu_seg(2.4,'gear_pick',[hl('GEAR UP',190),sub('common · rare · epic · legendary',300)],bg='mode_arena',cues=[(0,'whoosh')]))
    S.append(Seg(2.4,'hero_tide',lin(26,30,0.8),zoom=lambda t:1.08+0.05*t/2.4,
        texts=[Txt('LEGENDARY',46,250,0.02,fill=MOON,bold=False,track=12,kind='fade'),Txt('THE TIDE ENGINE',112,370,0.08,fill=GOLD,stroke=4)],cues=[(0,'tick')],flash_in=0.12))
    S.append(menu_seg(2.4,'vault',[hl('HYPERSPACE GOLD',190,96),sub("it's not jewelry. it's the door.",300)],bg='title_bg',cues=[(0,'whoosh')]))
    S.append(Seg(2.6,'mode_royale',lin(20,30,0.7),zoom=lambda t:1.05,dim=0.55,
        texts=[Txt('TOP 1,000 PILOTS',112,820,0.0,fill=WHITE,stroke=4),Txt('GET $LUNAR',150,980,0.25,fill=GOLD,stroke=5,track=6),
               Txt('climb the leaderboard',50,1130,0.5,fill=MOON,bold=False,kind='fade',stroke=2)],cues=[(0,'tick'),(0.25,'tick')]))
    S.append(menu_seg(2.5,'pass',[hl('LUNAR PASS',180),sub('season 1 · the clock starts nov 1',285,46),
        Txt('8 BONUS TIERS FOR EARLY PILOTS',50,370,0.5,fill=GOLD,stroke=2,kind='slide')],bg='mode_bounty',cues=[(0,'whoosh')],card_y=1175))
    S.append(LORE('lore_wide',2.6,['the lunar border holds.','because we hold it.'],s0=40))
    S.append(END(3.8))
    def sections(dur):
        t=0;b=[]
        marks=[sum(s.dur for s in S[:i]) for i in range(len(S)+1)]
        drums=marks[3];modes=marks[7];brk=marks[19];end=marks[20]
        return [(0,drums,{'drone'}),(drums,modes,{'pad','bass','kick','clap','hats'}),(modes,brk,{'pad','bass','kick','clap','hats','arp'}),
                (brk,end,{'drone','pad'}),(end,dur+2,{'pad'})]
    rise=sum(s.dur for s in S[:20])
    return S,sections,[(rise,'riser')]

def short_cut():
    S=[TITLE(1.5),
       SUPER('sup_moon',1.9,'MOONFALL','SUPERS',lead=0.4),
       SUPER('sup_siege',1.6,'SIEGE BLAST','SUPERS',lead=0.4,low=True),
       MODE('mode_crystal',0.7,'CRYSTAL RUSH'),MODE('mode_bounty',0.7,'BOUNTY'),MODE('mode_royale',0.8,'LAST STANDING'),
       menu_seg(1.9,'vs_live',[hl('REAL-TIME PVP',190),sub('right inside telegram.',300)],cues=[(0,'whoosh')],flash_in=0.1),
       Seg(1.8,'mode_arena',lin(10,30,0.7),zoom=lambda t:1.05,dim=0.55,texts=[Txt('TOP 1,000 PILOTS',112,840,0.0,fill=WHITE,stroke=4),Txt('GET $LUNAR',150,1000,0.2,fill=GOLD,stroke=5,track=6)],cues=[(0,'tick')]),
       menu_seg(1.6,'pass',[hl('SEASON 1',190),sub('8 bonus tiers for early pilots',300)],bg='mode_bounty',cues=[(0,'whoosh')]),
       END(2.6)]
    def sections(dur):
        return [(0,1.5,{'pad','bass'}),(1.5,dur-2.6,{'pad','bass','kick','clap','hats','arp'}),(dur-2.6,dur+2,{'pad'})]
    return S,sections,[]

def previews():
    out={}
    out['preview1_supers']=([TITLE(1.4),SUPER('sup_moon',2.5,'MOONFALL','SUPERS'),SUPER('sup_siege',2.2,'SIEGE BLAST','SUPERS',lead=0.5,low=True),
        SUPER('sup_nova',2.1,'STATIC NOVA','SUPERS',lead=0.35),END(2.2)])
    out['preview2_modes']=([Seg(1.0,card=lambda t:E.starfield(t),texts=[Txt('5 MODES',150,900,0.0,fill=GOLD,stroke=4,track=8)],cues=[(0,'slam')]),
        MODE('mode_arena',1.6,'ARENA','last team standing'),MODE('mode_zone',1.6,'MOON ZONE','hold the zone'),MODE('mode_crystal',1.6,'CRYSTAL RUSH','grab 10. hold them.'),
        MODE('mode_bounty',1.6,'BOUNTY','hunt the biggest bounty'),MODE('mode_royale',2.0,'LAST STANDING','6 tanks. the ring closes.'),END(2.0)])
    out['preview3_gear']=([menu_seg(2.4,'gear_pick',[hl('GEAR UP',190),sub('common · rare · epic · legendary',300)],bg='mode_arena',cues=[(0,'slam')],flash_in=0.2),
        Seg(2.6,'hero_tide',lin(26,30,0.8),zoom=lambda t:1.08+0.05*t/2.6,texts=[Txt('LEGENDARY',46,250,0.02,fill=MOON,bold=False,track=12,kind='fade'),Txt('THE TIDE ENGINE',112,370,0.08,fill=GOLD,stroke=4)],cues=[(0,'tick')],flash_in=0.12),
        menu_seg(2.4,'vault',[hl('HYPERSPACE GOLD',190,96),sub("it's not jewelry. it's the door.",300)],bg='title_bg',cues=[(0,'whoosh')]),
        menu_seg(2.2,'paints',[hl('PAINT YOUR MACHINE',190,86)],bg='lore_wide',cues=[(0,'whoosh')]),END(2.0)])
    out['preview4_pvp']=([menu_seg(2.4,'vs_live',[hl('REAL-TIME PVP',190),sub('live pilots. right inside telegram.',300)],cues=[(0,'slam')],flash_in=0.2),
        Seg(2.6,'counter',lin(0,30),texts=[hl('EVERY TANK HAS A COUNTER',1560,74),Txt('SCOUT > TITAN > VANGUARD > SCOUT',52,1680,0.35,fill=WHITE,kind='slide',stroke=3)],cues=[(0,'whoosh')],extra=BAND),
        Seg(2.4,'mode_royale',lin(20,30,0.7),zoom=lambda t:1.05,dim=0.55,texts=[Txt('TOP 1,000 PILOTS',112,820,0.0,fill=WHITE,stroke=4),Txt('GET $LUNAR',150,980,0.25,fill=GOLD,stroke=5,track=6)],cues=[(0,'tick')]),
        menu_seg(2.4,'pass',[hl('LUNAR PASS',180),sub('season 1 · the clock starts nov 1',285,46),Txt('8 BONUS TIERS FOR EARLY PILOTS',50,370,0.5,fill=GOLD,stroke=2,kind='slide')],bg='mode_bounty',cues=[(0,'whoosh')],card_y=1175),
        END(2.2)])
    return out

def run(which,OUT):
    if 'main' in which:
        S,sec,cues=main_cut();E.render(S,'lunar_trailer',OUT,sec,cues)
    if 'short' in which:
        S,sec,cues=short_cut();E.render(S,'lunar_trailer_15s',OUT,sec,cues)
    if 'previews' in which:
        for k,S in previews().items():
            E.render(S,k,OUT,lambda d:[(0,d-2.0,{'pad','bass','kick','clap','hats','arp'}),(d-2.0,d+2,{'pad'})])
    if 'thumb' in which:
        thumb(OUT)

def thumb(OUT):
    from PIL import Image
    s=Seg(2.5,'sup_moon',sup_map('sup_moon',2.5),zoom=lambda t:1.05,dim=0.15);im=s.frame(hit_t()+0.3).convert('RGBA')
    E.band(im,1050,1920,0.85)
    ov=Image.new('RGBA',im.size,(0,0,0,0));E.Txt('LUNAR',200,1250,0,fill=GOLD,stroke=5,track=12).draw(ov,1,9)
    E.Txt('WAR MACHINES',96,1410,0,fill=WHITE,stroke=4,track=16).draw(ov,1,9)
    E.Txt('top 1,000 pilots get $LUNAR',56,1560,0,fill=MOON,bold=False,stroke=2,kind='fade').draw(ov,1,9)
    im=Image.alpha_composite(im,ov);im.convert('RGB').save(os.path.join(OUT,'lunar_thumbnail.jpg'),quality=94)
    print('thumb ok')
