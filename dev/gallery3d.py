# renders the wiki's gear and map pictures from the game's own 3D models: python3 dev/gallery3d.py (writes img/wiki/*.webp)
import os, asyncio, sys, base64
sys.path.insert(0,os.path.join(os.path.dirname(os.path.abspath(__file__)),'tests'))
from harness import open_game, start_dev
from playwright.async_api import async_playwright
OUT=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'img','wiki')
JS="""(o)=>{const w=o.w,h=o.h,c=document.createElement('canvas');c.width=w*2;c.height=h*2;const x=c.getContext('2d');x.setTransform(2,0,0,2,0,0);
 const g=x.createRadialGradient(w/2,h*0.62,4,w/2,h*0.62,w*0.6);g.addColorStop(0,'#1d2638');g.addColorStop(1,'#111724');x.fillStyle=g;x.fillRect(0,0,w,h);
 const dd=window.dpr;window.dpr=2;
 try{if(o.map)mapArt(x,w,h,o.map);else artTank(x,w,h,Object.assign({cls:'vanguard',ct:0,arch:'pulse',wt:0,paint:'stock',lunar:false,team:'#4d9fff',gems:'dmg,rof,arm',boss:false,ghost:false},o.s),o.p||3,{az:o.az===undefined?0.95:o.az,t:1.3,z:o.z||1});}finally{window.dpr=dd;}
 return c.toDataURL('image/webp',0.86);}"""
async def main():
    start_dev()
    os.makedirs(OUT,exist_ok=True)
    async with async_playwright() as p:
        b,pg,errs=await open_game(p,400,400,init="window.LUNAR_NO_AUTOGFX=1;")
        await pg.wait_for_function("()=>typeof R3!=='undefined'&&R3.ready",timeout=15000)
        jobs=[]
        for a in ['pulse','twin','siege']:
            for t in range(3): jobs.append(('w_%s_%d'%(a,t),{'s':{'arch':a,'wt':t},'p':2,'az':1.15,'z':0.78,'w':200,'h':150}))
        jobs.append(('w_moon',{'s':{'arch':'moon','wt':2},'p':2,'az':1.15,'z':0.82,'w':200,'h':150}))
        for c in ['scout','vanguard','titan']:
            for t in range(3): jobs.append(('c_%s_%d'%(c,t),{'s':{'cls':c,'ct':t},'p':1,'z':0.9,'w':200,'h':150}))
        jobs.append(('c_lunar',{'s':{'cls':'vanguard','ct':2,'arch':'moon','wt':2,'lunar':True,'team':'#e8f4ff'},'w':200,'h':150}))
        jobs.append(('megatank',{'s':{'boss':True},'az':0.9,'w':200,'h':150}))
        for m in ['classic','overpass','longshot','craters']: jobs.append(('map_'+m,{'map':m,'w':180,'h':250}))
        for name,o in jobs:
            url=await pg.evaluate(JS,o)
            open(os.path.join(OUT,name+'.webp'),'wb').write(base64.b64decode(url.split(',',1)[1]))
        print(len(jobs),'images','errors',errs)
        await b.close()
asyncio.run(main())
