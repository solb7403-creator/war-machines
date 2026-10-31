'use strict';
(()=>{
 const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
 let session,order,busy=false,desc,ton,viewStatus='pending',walletAllowed=true;
 const message=t=>{$('status').textContent=t;};
 async function api(path,body={}){
  const r=await fetch('/api/chain/'+path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Lunar-CSRF':session.csrf},body:JSON.stringify(body)});
  const d=await r.json();if(!r.ok||d.error)throw Error(d.error||'Checkout unavailable');return d;
 }
 const sdk=(src,integrity)=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.integrity=integrity;s.crossOrigin='anonymous';s.onload=resolve;s.onerror=()=>reject(Error('Wallet library unavailable'));document.head.append(s);});
 const key=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
 function render(v){
  order=v.order;viewStatus=v.status;walletAllowed=v.walletAllowed!==false;$('order').hidden=false;
  $('details').textContent=JSON.stringify({id:order.id,goods:order.desc,network:order.network,currency:order.currency,amount:(Number(order.amountNano)/1e9),recipient:order.recipient,expires:new Date(order.expires).toISOString()},null,2);
  $('wallet').disabled=!walletAllowed||v.status!=='pending'||Date.now()>=order.expires;
  const texts={pending:'Waiting for a finalized payment. Approve once, then check here.',paid:'Payment finalized. Your items are saved to your account. Return to the game.',review:'Payment or eligibility needs support review. Do not pay again.',expired:'Quote expired. Do not send funds. Any payment already sent will still be checked.',cancelled:'Checkout cancelled. A wallet may already have sent funds; checking continues. Do not pay again.',refunded:'Refund recorded by support.'};
  message(texts[v.status]||'Quote saved. Review the exact amount and destination.');
 }
 async function history(){
  const d=await api('list');$('history').replaceChildren();
  for(const item of d.orders){const b=document.createElement('button');b.textContent=item.currency+' · '+item.id+' · '+item.status;b.onclick=()=>api('status',{id:item.id}).then(render).catch(e=>message(e.message));$('history').append(b);}
 }
 $('quote').onclick=async()=>{
  if(busy)return;busy=true;$('quote').disabled=true;
  try{
   const storage='lunar-checkout-request:'+session.pid+':'+$('currency').value+':'+JSON.stringify(desc);
   let requestId=localStorage.getItem(storage);if(!requestId){requestId=key();localStorage.setItem(storage,requestId);}
   const v=await api('order',{currency:$('currency').value,desc,requestId});
   render({...v,status:Date.now()>=v.order.expires?'expired':'pending'});
   // A successful response can be revisited from server history. Expired retries
   // remain immutable; a deliberate new click can request a new quote.
   localStorage.removeItem(storage);await history();
  }catch(e){message('Quote not confirmed: '+e.message+'. Retry uses the same request.');}
  finally{busy=false;$('quote').disabled=!desc;}
 };
 $('refresh').onclick=async()=>{try{render(await api('confirm',{id:order.id}));await history();}catch(e){message('Confirmation unavailable. Your saved order remains pending. '+e.message);}};
 $('cancel').onclick=async()=>{try{await api('cancel',{id:order.id});render(await api('status',{id:order.id}));}catch(e){message(e.message);}};
 function comment(text){const bytes=Array.from(new TextEncoder().encode(text)),n=4+bytes.length;return btoa(String.fromCharCode(...[0xb5,0xee,0x9c,0x72,1,1,1,1,0,2+n,0,0,2*n,0,0,0,0,...bytes]));}
 $('wallet').onclick=async()=>{
  if(busy||!order)return;busy=true;$('wallet').disabled=true;
  try{
   const latest=await api('status',{id:order.id});render(latest);
   if(latest.walletAllowed===false||latest.status!=='pending'||Date.now()>=order.expires)throw Error('Order is no longer payable');
   if(order.currency==='TON'){
    if(!window.TON_CONNECT_UI)await sdk('https://unpkg.com/@tonconnect/ui@2.0.9/dist/tonconnect-ui.min.js','sha384-ej0rYqvkb978ljOWDi1iAt5spb5B7sRdf1g8Hii30vS72XLjxoCPCmx5seE7s05g');
    ton=ton||new TON_CONNECT_UI.TonConnectUI({manifestUrl:location.origin+'/web/tonconnect-manifest.json'});
    if(!ton.connected){await ton.openModal();message('Connect a wallet, then tap Approve in wallet again.');return;}
    const chain=order.network==='testnet'?'-3':'-239';if(ton.account?.chain!==chain)throw Error('Switch the wallet to '+order.network);
    if(!(await api('prepare',{id:order.id})).prepared)throw Error('Approval intent not confirmed');walletAllowed=false;
    await ton.sendTransaction({validUntil:Math.floor(order.expires/1000),network:chain,messages:[{address:order.recipient,amount:order.amountNano,payload:comment(order.memo)}]});
    render(await api('confirm',{id:order.id}));
   }else{
    const provider=window.phantom?.solana||window.solflare||window.backpack?.solana||window.solana;
    if(!provider){
     const target=location.origin+location.pathname+'?id='+order.id;
     const a=document.createElement('a');a.href='https://phantom.app/ul/browse/'+encodeURIComponent(target)+'?ref='+encodeURIComponent(location.origin);a.textContent='Open this independent website in Phantom';$('details').after(a);
     throw Error('Open in a supported wallet browser, then sign in to the same account. Your order stays saved.');
    }
    if(!window.solanaWeb3)await sdk('https://unpkg.com/@solana/web3.js@1.98.4/lib/index.iife.min.js','sha384-I45YF+S0YGWIolUyTksLk9TNtTqaDgZg8e6T1OoBoJvvFmphqYNIPZw3Kl0TkZNN');
    await provider.connect();const W=solanaWeb3,connection=new W.Connection(order.network==='devnet'?'https://api.devnet.solana.com':'https://api.mainnet-beta.solana.com','finalized');
    const genesis=await connection.getGenesisHash();if(genesis!==(order.network==='devnet'?'EtWTRABZaYq6iMfeYKouRu166VU2xqa1':'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'))throw Error('Wallet network mismatch');
    const transfer=W.SystemProgram.transfer({fromPubkey:provider.publicKey,toPubkey:new W.PublicKey(order.recipient),lamports:Number(order.amountNano)});
    transfer.keys.push({pubkey:new W.PublicKey(order.reference),isWritable:false,isSigner:false});
    const tx=new W.Transaction().add(transfer,new W.TransactionInstruction({programId:new W.PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),keys:[],data:new TextEncoder().encode(order.memo)}));
    tx.feePayer=provider.publicKey;tx.recentBlockhash=(await connection.getLatestBlockhash('finalized')).blockhash;
    if(!(await api('prepare',{id:order.id})).prepared)throw Error('Approval intent not confirmed');walletAllowed=false;
    const result=await provider.signAndSendTransaction(tx);const signature=typeof result==='string'?result:result.signature;
    render(await api('confirm',{id:order.id,signature}));
   }
  }catch(e){message('Wallet result is not delivery confirmation. '+e.message+' Check your saved order before trying again.');}
  finally{busy=false;if(order)$('wallet').disabled=!walletAllowed||viewStatus!=='pending'||Date.now()>=order.expires;}
 };
 (async()=>{
  try{
   const r=await fetch('/auth/session',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('Sign in to your independent Lunar account first.');session=await r.json();
   const cfg=await api('config');if(!cfg.enabled)throw Error('Checkout is disabled pending payment certification.');
   $('network').textContent=cfg.network==='testnet'?'TEST NETWORKS ONLY — no mainnet funds.':'Mainnet checkout';
   if(params.has('item'))desc=JSON.parse(params.get('item'));$('quote').disabled=!desc;
   await history();if(params.has('id'))render(await api('status',{id:params.get('id')}));else message('Choose a currency and request the exact server quote.');
  }catch(e){message(e.message);$('quote').disabled=true;}
 })();
})();
