// Step 2C foundation ONLY. No HTTP handler or wallet/settlement integration.
// Future callers MUST authenticate an independent-website session and pass its
// canonical economy pid; never accept pid, recipient, price or memo from a body.
import { readEco, tx, ctxOf } from './eco.js';
import { RULES } from './sim.gen.js';

const RECIPIENT = 'UQAq3MBfPQ7Wqo5kL7631yEDKf2E9GOmZdhOfLUWhUiACfzu';
const TTL = 600000;
// Refuse new issuance instead of deleting late-payment/replay evidence. A future
// audited archival/retention contract is required before exposing this service.
const ORDER_LIMIT = 32;
const buyerOk = pid => /^(?:tg|ln)_\d{3,15}$/.test(pid);
const keyOk = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
function descriptor(d) {
  if (!d || typeof d !== 'object') return null;
  const kind=d.kind;
  if (kind==='vault') return Object.hasOwn(RULES.VAULT,d.tk) ? {kind,tk:d.tk} : null;
  if (kind==='paint') return Object.hasOwn(RULES.PAINTS,d.id) && RULES.PAINTS[d.id].stars ? {kind,id:d.id} : null;
  if (kind==='box') return ['gem','weapon','chassis'].includes(d.tk) && [0,1,2].includes(d.ri) && [undefined,null,'d','w'].includes(d.deal) ? {kind,tk:d.tk,ri:d.ri,deal:d.deal||''} : null;
  return ['starter','founder','moonbeam','skin','pass','respec'].includes(kind) ? {kind} : null;
}
function eligible(S, desc, X) {
  const price=RULES.ecoPrice(S,desc,X);
  return price && !RULES.ecoOwned(S,desc,X) && Number.isFinite(price.ton) && price.ton>0 && Number.isSafeInteger(Math.round(price.ton*1e9)) ? price : null;
}
function unchanged(S, order, X) {
  const p=eligible(S,order.desc,X);
  if (!p || p.ton!==order.price.ton || p.stars!==order.price.stars || (p.deal||null)!==(order.price.deal||null)) return false;
  if (order.desc.kind==='pass' && RULES.ecoSeason(X)!==order.season) return false;
  if (order.desc.kind==='box' && (X.day!==order.day || X.week!==order.week)) return false;
  return true;
}
export async function issueTonOrder(env, pid, input, now=Date.now()) {
  if (!buyerOk(pid)) return {error:'buyer'};
  if (!keyOk(input?.requestId) || !Number.isSafeInteger(now) || now<0) return {error:'request'};
  const desc=descriptor(input.desc);
  if (!desc) return {error:'descriptor'};
  // Randomness is outside CAS retry; a failed write never returns this candidate.
  const id=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
  const result=await tx(env,pid,(S,X)=>{
    const orders=S.tonOrders||{};
    const prior=Object.values(orders).find(o=>o.requestId===input.requestId);
    if (prior) return JSON.stringify(prior.desc)===JSON.stringify(desc)
      ? {abort:true,order:prior,duplicate:true} : {abort:true,error:'request_conflict'};
    if ((S.starCheckout?.until||0)>now || Object.values(orders).some(o=>o.expires>now)) return {abort:true,error:'pending'};
    if (Object.keys(orders).length>=ORDER_LIMIT || orders[id]) return {abort:true,error:'capacity'};
    const price=eligible(S,desc,X);
    if (!price) return {abort:true,error:'ineligible'};
    const order={v:1,id,requestId:input.requestId,buyer:pid,currency:'TON',network:'mainnet',
      recipient:RECIPIENT,amountNano:String(Math.round(price.ton*1e9)),memo:'LWM2|TON|'+id,
      desc,price:{ton:price.ton,stars:price.stars,deal:price.deal||''},
      created:now,expires:now+TTL,day:X.day,week:X.week,season:RULES.ecoSeason(X)};
    S.tonOrders={...orders,[id]:order};
    return {order};
  },now);
  // Never expose the complete economy record or CAS implementation fields.
  return result.error ? {error:result.error} : {order:result.order,...(result.duplicate?{duplicate:true}:{})};
}
export async function inspectTonOrder(env,pid,id,now=Date.now()) {
  if (!buyerOk(pid) || !keyOk(id)) return {error:'not_found'};
  const S=await readEco(env,pid), order=S.tonOrders?.[id];
  if (!order || order.buyer!==pid) return {error:'not_found'};
  // Read-only quote information, NEVER a successful/paid/delivered state. Expiry
  // cannot erase proof of a later indexed payment; settlement remains unbuilt.
  const status=!unchanged(S,order,ctxOf(pid,now)) ? 'review' : now>=order.expires ? 'expired' : 'pending';
  return {order,status};
}
