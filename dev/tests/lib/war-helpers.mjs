// Session 7 test helpers: put a war event on the clock the way the Worker's own clock does (a pending assault or LDF counterattack
// announced at this tick, landing two ticks later), so a test can open the battle it fights. Never used by the game.
export function warEvent(CONQUEST,s,territory,now,{kind='a',general=null,air=0,roll}={}){const WR=CONQUEST.War;s.war=WR.norm(s.war,now);const w=s.war,k=WR.tickOf(now);
 if(kind==='c')w.o[territory]='p';else if(!WR.BY[territory].heart)w.o[territory]='h';
 const e={id:(kind==='c'?'c':'a')+(900+w.ev.length+(w.n|0)),k:kind,t:territory,g:general,a:k,l:k+WR.warnTicks(),air,ds:air?1:0,...(roll!==undefined?{sc:roll}:{})};w.ev.push(e);return e;}
// the script is done (the war's own rolls schedule from here): tests that are not about the first war start from a quiet front
export function warQuiet(CONQUEST,s,now){const WR=CONQUEST.War;s.war=WR.norm(s.war,now);s.war.sc={n:9,done:1};s.war.ev=[];s.war.go=null;return s.war;}
