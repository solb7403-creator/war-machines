// "Human" pilot profile (Session 2, owner request): a stand-in for real players in equipment and PvP comparisons, where
// mirror bot duels exaggerate small edges (the bot brain is deterministic: an equal-gear Titan beats a Vanguard 99%).
// Injected into the measurement world only (dev/tests/s2/pool.mjs patch); production AI pilots never run it.
// A human pilot: tracks targets with a reaction lag, aims with a slow wobble, misses or is late on some super dodges,
// sometimes drifts out of position, sometimes picks a poor target, and has good and bad matches (a per-match form draw
// scales all of it). Calibrated ONLY on equal-gear matchups (Titan vs Vanguard, mirrors), then locked (HUMAN below).
export const HUMAN = { react: 0.30, wobble: 0.20, wobbleT: 0.8, dodgeMiss: 0.5, drift: 0.12, driftT: 0.9, badTarget: 0.25, formSd: 0.30, formPow: 1 };
export const humanPatch = (H = HUMAN) => `
const __H=${JSON.stringify(H)};
function __hu(u){if(!u.hu)return null;if(!u.hu.ok){const z=Math.sqrt(-2*Math.log(1-random()))*Math.cos(6.283*random());u.hu={ok:1,s:Math.max(0.45,Math.min(1.8,1+__H.formSd*z)),w:0,p:{},drift:0,dx:0,dy:0,tg:null,tgT:0};}return u.hu;}
// aim: the turret sees each foe where it was about react seconds ago (a lag filter), plus a slow angular wobble
{const tu=turret;turret=function(a,dt){const h=__hu(a);if(!h)return tu(a,dt);
 const sd=__H.wobble/Math.pow(h.s,__H.formPow),th=__H.wobbleT,lag=Math.max(0.05,__H.react/h.s);
 h.w+=(-h.w/th)*dt+sd*Math.sqrt(2*dt/th)*(Math.sqrt(-2*Math.log(1-random()))*Math.cos(6.283*random()));
 const keep=[];for(const v of units){if(v.team===a.team||v.hp<=0)continue;const q=h.p[v.id]||(h.p[v.id]={x:v.x,y:v.y});q.x+=(v.x-q.x)*Math.min(1,dt/lag);q.y+=(v.y-q.y)*Math.min(1,dt/lag);
  const dx=q.x-a.x,dy=q.y-a.y,d=Math.hypot(dx,dy)||1,ang=Math.atan2(dy,dx)+h.w;keep.push([v,v.x,v.y]);v.x=a.x+Math.cos(ang)*d;v.y=a.y+Math.sin(ang)*d;}
 try{return tu(a,dt);}finally{for(const [v,x,y] of keep){v.x=x;v.y=y;}}};}
// dodges: a human misses some telegraphed supers entirely (more on a bad day)
{const bd=botDodge;botDodge=function(u){const h=__hu(u);if(!h)return bd(u);
 for(const v of units){if(v.team===u.team||!v.sup||(v.sup.hm&&v.sup.hm[u.id]))continue;v.sup.hm=v.sup.hm||{};v.sup.hm[u.id]=1;
  if(random()<Math.min(0.95,__H.dodgeMiss/h.s)){v.sup.dodged=v.sup.dodged||{};v.sup.dodged[u.id]=1;}}
 return bd(u);};}
// target choice: now and then a human locks onto the wrong foe for a few seconds (team modes)
{const bt=botTarget;botTarget=function(u){const h=__hu(u);if(!h)return bt(u);h.tgT-=1/60;
 if(h.tg&&h.tg.hp>0&&h.tgT>0)return h.tg;h.tg=null;
 if(h.tgT<=-3){h.tgT=0;const fs=units.filter(v=>v.team!==u.team&&v.hp>0);if(fs.length>1&&random()<__H.badTarget/h.s){h.tg=fs[(random()*fs.length)|0];h.tgT=2+random()*2;return h.tg;}}
 return bt(u);};}
// positioning: now and then a human drifts somewhere unhelpful for about a second instead of what the fight needs
{const ba=botAI;botAI=function(dt,u){const h=__hu(u);if(!h)return ba(dt,u);
 if(h.drift<=0&&random()<__H.drift/h.s*dt){h.drift=__H.driftT*(0.5+random());const a=random()*6.283;h.dx=Math.cos(a);h.dy=Math.sin(a);}
 if(h.drift>0){h.drift-=dt;const x0=u.x,y0=u.y;ba(dt,u);if(u.dash)return;u.x=x0;u.y=y0;const k=STAT.speed*0.85*spdMult(u)*slowAt(u)*dt;u.x+=h.dx*k;u.y+=h.dy*k;push(u);return;}
 return ba(dt,u);};}
`;
