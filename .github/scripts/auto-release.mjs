#!/usr/bin/env node
/* Auto-release (Session 7B, owner brief docs/conquest/audit/SESSION_07B_CITADEL_BRIEF.md, STEP 1).
 *
 * Merges a pull request by itself when ALL of these hold:
 *   - its head branch is claude/* in THIS repository (never a fork) and it targets the default branch;
 *   - it is ready (not a draft) and carries the auto-release label;
 *   - every check on its head commit finished green: every check run (latest per name) and every workflow run for that commit is
 *     completed with success, neutral or skipped (GitHub counts a skipped job as passing), every commit status is success, and at
 *     least one check ran (this gate's own job is left out);
 *   - it has no conflicts (GitHub reports it mergeable).
 * The merge is a merge commit titled as #150-#153 were ("Merge pull request #N: <title>"), pinned to the checked head commit.
 *
 * A merge made with the workflow's token starts no push workflows, so afterwards it dispatches every workflow that a push to the
 * default branch would have run for the merged files: each workflow file at the merge commit is read, its on.push branches /
 * branches-ignore / paths / paths-ignore filters are applied to the pull request's files, and the matching ones are started with
 * workflow_dispatch on the default branch. GitHub Pages: if no Pages build for the merge commit starts within a few minutes, the
 * workflow requests one (POST /pages/builds) and waits for it.
 *
 * Pure decision helpers are exported for dev/tests/auto-release.mjs; main() runs only when this file is executed. */
import {fileURLToPath} from 'node:url';
import {appendFileSync} from 'node:fs';

export const LABEL='auto-release';
export const BRANCH_PREFIX='claude/';
export const GATE_JOB='auto-release gate';                       // this workflow's job name (its own check run is left out)
export const GATE_PATH='.github/workflows/auto-release.yml';     // this workflow's file (its own runs are left out)
export const GREEN=new Set(['success','neutral','skipped']);

// ---- GitHub path filters (docs: "Filter pattern cheat sheet"): * any characters but '/', ** any characters, ? one character,
// + one or more of the preceding character, [..] a class; a leading ! negates; the last matching pattern wins ---------------------
export function globToRegExp(glob){
 let re='';
 for(let i=0;i<glob.length;i++){
  const c=glob[i];
  if(c==='*'){if(glob[i+1]==='*'){i++;if(glob[i+1]==='/'){i++;re+='(?:.*/)?';}else re+='.*';}else re+='[^/]*';}
  else if(c==='?')re+='[^/]';
  else if(c==='+')re+='+';
  else if(c==='['){const j=glob.indexOf(']',i+1);if(j>i){re+='['+glob.slice(i+1,j).replace(/\\/g,'\\\\')+']';i=j;}else re+='\\[';}
  else re+=c.replace(/[.^${}()|\\/]/g,'\\$&');
 }
 return new RegExp('^'+re+'$');
}
// true when the filter list (in order, with ! negations) selects this path
export function filterMatch(patterns,path){
 let hit=false;
 for(const raw of patterns){const p=String(raw);if(p.startsWith('!')){if(globToRegExp(p.slice(1)).test(path))hit=false;}else if(globToRegExp(p).test(path))hit=true;}
 return hit;
}

// ---- a small YAML reader for the `on:` block of a workflow (maps, block lists, flow lists, quoted / plain scalars, comments).
// The rest of the file is never needed. Returns the trigger value: a string, a list of names, or a map name -> spec (null when
// the trigger has no settings, e.g. "workflow_dispatch:"). ---------------------------------------------------------------------
function stripComment(line){
 let q=null;
 for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c===q)q=null;continue;}if(c==='"'||c==='\''){q=c;continue;}if(c==='#'&&(i===0||/\s/.test(line[i-1])))return line.slice(0,i);}
 return line;
}
function scalar(v){
 v=v.trim();if(v===''||v==='~'||v==='null')return null;
 if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith('\'')&&v.endsWith('\'')))return v.slice(1,-1);
 if(v==='true')return true;if(v==='false')return false;
 return v;
}
function flowList(v){
 const inner=v.trim().slice(1,-1),out=[];let cur='',q=null;
 for(const c of inner){if(q){cur+=c;if(c===q)q=null;continue;}if(c==='"'||c==='\''){q=c;cur+=c;continue;}if(c===','){if(cur.trim())out.push(scalar(cur));cur='';continue;}cur+=c;}
 if(cur.trim())out.push(scalar(cur));
 return out;
}
function value(v){const t=v.trim();if(t.startsWith('['))return flowList(t);if(t.startsWith('{'))return t;/* inline maps (inputs) are not needed */return scalar(t);}
export function parseOn(text){
 const lines=String(text).split(/\r?\n/).map(l=>stripComment(l).replace(/\s+$/,''));
 let start=-1,inline=null;
 for(let i=0;i<lines.length;i++){const m=/^(?:on|"on"|'on'):(.*)$/.exec(lines[i]);if(m){start=i;inline=m[1].trim();break;}}
 if(start<0)return null;
 if(inline)return value(inline);
 const block=[];
 for(let i=start+1;i<lines.length;i++){const l=lines[i];if(!l.trim())continue;if(!/^\s/.test(l))break;block.push(l);}
 let pos=0;
 const indent=l=>l.length-l.trimStart().length;
 function parseBlock(ind){
  if(pos>=block.length)return null;
  if(block[pos].trimStart().startsWith('- ')||block[pos].trim()==='-'){
   const out=[];
   while(pos<block.length&&indent(block[pos])===ind&&block[pos].trimStart().startsWith('-')){out.push(scalar(block[pos].trimStart().slice(1)));pos++;
    while(pos<block.length&&indent(block[pos])>ind)pos++;/* nested items under a list entry are not used by triggers */}
   return out;
  }
  const out={};
  while(pos<block.length&&indent(block[pos])===ind){
   const l=block[pos].trim(),k=l.indexOf(':');
   if(k<0){pos++;continue;}
   const key=scalar(l.slice(0,k)),rest=l.slice(k+1);pos++;
   if(rest.trim())out[key]=value(rest);
   else if(pos<block.length&&indent(block[pos])>ind)out[key]=parseBlock(indent(block[pos]));
   else out[key]=null;
  }
  return out;
 }
 return parseBlock(indent(block[0]||''));
}
// the trigger map in one shape: name -> spec ({} when it has no settings)
export function triggers(on){
 if(on===null||on===undefined)return {};
 if(typeof on==='string')return {[on]:{}};
 if(Array.isArray(on))return Object.fromEntries(on.map(n=>[n,{}]));
 if(typeof on==='object')return Object.fromEntries(Object.entries(on).map(([k,v])=>[k,v&&typeof v==='object'&&!Array.isArray(v)?v:{}]));
 return {};
}
const asList=v=>v===null||v===undefined?null:Array.isArray(v)?v.map(String):[String(v)];
// would a push of these files to `branch` start this workflow? (GitHub: branches / branches-ignore, then paths / paths-ignore;
// with both a branch and a path filter, both must pass; a rename counts both names)
export function pushWouldRun(on,branch,files){
 const T=triggers(on),push=T.push;if(!push)return false;
 const br=asList(push.branches),bri=asList(push['branches-ignore']);
 if(br&&!filterMatch(br,branch))return false;
 if(bri&&filterMatch(bri,branch))return false;
 const paths=asList(push.paths),ign=asList(push['paths-ignore']);
 if(!paths&&!ign)return true;
 if(paths)return files.some(f=>filterMatch(paths,f));
 return files.some(f=>!filterMatch(ign,f));
}
export const dispatchable=on=>'workflow_dispatch' in triggers(on);

// ---- the gate ----------------------------------------------------------------------------------------------------------------
// why this pull request may not be merged, or null when it is a candidate (mergeability and checks are judged separately)
export function ineligible(pr,repoFullName,defaultBranch){
 if(!pr||pr.state!=='open')return 'not open';
 if(pr.draft)return 'draft';
 if(!(pr.labels||[]).some(l=>(l?.name??l)===LABEL))return 'no '+LABEL+' label';
 if(!pr.head?.repo||pr.head.repo.full_name!==repoFullName||pr.base?.repo?.full_name!==repoFullName||(pr.head.repo.id!==undefined&&pr.base?.repo?.id!==undefined&&pr.head.repo.id!==pr.base.repo.id))return 'head is not in this repository (fork)';
 if(!String(pr.head.ref||'').startsWith(BRANCH_PREFIX))return 'head branch is not '+BRANCH_PREFIX+'*';
 if(pr.base.ref!==defaultBranch)return 'base is not '+defaultBranch;
 return null;
}
// every check on the head commit finished green? checkRuns: latest check runs of the commit; workflowRuns: Actions runs of the
// commit; statuses: the commit's statuses (combined endpoint). Returns {ok, pending:[...], failed:[...], counted}
export function checksVerdict(checkRuns,workflowRuns,statuses){
 const pending=[],failed=[];let counted=0;
 for(const r of checkRuns||[]){
  if(r.app?.slug==='github-actions'&&r.name===GATE_JOB)continue;
  counted++;
  if(r.status!=='completed')pending.push('check '+r.name);else if(!GREEN.has(r.conclusion))failed.push('check '+r.name+' = '+r.conclusion);
 }
 // the newest run of each workflow (a re-run keeps its id; a new run replaces an older one of the same workflow)
 const newest=new Map();
 for(const w of workflowRuns||[]){if(w.path===GATE_PATH||String(w.path||'').endsWith('/auto-release.yml'))continue;const k=w.workflow_id??w.path??w.name,o=newest.get(k);if(!o||Date.parse(w.created_at||0)>=Date.parse(o.created_at||0))newest.set(k,w);}
 for(const w of newest.values()){if(w.status!=='completed')pending.push('workflow '+w.name);else if(!GREEN.has(w.conclusion))failed.push('workflow '+w.name+' = '+w.conclusion);}
 for(const s of statuses||[]){counted++;if(s.state==='pending')pending.push('status '+s.context);else if(s.state!=='success')failed.push('status '+s.context+' = '+s.state);}
 if(!counted)return {ok:false,pending:['no check has run on the head commit yet'],failed,counted};
 return {ok:!pending.length&&!failed.length,pending,failed,counted};
}
export const mergeTitle=pr=>'Merge pull request #'+pr.number+': '+pr.title;

// ---- the GitHub API ----------------------------------------------------------------------------------------------------------
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// the poll interval (the unit test runs it against a local fake API with a 1 ms interval)
const POLL=()=>Number(process.env.AUTO_RELEASE_POLL_MS)||10000;
function client(token,repo,api='https://api.github.com'){
 async function call(method,path,body){
  for(let attempt=0;;attempt++){
   const r=await fetch(api+path.replace('{repo}',repo),{method,headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'auto-release'},body:body===undefined?undefined:JSON.stringify(body)});
   if(r.status>=500&&attempt<3){await sleep(POLL()*.2*(attempt+1));continue;}
   const text=await r.text();let json=null;try{json=text?JSON.parse(text):null;}catch(_){json={raw:text};}
   return {status:r.status,json};
  }
 }
 async function all(path,key){const out=[];for(let page=1;page<=30;page++){const sep=path.includes('?')?'&':'?',r=await call('GET',path+sep+'per_page=100&page='+page);if(r.status!==200)throw new Error('GET '+path+' -> '+r.status+' '+JSON.stringify(r.json).slice(0,300));const items=key?r.json[key]:r.json;out.push(...items);if(items.length<100)break;}return out;}
 return {call,all};
}
function log(...a){console.log(...a);}
function summary(md){const f=process.env.GITHUB_STEP_SUMMARY;if(f)try{appendFileSync(f,md+'\n');}catch(_){}}

async function workflowsAt(gh,sha){
 const r=await gh.call('GET','/repos/{repo}/contents/.github/workflows?ref='+sha);if(r.status!==200)throw new Error('workflow list at '+sha+' -> '+r.status);
 const out=[];
 for(const f of r.json.filter(f=>f.type==='file'&&/\.ya?ml$/.test(f.name))){
  const c=await gh.call('GET','/repos/{repo}/contents/'+encodeURI(f.path)+'?ref='+sha);if(c.status!==200)continue;
  out.push({file:f.name,path:f.path,on:parseOn(Buffer.from(c.json.content,'base64').toString('utf8'))});
 }
 return out;
}
async function ensurePages(gh,sha){
 const site=await gh.call('GET','/repos/{repo}/pages');
 if(site.status===404)return 'GitHub Pages is not enabled: nothing to build';
 if(site.status!==200)return 'GitHub Pages: could not read the site ('+site.status+')';
 if(site.json.build_type==='workflow')return 'GitHub Pages builds from a workflow (dispatched with the push workflows)';
 const started=async()=>{const b=await gh.call('GET','/repos/{repo}/pages/builds/latest');if(b.status===200&&b.json?.commit===sha)return b.json;
  const runs=await gh.call('GET','/repos/{repo}/actions/runs?head_sha='+sha+'&per_page=50');const run=(runs.json?.workflow_runs||[]).find(w=>/pages build and deployment/i.test(w.name||''));return run?{status:run.status==='completed'?(run.conclusion==='success'?'built':'errored'):'building',run:run.html_url}:null;};
 let b=null;
 for(let i=0;i<18&&!b;i++){b=await started();if(!b)await sleep(POLL());}   // up to 3 minutes for the build the merge should start
 let requested=false;
 if(!b){const q=await gh.call('POST','/repos/{repo}/pages/builds');requested=true;log('Pages build requested:',q.status,JSON.stringify(q.json).slice(0,200));if(q.status>=300)return 'GitHub Pages did not build the merge and the build request failed ('+q.status+')';}
 for(let i=0;i<60;i++){b=await started();if(b&&['built','errored'].includes(b.status))break;await sleep(POLL());}   // up to 10 more minutes
 return 'GitHub Pages '+(requested?'(build requested by this workflow: none had started) ':'')+(b?b.status:'not seen')+(b?.run?' '+b.run:'');
}

async function release(gh,pr,defaultBranch){
 const head=pr.head.sha,body='Auto-release: every check green on '+head.slice(0,7)+'; label '+LABEL+'; head branch '+pr.head.ref+'.';
 const m=await gh.call('PUT','/repos/{repo}/pulls/'+pr.number+'/merge',{merge_method:'merge',sha:head,commit_title:mergeTitle(pr),commit_message:body});
 if(m.status!==200||!m.json?.merged){log('MERGE REFUSED #'+pr.number,m.status,JSON.stringify(m.json).slice(0,400));summary('### #'+pr.number+' not merged\nGitHub refused the merge ('+m.status+'): '+(m.json?.message||'')+'\n');return false;}
 const sha=m.json.sha;log('MERGED #'+pr.number+' as',sha);
 const files=[];for(const f of await gh.all('/repos/{repo}/pulls/'+pr.number+'/files')){files.push(f.filename);if(f.previous_filename)files.push(f.previous_filename);}
 const lines=['### Merged #'+pr.number+' as `'+sha.slice(0,7)+'`',mergeTitle(pr),'','| Workflow a push to '+defaultBranch+' would run | Result |','|---|---|'];
 let flows=[];try{flows=await workflowsAt(gh,sha);}catch(e){lines.push('| (could not read the workflows: '+e.message+') | |');}
 for(const w of flows){
  if(w.path===GATE_PATH||!pushWouldRun(w.on,defaultBranch,files))continue;
  if(!dispatchable(w.on)){lines.push('| '+w.file+' | cannot start: no workflow_dispatch trigger |');continue;}
  const d=await gh.call('POST','/repos/{repo}/actions/workflows/'+encodeURIComponent(w.file)+'/dispatches',{ref:defaultBranch});
  lines.push('| '+w.file+' | '+(d.status===204||d.status===200?'dispatched on '+defaultBranch:'dispatch failed ('+d.status+' '+(d.json?.message||'')+')')+' |');
  log('dispatch',w.file,d.status);
 }
 lines.push('',await ensurePages(gh,sha));
 summary(lines.join('\n'));log(lines.join('\n'));
 return true;
}

export async function main(env=process.env){
 const token=env.GITHUB_TOKEN,repo=env.GITHUB_REPOSITORY;if(!token||!repo)throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required');
 const gh=client(token,repo,env.GITHUB_API_URL||'https://api.github.com');
 const meta=await gh.call('GET','/repos/{repo}');if(meta.status!==200)throw new Error('repository '+meta.status);
 const defaultBranch=meta.json.default_branch,only=String(env.PR_NUMBER||'').trim();
 const open=only?[(await gh.call('GET','/repos/{repo}/pulls/'+only)).json]:await gh.all('/repos/{repo}/pulls?state=open&base='+defaultBranch);
 let merged=0,refused=0;
 for(const listed of open){
  if(!listed?.number)continue;
  let why=ineligible(listed,repo,defaultBranch);if(why){log('#'+listed.number+': '+why);continue;}
  // mergeability is computed by GitHub in the background: ask again until it is known
  let pr=null;for(let i=0;i<6;i++){pr=(await gh.call('GET','/repos/{repo}/pulls/'+listed.number)).json;if(pr.mergeable!==null&&pr.mergeable!==undefined)break;await sleep(POLL()*.4);}
  why=ineligible(pr,repo,defaultBranch);if(why){log('#'+pr.number+': '+why);continue;}
  if(pr.mergeable!==true){log('#'+pr.number+': not mergeable ('+pr.mergeable_state+'): conflicts or unknown');continue;}
  const sha=pr.head.sha;
  const checks=await gh.all('/repos/{repo}/commits/'+sha+'/check-runs?filter=latest','check_runs');
  const runs=await gh.all('/repos/{repo}/actions/runs?head_sha='+sha,'workflow_runs');
  const st=await gh.call('GET','/repos/{repo}/commits/'+sha+'/status');
  const v=checksVerdict(checks,runs,st.json?.statuses||[]);
  if(!v.ok){log('#'+pr.number+' at '+sha.slice(0,7)+': waiting',JSON.stringify({pending:v.pending,failed:v.failed}));continue;}
  // the head must not have moved while the checks were read
  const again=(await gh.call('GET','/repos/{repo}/pulls/'+pr.number)).json;if(again.head?.sha!==sha||ineligible(again,repo,defaultBranch)){log('#'+pr.number+': changed while checking; next run decides');continue;}
  log('#'+pr.number+' at '+sha.slice(0,7)+': every check green ('+v.counted+'), no conflicts: merging');
  if(await release(gh,again,defaultBranch))merged++;else refused++;
 }
 log('merged',merged,'refused',refused);
 // a refused merge fails this run so it shows; waiting for checks is not a failure
 if(refused)process.exitCode=1;
 return {merged,refused};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])main().catch(e=>{console.error(e);process.exit(1);});
