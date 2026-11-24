// Session 7B STEP 1: the auto-release workflow's decisions (.github/scripts/auto-release.mjs), against the real workflow files
// and a local fake GitHub API (no network): who may be merged, when every check is green, which push workflows a merge starts,
// the merge commit's form, and the GitHub Pages fallback.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const AR=await import(path.join(ROOT,'.github/scripts/auto-release.mjs'));
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL',m);}};

// ---- GitHub path filters ----
const F=AR.filterMatch;
ok(F(['worker/**'],'worker/src/conquest-town.js')&&F(['worker/**'],'worker/build-sim.mjs'),'** crosses folders');
ok(F(['js/**'],'js/conquest/citadel.js')&&!F(['js/**'],'jsx/a.js'),'js/** is the js folder only');
ok(F(['dev/tests/combat-*.mjs'],'dev/tests/combat-sim.mjs')&&!F(['dev/tests/combat-*.mjs'],'dev/tests/x/combat-sim.mjs'),'* stops at /');
ok(F(['dev/tests/conquest*'],'dev/tests/conquest-citadel.mjs')&&!F(['dev/tests/conquest*'],'dev/tests/wtest/conquest.mjs'),'conquest* in one folder');
ok(F(['dev/tests/wtest/conquest*'],'dev/tests/wtest/conquest-citadel.mjs'),'wtest/conquest*');
ok(F(['**/*.md'],'docs/a/b.md')&&F(['**/*.md'],'a.md'),'**/ also matches the root');
ok(!F(['docs/**','!docs/secret/**'],'docs/secret/x.md')&&F(['docs/**','!docs/secret/**'],'docs/x.md'),'a later ! wins');
ok(F(['version.json'],'version.json')&&!F(['version.json'],'versionXjson'),'a dot is a dot');
ok(F(['main'],'main')&&!F(['main'],'claude/x')&&F(['claude/*'],'claude/x')&&!F(['claude/*'],'claude/x/y'),'branch patterns');

// ---- the `on:` block of every workflow in this repository ----
const WF=path.join(ROOT,'.github/workflows'),files=fs.readdirSync(WF).filter(f=>/\.ya?ml$/.test(f));
const on={};for(const f of files)on[f]=AR.parseOn(fs.readFileSync(path.join(WF,f),'utf8'));
ok(files.every(f=>on[f]!==null),'every workflow has an on: block');
const T=f=>AR.triggers(on[f]);
ok(T('deploy-worker.yml').push?.branches?.[0]==='main'&&T('deploy-worker.yml').push.paths.includes('worker/**')&&T('deploy-worker.yml').push.paths.includes('js/**')&&AR.dispatchable(on['deploy-worker.yml']),'deploy-worker: push to main, worker/** and js/**, dispatchable');
ok(JSON.stringify(T('deploy-rules.yml').push?.paths)==='["database.rules.json",".github/workflows/deploy-rules.yml"]'&&AR.dispatchable(on['deploy-rules.yml']),'deploy-rules: its two paths, dispatchable');
ok(T('graphify-code-index.yml').push?.paths?.includes('worker/src/**')&&AR.dispatchable(on['graphify-code-index.yml']),'graphify: push paths, dispatchable');
ok(T('owner-rules.yml').push&&!T('owner-rules.yml').push.paths&&'pull_request' in T('owner-rules.yml')&&AR.dispatchable(on['owner-rules.yml']),'owner-rules: every push to main, dispatchable');
ok(T('equipment-balance.yml').push?.branches?.includes('main')&&T('equipment-balance.yml').push.paths.length>20&&AR.dispatchable(on['equipment-balance.yml']),'equipment-balance: push to main, dispatchable (Session 7B)');
ok(T('lab-ui-check.yml').push?.paths?.includes('js/ui.js')&&AR.dispatchable(on['lab-ui-check.yml']),'lab-ui-check: push to main, dispatchable (Session 7B)');
ok(Object.keys(T('sol-check.yml')).join()==='workflow_dispatch','on: workflow_dispatch (a scalar)');
ok('schedule' in T('channel-post.yml')&&AR.dispatchable(on['channel-post.yml'])&&!T('channel-post.yml').push,'channel-post: schedule + dispatch, no push');
ok(T('auto-release.yml').workflow_run?.workflows?.includes('Conquest regression')&&!T('auto-release.yml').push,'the gate itself never runs on push');
// every workflow that runs on a pull request is one the gate listens to (the last green check releases the pull request)
const gateWatches=new Set(T('auto-release.yml').workflow_run.workflows),names={};for(const f of files)names[f]=/^name:\s*(.+)$/m.exec(fs.readFileSync(path.join(WF,f),'utf8'))?.[1].trim();
for(const f of files)if('pull_request' in T(f)&&f!=='auto-release.yml')ok(gateWatches.has(names[f]),'the gate listens to '+f+' ('+names[f]+')');
// cross-check the reader against PyYAML where it is installed (YAML 1.1 reads the key on as True)
const py=spawnSync('python3',['-c','import json,sys,yaml,os\nout={}\nfor f in sys.argv[1:]:\n d=yaml.safe_load(open(f))\n out[os.path.basename(f)]=d.get(True,d.get("on"))\nprint(json.dumps(out))',...files.map(f=>path.join(WF,f))],{encoding:'utf8'});
if(py.status===0){const ref=JSON.parse(py.stdout);for(const f of files){const a=AR.triggers(on[f]),b=AR.triggers(ref[f]);
 for(const k of new Set([...Object.keys(a),...Object.keys(b)]))for(const fld of ['branches','branches-ignore','paths','paths-ignore','types','workflows'])ok(JSON.stringify(a[k]?.[fld]??null)===JSON.stringify(b[k]?.[fld]??null),f+' '+k+'.'+fld+' as PyYAML reads it');}}
else console.log('(PyYAML not installed here: the reader is checked against the known values above)');

// ---- which push workflows a merge starts ----
const runs=(fl,branch='main')=>files.filter(f=>AR.pushWouldRun(on[f],branch,fl)).sort().join(',');
ok(runs(['js/conquest/citadel.js'])==='deploy-worker.yml,graphify-code-index.yml,owner-rules.yml','a Conquest file: Worker deploy, graph, owner rules');
ok(runs(['docs/conquest/IMPLEMENTATION_CHECKPOINT.md'])==='owner-rules.yml','a docs-only merge: owner rules only');
ok(runs(['database.rules.json'])==='deploy-rules.yml,owner-rules.yml','the database rules: their deploy');
ok(runs(['js/ui.js'])==='deploy-worker.yml,equipment-balance.yml,graphify-code-index.yml,lab-ui-check.yml,owner-rules.yml','js/ui.js: every push workflow that watches it');
ok(runs(['js/conquest/citadel.js'],'claude/x')==='','a push to another branch starts none of them');
ok(AR.pushWouldRun({push:{'paths-ignore':['docs/**']}},'main',['docs/a.md'])===false&&AR.pushWouldRun({push:{'paths-ignore':['docs/**']}},'main',['docs/a.md','js/a.js']),'paths-ignore');
ok(AR.pushWouldRun({push:{'branches-ignore':['main']}},'main',['a'])===false,'branches-ignore');

// ---- who may be merged ----
const repo='solb7403-creator/war-machines',R={full_name:repo,id:7};
const pr=(o={})=>({number:154,title:'Session 7B: x',state:'open',draft:false,labels:[{name:'auto-release'}],head:{ref:'claude/citadel-act-i-logic-jpnnz3',sha:'a'.repeat(40),repo:{...R}},base:{ref:'main',repo:{...R}},mergeable:true,...o});
ok(AR.ineligible(pr(),repo,'main')===null,'a ready claude/* pull request with the label is a candidate');
ok(AR.ineligible(pr({draft:true}),repo,'main')==='draft','a draft waits');
ok(/label/.test(AR.ineligible(pr({labels:[{name:'other'}]}),repo,'main')),'no label: not merged');
ok(/fork/.test(AR.ineligible(pr({head:{ref:'claude/x',sha:'b',repo:{full_name:'someone/war-machines',id:9}}}),repo,'main')),'a fork is never merged');
ok(/fork/.test(AR.ineligible(pr({head:{ref:'claude/x',sha:'b',repo:null}}),repo,'main')),'a deleted fork is never merged');
ok(/fork/.test(AR.ineligible(pr({head:{ref:'claude/x',sha:'b',repo:{full_name:repo,id:9}}}),repo,'main')),'same name, another repository id: never');
ok(/claude/.test(AR.ineligible(pr({head:{ref:'feature/x',sha:'b',repo:{...R}}}),repo,'main')),'only claude/* branches');
ok(/claude/.test(AR.ineligible(pr({head:{ref:'xclaude/x',sha:'b',repo:{...R}}}),repo,'main')),'claude/ must be the prefix');
ok(/base/.test(AR.ineligible(pr({base:{ref:'dev',repo:{...R}}}),repo,'main')),'only into the default branch');
ok(AR.ineligible(pr({state:'closed'}),repo,'main')==='not open','a closed pull request');

// ---- every check green ----
const C=(name,status,conclusion,slug='github-actions')=>({name,status,conclusion,app:{slug}}),W=(id,name,status,conclusion,at='2026-11-24T00:00:00Z',p='.github/workflows/x.yml')=>({workflow_id:id,name,status,conclusion,created_at:at,path:p});
ok(!AR.checksVerdict([],[],[]).ok,'no check ran: wait');
ok(AR.checksVerdict([C('conquest','completed','success'),C('website','completed','skipped'),C('note','completed','neutral')],[W(1,'Conquest regression','completed','success')],[]).ok,'success, skipped and neutral are green');
ok(!AR.checksVerdict([C('conquest','in_progress',null)],[],[]).ok,'a running check: wait');
ok(!AR.checksVerdict([C('conquest','completed','failure')],[],[]).ok,'a failed check: never');
ok(!AR.checksVerdict([C('conquest','completed','cancelled')],[],[]).ok,'a cancelled check: never');
ok(!AR.checksVerdict([C('conquest','completed','timed_out')],[],[]).ok&&!AR.checksVerdict([C('x','completed','action_required')],[],[]).ok,'timed out / action required: never');
ok(AR.checksVerdict([C('conquest','completed','success'),C('auto-release gate','in_progress',null)],[W(1,'Conquest regression','completed','success'),W(2,'Auto-release','in_progress',null,'2026-11-24T00:00:00Z','.github/workflows/auto-release.yml')],[]).ok,'the gate\'s own job and run are left out');
ok(!AR.checksVerdict([C('auto-release gate','completed','success')],[],[]).ok,'the gate alone is not a check');
ok(AR.checksVerdict([C('auto-release gate','completed','success','someone-else')],[],[]).ok,'another app\'s check with the gate\'s name still counts');
ok(!AR.checksVerdict([C('conquest','completed','success')],[W(1,'Conquest regression','completed','success'),W(3,'Website','queued',null)],[]).ok,'a queued workflow run with no job yet: wait');
ok(AR.checksVerdict([C('conquest','completed','success')],[W(1,'Conquest regression','completed','failure','2026-11-24T00:00:00Z'),W(1,'Conquest regression','completed','success','2026-11-24T01:00:00Z')],[]).ok,'the newest run of a workflow decides');
ok(!AR.checksVerdict([C('conquest','completed','success')],[],[{context:'ci/x',state:'pending'}]).ok&&!AR.checksVerdict([C('conquest','completed','success')],[],[{context:'ci/x',state:'failure'}]).ok,'a pending or failed commit status: no');
ok(AR.checksVerdict([C('conquest','completed','success')],[],[{context:'ci/x',state:'success'}]).ok,'a green commit status');
ok(AR.mergeTitle({number:153,title:'docs: Session 7T-P RELEASED'})==='Merge pull request #153: docs: Session 7T-P RELEASED','the merge commit is titled as #150-#153');

// ---- end to end against a local fake GitHub API ----
async function scenario(o){
 const head='c'.repeat(40),merge='d'.repeat(40),calls=[];let pagesLatest=o.pagesBuilt?{commit:merge,status:'built'}:{commit:'e'.repeat(40),status:'built'},requested=false;
 const wfFiles=files.map(f=>({type:'file',name:f,path:'.github/workflows/'+f}));
 const thePr=pr({number:160,head:{ref:o.ref||'claude/citadel-act-i-logic-jpnnz3',sha:head,repo:{...R}},...(o.pr||{})});
 const server=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;const u=new URL(req.url,'http://x'),p=u.pathname,send=(s,j)=>{res.writeHead(s,{'content-type':'application/json'});res.end(j===undefined?'':JSON.stringify(j));};
  calls.push({m:req.method,p,q:u.search,body:body?JSON.parse(body):null});
  if(p==='/repos/'+repo)return send(200,{default_branch:'main'});
  if(p==='/repos/'+repo+'/pulls'&&req.method==='GET')return send(200,u.searchParams.get('page')==='1'?[thePr]:[]);
  if(p==='/repos/'+repo+'/pulls/160'&&req.method==='GET')return send(200,thePr);
  if(p==='/repos/'+repo+'/commits/'+head+'/check-runs')return send(200,{check_runs:u.searchParams.get('page')==='1'?(o.checks||[C('conquest','completed','success'),C('owner-rules','completed','success')]):[]});
  if(p==='/repos/'+repo+'/actions/runs'&&u.searchParams.get('head_sha')===head)return send(200,{workflow_runs:u.searchParams.get('page')==='1'?(o.runs||[W(1,'Conquest regression','completed','success')]):[]});
  if(p==='/repos/'+repo+'/commits/'+head+'/status')return send(200,{statuses:[]});
  if(p==='/repos/'+repo+'/pulls/160/merge'&&req.method==='PUT')return o.refuse?send(405,{message:'Pull Request is not mergeable'}):send(200,{merged:true,sha:merge});
  if(p==='/repos/'+repo+'/pulls/160/files')return send(200,u.searchParams.get('page')==='1'?(o.files||['js/conquest/citadel.js']).map(f=>({filename:f})):[]);
  if(p==='/repos/'+repo+'/contents/.github/workflows')return send(200,wfFiles);
  if(p.startsWith('/repos/'+repo+'/contents/.github/workflows/')){const f=decodeURIComponent(p.split('/').pop());return send(200,{content:Buffer.from(fs.readFileSync(path.join(WF,f))).toString('base64')});}
  if(/\/actions\/workflows\/[^/]+\/dispatches$/.test(p))return send(204);
  if(p==='/repos/'+repo+'/pages')return send(200,{build_type:'legacy'});
  if(p==='/repos/'+repo+'/pages/builds/latest')return send(200,pagesLatest);
  if(p==='/repos/'+repo+'/pages/builds'&&req.method==='POST'){requested=true;pagesLatest={commit:merge,status:'built'};return send(201,{status:'queued'});}
  if(p==='/repos/'+repo+'/actions/runs')return send(200,{workflow_runs:[]});
  send(404,{message:'not in the fake: '+p});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const env={GITHUB_TOKEN:'test-token',GITHUB_REPOSITORY:repo,GITHUB_API_URL:'http://127.0.0.1:'+server.address().port};
 process.env.AUTO_RELEASE_POLL_MS='1';const exitBefore=process.exitCode;
 let result;try{result=await AR.main(env);}finally{server.close();}
 const exit=process.exitCode;process.exitCode=exitBefore;
 return {result,calls,requested,exit,merge:calls.find(c=>c.m==='PUT'),dispatched:calls.filter(c=>c.p.endsWith('/dispatches')).map(c=>decodeURIComponent(c.p.split('/').at(-2))).sort().join(',')};
}
{const s=await scenario({});
 ok(s.result.merged===1&&s.merge?.body?.merge_method==='merge'&&s.merge.body.sha==='c'.repeat(40)&&s.merge.body.commit_title==='Merge pull request #160: Session 7B: x','green: merged as a merge commit pinned to the checked head');
 ok(s.dispatched==='deploy-worker.yml,graphify-code-index.yml,owner-rules.yml','then the push workflows of the merged files are dispatched');
 ok(s.calls.filter(c=>c.p.endsWith('/dispatches')).every(c=>c.body?.ref==='main'),'dispatched on main');
 ok(s.requested,'no Pages build for the merge: the workflow requests one');}
{const s=await scenario({pagesBuilt:true});ok(s.result.merged===1&&!s.requested,'Pages already built the merge: no request');}
{const s=await scenario({files:['database.rules.json']});ok(s.dispatched==='deploy-rules.yml,owner-rules.yml','a rules change: the rules deploy');}
{const s=await scenario({checks:[C('conquest','completed','success'),C('transmission (webkit)','in_progress',null)]});ok(s.result.merged===0&&!s.merge,'a check still running: no merge');}
{const s=await scenario({checks:[C('conquest','completed','failure')]});ok(s.result.merged===0&&!s.merge,'a red check: no merge');}
{const s=await scenario({pr:{draft:true}});ok(s.result.merged===0&&!s.merge,'a draft: no merge');}
{const s=await scenario({pr:{labels:[]}});ok(s.result.merged===0&&!s.merge,'no label: no merge');}
{const s=await scenario({pr:{mergeable:false,mergeable_state:'dirty'}});ok(s.result.merged===0&&!s.merge,'conflicts: no merge');}
{const s=await scenario({ref:'feature/x'});ok(s.result.merged===0&&!s.merge,'not claude/*: no merge');}
{const s=await scenario({pr:{head:{ref:'claude/x',sha:'c'.repeat(40),repo:{full_name:'fork/war-machines',id:99}}}});ok(s.result.merged===0&&!s.merge,'a fork: no merge');}
{const s=await scenario({refuse:true});ok(s.result.refused===1&&s.exit===1&&!s.dispatched,'GitHub refuses the merge: nothing dispatched, the run fails so it shows');}

console.log(JSON.stringify({test:'auto-release',pass,fail}));
if(fail)process.exit(1);
