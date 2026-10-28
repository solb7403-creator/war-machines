# Actual shared sim, accelerated in an isolated browser; exercises frozen Lab proofs including round swaps.
import asyncio,ast,json,pathlib,subprocess
from harness import start_dev,open_game
from playwright.async_api import async_playwright
HERE=pathlib.Path(__file__).resolve().parent
PLAY=next(ast.literal_eval(n.value) for n in ast.parse((HERE/'proofreal.py').read_text()).body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='PLAY' for t in n.targets))
PLAY=PLAY.replace("if(state==='round'){startRound();continue;}","if(state==='round'){switchChassis(me.cls==='scout'?'vanguard':'scout');startRound();continue;}")
PLAY=PLAY.replace("if(me.hp>0&&me.ctl==='me'&&!me.dash){","if(me.hp>0&&me.ctl==='me'&&!me.dash){if(!me.brain){me.brain=newBrain();me.strafe=1;me.strafeT=1.5;}")
PLAY=PLAY.replace('const tk=tankOf(myLoadout(),1);','const tk=tankOf(battleLoadout,1);const variants=battleLoadout.chs.map(c=>{const t=tankOf({...battleLoadout,c},hpScale());return {ci:CHORDER.indexOf(c.c),mhp:t.mhp,spdM:t.spdM};});')
PLAY=PLAY.replace('return {c:{g:matchG,','return {c:{variants,g:matchG,')
async def main():
 start_dev(); recs=[]
 async with async_playwright() as p:
  b,pg,errs=await open_game(p,user={'id':882009,'first_name':'Lab proofs'})
  await pg.evaluate('()=>{save.cOwn.scout=[0];labEnsure(save,myLoadout());save.welcomed=true;closeAll();}')
  for i,g in enumerate(['arena','arena','zone','crystal','bounty','royale','boss']):
   r=await pg.evaluate(PLAY,{'g':g,'m':'1v1' if i<2 or g=='royale' else '2v2','map':'classic','mp':25,'max':bool(i%2)})
   assert 'err' not in r,r
   recs.append(r)
  assert not errs,errs
  await b.close()
 path=pathlib.Path('/tmp/lunar-lab-proofreal.json');path.write_text(json.dumps(recs))
 result=subprocess.run(['node',str(HERE/'wtest/proofcheck.mjs'),str(path)],capture_output=True,text=True)
 print(result.stdout);print(result.stderr);assert result.returncode==0
 print('PASS 7 Lab simulated matches, frozen variant proofs including Arena round counterpicks')
asyncio.run(main())
