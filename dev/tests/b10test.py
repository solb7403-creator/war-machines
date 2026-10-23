# Batch 10 test: the 3D view. Loads, every mode on every map with no errors, draw cost at 4x CPU slowdown, aiming and
# tapping line up with the tilted ground, the Graphics setting, the automatic step-down (High -> Low -> 2D), the 2D
# fallback without WebGL and after a lost GPU context, and the 3D menu pictures for every weapon and chassis.
import os, asyncio, sys, json, math
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game
from playwright.async_api import async_playwright
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/b10/';os.makedirs(OUT,exist_ok=True)
READY="()=>typeof R3!=='undefined'&&(R3.ready||R3.failed)"
BOT="if(me&&!me.brain){me.brain={mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0};me.strafe=1;me.strafeT=1.5;}"
async def main():
    start_dev()
    fails=[]
    def check(c,msg):
        print(('ok   ' if c else 'FAIL ')+msg)
        if not c: fails.append(msg)
    async with async_playwright() as p:
        # ---------- 3D on: loads, plays every mode on every map ----------
        b,pg,errs=await open_game(p,390,740)
        await pg.add_style_tag(content='#toast{display:none!important}')
        await pg.wait_for_function(READY,timeout=20000)
        await pg.evaluate("()=>{save.welcomed=true;save.mp=5;store();closeAll();}")
        r=await pg.evaluate("()=>({ready:R3.ready,failed:R3.failed,GK,g3d:document.body.classList.contains('g3d'),mode:gfxMode()})")
        check(r['ready'] and not r['failed'] and abs(r['GK']-math.cos(0.6))<1e-6 and r['g3d'] and r['mode']=='auto','3D view loads by default (Auto) '+json.dumps(r))
        bad=[]
        for g in ['arena','zone','crystal','bounty','royale','boss']:
            for mp in ['classic','overpass','longshot','craters']:
                md='1v1' if g in ('royale',) else '2v2'
                r=await pg.evaluate("(c)=>{closeAll();save.gtype=c[0];save.mode=c[1];save.map=c[2];store();prepareMatch();startMatch();document.body.classList.add('battle');fit();"+BOT+"let mx=0;for(let i=0;i<150;i++){if(me.hp>0)botAI(1/30,me);update(1/30);fxTick(1/30);if(i%3===0){drawBattle();mx=Math.max(mx,R3.calls);}}const n=B3.units.size;state='menu';document.body.classList.remove('battle');return {calls:mx,units:n};}",[g,md,mp])
                if r['calls']>160 or r['units']<2: bad.append([g,mp,r])
        check(not bad and not errs,'every mode on every map draws in 3D, under 160 draw calls '+json.dumps(bad)+' '+json.dumps(errs[:3]))
        await pg.screenshot(path=OUT+'last_battle.png')
        # ---------- draw cost at 4x CPU slowdown (a slow phone's CPU) ----------
        cdp=await pg.context.new_cdp_session(pg)
        await cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
        worst=[]
        for st in ['arena:3v3:overpass','zone:3v3:classic','royale:1v1:craters','boss:2v2:classic']:
            r=await pg.evaluate("""(st)=>{const [g,m,mp]=st.split(':');save.gtype=g;save.mode=m;save.map=mp;prepareMatch();startMatch();document.body.classList.add('battle');fit();"""+BOT+"""
              for(let i=0;i<200;i++){if(me.hp>0)botAI(1/60,me);update(1/60);fxTick(1/60);}
              const td=[];for(let i=0;i<90;i++){if(me.hp>0)botAI(1/60,me);update(1/60);fxTick(1/60);const a=performance.now();drawBattle();td.push(performance.now()-a);}
              td.sort((a,b)=>a-b);state='menu';document.body.classList.remove('battle');return {st,med:+td[45].toFixed(1),p95:+td[85].toFixed(1)};}""",st)
            worst.append(r)
        await cdp.send('Emulation.setCPUThrottlingRate',{'rate':1})
        check(all(w['med']<12 and w['p95']<25 for w in worst),'3D frame cost at 4x CPU slowdown fits a 30fps frame (median under 12ms, p95 under 25ms) '+json.dumps(worst))
        # ---------- aiming on the tilted ground ----------
        r=await pg.evaluate("""()=>{save.gtype='arena';save.mode='1v1';save.map='craters';prepareMatch();startMatch();document.body.classList.add('battle');fit();
          const e=units.find(u=>u.team!==0);e.x=14;e.y=9;me.x=6;me.y=24;tapFocus=-1;tapTarget(X(e.x),Y(e.y));const tapped=tapFocus===e.id;
          joy.dx=0;joy.dy=-1;const up=inputVec();joy.dx=Math.SQRT1_2;joy.dy=-Math.SQRT1_2;const dg=inputVec();joy.dx=joy.dy=0;
          const want=Math.atan2(-Math.SQRT1_2/GK,Math.SQRT1_2);
          aim={id:1,sx:0,sy:0,x:X(me.x)+100,y:Y(me.y)-100,on:true};const aa=aimAng();aim=null;
          state='menu';document.body.classList.remove('battle');
          return {tapped,up,dg,dgAng:Math.atan2(dg[1],dg[0]),want,mag:Math.hypot(dg[0],dg[1]),aa,aWant:Math.atan2(-100/GK,100)};}""")
        check(r['tapped'],'tapping an enemy on the 3D ground locks onto it')
        check(abs(r['up'][0])<1e-6 and abs(r['up'][1]+1)<1e-6 and abs(r['dgAng']-r['want'])<1e-6 and abs(r['mag']-1)<1e-6,'joystick drives where your finger points on the tilted ground '+json.dumps(r))
        check(abs(r['aa']-r['aWant'])<1e-6,'drag-aim angle is measured on the ground '+json.dumps([r['aa'],r['aWant']]))
        # ---------- menu pictures in 3D: every weapon and chassis at every tier, crates, gems, maps, the hero ----------
        r=await pg.evaluate("""()=>{const c=document.createElement('canvas');c.width=c.height=120;const x=c.getContext('2d');const res=[];
          const lit=()=>{const d=x.getImageData(0,0,120,120).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>20)n++;return n;};
          const specs=[];for(const a of ['pulse','twin','siege'])for(const t of [0,1,2])specs.push(['gear','w',a,String(t),'0']);specs.push(['gear','w','moon','2','0']);
          for(const k of ['scout','vanguard','titan'])for(const t of [0,1,2])specs.push(['gear','c',k,String(t),'0']);
          for(const tk of ['weapon','chassis','gem'])for(const t of [0,1,2])specs.push(['crate',tk,String(t)]);
          specs.push(['tank','lunar'],['tank','paint','gold'],['tank','me'],['gem','dmg'],['map','overpass']);
          for(const s of specs){x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,120,120);const ok=art3D(x,120,120,s);res.push([s.join(':'),ok,lit()]);}
          return res;}""")
        badart=[x for x in r if not x[1] or x[2]<300]
        check(not badart,'3D menu pictures draw for every weapon, chassis, crate, paint, gem and map ('+str(len(r))+') '+json.dumps(badart))
        await pg.evaluate("()=>{setTab('garage');}");await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT+'garage.png')
        await pg.evaluate("()=>{setTab('play');}");await pg.wait_for_timeout(300)
        h1=await pg.evaluate("()=>heroCv.toDataURL().length");await pg.wait_for_timeout(400);h2=await pg.evaluate("()=>heroCv.toDataURL()")
        await pg.wait_for_timeout(300);h3=await pg.evaluate("()=>heroCv.toDataURL()")
        check(h2!=h3,'the Play tab hero tank animates in 3D')
        # ---------- the Graphics setting ----------
        await pg.evaluate("()=>openSettings()");await pg.wait_for_timeout(300)
        segs=await pg.evaluate("()=>[...document.querySelectorAll('[data-act=gfx]')].map(b=>b.textContent+(b.classList.contains('on')?'*':''))")
        check(segs==['Auto*','High','Low','2D'],'settings offer Auto, High, Low, 2D '+json.dumps(segs))
        await pg.click('[data-act=gfx][data-arg="2d"]');await pg.wait_for_timeout(300)
        r=await pg.evaluate("()=>({GK,g3d:document.body.classList.contains('g3d'),gfx:save.gfx,note:document.querySelector('.q.gfx .p').textContent})")
        check(r['GK']==1 and not r['g3d'] and r['gfx']=='2d' and 'Classic 2D' in r['note'],'2D setting switches to the classic view '+json.dumps(r))
        r=await pg.evaluate("()=>{save.gtype='arena';save.mode='2v2';save.map='classic';prepareMatch();startMatch();document.body.classList.add('battle');fit();for(let i=0;i<30;i++){update(1/30);fxTick(1/30);}drawBattle();const px=document.getElementById('c').getContext('2d').getImageData(Math.round(X(10)*dpr),Math.round(Y(2)*dpr),1,1).data;state='menu';document.body.classList.remove('battle');return [...px];}")
        check(r[3]==255,'2D battle still draws its own arena '+json.dumps(r))
        await pg.evaluate("()=>openSettings()");await pg.wait_for_timeout(300)
        await pg.click('[data-act=gfx][data-arg="low"]');await pg.wait_for_timeout(300)
        r=await pg.evaluate("()=>({q:R3.q,GK,g3d:document.body.classList.contains('g3d'),pr:RR.getPixelRatio()})")
        check(r['q']=='low' and r['g3d'] and r['GK']<1 and r['pr']<=1,'Low setting: 3D at pixel ratio 1 '+json.dumps(r))
        await pg.click('[data-act=gfx][data-arg="auto"]');await pg.wait_for_timeout(300)
        await pg.evaluate("()=>closeAll()")
        check(not errs,'no page errors '+json.dumps(errs[:3]))
        await b.close()

        # ---------- Auto steps down on a phone that can't keep up: High -> Low -> 2D ----------
        b,pg,errs=await open_game(p,390,740,autogfx=True)
        await pg.wait_for_function(READY,timeout=20000)
        r=await pg.evaluate("""()=>{save.welcomed=true;save.mp=5;save.gfx='auto';R3.q='high';closeAll();save.gtype='arena';save.mode='1v1';save.map='classic';prepareMatch();startMatch();
          let m=null;const st=window.showToast;window.showToast=x=>m=x;
          R3.ft=[];for(let i=0;i<90;i++)perfWatch(1/33);const q1=R3.q;
          for(let i=0;i<200;i++)perfWatch(1/18);
          window.showToast=st;const r={q1,auto:R3.auto,GK,g3d:document.body.classList.contains('g3d'),toast:m};state='menu';return r;}""")
        check(r['q1']=='low' and r['auto']=='2d' and r['GK']==1 and not r['g3d'] and 'Switched to 2D' in (r['toast'] or ''),'Auto: slow frames step down to Low, then to 2D, and say so '+json.dumps(r))
        check(not errs,'no page errors (auto) '+json.dumps(errs[:3]))
        await b.close()

        # ---------- no WebGL: the game runs in 2D ----------
        NOGL="(()=>{const og=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){if(/webgl/i.test(t))return null;return og.call(this,t,...a);};})();"
        b,pg,errs=await open_game(p,390,740,init=NOGL)
        await pg.wait_for_function(READY,timeout=20000)
        await pg.evaluate("()=>{save.welcomed=true;save.mp=5;store();closeAll();}")
        r=await pg.evaluate("""()=>{const a={failed:R3.failed,ready:R3.ready,GK,g3d:document.body.classList.contains('g3d'),c3:!!document.getElementById('c3')};
          save.gtype='zone';save.mode='2v2';save.map='overpass';prepareMatch();startMatch();document.body.classList.add('battle');fit();for(let i=0;i<60;i++){update(1/30);fxTick(1/30);drawBattle();}
          a.px=[...document.getElementById('c').getContext('2d').getImageData(Math.round(X(10)*dpr),Math.round(Y(2)*dpr),1,1).data];state='menu';document.body.classList.remove('battle');openSettings();a.note=document.querySelector('.q.gfx .p').textContent;closeAll();return a;}""")
        check(r['failed'] and not r['ready'] and r['GK']==1 and not r['g3d'] and not r['c3'] and r['px'][3]==255,'no WebGL: the 3D view stays off and battles draw in 2D '+json.dumps(r))
        check('isn’t supported' in r['note'],'settings explain 3D isn\'t supported here: '+r['note'])
        await pg.evaluate("()=>setTab('garage')");await pg.wait_for_timeout(300)
        check(not errs,'no page errors (no WebGL) '+json.dumps(errs[:3]))
        await b.close()

        # ---------- the GPU drops the context mid-match: back to 2D, no crash ----------
        b,pg,errs=await open_game(p,390,740)
        await pg.wait_for_function(READY,timeout=20000)
        await pg.evaluate("()=>{save.welcomed=true;save.mp=5;closeAll();save.gtype='arena';save.mode='2v2';save.map='classic';prepareMatch();startMatch();document.body.classList.add('battle');fit();for(let i=0;i<20;i++){update(1/30);drawBattle();}const gl=RR.getContext();gl.getExtension('WEBGL_lose_context').loseContext();}")
        await pg.wait_for_timeout(400)
        r=await pg.evaluate("()=>{for(let i=0;i<20;i++){update(1/30);fxTick(1/30);drawBattle();}const r={failed:R3.failed,GK,g3d:document.body.classList.contains('g3d')};state='menu';return r;}")
        check(r['failed'] and r['GK']==1 and not r['g3d'],'lost GPU context: falls back to 2D mid-match '+json.dumps(r))
        check(not errs,'no page errors (context lost) '+json.dumps(errs[:3]))
        await b.close()
    print('fails:',fails)
    print('RESULT','PASS' if not fails else 'FAIL')
asyncio.run(main())
