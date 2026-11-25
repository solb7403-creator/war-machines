/* Session 7C STEP 2 (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md): the hub's AIRDROP STANDING card. The pilot's live rank in
   the points pool (the top 1,000 by play score), the points to the next mark, today's points against the 50,000 shared daily cap and
   the trust line ("verified play N%", or "under review" and the rule). Everything comes from the Worker (POST /api/conquest/standing,
   worker/src/conquest-standing.js): read on the hub's open and every 60 s while it stays open; the last answer paints first. A
   research ranking: no token amount is promised (RULES.AIRDROP.dist stays false). Draws only; phone and computer alike. */
(function(root){
'use strict';
const KEY='lunar-conquest-standing-v1',EVERY=60000,fmt=n=>typeof fmtNum==='function'?fmtNum(n):Math.round(Number(n)||0).toLocaleString('en-US');
const S={st:null,at:0,busy:false,seen:0};
try{const c=JSON.parse(localStorage.getItem(KEY)||'null');if(c&&c.st){S.st=c.st;S.at=0;}}catch(e){}   // the last answer paints first (then it refreshes)
function refresh(){if(S.busy||typeof apiFetch!=='function'||typeof ACCOUNT_OK==='undefined'||!ACCOUNT_OK)return;S.busy=true;
 apiFetch('/api/conquest/standing',{}).then(r=>r.json().then(j=>{S.busy=false;if(r.ok&&j&&j.st){S.st=j.st;S.at=Date.now();try{localStorage.setItem(KEY,JSON.stringify({st:j.st}));}catch(e){}}else S.at=Date.now()-EVERY+15000;}))
  .catch(()=>{S.busy=false;S.at=Date.now()-EVERY+15000;});}   // a failed read tries again in 15 s
// the lines the card shows (pure: the test reads them)
function lines(st){if(!st)return {big:'CHECKING YOUR STANDING…',sub:'',today:'',trust:'',held:false};
 const big=st.held?'UNDER REVIEW':st.inPool?'#'+fmt(st.rank)+' IN THE POINTS POOL':'OUTSIDE THE POOL',
  sub=st.held?'You keep playing and earning. You sit out the boards and the airdrop snapshot until the review clears you.':st.inPool?(st.next?fmt(st.next.pts)+' pts to #'+fmt(st.next.rank):'The top of the pool'):(st.toPool?fmt(st.toPool)+' pts to #'+fmt(st.top)+' (the pool is the top '+fmt(st.top)+')':'Play to enter the pool (the top '+fmt(st.top)+')'),
  today='TODAY '+fmt(st.today)+' / '+fmt(st.cap)+(st.today>=st.cap?' · CAP REACHED. Loot, minerals and CP still drop.':''),
  trust=st.trust?.held||st.held?'':'VERIFIED PLAY '+Math.max(0,Math.min(100,st.trust?.p??100))+'%'+(st.trust?.days&&st.trust.days<30?' · '+st.trust.days+' day'+(st.trust.days>1?'s':''):' · LAST 30 DAYS');
 return {big,sub,today,trust,held:!!st.held};}
// the hub calls this every second while it is open (js/conquest/hub.js status)
function card(col,{el,button,now=Date.now()}={}){if(!el||!col)return null;if(now-S.seen>5000||now-S.at>=EVERY)refresh();S.seen=now;
 const st=S.st,L=lines(st),c=el('section','cq-hub-card cq-hub-standing'+(L.held?' cq-standing-held':''),null,col);el('h3','','AIRDROP STANDING',c);
 el('p','cq-hub-big',L.big,c);if(L.sub)el('small','cq-standing-sub',L.sub,c);
 if(st){const bar=el('progress','cq-hub-bar cq-standing-day',null,c);bar.max=Math.max(1,st.cap|0);bar.value=Math.min(bar.max,Math.max(0,st.today|0));bar.setAttribute('aria-label','Points today against the daily cap');el('small','cq-standing-today',L.today,c);}
 if(L.trust)el('small','cq-standing-trust',L.trust,c);
 el('small','cq-standing-note','A research ranking of the top '+fmt(st?.top||1000)+' by play score, updated every few minutes. No token amount is promised.',c);
 if(button&&root.ConquestBoardsUI){const host=col.closest?.('.cq')||col.parentElement||col;if(!S.btn||S.btnHost!==host){S.btnHost=host;S.btn=button('WEEKLY BOARDS',()=>{if(!host.querySelector('.cq-boards'))root.ConquestBoardsUI.open(host,{el,button});},'cq-standing-boards');}c.append(S.btn);}   /* one node for the hub's life (the card is rebuilt every second); Session 7C STEP 3 */
 return c;}
root.ConquestStanding=Object.freeze({card,lines,refresh,EVERY,state:()=>S.st});
})(globalThis);
