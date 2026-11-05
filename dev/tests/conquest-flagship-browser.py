"""Session 2 native-input browser proof against the real authenticated Worker/CAS.

Disposable fixture: legal epic Moon/Titan gear and initial placement only. Base defense
uses a separate resource-rich build-cost fixture. No client position/damage/kill/loot/
outcome writes. Camera framing and profiler resets change presentation only.
Chromium SwiftShader/WebKit automation is NOT physical iPhone or Telegram evidence.
"""
import argparse, asyncio, json, math, os, pathlib, shutil, time
from urllib.parse import urlparse
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/conquest-session-2/browser'

# Read collision to find waypoints; movement is exclusively ordinary key events.
PATH = r'''target=>{const v=Conquest.view,W=ConquestWorld,K=ConquestControl,B=v.battle||v.encounter,start={...v.p},step=3,gx=Math.round((target.x-start.x)/step),gz=Math.round((target.z-start.z)/step),key=(x,z)=>x+':'+z,open=[{x:0,z:0,g:0,f:Math.hypot(gx,gz)}],best=new Map([[key(0,0),0]]),parent=new Map(),points=new Map([[key(0,0),start]]),closed=new Set();let end=null;for(let n=0;open.length&&n<5000;n++){open.sort((a,b)=>b.f-a.f);const c=open.pop(),ck=key(c.x,c.z);if(closed.has(ck))continue;closed.add(ck);if(Math.hypot(c.x-gx,c.z-gz)<1.5){end=ck;break;}const p=points.get(ck);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=c.x+dx,nz=c.z+dz,nk=key(nx,nz);if(closed.has(nk)||nx<Math.min(0,gx)-18||nx>Math.max(0,gx)+18||nz<Math.min(0,gz)-18||nz>Math.max(0,gz)+18)continue;const q=W.advance(p,dx*step,dz*step),x=start.x+nx*step,z=start.z+nz*step;if(Math.hypot(q.x-x,q.z-z)>.2||K.baseBlocked(B,q)||[[1.5,0],[-1.5,0],[0,1.5],[0,-1.5]].some(([a,b])=>W.solidAt(x+a,z+b)))continue;const g=c.g+Math.hypot(dx,dz);if(g>=(best.get(nk)??Infinity))continue;best.set(nk,g);parent.set(nk,ck);points.set(nk,q);open.push({x:nx,z:nz,g,f:g+Math.hypot(nx-gx,nz-gz)});}}if(!end)return [target];const out=[];for(let at=end;at;at=parent.get(at))out.push(points.get(at));out.reverse();out.push(target);return out;}'''

# Project actual visible hostile geometry and ray-test a click through the canvas.
INFO = r'''()=>{const v=Conquest.view,B=v.battle||v.encounter,s=v.authority.state,living=B.enemies.filter(e=>e.hp>0&&!e.resident),visible=living.filter(e=>ConquestControl.visible(B,v.p,e)),e=visible.find(e=>e.id===B.carrierId)||visible.find(e=>e.immobile)||visible.sort((a,b)=>Math.hypot(a.x-v.p.x,a.z-v.p.z)-Math.hypot(b.x-v.p.x,b.z-v.p.z))[0]||living[0];let pick=null;if(e&&visible.includes(e)){let hull=null;const group=v.enemyMeshes.get(e.id),meshes=[];group?.traverse(m=>{if(m.isMesh&&m!==group.userData.marker){meshes.push(m);if(!hull)hull=m;}});if(hull&&!hull.geometry.boundingBox)hull.geometry.computeBoundingBox();const center=hull?hull.geometry.boundingBox.getCenter(new v.T.Vector3()).applyMatrix4(hull.matrixWorld):new v.T.Vector3(e.x-v.origin.x,e.y+1,e.z-v.origin.z),q=center.project(v.camera),r=v.host.getBoundingClientRect();for(const [dx,dy] of [[0,0],[0,3],[0,-3],[3,0],[-3,0],[0,6],[6,0],[-6,0]]){const x=(q.x+1)*r.width/2+dx,y=(1-q.y)*r.height/2+dy;if(document.elementFromPoint(x,y)!==v.renderer.domElement)continue;const ray=new v.T.Raycaster();ray.setFromCamera(new v.T.Vector2(x/r.width*2-1,1-y/r.height*2),v.camera);const hit=ray.intersectObjects(meshes,false)[0];if(hit&&ConquestCombat.lineClear({x:ray.ray.origin.x+v.origin.x,y:ray.ray.origin.y,z:ray.ray.origin.z+v.origin.z},{x:hit.point.x+v.origin.x,y:hit.point.y,z:hit.point.z+v.origin.z})){pick={id:e.id,x,y,visible:q.z<1};break;}}}let target=e?{x:e.x,z:e.z}:B.objective;if(!e&&['battery','extraction'].includes(B.operation?.family)&&B.nodes[B.scans])target={x:B.nodes[B.scans][0],z:B.nodes[B.scans][1]};const h=B.hazards?.find(h=>Math.hypot(h.x-v.p.x,h.z-v.p.z)<h.radius+3);return {state:s.battle.state,hp:s.hp,maxHp:B.playerMax,target,selected:v.selectedId,pick,live:living.length,canHit:!!e&&ConquestControl.visible(B,v.p,e),enemy:e?{id:e.id,hp:e.hp}:null,p:{x:v.p.x,z:v.p.z,yaw:v.yaw},hazard:h,charge:B.charge,scans:B.scans,stage:B.stage,work:B.work,time:B.time,kills:B.kills,shots:B.playerShots,operation:B.operation?.id,serverTime:s.battle.time};}'''

class Journey:
    def __init__(self, page, base, width, height, name):
        self.page, self.base, self.width, self.height, self.name = page, base, width, height, name
        self.held, self.trace, self.api, self.errors = set(), [], [], []
        self.path, self.path_goal, self.path_at = [], None, 0
        page.on('pageerror', lambda e: self.errors.append(str(e)))

    async def keys(self, want):
        for key in self.held-want: await self.page.keyboard.up(key)
        for key in want-self.held: await self.page.keyboard.down(key)
        self.held = want

    async def steer(self, target, fire=False, stop=3):
        p = await self.page.evaluate('({x:Conquest.view.p.x,z:Conquest.view.p.z,yaw:Conquest.view.yaw})')
        d = math.hypot(target['x']-p['x'], target['z']-p['z'])
        want = {'Space'} if fire else set()
        if d > stop:
            if not self.path_goal or math.hypot(target['x']-self.path_goal['x'], target['z']-self.path_goal['z'])>8 or time.monotonic()-self.path_at>2:
                self.path = await self.page.evaluate(PATH, target)
                self.path_goal, self.path_at = target, time.monotonic()
            while len(self.path)>1 and math.hypot(self.path[0]['x']-p['x'], self.path[0]['z']-p['z'])<3: self.path.pop(0)
            goal = self.path[0] if self.path else target
            dx,dz = goal['x']-p['x'],goal['z']-p['z']; n=math.hypot(dx,dz) or 1
            x=(math.cos(p['yaw'])*dx-math.sin(p['yaw'])*dz)/n
            z=(-math.sin(p['yaw'])*dx-math.cos(p['yaw'])*dz)/n
            if abs(x)>.3: want.add('d' if x>0 else 'a')
            if abs(z)>.3: want.add('w' if z>0 else 's')
        await self.keys(want)

    async def travel(self, target, stop=2.1):
        self.path_goal=None
        for step in range(800):
            p=await self.page.evaluate('({x:Conquest.view.p.x,z:Conquest.view.p.z,hp:Conquest.view.authority.state.hp,verified:Conquest.view.authority.state.position})')
            assert p['hp']>0, p
            if math.hypot(p['x']-target['x'],p['z']-target['z'])<stop and math.hypot(p['verified']['x']-target['x'],p['verified']['z']-target['z'])<stop+1: break
            await self.steer(target, stop=stop*.65)
            if step%50==0: await self.page.keyboard.press('f')
            await self.page.wait_for_timeout(125)
        else: raise AssertionError(('travel blocked',target,p))
        await self.keys(set()); await self.page.wait_for_timeout(1100)

    async def shot(self, label):
        await self.page.screenshot(path=str(OUT/f'{self.name}-{label}.png'))

    async def win(self, operation):
        self.path_goal=None;started=time.monotonic();clicked=0;captured=False
        await self.page.evaluate('Conquest.view.frameSamples=[];Conquest.view.worstFrame=0;Conquest.view.hitches=0;Conquest.view.profileLast=performance.now()')
        for step in range(1400):
            info=await self.page.evaluate(INFO)
            if step%12==0:
                self.trace.append({'step':step,**info})
                print('BATTLE',operation,step,json.dumps({k:info[k] for k in ['state','hp','live','selected','enemy','time','scans','work','p']}),flush=True)
            if info['state']=='victory': break
            assert info['state']=='active' and info['hp']>0, (operation,info)
            pick=info.get('pick')
            if pick and pick['visible'] and pick['id']!=info['selected'] and 8<pick['x']<self.width-8 and 120<pick['y']<self.height-190:
                await self.page.mouse.click(pick['x'],pick['y']);clicked+=1
            target=info['target']; p=info['p']; distance=math.hypot(target['x']-p['x'],target['z']-p['z'])
            locked=info['enemy'] and info['selected']==info['enemy']['id']
            # Keep normal firing while closing; only actual hull clicks can establish lock.
            if info['hazard']:
                h=info['hazard'];dx,dz=p['x']-h['x'],p['z']-h['z'];d=math.hypot(dx,dz)
                target={'x':p['x']+(dx/d if d>.01 else 1)*12,'z':p['z']+(dz/d if d>.01 else 0)*12}
                self.path_goal=None
            elif info['live'] and locked and info['canHit'] and distance<30: target=p
            await self.steer(target,fire=bool(info['live']),stop=4 if not info['live'] else 16 if info['canHit'] else 3)
            if step%20==0: await self.page.keyboard.press('f')
            if info['charge']>=1000 and locked: await self.page.keyboard.press('r')
            if not captured and step>=24:
                await self.shot(operation+'-active');captured=True
            await self.page.wait_for_timeout(150)
        else: raise AssertionError(('operation timeout',operation,info))
        await self.keys(set())
        await self.page.wait_for_selector('.cq-result')
        await self.shot(operation+'-victory')
        state=await self.page.evaluate('Conquest.view.authority.state')
        assert state['settlement']['cp']>0 and state['completed'].get(operation),state
        report={'operation':operation,'secondsWall':time.monotonic()-started,'physicalHullClicks':clicked,'settlement':state['settlement'],'kills':state['battle']['kills'],'hp':state['hp'],'position':state['position'],'raidProgress':state.get('raidProgress'),'territory':state.get('territory'),'performance':await self.page.evaluate('Conquest.view.performanceReport()')}
        assert clicked>0, report
        print('VICTORY',json.dumps(report),flush=True)
        return report

async def run(args):
    OUT.mkdir(parents=True,exist_ok=True)
    server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
    ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port'])
    result={'engine':args.engine,'fixture':'Disposable local legal epic Moon/Titan starting loadout and safe raid-entry placement; separate rich banked base-build fixture. No forged combat, health, outcome, ownership or settlement.','environment':'Automated browser; Chromium uses SwiftShader software rendering. PHYSICAL_IPHONE_NOT_TESTED.','cases':[],'errors':[]}
    name=args.engine+('-fallback' if args.fallback else '')+('-'+args.family.replace(',','-') if args.family else '')+('-defense' if args.defense_only else '')
    try:
        async with async_playwright() as pw:
            opts={'headless':True}
            if args.engine=='chromium': opts.update(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
            browser=await getattr(pw,args.engine).launch(**opts)
            context=await browser.new_context(viewport={'width':args.width,'height':args.height},has_touch=True,is_mobile=True,reduced_motion='reduce')
            page=await context.new_page();j=Journey(page,base,args.width,args.height,name)
            await page.add_init_script('window.LUNAR_LOCAL_ECO=1;window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.Telegram={WebApp:{initData:'+json.dumps(ready['initData'])+',initDataUnsafe:{user:{id:8301,first_name:"BrowserPilot"}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};')
            async def route(r):
                u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
                if u.path.startswith('/api/conquest/') or u.path=='/api/sync':
                    response=await page.request.post(base+u.path,data=json.loads(r.request.post_data or '{}'))
                    payload=await response.body();j.api.append({'path':u.path,'status':response.status,'bytes':len(payload)})
                    if response.status>=400: print('API ERROR',u.path,response.status,payload[:250],flush=True)
                    return await r.fulfill(status=response.status,body=payload,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
                if u.path.startswith('/api/'): return await r.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
                if u.netloc=='lunar.test' and f.is_file(): return await r.fulfill(path=str(f))
                if u.netloc=='telegram.org': return await r.fulfill(body='',content_type='application/javascript')
                await r.abort()
            await page.route('**/*',route)
            async def enter():
                await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"')
                await page.evaluate('closeAll();save.welcomed=true;uiDirty();save.gfx='+json.dumps('2d' if args.fallback else 'low')+';')
                await page.locator('[data-act="conquest"]').click();await page.get_by_role('button',name='ENTER CONQUEST',exact=True).click()
                if await page.locator('.cq-transmission').count(): await page.locator('.cq-story-start').click()
                await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0',timeout=60000)
                # Explicit presentation-only camera framing, no simulation mutation.
                await page.evaluate('Conquest.view.distance=90;Conquest.view.pitch=.95;Conquest.view.yaw=-.8')
            await page.request.post(base+'/fixture',data={'veteranLoadout':True,'engineering':True,'position':[890,945]})
            await enter()
            definitions=await page.evaluate('ConquestCombat.operations')
            ids=['raid-'+f+'-1' for f in (args.family.split(',') if args.family else ['intercept','sabotage','battery'])]
            if args.defense_only: ids=[]
            for operation in ids:
                o=definitions[operation]
                await j.travel({'x':o['x'],'z':o['z']},stop=o['activationRadius']-8)
                await page.get_by_role('button',name='OPEN MAP',exact=True).click();await page.locator('.cq-operation-board summary').click();await page.get_by_role('button',name='BRIEF · '+o['name'],exact=True).click()
                await j.shot(operation+'-approach')
                await page.get_by_role('button',name='START MISSION',exact=True).click()
                await page.wait_for_function('(id)=>Conquest.view.authority.state.mission===id',arg=operation)
                result['cases'].append(await j.win(operation))
                await page.get_by_role('button',name='RETURN TO EXPLORATION',exact=True).click()
                await page.wait_for_function('!Conquest.view.battle&&!Conquest.view.authority.actionBusy&&!Conquest.view.authority.state.mission')
                (OUT/f'{name}-results.json').write_text(json.dumps(result,indent=2))
            if ids:
                await page.get_by_role('button',name='MORE',exact=True).click();await page.get_by_role('button',name='PERMANENT COLLECTION',exact=True).click()
                await page.locator('details').filter(has=page.locator('summary',has_text='TRAIL')).locator('summary').click()
                item=page.locator('.cq-product').filter(has=page.get_by_role('heading',name='Sunlance Muzzle Halo',exact=True))
                await item.get_by_role('button',name='PREVIEW · Sunlance Muzzle Halo',exact=True).click()
                await item.get_by_role('button',name='EQUIP',exact=True).click()
                await page.wait_for_function('Conquest.view.authority.state.cosmetics.equipped.trail==="fire-sunlance"')
                assert await page.get_by_role('button',name='CHECKOUT DISABLED',exact=True).count()==20
                assert await page.get_by_role('button',name='CHECKOUT DISABLED',exact=True).first.is_disabled()
                for width,height in [(320,568),(390,844),(430,932),(1280,800)]:
                    await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(150)
                    assert await page.locator('.cq-dialog').evaluate('(e)=>e.getBoundingClientRect().width<=innerWidth')
                    await j.shot('earned-equipped-collection-'+str(width))
                await page.set_viewport_size({'width':args.width,'height':args.height})
                await page.get_by_role('button',name='CLOSE COLLECTION',exact=True).click()
                before=await page.evaluate('({cp:Conquest.view.authority.state.ledger.cp,shards:Conquest.view.authority.state.raidProgress.shards,owned:Conquest.view.authority.state.cosmetics.owned,completed:Conquest.view.authority.state.completed})')
                await page.evaluate('Conquest.view.authority.dispose()');await enter()
                after=await page.evaluate('({cp:Conquest.view.authority.state.ledger.cp,shards:Conquest.view.authority.state.raidProgress.shards,owned:Conquest.view.authority.state.cosmetics.owned,completed:Conquest.view.authority.state.completed})')
                assert after==before,(before,after)
                assert await page.evaluate('Conquest.view.authority.state.cosmetics.equipped.trail==="fire-sunlance"')
                await j.shot('reload-earned-cosmetic')
                result['retention']={'reload':True,'owned':after['owned'],'shards':after['shards'],'exactlyOnceCp':after['cp']}
            if not args.no_defense:
                await page.evaluate('Conquest.view.authority.dispose()');await page.wait_for_timeout(300)
                await page.request.post(base+'/fixture',data={'veteranLoadout':True,'baseFunds':True,'position':[1080,1160]})
                await enter();await page.locator('#cq-base-access').click()
                await page.get_by_role('button',name='CONSTRUCT BASE I',exact=False).click()
                await page.wait_for_function('Conquest.view.authority.state.base.tier===1')
                await page.get_by_role('button',name='DEPLOY TURRET',exact=True).click()
                await page.get_by_role('button',name='DEPLOY BASE DEFENSE',exact=True).click()
                await page.get_by_role('button',name='CLOSE BASE',exact=True).click()
                await page.wait_for_function('Conquest.view.authority.state.mission==="base-defense"')
                result['cases'].append(await j.win('base-defense'))
                defense=await page.evaluate('Conquest.view.authority.state.base.defense')
                assert defense['report']['outcome']=='victory' and defense['report']['stolen']==0,defense
                result['defense']=defense
            assert not j.errors,j.errors
            result.update(errors=j.errors,requests=j.api)
            (OUT/f'{name}-trace.json').write_text(json.dumps(j.trace,indent=2))
            await page.evaluate('Conquest.view.authority.dispose()');await context.close();await browser.close()
    except Exception as exc:
        result['errors'].append(str(exc));raise
    finally:
        (OUT/f'{name}-results.json').write_text(json.dumps(result,indent=2))
        server.terminate();await server.wait()
    print('PASS',name,len(result['cases']),'actual victories; persisted earned cosmetic; software/browser evidence only',flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--engine',choices=['chromium','webkit'],default='chromium');p.add_argument('--fallback',action='store_true');p.add_argument('--width',type=int,default=390);p.add_argument('--height',type=int,default=844);p.add_argument('--family');p.add_argument('--no-defense',action='store_true');p.add_argument('--defense-only',action='store_true')
    asyncio.run(run(p.parse_args()))
