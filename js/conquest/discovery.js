/* Client exploration ledger. Only accepted physical movement writes it; not anti-cheat verification.
 * Stable 32-unit cells in sparse 1024-unit regions allow future world sectors without reindexing. */
(function(root){
'use strict';
const CELL=32,SIDE=32,RADIUS=80,W=root.ConquestWorld;let accountReady=false,pendingStore=false;
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.x>=0&&p.z>=0&&p.x<=W.WIDTH&&p.z<=W.LENGTH;
class Discovery {
 constructor(key,getSave,persist){this.key=key;this.getSave=getSave;this.persist=persist;this.regions=new Map();this.version=0;this.dirty=false;this.timer=null;
 let local=null;try{local=JSON.parse(localStorage.getItem(key));}catch(_){}const account=getSave()?.conquestDiscovery;this.accountData=account;this.merge(local);this.merge(account);
 // Reading the map never writes or schedules a save. A view's next lifecycle flush synchronizes a merged fallback.
 this.dirty=this.regions.size>0&&JSON.stringify(local)!==JSON.stringify(account);
 }
 merge(data){if(data?.v!==1||data.cell!==CELL)return false;let changed=false;for(const [key,value] of Object.entries(data.regions||{})){if(!/^\d+:\d+$/.test(key)||typeof value!=='string'||value.length>180)continue;try{const raw=atob(value);if(raw.length!==128)continue;const bytes=this.regions.get(key)||new Uint8Array(128);for(let i=0;i<128;i++){const merged=bytes[i]|raw.charCodeAt(i);if(merged!==bytes[i])changed=true;bytes[i]=merged;}this.regions.set(key,bytes);}catch(_){}}if(changed){this.version++;this.dirty=true;}return changed;
 }
 has(x,z){if(!valid({x,z}))return false;const i=Math.floor(x/CELL),j=Math.floor(z/CELL),bytes=this.regions.get(Math.floor(i/SIDE)+':'+Math.floor(j/SIDE)),bit=(j%SIDE)*SIDE+i%SIDE;return !!(bytes&&(bytes[bit>>3]&(1<<(bit&7))));}
 reveal(p){let changed=false;const minI=Math.max(0,Math.floor((p.x-RADIUS)/CELL)),maxI=Math.min(Math.ceil(W.WIDTH/CELL)-1,Math.floor((p.x+RADIUS)/CELL)),minJ=Math.max(0,Math.floor((p.z-RADIUS)/CELL)),maxJ=Math.min(Math.ceil(W.LENGTH/CELL)-1,Math.floor((p.z+RADIUS)/CELL));
 for(let j=minJ;j<=maxJ;j++)for(let i=minI;i<=maxI;i++){if(Math.hypot((i+.5)*CELL-p.x,(j+.5)*CELL-p.z)>RADIUS)continue;const key=Math.floor(i/SIDE)+':'+Math.floor(j/SIDE);let bytes=this.regions.get(key);if(!bytes){bytes=new Uint8Array(128);this.regions.set(key,bytes);}const bit=(j%SIDE)*SIDE+i%SIDE,mask=1<<(bit&7);if(!(bytes[bit>>3]&mask)){bytes[bit>>3]|=mask;changed=true;}}
 if(changed){this.version++;this.dirty=true;if(!this.timer)this.timer=setTimeout(()=>this.flush(),1500);}return changed;
 }
 spawn(p){if(valid(p))this.reveal(p);}
 accept(from,to,dt,speed){if(!valid(from)||!valid(to)||!Number.isFinite(dt)||dt<=0||dt>.25||!Number.isFinite(speed)||speed<=0)return false;const distance=Math.hypot(to.x-from.x,to.z-from.z);if(distance<=0||distance>speed*dt+1e-5)return false;const steps=Math.max(1,Math.ceil(distance/(CELL/2)));for(let i=0;i<=steps;i++)this.reveal({x:from.x+(to.x-from.x)*i/steps,z:from.z+(to.z-from.z)*i/steps});return true;}
 cellsIn(bounds){const cells=[];for(const [key,bytes] of this.regions){const [rx,rz]=key.split(':').map(Number);if((rx+1)*1024<bounds.x||rx*1024>bounds.x+bounds.width||(rz+1)*1024<bounds.z||rz*1024>bounds.z+bounds.height)continue;for(let bit=0;bit<1024;bit++)if(bytes[bit>>3]&(1<<(bit&7))){const x=(rx*SIDE+bit%SIDE)*CELL,z=(rz*SIDE+Math.floor(bit/SIDE))*CELL;if(x+CELL>=bounds.x&&x<=bounds.x+bounds.width&&z+CELL>=bounds.z&&z<=bounds.z+bounds.height)cells.push({x,z,size:CELL});}}return cells;}
 flush(){clearTimeout(this.timer);this.timer=null;const account=this.getSave()?.conquestDiscovery;if(account!==this.accountData&&this.regions.size)this.dirty=true;this.merge(account);try{this.merge(JSON.parse(localStorage.getItem(this.key)));}catch(_){}if(!this.dirty)return;const regions={};for(const [key,bytes] of this.regions)regions[key]=btoa(String.fromCharCode(...bytes));const data={v:1,cell:CELL,regions};try{localStorage.setItem(this.key,JSON.stringify(data));}catch(_){}const S=this.getSave();if(S){S.conquestDiscovery=data;this.accountData=data;this.persist();}this.dirty=false;}
}
// Boot opens the account-write gate only after the initial cloud response (including its timeout).
// Local compact fallback and in-memory discovery remain available immediately without changing economy timestamps.
root.ConquestDiscovery=Object.freeze({CELL,RADIUS,Discovery,markReady(){accountReady=true;},create(){const key=(typeof SAVE_KEY==='string'?SAVE_KEY:'wm_save_v1')+':conquest-discovery-v1';const ledger=new Discovery(key,()=>typeof save!=='undefined'?save:null,()=>{if(!accountReady){pendingStore=true;return;}pendingStore=false;if(typeof store==='function')store();});if(accountReady&&pendingStore)ledger.dirty=true;return ledger;}});
})(globalThis);
