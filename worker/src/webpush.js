// Session 7 (owner decision 12): Web Push for the website's war alerts, with no outside service and nothing for the owner to set up.
// The VAPID key pair is created by the Worker itself on first use (WebCrypto ECDSA P-256) and kept at meta/vapid, a server-only
// database path (database.rules.json denies every client read); the public half is served at GET /api/push-key. Messages are
// encrypted for the browser's subscription (RFC 8291 "aes128gcm", RFC 8188 records) and signed with a VAPID JWT (RFC 8292).
// Every push carries a visible notification (iOS revokes the permission of a site that sends silent pushes).
import {readTag,writeIf} from './eco.js';
const enc=new TextEncoder();
export const b64u=b=>{let s='';const u=b instanceof Uint8Array?b:new Uint8Array(b);for(let i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
export const unb64u=s=>{const t=String(s).replace(/-/g,'+').replace(/_/g,'/'),p=t+'==='.slice((t.length+3)%4),bin=atob(p),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u;};
const cat=(...a)=>{const n=a.reduce((x,y)=>x+y.length,0),o=new Uint8Array(n);let i=0;for(const x of a){o.set(x,i);i+=x.length;}return o;};
const PATH='meta/vapid';let CACHE=null;
// the key pair: read once per isolate; created exactly once (a conditional write on the empty path: two isolates racing keep one)
export async function vapidKeys(env){if(CACHE&&CACHE.env===env)return CACHE.keys;for(let i=0;i<4;i++){const {v,tag}=await readTag(env,PATH);
  if(v&&v.pub&&v.jwk){const keys={pub:v.pub,jwk:v.jwk};CACHE={env,keys};return keys;}
  const kp=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),jwk=await crypto.subtle.exportKey('jwk',kp.privateKey),pub=b64u(await crypto.subtle.exportKey('raw',kp.publicKey));
  const val={pub,jwk:{kty:jwk.kty,crv:jwk.crv,x:jwk.x,y:jwk.y,d:jwk.d},at:Date.now()};if(await writeIf(env,PATH,val,tag)){CACHE={env,keys:{pub,jwk:val.jwk}};return CACHE.keys;}}
 throw Error('push keys busy');}
// RFC 8292: the VAPID JWT for one push service origin (12 hours), signed ES256 (WebCrypto returns the raw r||s form JWS wants)
export async function vapidAuth(keys,endpoint,now=Date.now(),sub='https://lunar-api.solb7403.workers.dev/web/'){const aud=new URL(endpoint).origin;
 const h=b64u(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'}))),p=b64u(enc.encode(JSON.stringify({aud,exp:Math.floor(now/1000)+12*3600,sub})));
 const key=await crypto.subtle.importKey('jwk',{...keys.jwk,ext:true},{name:'ECDSA',namedCurve:'P-256'},false,['sign']),sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(h+'.'+p));
 return 'vapid t='+h+'.'+p+'.'+b64u(sig)+', k='+keys.pub;}
async function hkdf(salt,ikm,info,len){const k=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},k,len*8));}
// RFC 8291 section 3: one aes128gcm record for the subscription (p256dh: the browser's public key, auth: its 16-byte secret).
// as / salt are injectable for the known-answer test (dev/tests/conquest-war-alerts.mjs); normally fresh for every message.
export async function encrypt(plain,p256dh,auth,{as=null,salt=null,rs=4096}={}){const ua=typeof p256dh==='string'?unb64u(p256dh):p256dh,secret=typeof auth==='string'?unb64u(auth):auth,data=typeof plain==='string'?enc.encode(plain):plain;
 const kp=as||await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']),asPub=new Uint8Array(await crypto.subtle.exportKey('raw',kp.publicKey));
 const uaKey=await crypto.subtle.importKey('raw',ua,{name:'ECDH',namedCurve:'P-256'},false,[]),ecdh=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:uaKey},kp.privateKey,256));
 const ikm=await hkdf(secret,ecdh,cat(enc.encode('WebPush: info\0'),ua,asPub),32),sl=salt||crypto.getRandomValues(new Uint8Array(16));
 const cek=await hkdf(sl,ikm,enc.encode('Content-Encoding: aes128gcm\0'),16),nonce=await hkdf(sl,ikm,enc.encode('Content-Encoding: nonce\0'),12);
 if(data.length+17>rs)throw Error('push message too long');const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
 const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce,tagLength:128},key,cat(data,new Uint8Array([2]))));
 const head=new Uint8Array(21+asPub.length);head.set(sl,0);new DataView(head.buffer).setUint32(16,rs);head[20]=asPub.length;head.set(asPub,21);return cat(head,ct);}
// One push. sub: {e endpoint, k p256dh, a auth}. Returns 'ok' | 'gone' (404 / 410: forget the subscription) | 'retry' | 'fail'.
export async function sendPush(env,sub,payload,{now=Date.now(),ttl=43200,fetcher=fetch}={}){try{const keys=await vapidKeys(env),body=await encrypt(JSON.stringify(payload),sub.k,sub.a),auth=await vapidAuth(keys,sub.e,now);
  const r=await fetcher(sub.e,{method:'POST',headers:{TTL:String(ttl),Urgency:'high','Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',Authorization:auth},body});
  return r.status>=200&&r.status<300?'ok':r.status===404||r.status===410?'gone':r.status===429||r.status>=500?'retry':'fail';}catch{return 'fail';}}
