# the 3D model sheet: every weapon and chassis at every tier, the Legendary items, the Megatank, crates
import os, asyncio, sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from harness import open_game, start_dev
from playwright.async_api import async_playwright
OUT=os.environ.get('SHOTS','/tmp/lunar-shots')+'/sheet3d/';os.makedirs(OUT,exist_ok=True)
JS="""(o)=>{
 closeAll();const d=document.createElement('div');d.id='sheet';document.body.style.overflow='visible';document.documentElement.style.overflow='visible';document.getElementById('app').style.display='none';d.style.cssText='position:absolute;left:0;top:0;width:100%;box-sizing:border-box;z-index:99999;background:#0a0e17;padding:14px;font:600 13px "Chakra Petch",sans-serif;color:#dfe7f2';
 const rows=o.rows;let h='<h2 style="margin:0 0 10px">'+o.title+'</h2>';
 for(const r of rows){h+='<div style="margin:8px 0 2px;color:#9fb3c8">'+r.n+'</div><div style="display:flex;gap:8px;flex-wrap:wrap">';
  for(const c of r.c)h+='<div style="text-align:center;width:'+o.w+'px"><canvas data-k="'+c.k+'" style="width:'+o.w+'px;height:'+o.h+'px;background:#141a26;border-radius:8px"></canvas><div style="margin-top:3px">'+c.l+'</div></div>';
  h+='</div>';}
 d.innerHTML=h;document.body.appendChild(d);
 for(const c of d.querySelectorAll('canvas')){const w=o.w,hh=o.h;c.width=w*dpr;c.height=hh*dpr;const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);
  const k=JSON.parse(c.dataset.k.replace(/'/g,'"'));
  if(k.t==='art')art3D(x,w,hh,k.a);
  else{const sp=Object.assign({cls:'vanguard',ct:0,arch:'pulse',wt:0,paint:'stock',lunar:false,team:'#4d9fff',gems:'dmg,rof,arm',boss:false,ghost:false},k.s);artTank(x,w,hh,sp,k.p||3,{az:k.az===undefined?0.95:k.az,t:1.3,z:k.p===2?0.8:k.p===1?0.92:1});}}
 return d.querySelectorAll('canvas').length;}"""
def q(o):return str(o).replace('True','true').replace('False','false').replace('"',"'")
async def main():
    start_dev()
    async with async_playwright() as p:
        b,pg,errs=await open_game(p,760,1000,init="window.LUNAR_NO_AUTOGFX=1;")
        await pg.wait_for_function("()=>typeof R3!=='undefined'&&(R3.ready||R3.failed)",timeout=15000)
        T=['Common','Rare','Epic']
        WN={'pulse':['Pulse Cannon','Arc Pulse','Nova Pulse'],'twin':['Twin Repeater','Storm Repeater','Helix Repeater'],'siege':['Siege Breaker','Rail Breaker','Titanfall']}
        CN={'scout':['Scout','Strider','Phantom'],'vanguard':['Vanguard','Sentinel','Paladin'],'titan':['Titan','Bulwark','Colossus']}
        rows=[{'n':'Weapons','c':[]}]
        rows=[]
        for a in ['pulse','twin','siege']:
            rows.append({'n':WN[a][0]+' family','c':[{'k':q({'t':'s','s':{'arch':a,'wt':i},'p':2,'az':1.15}),'l':WN[a][i]+' ('+T[i]+')'} for i in range(3)]})
        rows.append({'n':'Legendary weapon','c':[{'k':q({'t':'s','s':{'arch':'moon','wt':2},'p':2,'az':1.15}),'l':'Moonbeam (Legendary)'}]})
        n=await pg.evaluate(JS,{'title':'Weapons','w':230,'h':170,'rows':rows});await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT+'weapons.png',full_page=True)
        await pg.evaluate("()=>document.getElementById('sheet').remove()")
        rows=[]
        for c in ['scout','vanguard','titan']:
            rows.append({'n':CN[c][0]+' family','c':[{'k':q({'t':'s','s':{'cls':c,'ct':i},'p':1}),'l':CN[c][i]+' ('+T[i]+')'} for i in range(3)]})
        rows.append({'n':'Legendary skin','c':[{'k':q({'t':'s','s':{'cls':c,'ct':0,'lunar':True,'team':'#e8f4ff'},'p':1}),'l':'Lunar '+CN[c][0]} for c in ['scout','vanguard','titan']]})
        await pg.evaluate(JS,{'title':'Chassis','w':230,'h':170,'rows':rows});await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT+'chassis.png',full_page=True)
        await pg.evaluate("()=>document.getElementById('sheet').remove()")
        rows=[{'n':'Full tanks, matching tiers','c':[{'k':q({'t':'s','s':{'cls':c,'ct':i,'arch':a,'wt':i}}),'l':CN[c][i]+' + '+WN[a][i]} for (c,a) in [('scout','twin'),('vanguard','pulse'),('titan','siege')] for i in range(3)]},
              {'n':'Legendary and the boss','c':[{'k':q({'t':'s','s':{'cls':'vanguard','ct':2,'arch':'moon','wt':2,'lunar':True,'team':'#e8f4ff'}}),'l':'Lunar Paladin + Moonbeam'},{'k':q({'t':'s','s':{'boss':True},'az':0.9}),'l':'Megatank'},{'k':q({'t':'s','s':{'cls':'titan','ct':1,'arch':'twin','wt':1,'paint':'gold','team':'#ff4d5e'}}),'l':'Gold plate paint, red team'}]},
              {'n':'Paints','c':[{'k':q({'t':'s','s':{'paint':pp,'ct':1,'wt':1}}),'l':pp} for pp in ['stock','regolith','eclipse','aurora','nebula','ember','arctic','venom','gold','void','founder']]},
              {'n':'Crates','c':[{'k':q({'t':'art','a':['crate',tk,str(ri)]}),'l':tk+' '+T[ri]} for tk in ['weapon','chassis','gem'] for ri in range(3)]}]
        await pg.evaluate(JS,{'title':'Tanks, paints, crates','w':170,'h':130,'rows':rows});await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT+'tanks.png',full_page=True)
        print('errors',errs[:5])
        await b.close()
asyncio.run(main())
