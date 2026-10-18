# Final QA: every screen at 5 sizes. Overflow, clipped text, overlaps, hidden buttons, console errors.
import os, asyncio, sys, json, os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import start_dev, open_game, dev
from playwright.async_api import async_playwright
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/qa/';os.makedirs(OUT,exist_ok=True)
SIZES=[(320,500,'xs'),(375,667,'s'),(390,740,'m'),(430,860,'l'),(768,1000,'xl')]
CHECK="""(where)=>{
 const out=[];const W=innerWidth,H=innerHeight;
 if(document.documentElement.scrollWidth>W+1)out.push(where+': page scrolls sideways '+document.documentElement.scrollWidth);
 const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
 for(const e of document.querySelectorAll('.screen.on *, .ovl *')){
  if(!vis(e))continue;const cs=getComputedStyle(e);
  if(e.children.length===0&&e.textContent.trim()&&e.scrollWidth>e.clientWidth+2&&cs.overflow!=='visible'&&cs.textOverflow!=='ellipsis')out.push(where+': clipped text "'+e.textContent.trim().slice(0,30)+'"');
  const r=e.getBoundingClientRect();if(r.right>W+1&&cs.position!=='fixed'&&!e.closest('.sheet,.modal'))out.push(where+': off-screen right '+e.className+' '+Math.round(r.right));
 }
 const f=document.querySelector('.screen.on .fight');if(f){const r=f.getBoundingClientRect(),tb=document.querySelector('.tabbar').getBoundingClientRect();if(r.bottom>tb.top+1||r.top<0)out.push(where+': FIGHT hidden '+Math.round(r.top)+'-'+Math.round(r.bottom)+' tabbar '+Math.round(tb.top));}
 for(const b of document.querySelectorAll('.screen.on button, .ovl button')){if(!vis(b))continue;const r=b.getBoundingClientRect();if(r.height<30&&!b.classList.contains('info'))out.push(where+': small tap target '+(b.textContent.trim().slice(0,20)||b.className)+' '+Math.round(r.height));}
 return out;}"""
async def run(p,w,h,tag,uid):
    b,pg,errs=await open_game(p,w,h,scale=1,user={'id':uid,'username':'qa'+tag,'first_name':'QA'})
    issues=[]
    await pg.wait_for_timeout(400)
    issues+=await pg.evaluate(CHECK,'welcome')
    wf=await pg.evaluate("()=>{const f=document.querySelector('.welcome .fight');if(!f)return null;const r=f.getBoundingClientRect();return {b:r.bottom,h:innerHeight}}")
    if wf and wf['b']>wf['h']:
        # welcome scrolls: fine only if it can scroll to the button
        sc=await pg.evaluate("()=>{const o=document.querySelector('.full.welcome');o.scrollTop=9999;const r=document.querySelector('.welcome .fight').getBoundingClientRect();return r.bottom<=innerHeight}")
        if not sc: issues.append('welcome: FIGHT unreachable')
    await pg.screenshot(path=OUT+tag+'_welcome.png')
    await pg.evaluate("()=>{save.welcomed=true;save.mp=4;save.pts=3000;save.earned=14000;store();closeAll();}")
    await pg.wait_for_timeout(300)
    for t in ['play','garage','shop','quests','ranks']:
        await pg.evaluate("(t)=>setTab(t)",t);await pg.wait_for_timeout(350)
        issues+=await pg.evaluate(CHECK,t)
        await pg.screenshot(path=OUT+tag+'_'+t+'.png')
    for sh,js in [('setup',"openSetup()"),('settings',"openSettings()"),('gear',"openGearPicker(true)"),('core',"openCorePicker(0)"),('crate',"openCrate('weapon',1)"),('howto',"showInfo('howto')")]:
        await pg.evaluate("(js)=>{closeAll();setTab('play');eval(js)}",js);await pg.wait_for_timeout(350)
        issues+=await pg.evaluate(CHECK,sh)
        await pg.screenshot(path=OUT+tag+'_sheet_'+sh+'.png')
    # VS, battle HUD, round screen, results
    await pg.evaluate("()=>{closeAll();save.gtype='arena';save.mode='3v3';save.map='overpass';store();beginMatch();}");await pg.wait_for_timeout(400)
    issues+=await pg.evaluate(CHECK,'vs');await pg.screenshot(path=OUT+tag+'_vs.png')
    await pg.evaluate("()=>vsGo()");await pg.evaluate("()=>{for(let i=0;i<30*8;i++)update(1/30)}");await pg.wait_for_timeout(250)
    hud=await pg.evaluate("()=>{const B=btn(),D=dashBtn();return {sup:[B.x-B.r,B.y-B.r,B.x+B.r,B.y+B.r],dash:[D.x-D.r,D.y-D.r,D.x+D.r,D.y+D.r],W:innerWidth,H:innerHeight}}")
    s,d=hud['sup'],hud['dash']
    if s[0]<0 or s[2]>hud['W'] or s[3]>hud['H'] or d[0]<0 or d[3]>hud['H']: issues.append('battle: buttons off screen '+json.dumps(hud))
    if not (d[2]<s[0] or d[0]>s[2] or d[3]<s[1] or d[1]>s[3]): issues.append('battle: DASH overlaps SUPER')
    await pg.screenshot(path=OUT+tag+'_battle.png')
    await pg.evaluate("()=>{units.filter(u=>u.team===1).forEach(u=>u.hp=0);update(1/30)}");await pg.wait_for_timeout(1500)
    issues+=await pg.evaluate(CHECK,'results')
    rf=await pg.evaluate("()=>{const f=document.querySelector('.res .fight');if(!f)return 'missing';const o=document.querySelector('.full.res');o.scrollTop=9999;const r=f.getBoundingClientRect();return r.bottom<=innerHeight?'ok':'cut'}")
    if rf!='ok': issues.append('results: PLAY AGAIN '+rf)
    await pg.evaluate("()=>{document.querySelector('.full.res').scrollTop=0}")
    await pg.screenshot(path=OUT+tag+'_results.png')
    await pg.evaluate("()=>{exitBattle();save.gtype='arena';save.mode='1v1';store();beginMatch();vsGo();units[1].hp=0;update(1/30);}");await pg.wait_for_timeout(1200)
    issues+=await pg.evaluate(CHECK,'round')
    await pg.screenshot(path=OUT+tag+'_round.png')
    await b.close()
    return issues,errs
async def main():
    start_dev()
    allbad=[]
    async with async_playwright() as p:
        for i,(w,h,tag) in enumerate(SIZES):
            iss,errs=await run(p,w,h,tag,991000+i)
            u=sorted(set(iss))
            print(tag,w,'x',h,'issues:',len(u));[print('   ',x) for x in u[:40]]
            if errs: print('   ERRORS',errs[:5])
            allbad+=u+errs
    print('RESULT','PASS' if not allbad else 'REVIEW')
asyncio.run(main())
