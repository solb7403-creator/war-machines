// Test-only official-signature issuer and disposable session namespace. Never bundled with public assets.
export async function webFixture(WebSession){
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const key=await crypto.subtle.exportKey('jwk',pair.publicKey);Object.assign(key,{kid:'browser-key',alg:'RS256',use:'sig'});
 const objects=new Map(),SESSIONS={idFromName:n=>n,get(n){if(!objects.has(n)){let q=Promise.resolve();const vals=new Map(),s={storage:{get:async k=>structuredClone(vals.get(k)),put:async(k,v)=>vals.set(k,structuredClone(v)),deleteAll:async()=>vals.clear(),setAlarm:async()=>{}},blockConcurrencyWhile(fn){const r=q.then(fn);q=r.catch(()=>{});return r;}};objects.set(n,new WebSession(s));}return {fetch:(u,o)=>objects.get(n).fetch(new Request(u,o))};}};
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 async function token(nonce,id=8837001){const sec=Math.floor(Date.now()/1000),s=b64({alg:'RS256',kid:key.kid})+'.'+b64({iss:'https://oauth.telegram.org',aud:'123',sub:'oidc-'+id,id,name:'Lunar Engineer',preferred_username:'engineer',nonce,iat:sec,exp:sec+300});return s+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(s))).toString('base64url');}
 return {key,token,SESSIONS};
}
