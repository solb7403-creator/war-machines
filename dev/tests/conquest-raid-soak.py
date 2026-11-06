"""Long-lived raid soak and dense-raid frame profile (software/browser evidence only; NOT physical iPhone/Telegram).

One page stays open for the whole run; between raids the disposable pilot is reset through the authority reconnect, never a
page reload, so client-side leaks accumulate. Raids are played by the native-input Journey bot from
conquest-flagship-browser.py. Harness cost is kept off the measurement: the bot's A* runs in a Web Worker (same algorithm,
served from a virtual same-origin path so the game's CSP is untouched), mid-raid screenshots are disabled, and the local
authoritative Worker emulator runs at low CPU priority (in production it runs on Cloudflare, not on the player's device).

Usage: python dev/tests/conquest-raid-soak.py --width 390 --minutes 12 [--engine chromium|webkit]
Output: docs/conquest-session-2/soak/<engine>-<width>.json
"""
import argparse, asyncio, importlib.util, json, os, pathlib, shutil, statistics, time
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('flagship', ROOT / 'dev/tests/conquest-flagship-browser.py')
fb = importlib.util.module_from_spec(spec); spec.loader.exec_module(fb)

# --- Off-main-thread planner: identical A* body, executed in a dedicated worker -------------------------------------------
_body = fb.PATH[len('target=>{'):]
_prologue = 'const v=Conquest.view,W=ConquestWorld,K=ConquestControl,B=v.battle||v.encounter,start={...v.p},'
assert _prologue in _body, 'flagship PATH prologue changed; update the soak planner'
_body = _body.replace(_prologue, 'const W=self.ConquestWorld,K=self.ConquestControl,B={baseTier:msg.baseTier},start=msg.start,')
WORKER = ("let ready=false;onmessage=e=>{const msg=e.data;if(!ready){const C={baseDefinition:msg.base};"
          "self.ConquestControl={baseBlocked:new Function('C','return '+msg.blocked)(C)};importScripts('/js/conquest/world.js');ready=true;}"
          "const target=msg.target;const out=(()=>{" + _body + ")();postMessage({id:msg.id,path:out});};")
fb.PATH = ("target=>new Promise(res=>{const v=Conquest.view,B=v.battle||v.encounter;if(!window.cqPlanner){"
           "window.cqPlanner=new Worker('/js/__cq_harness_planner.js');window.cqPlanSeq=0;window.cqPlanWait=new Map();"
           "cqPlanner.onmessage=e=>{const r=cqPlanWait.get(e.data.id);cqPlanWait.delete(e.data.id);r&&r(e.data.path);};}"
           "const id=++cqPlanSeq;cqPlanWait.set(id,res);cqPlanner.postMessage({id,blocked:ConquestControl.baseBlocked.toString(),"
           "base:ConquestCombat.baseDefinition,baseTier:B.baseTier||0,start:{x:v.p.x,z:v.p.z,y:v.p.y,surface:v.p.surface},target:{x:target.x,z:target.z}});})")

async def _no_shot(self, label):
    return None
fb.Journey.shot = _no_shot

# In-combat frame log: only frames while an operation is active and no modal is open (gameplay frames).
HOOK = r'''()=>{window.cqFrames=[];let prev=performance.now();const raf=()=>{const t=performance.now(),v=Conquest.view,B=v&&v.battle;
if(B&&B.state==='active'&&!document.querySelector('.cq-dialog'))cqFrames.push(+(t-prev).toFixed(1));prev=t;requestAnimationFrame(raf);};requestAnimationFrame(raf);}'''
SAMPLE = r'''()=>{const v=Conquest.view;let objects=0;v.scene.traverse(()=>objects++);const r=v.performanceReport();return {jsHeap:performance.memory?.usedJSHeapSize||null,sceneObjects:objects,
enemyMeshes:v.enemyMeshes?.size||0,programs:v.renderer.info?.programs?.length||0,geometries:r.geometries,textures:r.textures,drawCalls:r.drawCalls,triangles:r.triangles,domNodes:document.getElementsByTagName('*').length,autoLow:r.autoLow}}'''

async def main(args):
    height = {320: 568, 360: 640, 390: 844, 430: 932}.get(args.width, 844)
    env = dict(os.environ, CQ_PREVIEW_PORT=str(args.port))
    server = await asyncio.create_subprocess_exec('nice', '-n', '19', 'node', 'dev/tests/conquest-server.mjs', '--preview', cwd=ROOT, env=env, stdout=asyncio.subprocess.PIPE)
    base = 'http://127.0.0.1:%d' % json.loads(await server.stdout.readline())['port']
    out = ROOT / 'docs/conquest-session-2/soak'; out.mkdir(parents=True, exist_ok=True)
    result = {'scope': f'headless {args.engine} {args.width}x{height}, software rendering; NOT physical iPhone/Telegram evidence (PHYSICAL_IPHONE_UNVERIFIED)', 'cycles': [], 'errors': []}
    try:
        async with async_playwright() as pw:
            opts = {'headless': True}
            if args.engine == 'chromium':
                opts.update(executable_path=shutil.which('chromium') or '/opt/pw-browsers/chromium', args=['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'])
            browser = await getattr(pw, args.engine).launch(**opts)
            context = await browser.new_context(viewport={'width': args.width, 'height': height}, has_touch=True, is_mobile=args.engine != 'firefox')
            page = await context.new_page()
            page.on('pageerror', lambda e: result['errors'].append(str(e)))
            await page.route('**/js/__cq_harness_planner.js', lambda r: r.fulfill(body=WORKER, content_type='application/javascript'))
            async def fixture(**kw):
                r = await page.request.post(base + '/fixture', data={'fieldMissions': True, **kw}); assert r.ok, await r.text()
            async def reconnect():
                await page.evaluate('Conquest.view.reset();Conquest.view.authority.actionBusy=true')
                await page.wait_for_function('!Conquest.view.authority.busy')
                await page.evaluate('Conquest.view.authority.state=null;Conquest.view.authority.queue=[];Conquest.view.authority.phase=null;Conquest.view.authority.connect()')
                await page.wait_for_function('Conquest.view.authority.state&&Conquest.view.authority.connected')
                await page.evaluate('Conquest.view.authority.actionBusy=false')
            await fixture(veteranLoadout=True, engineering=True, position=[890, 945])
            await page.goto(base + '/index.html'); await page.wait_for_function('typeof Conquest!=="undefined"')
            await page.evaluate('closeAll();save.welcomed=true;uiDirty();'); await page.locator('[data-act="conquest"]').click()
            await page.get_by_role('button', name='ENTER CONQUEST', exact=True).click()
            if await page.locator('.cq-transmission').count(): await page.locator('.cq-story-start').click()
            await page.wait_for_function('Conquest.view?.authority?.connected&&Conquest.view.pending===0', timeout=90000)
            await page.wait_for_timeout(8000); await page.evaluate(HOOK)
            defs = await page.evaluate('ConquestCombat.operations')
            ids = [i for i in defs if i.startswith('raid-') and (args.all or i[-1] in '123')]
            j = fb.Journey(page, base, args.width, height, f'soak-{args.engine}-{args.width}')
            start = time.monotonic(); n = 0
            while time.monotonic() - start < args.minutes * 60:
                o = defs[ids[n % len(ids)]]; n += 1
                await fixture(veteranLoadout=True, engineering=True, position=o['entry']); await reconnect()
                await page.get_by_role('button', name='OPEN MAP', exact=True).click(); await page.locator('.cq-operation-board summary').click()
                await page.get_by_role('button', name='BRIEF · ' + o['name'], exact=True).click()
                await page.get_by_role('button', name='START MISSION', exact=True).click()
                await page.wait_for_function('(id)=>Conquest.view.authority.state.mission===id', arg=o['id'])
                await page.evaluate('cqFrames.length=0'); t0 = time.monotonic(); outcome = 'victory'
                try: await j.win(o['id'])
                except AssertionError: outcome = 'defeat'
                frames = await page.evaluate('cqFrames.splice(0)'); during = await page.evaluate(SAMPLE)
                for label in ['RETURN TO EXPLORATION', 'RESPAWN AT REFUGE']:
                    b = page.get_by_role('button', name=label, exact=True)
                    if await b.count(): await b.click()
                await page.wait_for_timeout(1500); await page.evaluate('window.gc&&gc()'); await page.wait_for_timeout(400)
                after = await page.evaluate(SAMPLE)
                fs = sorted(frames) or [0]
                cycle = {'n': n, 'raid': o['id'], 'danger': o['danger'], 'outcome': outcome, 'wallSeconds': round(time.monotonic() - t0, 1), 'elapsedMinutes': round((time.monotonic() - start) / 60, 2),
                         'combatFrames': len(frames), 'frameMedianMs': fs[len(fs) // 2], 'frameP95Ms': fs[int(len(fs) * .95)], 'worstMs': fs[-1], 'over100ms': sum(f > 100 for f in frames), 'over50ms': sum(f > 50 for f in frames),
                         'combat': during, 'afterReturn': after}
                result['cycles'].append(cycle)
                print('CYCLE', json.dumps({k: cycle[k] for k in ['n', 'raid', 'outcome', 'elapsedMinutes', 'combatFrames', 'frameMedianMs', 'frameP95Ms', 'worstMs', 'over100ms']}), 'heapMB', round((after['jsHeap'] or 0) / 1e6, 1), 'geo', after['geometries'], 'programs', after['programs'], flush=True)
                (out / f'{args.engine}-{args.width}.json').write_text(json.dumps(result, indent=1))
            await browser.close()
    finally:
        server.terminate(); await server.wait()
    c = result['cycles']
    result['summary'] = {'raids': len(c), 'minutes': c[-1]['elapsedMinutes'] if c else 0, 'victories': sum(x['outcome'] == 'victory' for x in c), 'combatFrames': sum(x['combatFrames'] for x in c),
                         'framesOver100ms': sum(x['over100ms'] for x in c), 'worstMs': max((x['worstMs'] for x in c), default=0), 'pageErrors': len(result['errors']),
                         'heapMB': [round(min(x['afterReturn']['jsHeap'] or 0 for x in c) / 1e6, 1), round(max(x['afterReturn']['jsHeap'] or 0 for x in c) / 1e6, 1)] if c else None,
                         'geometries': [min(x['afterReturn']['geometries'] for x in c), max(x['afterReturn']['geometries'] for x in c)] if c else None,
                         'programs': [min(x['afterReturn']['programs'] for x in c), max(x['afterReturn']['programs'] for x in c)] if c else None}
    (out / f'{args.engine}-{args.width}.json').write_text(json.dumps(result, indent=1))
    print('SUMMARY', json.dumps(result['summary']), flush=True)
    assert not result['errors'], result['errors']

if __name__ == '__main__':
    a = argparse.ArgumentParser(); a.add_argument('--engine', choices=['chromium', 'webkit'], default='chromium'); a.add_argument('--width', type=int, default=390)
    a.add_argument('--minutes', type=float, default=12); a.add_argument('--port', type=int, default=8870); a.add_argument('--all', action='store_true')
    asyncio.run(main(a.parse_args()))
