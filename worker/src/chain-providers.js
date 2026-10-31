// Trust boundary: HTTPS RPC/indexer responses are trusted provider attestations,
// not locally verified consensus proofs. Never accept these objects from a client.
import {Address, Cell} from '@ton/core';
import {Buffer} from 'node:buffer';
export const SOL_MAIN_GENESIS='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
export const SOL_DEV_GENESIS='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const SYS='11111111111111111111111111111111', MEMO='MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const safeInt=n=>Number.isSafeInteger(n)&&n>=0;
const address=a=>Address.parse(a).toRawString();
export function tonEvidence(order, t, master, block, now=Date.now()) {
 try {
  const m=t.in_msg,d=t.description;
  if(t.emulated!==false || address(t.account)!==address(order.recipient)||address(m.destination)!==address(order.recipient))return null;
  if(!safeInt(t.mc_block_seqno)||t.mc_block_seqno<=0||!safeInt(master.last.seqno)||master.last.seqno<t.mc_block_seqno+1)return null;
  if(block.workchain!==-1||block.seqno!==t.mc_block_seqno||block.global_id!==(order.network==='testnet'?-3:-239)||!block.root_hash)return null;
  if(d.type!=='ord'||d.aborted!==false||d.compute_ph?.success!==true||d.compute_ph.exit_code!==0||d.action?.success!==true||d.action.result_code!==0||d.bounce || m.bounced!==false)return null;
  const slice=Cell.fromBase64(m.message_content.body).beginParse();
  if(slice.loadUint(32)!==0||slice.loadStringTail()!==order.memo)return null;
  if(!/^[A-Za-z0-9+/_=-]{43,44}$/.test(t.hash)||!/^\d+$/.test(m.value)||BigInt(m.value)<=0n||!safeInt(t.now)||t.now<Math.floor(order.created/1000)||t.now>Math.floor(now/1000))return null;
  return {tx:t.hash,payer:address(m.source),at:t.now*1000,amount:m.value,network:order.network,slot:t.mc_block_seqno,
   hold:m.value!==order.amountNano?'amount':t.now*1000>=order.expires?'late':''};
 }catch{return null;}
}
export function solEvidence(order, signature, tx, status, genesis, now=Date.now()) {
 try {
  if(genesis!==(order.network==='devnet'?SOL_DEV_GENESIS:SOL_MAIN_GENESIS)||status.confirmationStatus!=='finalized'||status.err!==null||!safeInt(status.slot)||status.slot!==tx.slot||!safeInt(tx.slot)||tx.slot<=0||tx.meta.err!==null)return null;
  if(!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)||tx.transaction.signatures[0]!==signature||!safeInt(tx.blockTime)||tx.blockTime<Math.floor(order.created/1000)||tx.blockTime>Math.floor(now/1000))return null;
  const msg=tx.transaction.message,keys=msg.accountKeys;
  if(!keys.some(k=>k.pubkey===order.reference)||!msg.instructions.some(i=>i.programId===MEMO&&i.parsed===order.memo))return null;
  const transfers=msg.instructions.filter(i=>i.program==='system'&&i.programId===SYS&&i.parsed?.type==='transfer'&&i.parsed.info.destination===order.recipient);
  if(transfers.length!==1)return null;
  const info=transfers[0].parsed.info;
  if(!safeInt(info.lamports)||info.lamports<=0||!keys.some(k=>k.pubkey===info.source&&k.signer===true)||info.source===order.recipient)return null;
  return {tx:signature,payer:info.source,at:tx.blockTime*1000,amount:String(info.lamports),network:order.network,slot:tx.slot,
   hold:String(info.lamports)!==order.amountNano?'amount':tx.blockTime*1000>=order.expires?'late':''};
 }catch{return null;}
}
export async function providerJson(url, body) {
 const r=await fetch(url,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('provider unavailable');
 const d=await r.json();if(d.error||d.ok===false)throw Error('provider response');return d;
}
const rpc=async(url,method,params=[])=> (await providerJson(url,{jsonrpc:'2.0',id:1,method,params})).result;
export async function findChainPayment(order, cursor=0, signature='', now=Date.now()) {
 if(order.currency==='SOL') {
  const url=order.network==='devnet'?'https://api.devnet.solana.com':'https://api.mainnet-beta.solana.com';
  const genesis=await rpc(url,'getGenesisHash');
  const signatures=signature?[{signature}]:(await rpc(url,'getSignaturesForAddress',[order.reference,{limit:2,commitment:'finalized',...(typeof cursor==='string'&&cursor?{before:cursor}:{})}]))||[];
  for(const row of signatures){
   const sig=row.signature;
   const tx=await rpc(url,'getTransaction',[sig,{encoding:'jsonParsed',maxSupportedTransactionVersion:0,commitment:'finalized'}]);
   const status=(await rpc(url,'getSignatureStatuses',[[sig],{searchTransactionHistory:true}]))?.value?.[0];
   const proof=solEvidence(order,sig,tx,status,genesis,now);if(proof)return {proof,cursor:''};
  }
  return {cursor:!signature&&signatures.length===2?signatures[1].signature:''};
 }
 const base=order.network==='testnet'?'https://testnet.toncenter.com/api/v3':'https://toncenter.com/api/v3';
 const rows=(await providerJson(base+'/transactions?account='+encodeURIComponent(order.recipient)+'&start_utime='+Math.floor(order.created/1000)+'&sort=asc&limit=20&offset='+cursor)).transactions;
 if(!Array.isArray(rows))throw Error('provider schema');
 for(const t of rows) {
  let memo;try{const s=Cell.fromBase64(t.in_msg.message_content.body).beginParse();memo=s.loadUint(32)===0?s.loadStringTail():'';}catch{continue;}
  if(memo!==order.memo)continue;
  const master=await providerJson(base+'/masterchainInfo');
  const block=(await providerJson(base+'/blocks?workchain=-1&seqno='+t.mc_block_seqno+'&limit=1')).blocks?.[0];
  const proof=tonEvidence(order,t,master,block,now);if(proof)return {proof,cursor:0};
 }
 return {cursor:rows.length===20?cursor+20:0};
}
