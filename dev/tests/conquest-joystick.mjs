// Exercise the production Conquest DRIVE pointer handlers with mobile-style lost touch events.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const app=readFileSync('js/conquest/app.js','utf8');
const viewSource=readFileSync('js/conquest/view.js','utf8');
const begin=app.indexOf("const stick=el('div','cq-stick'");
const end=app.indexOf('\n if(dev){',begin);
assert(begin>=0&&end>begin,'production joystick setup exists');
assert(viewSource.includes('reset(){this.releaseStick?.();'),'View.reset releases pointer state along with movement');
class Target {
 constructor(){this.listeners=new Map();this.captured=new Set();this.style={transform:''};}
 setAttribute(){}
 addEventListener(type,fn){const xs=this.listeners.get(type)||[];xs.push(fn);this.listeners.set(type,xs);}
 emit(type,e={}){for(const fn of this.listeners.get(type)||[])fn(e);}
 setPointerCapture(id){this.captured.add(id);}
 hasPointerCapture(id){return this.captured.has(id);}
 releasePointerCapture(id){this.captured.delete(id);this.onlostpointercapture?.({pointerId:id});}
 getBoundingClientRect(){return {x:0,y:0,width:100,height:100};}
}
const win=new Target(),doc=new Target(),stick=new Target(),nub=new Target(),controller=new AbortController();
const view={stick:{x:0,z:0},lifecycle:controller};
const sandbox={window:win,document:doc,panel:{},view,el:(_tag,cls)=>cls==='cq-stick'?stick:nub};
runInNewContext(app.slice(begin,end)+'\nglobalThis.joystick={stick,nub,release};',sandbox);
const point=(pointerId,x,y)=>({pointerId,clientX:x,clientY:y,preventDefault(){}});
const down=(id,x=90,y=50)=>stick.onpointerdown(point(id,x,y));
const neutral=()=>{assert.equal(view.stick.x,0);assert.equal(view.stick.z,0);assert.equal(nub.style.transform,'');};
down(1);assert(view.stick.x>0);assert(stick.hasPointerCapture(1));
stick.onpointermove(point(1,50,10));assert(view.stick.z>0,'active pointer changes direction');
win.emit('pointerup',point(1,50,10));neutral();assert(!stick.hasPointerCapture(1),'window pointerup clears capture');
down(2);stick.onpointercancel(point(2,90,50));neutral();
down(3);stick.onlostpointercapture(point(3,90,50));neutral();
down(4);win.emit('blur');neutral();
down(5);win.emit('pagehide');neutral();
down(6);doc.hidden=true;doc.emit('visibilitychange');neutral();
doc.hidden=false;
down(7);assert(stick.hasPointerCapture(7));down(8,10,50);assert(!stick.hasPointerCapture(7)&&stick.hasPointerCapture(8));assert(view.stick.x<0,'new touch replaces missing pointerup');
view.releaseStick();neutral();assert(!stick.hasPointerCapture(8),'View.reset hook clears DOM pointer state');
down(9);controller.abort();neutral();assert(!stick.hasPointerCapture(9),'world disposal clears joystick');
console.log('PASS Conquest DRIVE: pointerup/cancel/lost capture, blur, pagehide, hide, stale touch takeover, reset and disposal');
