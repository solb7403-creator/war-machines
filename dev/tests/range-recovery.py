"""Focused recovery/cancellation/error and post-range ranked-proof regression, entirely fake/local."""
import asyncio,ast,json,pathlib,subprocess,time
from harness import start_dev,open_game,dev
from playwright.async_api import async_playwright
HERE=pathlib.Path(__file__).resolve().parent
PLAY=next(ast.literal_eval(n.value) for n in ast.parse((HERE/'proofreal.py').read_text()).body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='PLAY' for t in n.targets))
UID=int(time.time()*1000)%1000000000
async def main():
 server=start_dev()
 try:
  async with async_playwright() as p:
   b,pg,errs=await open_game(p,390,844,eco='server',user={'id':UID,'first_name':'Recovery'})
   await pg.wait_for_function('!!save.lab');await pg.wait_for_timeout(2800)
   # A REAL fake-server ticket, queued quit result from a previously abandoned ranked fight.
   tok=await pg.evaluate("""async()=>{closeAll();const r=await api('/api/match/start',{g:'arena',m:'1v1',map:'classic',labRev:save.lab.rev,fv:1,pv:1,L:myLoadout()});if(!r.tok)throw Error(JSON.stringify(r));save.mq=[{tok:r.tok,r:{quit:true}}];save.pendingTx={memo:'existing-wallet-recovery',amount:1,since:Date.now()};save.payQ=[{rec:{memo:'existing-outbox'},t:Date.now()}];store();setTab('garage');return r.tok;}""")
   await pg.evaluate("""tok=>{window.__net=[];window.__bad=[];const f=fetch;window.fetch=(u,o={})=>{if(o.method==='POST'){const body=JSON.parse(o.body||'{}');if(String(u).endsWith('/api/match/end')&&body.tok===tok)__net.push('existing-ranked-recovery');else __bad.push(String(u));}return f(u,o);};window.__pending=JSON.stringify([save.pendingTx,save.payQ]);window.__random=random;}""",tok)
   await pg.locator('[data-act="rangecard"][data-arg="m_legacy"]').click()
   await pg.locator('[data-act="rangestart"]').click();await pg.wait_for_function('!!rangeRun?.sim')
   frozen=await pg.evaluate('()=>JSON.stringify(rangeRun.cfg)')
   await pg.evaluate('async()=>{rangeRun.paused=true;await flushMatches();}')
   assert await pg.evaluate('()=>save.mq.length')==0,'actual valid pending ranked submission recovered'
   assert await pg.evaluate('()=>__net')==['existing-ranked-recovery']
   assert await pg.evaluate('()=>JSON.stringify(rangeRun.cfg)')==frozen
   assert await pg.evaluate('()=>JSON.stringify([save.pendingTx,save.payQ])===__pending')
   assert await pg.evaluate('()=>rangeHistory("m_legacy").length')==0
   after_recovery=dev('/__dump')['eco']['tg_'+str(UID)]
   assert after_recovery['mp']==1 and after_recovery['pts']==0,'only explicit ranked quit counted'
   await pg.locator('[data-act="rangepause"]').click();await pg.locator('[data-act="rangestop"]').click()
   assert await pg.evaluate('()=>rangeHistory("m_legacy").length')==1
   assert dev('/__dump')['eco']['tg_'+str(UID)]==after_recovery
   # 30 retry/exit cycles: bounded realm/GPU lifetime, no account work or orphan frames.
   for i in range(30):
    await pg.evaluate('()=>rangeStart(true)');await pg.wait_for_function('!!rangeRun?.sim')
    await pg.evaluate('()=>{rangeFrame(1/60);rangeExit();}')
    assert await pg.evaluate('()=>document.querySelectorAll("iframe").length')==0
   assert await pg.evaluate('()=>__bad')==[]
   assert await pg.evaluate('()=>random===__random&&random===Math.random'),'ranked RNG unchanged'
   assert await pg.evaluate('()=>JSON.stringify([save.pendingTx,save.payQ])===__pending')
   assert dev('/__dump')['eco']['tg_'+str(UID)]==after_recovery
   # Reload preserves summaries and pending fields; does not forfeit or score a range.
   await pg.evaluate('()=>{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}')
   await pg.reload();await pg.wait_for_function('!!save.lab')
   assert await pg.evaluate('()=>rangeHistory("m_legacy").length')==1
   assert await pg.evaluate('()=>save.pendingTx.memo')=='existing-wallet-recovery'
   assert await pg.evaluate('()=>!rangeRun&&save.mq.length===0')
   # Cancelling a slow asset load before it resolves cannot start a hidden practice match.
   await pg.evaluate('()=>{closeAll();setTab("garage");openRange("m_legacy");}')
   await pg.evaluate('()=>{window.__append=document.body.appendChild.bind(document.body);document.body.appendChild=n=>n.tagName==="IFRAME"?n:__append(n);}')
   await pg.locator('[data-act="rangestart"]').click();await pg.wait_for_function('!!rangeRun')
   await pg.evaluate('()=>findOv("rangesetup").close()')
   assert await pg.evaluate('()=>rangeRun===null'),'closing loading sheet disposes engine'
   await pg.evaluate('()=>{document.body.appendChild=__append;}')
   await pg.wait_for_function('document.querySelectorAll("[data-act=rangestart]").length===0')
   # A failed practice engine is disposed locally, not retried by the main ranked loop.
   await pg.evaluate('()=>openRange("m_legacy")');await pg.locator('[data-act="rangestart"]').click();await pg.wait_for_function('!!rangeRun?.sim')
   await pg.evaluate("()=>{rangeRun.sim.step=()=>{throw Error('injected range failure')};rangeFrame(1/30);}")
   assert await pg.evaluate('()=>rangeRun===null&&!inBattle()')
   assert not errs,errs
   await b.close()
   # One actual ordinary AI match after range disposal, with the existing proof driver/checker.
   b,local,le=await open_game(p,390,740,eco='local',user={'id':UID+1,'first_name':'Ranked regression'})
   await local.evaluate('()=>{closeAll();labEnsure(save,myLoadout());setTab("garage");openRange("m_legacy");}')
   await local.locator('[data-act="rangestart"]').click();await local.wait_for_function('!!rangeRun?.sim')
   await local.evaluate('()=>rangeExit()')
   rec=await local.evaluate(PLAY,{'g':'arena','m':'1v1','map':'classic','mp':25,'max':False})
   assert 'err' not in rec,rec
   assert not le,le
   await b.close()
  path=pathlib.Path('/tmp/lunar-session4-ranked-proof.json');path.write_text(json.dumps([rec]))
  out=subprocess.run(['node',str(HERE/'wtest/proofcheck.mjs'),str(path)],capture_output=True,text=True)
  print(out.stdout);print(out.stderr);assert out.returncode==0
  print('PASS real queued ranked recovery, pending payment preservation, 30 disposals, reload, slow-load cancel, failure cleanup and 1 post-range ordinary Arena/proof')
 finally:
  if server:server.terminate();server.wait()
asyncio.run(main())
