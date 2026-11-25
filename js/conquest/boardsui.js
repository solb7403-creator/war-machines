/* Session 7C STEP 3: the BOARDS screen and the share card (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md). Five weekly boards
   (Town Score gain, defense rating, raid time-attack on the week's featured course, Hive Titan damage, campaign score) and the Titan's
   30-day board, as the Worker ranked them (POST /api/conquest/boards: names and scores only; pilots under review left off). Each board
   shows its reward bands, its field against the 20-pilot minimum, the top 100 and the pilot's own place; a finish inside a reward band
   gets a share card (the band, the board, the score: never a route). Opened from the hub's AIRDROP STANDING card. Draws only; phone and
   computer alike (every row a real button; the screen fits or scrolls). */
(function(root){
'use strict';
const fmtN=n=>Math.round(Number(n)||0).toLocaleString('en-US');
const sec=s=>{s=Math.max(0,Number(s)||0);return Math.floor(s/60)+':'+(s%60).toFixed(1).padStart(4,'0');};
const UNIT={town:n=>fmtN(n)+' TOWN SCORE',defense:n=>fmtN(n)+' DEFENSE',raid:sec,titan:n=>fmtN(n)+' DAMAGE',campaign:n=>fmtN(n)+' CAMPAIGN',titan30:n=>fmtN(n)+' DAMAGE'};
const ORDER=['town','defense','raid','titan','campaign','titan30'];
const left=ms=>{const h=Math.max(0,Math.floor(ms/3600000));return h>=48?Math.floor(h/24)+'D '+(h%24)+'H':h+'H '+Math.max(0,Math.floor(ms%3600000/60000))+'M';};
const reward=b=>[b.cp?fmtN(b.cp)+' CP':'',b.fr?'1 RARE FRAGMENT':'',b.mn?.se?b.mn.se+' SELENITE':'',b.mn?.mh?b.mn.mh+' MOONHEART':''].filter(Boolean).join(' + ');
// the band a place falls in (the smallest share first), from the field (none under the minimum)
function bandOf(B,r){if(!B||!r||B.field<B.min)return null;let best=null;for(const b of B.bands){const k=Math.min(b.max,Math.floor(b.pct*B.field));if(r<=k&&(!best||b.pct<best.pct))best=b;}return best;}
let S={data:null,at:0,k:'titan'};
async function load(){if(typeof apiFetch!=='function')return null;try{const r=await apiFetch('/api/conquest/boards',{}),j=await r.json();if(r.ok&&j.boards){S.data=j;S.at=Date.now();return j;}}catch(e){}return null;}
// the screen: a dialog in the given panel
function open(panel,{el,button,dialog}={}){if(!panel||!el||!button)return null;const d=dialog?dialog():el('div','cq-dialog',null,panel);d.classList.add('cq-boards');d.setAttribute('role','dialog');d.setAttribute('aria-label','Weekly boards');d.tabIndex=-1;
 const head=el('div','cq-boards-head',null,d);el('p','cq-kicker','CONQUEST · WEEKLY BOARDS',head);el('h2','','BOARDS',head);const sub=el('p','cq-boards-sub','Loading the boards…',head);
 const tabs=el('div','cq-boards-tabs',null,d);tabs.setAttribute('role','tablist');const body=el('div','cq-boards-body',null,d);
 const foot=el('div','cq-boards-foot',null,d);foot.append(button('CLOSE',()=>d.remove(),'cq-secondary'));d.onkeydown=e=>{if(e.key==='Escape'){d.remove();}};
 const draw=()=>{const j=S.data;if(!j){sub.textContent='The boards are not reachable right now. Try again in a moment.';return;}
  const B=j.boards[S.k],end=B?.ends||0;sub.textContent='Rewards need '+(B?.min||20)+'+ verified pilots on a board; each band rounds down. Pilots under review sit out. '+(S.k==='titan30'?'This 30-day board ends in ':'The week ends in ')+left(end-Date.now())+' (UTC).'+(j.held?' You are under review: you play on and sit out the boards until it clears.':'');
  tabs.replaceChildren();for(const k of ORDER){const b=button(j.boards[k].name,()=>{S.k=k;draw();},'cq-boards-tab'+(k===S.k?' on':''));b.setAttribute('role','tab');b.setAttribute('aria-selected',k===S.k?'true':'false');tabs.append(b);}
  body.replaceChildren();if(!B)return;const card=el('section','cq-boards-card',null,body);el('h3','',B.name,card);
  if(S.k==='raid')el('p','cq-boards-course','THIS WEEK\'S COURSE · '+(root.ConquestCombat?.operations?.[j.raid]?.name||j.raid).toUpperCase()+' · the fastest verified clear',card);
  for(const b of [...B.bands].sort((x,y)=>y.pct-x.pct))el('p','cq-boards-band','TOP '+Math.round(b.pct*100)+'% (UP TO '+b.max+') · '+reward(b),card);
  el('p','cq-boards-field'+(B.field<B.min?' small':''),B.field<B.min?'SMALL FIELD · '+B.field+' OF '+B.min+' PILOTS · NO REWARDS UNTIL '+B.min+' VERIFIED PILOTS':'FIELD '+B.field+' PILOTS',card);
  const list=el('ol','cq-boards-list',null,card);if(!B.top.length)el('li','cq-boards-empty','Nobody on this board yet this '+(S.k==='titan30'?'period':'week')+'. Be the first.',list);
  for(const r of B.top){const li=el('li','cq-boards-row'+(r.me?' me':''),null,list);el('b','','#'+r.r,li);el('span','',r.n+(r.me?' (YOU)':''),li);el('i','',UNIT[S.k](r.s),li);}
  if(B.me){const band=bandOf(B,B.me.r),mine=el('div','cq-boards-me',null,card);el('p','','YOUR PLACE #'+B.me.r+' · '+UNIT[S.k](B.me.s)+(band?' · TOP '+Math.round(band.pct*100)+'% · '+reward(band)+' IF IT HOLDS AT THE RESET':''),mine);
   if(band)mine.append(button('SHARE MY FINISH',()=>share(card,{el,button,board:B,k:S.k,band}),'cq-boards-share'));}
  else el('p','cq-boards-me','You are not on this board yet this '+(S.k==='titan30'?'period':'week')+'.',card);};
 draw();if(!S.data||Date.now()-S.at>60000)load().then(draw);setTimeout(()=>d.focus?.(),0);return d;}
// the share card: the band, the board and the score (never a route)
function share(host,{el,button,board,k,band}){const c=document.createElement('canvas');c.width=720;c.height=900;const g=c.getContext('2d'),grad=g.createLinearGradient(0,0,0,900);grad.addColorStop(0,'#160a26');grad.addColorStop(1,'#03060c');g.fillStyle=grad;g.fillRect(0,0,720,900);
 const pilot=(typeof save!=='undefined'&&(save.callsign||save.name))||'Pilot',me=board.me;g.fillStyle='#ffd96a';g.font='800 64px sans-serif';g.fillText('TOP '+Math.round(band.pct*100)+'%',40,130);
 g.fillStyle='#e8f6ff';g.font='800 38px sans-serif';g.fillText(board.name,40,200);g.fillStyle='#b98cff';g.font='700 30px sans-serif';g.fillText('#'+me.r+' OF '+board.field+' · '+UNIT[k](me.s),40,262);
 g.fillStyle='#c9d6e2';g.font='600 28px sans-serif';g.fillText(String(pilot).slice(0,22),40,330);g.strokeStyle='#ffd96a66';g.lineWidth=3;g.strokeRect(30,380,660,300);g.fillStyle='#ffd96a';g.font='700 26px sans-serif';g.fillText('REWARD IF IT HOLDS: '+reward(band),56,440);
 g.fillStyle='#e8f6ff';g.font='600 24px sans-serif';g.fillText('Server-verified score · one board, one week',56,490);g.fillText('Bands need 20+ verified pilots',56,530);
 const link=typeof refLink==='function'?refLink():null;g.fillStyle='#ffb347';g.font='700 26px sans-serif';g.fillText('LUNAR: WAR MACHINES · JOIN THE WAR',40,818);g.fillStyle='#c9d6e2';g.font='500 24px sans-serif';g.fillText(link?link.replace(/^https?:\/\//,''):'Telegram and web',40,858);
 const url=c.toDataURL('image/png'),box=el('div','cq-boards-sharebox',null,host);const img=document.createElement('img');img.src=url;img.alt='Top '+Math.round(band.pct*100)+'% on '+board.name;img.className='cq-boards-shareimg';box.append(img);
 const text='Top '+Math.round(band.pct*100)+'% on the LUNAR: War Machines '+board.name+' board this week (#'+me.r+' of '+board.field+'). Join the war.';
 box.append(button(typeof IN_TG!=='undefined'&&IN_TG?'SHARE IN TELEGRAM':'SHARE',async()=>{if(typeof IN_TG!=='undefined'&&IN_TG&&typeof shareRef==='function'){shareRef(text);return;}try{const blob=await (await fetch(url)).blob(),file=new File([blob],'lunar-board.png',{type:'image/png'}),data={title:'LUNAR: War Machines',text,...(link?{url:link}:{})};if(navigator.canShare?.({files:[file]}))data.files=[file];if(navigator.share)await navigator.share(data);else if(typeof shareRef==='function')shareRef(text);}catch(e){}},'cq-boards-share'));
 const a=document.createElement('a');a.href=url;a.download='lunar-board.png';a.textContent='DOWNLOAD IMAGE';a.className='cq-plot-dl';box.append(a);box.scrollIntoView?.({block:'nearest'});return box;}
// the ticker line for a board reward that arrived (js/conquest/app.js)
function notice(n){const got=Array.isArray(n?.got)?n.got:[];return got.length?'BOARD REWARD · '+got.map(g=>'TOP '+Math.round(g.pct*100)+'% '+String(g.k).toUpperCase()+': '+reward(g)).join(' · '):'BOARD REWARD';}
root.ConquestBoardsUI=Object.freeze({open,share,notice,bandOf,load});
})(globalThis);
