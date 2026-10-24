# Scripted shots for the trailer. JS runs in the game page with the director (director.js) loaded.
# setup: build the match; warm: seconds simulated without drawing; each: JS before every frame; events: {frame: JS}
# dt: sim seconds per captured frame (1/30 = real time at 30 fps; 1/90 = 3x slow motion)

# hold a unit still (staged target), no dodges or shields
HOLD="u.spdM=0.0;u.dashCd=99;u.shieldCd=99;"
def hold(expr): return "{const u="+expr+";if(u){"+HOLD+"}}"
# smooth camera follow: eases toward a target point and zoom
FOLLOW="""DIR.camf=()=>{const c=DIR.cam,t=DIR.tgt();const k=DIR.ease||0.12;c.x+=(t.x-c.x)*k;c.y+=(t.y-c.y)*k;c.z+=(t.z-c.z)*(DIR.zk||0.06);};"""

# keeps your tank in the fight through warm-ups (cinematic, not balance)
NOBOX="DIR.nonum=true;DIR.pre=()=>{boxes.length=0;};"
LIVE="DIR.pre=()=>{if(me&&me.hp>0&&me.hp<me.mhp*0.55)me.hp=me.mhp*0.55;};"
LIVENB="DIR.nonum=true;DIR.pre=()=>{boxes.length=0;if(me&&me.hp>0&&me.hp<me.mhp*0.55)me.hp=me.mhp*0.55;};"
LD="{w:'siege',wt:2,c:'titan',ct:2,paint:'gold',vg:9000}"

BATTLE={
 # ---- supers (slow motion) ----
 'sup_moon':dict(dt=1/90,frames=240,setup="""
   DIR.load({w:'moon',c:'vanguard',ct:2,paint:'hyper',skin:1,vg:60000});DIR.match('arena','2v2','craters');DIR.hud=false;
   DIR.place(me,10,22,-Math.PI/2);const f=DIR.foes()[0];DIR.place(f,10.5,11.5,Math.PI/2);DIR.place(DIR.foes()[1],17,3);
   for(const u of units)if(u.team===me.team&&u!==me)DIR.place(u,3,30);"""+hold("DIR.foes()[0]")+"""
   DIR.cam={x:10,y:19.5,z:3.0};DIR.tgt=()=>({x:10,y:16.5,z:2.1});DIR.ease=0.035;DIR.zk=0.025;"""+FOLLOW+NOBOX,
   warm=0.4,events={10:"DIR.ai=false;DIR.fire(me);",60:"const f=DIR.foes()[0];if(f)f.hp=Math.min(f.hp,300);"}),
 'sup_siege':dict(dt=1/90,frames=230,setup="""
   DIR.load({w:'siege',wt:2,c:'titan',ct:2,paint:'gold',vg:8000});DIR.match('arena','3v3','craters');DIR.hud=false;
   DIR.place(me,7.7,24,-Math.PI/2);const fs=DIR.foes();DIR.place(fs[0],7.7,14.4);DIR.place(fs[1],6.7,13.6);DIR.place(fs[2],18,3);
   {let k=0;for(const u of units)if(u.team===me.team&&u!==me)DIR.place(u,k++?18:2,30);}
   for(const u of fs.slice(0,2)){"""+HOLD+"""}
   DIR.cam={x:7.7,y:21.5,z:2.6};DIR.tgt=()=>({x:7.7,y:19,z:2.1});DIR.ease=0.05;DIR.zk=0.03;"""+FOLLOW+NOBOX,
   warm=0.3,events={8:"DIR.ai=false;DIR.fire(me,DIR.foes()[0]);",40:"for(const f of DIR.foes().slice(0,2))f.hp=Math.min(f.hp,250);"}),
 'sup_nova':dict(dt=1/90,frames=200,setup="""
   DIR.load({w:'twin',wt:2,c:'scout',ct:2,paint:'nebula',vg:0});DIR.match('arena','3v3','longshot');DIR.hud=false;
   DIR.place(me,10,17,-Math.PI/2);const fs=DIR.foes();DIR.place(fs[0],10,13.6);DIR.place(fs[1],7.4,16.2);DIR.place(fs[2],18,3);{let k=0;for(const u of units)if(u.team===me.team&&u!==me)DIR.place(u,k++?18:2,30);}
   for(const u of fs){"""+HOLD+"""}
   DIR.cam={x:10,y:17,z:2.6};DIR.tgt=()=>({x:10,y:16.5,z:1.9});DIR.ease=0.05;DIR.zk=0.03;"""+FOLLOW+NOBOX,
   warm=0.3,events={8:"DIR.ai=false;DIR.fire(me,DIR.foes()[0]);",20:"for(const f of DIR.foes().slice(0,2))f.hp=Math.min(f.hp,250);"}),

 # ---- the five modes (real time, HUD on) ----
 'mode_arena':dict(frames=84,setup=LIVE+"DIR.load("+LD+");DIR.match('arena','3v3','overpass');",warm=9),
 'mode_zone':dict(frames=84,setup=LIVE+"DIR.load("+LD+");DIR.match('zone','3v3','classic');",warm=14),
 'mode_crystal':dict(frames=84,setup=LIVE+"DIR.load("+LD+");DIR.match('crystal','3v3','craters');",warm=38),
 'mode_bounty':dict(frames=84,setup=LIVE+"DIR.load("+LD+");DIR.match('bounty','3v3','longshot');",warm=22),
 'mode_royale':dict(frames=96,setup=LIVE+"DIR.load("+LD+");DIR.match('royale','1v1','craters');",warm=30),
 # ---- counter triangle: start of a 3v3 with the matchup banner and the markers ----
 'counter':dict(frames=84,setup=LIVE+"DIR.load({w:'pulse',wt:1,c:'vanguard',ct:1,paint:'arctic'});DIR.match('arena','3v3','classic');DIR.hud=true;"
   "DIR.cam={x:10,y:15,z:1.0};DIR.tgt=()=>({x:10,y:12,z:1.45});DIR.ease=0.05;DIR.zk=0.05;"+FOLLOW,warm=0.1),
 # ---- cinematic: wide push-in for the lore lines, the Tide Engine hero, the title background ----
 'lore_wide':dict(frames=120,setup=LIVENB+"DIR.load("+LD+");DIR.match('arena','3v3','classic');DIR.hud=false;"
   "DIR.cam={x:10,y:16,z:1.02};DIR.tgt=()=>({x:10,y:16,z:1.32});DIR.ease=0.1;DIR.zk=0.012;"+FOLLOW,warm=7),
 'hero_tide':dict(frames=120,setup="DIR.load({w:'moon',c:'vanguard',ct:2,paint:'hyper',skin:1,vg:60000});DIR.match('arena','2v2','craters');DIR.hud=false;DIR.ai=false;"
   "DIR.place(me,9.5,27.5,-Math.PI/2);{const fs=DIR.foes();DIR.place(fs[0],2,2);DIR.place(fs[1],18,2);for(const u of fs){"+HOLD+"}}"
   "for(const u of units)if(u.team===me.team&&u!==me)DIR.place(u,18,30);"
   "DIR.nonum=true;DIR.pre=()=>{boxes.length=0;me.sp=0;joy.on=true;joy.dx=0.12;joy.dy=-0.5;};"
   "DIR.cam={x:9.5,y:26.5,z:4.4};DIR.tgt=()=>({x:me.x,y:me.y-0.4,z:3.4});DIR.ease=0.1;DIR.zk=0.02;"+FOLLOW,warm=0.2,after="DIR.ai=false;"),
 'title_bg':dict(frames=120,setup=LIVENB+"DIR.load("+LD+");DIR.match('arena','3v3','overpass');DIR.hud=false;"
   "DIR.cam={x:8,y:14,z:1.5};DIR.tgt=()=>({x:12,y:18,z:1.35});DIR.ease=0.012;DIR.zk=0.01;"+FOLLOW,warm=5),
}
MENU={
 'vs_live':dict(kind='menu',frames=40,setup="DIR.load({w:'moon',c:'vanguard',ct:2,paint:'hyper',skin:1,vg:60000});closeAll();save.gtype='arena';save.mode='3v3';save.map='overpass';store();prepareMatch();"
   "const nm=['NovaRider','Kraterkid','moonbag','0xTitan','Pengy97'];let i=0;for(const u of units){if(u!==me){u.ai=false;u.name=nm[i++%nm.length];}}"
   "pvp={live:true,phase:'vs'};showVS({live:true,ms:5000});",wait=1500),
 'play_hero':dict(kind='menu',frames=75,setup="pvp=null;closeAll();state='menu';DIR.load({w:'moon',c:'vanguard',ct:2,paint:'hyper',skin:1,vg:60000});save.pts=48200;save.earned=152650;store();setTab('play');uiDirty();",wait=1200),
 'gear_pick':dict(kind='menu',frames=30,setup="closeAll();DIR.load({w:'moon',c:'vanguard',ct:2,paint:'hyper',skin:1,vg:60000});setTab('garage');uiDirty();ACT.gear('w');",wait=1500),
 'vault':dict(kind='menu',frames=60,setup="closeAll();DIR.load({w:'moon',c:'vanguard',ct:2,paint:'hyper',skin:1,vg:60000});setTab('shop');uiDirty();ACT.vault();",wait=1500),
 'paints':dict(kind='menu',frames=30,setup="closeAll();setTab('garage');uiDirty();ACT.paints();",wait=1500),
 'quests':dict(kind='menu',frames=4,setup="closeAll();save.login={last:dayNum()-1,n:5};store();setTab('quests');uiDirty();",wait=1500),
 'ranks':dict(kind='menu',frames=20,setup="closeAll();setTab('ranks');uiDirty();",wait=1200),
 'pass':dict(kind='menu',frames=30,setup="closeAll();const P=passState();P.xp=350*33+120;P.prem=true;P.cf=[];P.cp=[];for(let i=1;i<=28;i++){P.cf.push(i);P.cp.push(i);}store();setTab('play');uiDirty();openPass();",
   wait=1500,after="const e=document.querySelector('.pbonus');if(e)e.scrollIntoView({block:'center'});"),
}
