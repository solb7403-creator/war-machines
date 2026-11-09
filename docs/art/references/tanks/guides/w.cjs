const {chromium}=require('playwright');const d=process.argv[2];
// side 3/4 guides: round base ring at the bottom (sits on the chassis mount), turret body, barrel(s) pointing right
const P=(pts,f)=>`<polygon points="${pts}" fill="${f}" stroke="#111" stroke-width="3"/>`;
const R=(x,y,w,h,f,rx=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" stroke="#111" stroke-width="3"/>`;
const E=(cx,cy,rx,ry,f)=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}" stroke="#111" stroke-width="3"/>`;
const G=(pts,c,w=6)=>`<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
const base=(r=150)=>`<ellipse cx="420" cy="760" rx="330" ry="60" fill="#1b1d21"/>${E(400,690,r,r*0.38,'#4a525c')}${R(400-r,640,r*2,50,'#5a636e')}${E(400,640,r,r*0.38,'#6d7884')}`;
const V='#b78bff',A='#ffb347',Au='#d4af37';
const W={
'1-pulse-cannon':`${base()}${P('270,640 530,640 560,520 300,500','#7c838c')}${R(530,545,330,46,'#8b939c',10)}${R(840,535,50,66,'#5a636e',8)}`,
'2-arc-pulse':`${base()}${P('260,640 540,640 580,510 300,490','#b9c2cc')}${R(540,540,340,48,'#cfd6de',10)}${[600,670,740,810].map(x=>E(x,564,16,40,'#9aa3ad')).join('')}${G('300,600 540,600',V)}${G('560,564 870,564',V,4)}`,
'3-nova-pulse':`${base()}${P('250,640 560,640 600,500 520,460 300,470','#3a3530')}${E(470,560,70,70,'#5a4a30')}${E(470,560,38,38,A)}${R(580,530,320,64,'#4a4030',14)}${R(880,515,60,94,Au,10)}${G('280,620 560,620',A)}${G('600,562 860,562','#ffcf4a',4)}`,
'4-twin-repeater':`${base()}${P('280,640 520,640 550,530 310,510','#7c838c')}${R(520,530,360,24,'#8b939c',8)}${R(520,575,360,24,'#8b939c',8)}`,
'5-storm-repeater':`${base()}${P('270,640 530,640 565,520 300,500','#b9c2cc')}${E(300,590,50,70,'#9aa3ad')}${R(530,525,370,26,'#cfd6de',8)}${R(530,575,370,26,'#cfd6de',8)}${[580,630,680].map(x=>R(x,515,16,96,'#7c838c')).join('')}${G('560,538 890,538',V,4)}${G('560,588 890,588',V,4)}`,
'6-helix-repeater':`${base()}${P('260,640 540,640 575,510 300,490','#3a3530')}${R(540,515,340,44,'#4a4030',20)}${R(540,575,340,44,'#4a4030',20)}${Array.from({length:9},(_,i)=>G(`${560+i*36},510 ${578+i*36},620`,A,5)).join('')}${R(870,505,40,124,Au,8)}${G('290,600 540,600','#ffcf4a')}`,
'7-siege-breaker':`${base(165)}${P('240,640 560,640 590,480 270,460','#7c838c')}${R(560,500,260,100,'#8b939c',14)}${R(800,480,90,140,'#5a636e',10)}${[820,850].map(x=>R(x,495,12,110,'#3a3d44')).join('')}`,
'8-rail-breaker':`${base(165)}${P('240,640 560,640 590,480 270,460','#b9c2cc')}${R(560,490,380,30,'#cfd6de',6)}${R(560,580,380,30,'#cfd6de',6)}${G('580,550 930,550',V,10)}${[620,720,820].map(x=>R(x,485,20,130,'#9aa3ad')).join('')}`,
'9-titanfall':`${base(175)}${P('220,640 580,640 620,450 500,400 260,420','#3a3530')}${P('300,520 520,470 560,560 320,600','#5a4a30')}${R(580,470,280,120,'#4a4030',20)}${R(840,445,110,170,Au,14)}${E(895,530,30,50,'#2a2c30')}${G('250,610 580,610',A)}${G('600,480 840,480','#ffcf4a',5)}${G('600,580 840,580','#ffcf4a',5)}`};
(async()=>{const b=await chromium.launch(),p=await b.newPage();for(const [n,g] of Object.entries(W)){await p.setContent(`<body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="100%" height="100%" fill="#2b2e33"/>${g}</svg></body>`);await (await p.$('svg')).screenshot({path:`${d}/weapon-${n}-guide.png`});}await b.close();console.log('ok')})();
