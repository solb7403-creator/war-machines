R='./'
def patch(f,pairs):
    s=open(R+f).read()
    for old,new in pairs:
        n=s.count(old);assert n==1,(f,n,old[:150]);s=s.replace(old,new)
    open(R+f,'w').write(s)
patch('worker/src/conquest.js',[
 ("""import {hex} from './db.js';""","""import {hex} from './db.js';
import {transaction as store,split as splitState,sweep,COLD_KEYS} from './conquest-store.js';"""),
 ("""async function transaction(env,pid,fn,now){
 const path='conquest/'+pid;
 for(let i=0;i<8;i++){const {v,tag}=await readTag(env,path);const s=v?structuredClone(v):null;const r=await fn(s);if(r.abort)return r;
 const state=r.state,m=Math.floor(now/60000);state.rate=state.rate?.m===m?state.rate:{m,n:0};if(++state.rate.n>90)return {abort:true,error:'rate',status:429,state:v};
 if(await writeIf(env,path,state,tag))return r;}
 throw Error('conquest busy');
}""","""// Session 6C: the record is split (worker/src/conquest-store.js): the hot part is the CAS document, the cold part an immutable blob
// named by it. fn sees the whole state exactly as before; the per-minute request limit is checked on the result, as before.
async function transaction(env,pid,fn,now){
 return store(env,pid,fn,(state,h)=>{const m=Math.floor(now/60000);state.rate=state.rate?.m===m?state.rate:{m,n:0};if(++state.rate.n>90)return {abort:true,error:'rate',status:429,state:h};return null;});
}"""),
 ("""for(let i=0;i<8;i++){const {v,tag}=await readTag(env,'conquest/'+pid);if(!v||v.v!==1)break;const cur=structuredClone(v);acknowledge(cur,c.cqw,view);if(await writeIf(env,'conquest/'+pid,cur,tag))break;}""","""for(let i=0;i<8;i++){const {v,tag}=await readTag(env,'conquest/'+pid);if(!v||v.v!==1)break;const cur=structuredClone(v);acknowledge(cur,c.cqw,view);if(await writeIf(env,'conquest/'+pid,cur,tag))break;}   // the outbox rides the hot part (conquest-store.js): this prune never touches the cold blob"""),
 ("""function result(r){return r.error?response(r.status||409,r.error,r.state):{status:200,body:{ok:true,state:publicState(r.state),replayed:!!r.replayed}};}""","""function result(r){return r.error?response(r.status||409,r.error,r.state):{status:200,body:{ok:true,state:publicState(r.state),replayed:!!r.replayed}};}
// Session 6C: an input reply carries the hot part only when nothing cold changed and the phone already holds this cold version
// (it sends the cv it has); the phone keeps its cold fields (js/conquest/session.js). Every other reply is the whole state.
export function publicHot(s){const {hot}=splitState(s),{lastDigest,rate,raidRoll,...out}=hot;if(s.base)out.base={...s.base,modules:s.base.modules||{}};return out;}"""),
 ("""async function submit(env,a,request,reduce,now){""","""async function submit(env,a,request,reduce,now,cv=null){"""),
 (""" return projected(env,a.pid,await settleAirdrop(env,a.pid,r,now),now);
}
// Session 6 analytics""",""" const out=await projected(env,a.pid,await settleAirdrop(env,a.pid,r,now),now);
 if(out.status===200&&r.state){const hcv=r.state.__cv;if(hcv){out.body.cv=hcv;if(cv&&cv===hcv&&!r.cold&&!r.replayed){const st=out.body.state;out.body.hot=publicHot(r.state);if(st?.warfront)out.body.hot.warfront=st.warfront;if(st?.airdrop)out.body.hot.airdrop=st.airdrop;delete out.body.state;}}}
 return out;
}
// Session 6 analytics"""),
 ("""if(!allowed(a.b,['gv','initData','seq','commands'])||!Number.isSafeInteger(a.b.seq)||a.b.seq<1)return response(400,'invalid conquest input');""","""if(!allowed(a.b,['gv','initData','seq','commands','cv'])||!Number.isSafeInteger(a.b.seq)||a.b.seq<1||a.b.cv!==undefined&&(typeof a.b.cv!=='string'||a.b.cv.length>40))return response(400,'invalid conquest input');"""),
 ("""return submit(env,a,{seq:a.b.seq,commands},applyCommands,now);""","""return submit(env,a,{seq:a.b.seq,commands},applyCommands,now,a.b.cv||null);"""),
])
print('split ok')
