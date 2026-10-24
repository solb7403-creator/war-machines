# Trailer editor: turns the raw captures (capture.py) into finished vertical videos with titles, ramps, shake,
# flashes, letterbox and an original synthesized soundtrack (music.py).
# Usage: python3 dev/trailer/edit.py RAWDIR OUTDIR [main|short|previews|thumb ...]
import os, sys, math, json, subprocess, shutil, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0,HERE)
import music as MU
ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
W,H,FPS=1080,1920,30
GOLD=(255,207,74);WHITE=(255,255,255);INK=(8,11,20);MOON=(232,221,176)
F7=os.path.join(ROOT,'fonts','chakra-petch-700.woff');F6=os.path.join(ROOT,'fonts','chakra-petch-600.woff')
RAW=None
_fc={}
def font(sz,bold=True):
    k=(sz,bold)
    if k not in _fc:_fc[k]=ImageFont.truetype(F7 if bold else F6,sz)
    return _fc[k]

# ---------------- sources ----------------
_meta={}
def nframes(shot):
    if shot not in _meta:_meta[shot]=json.load(open(os.path.join(RAW,shot,'meta.json')))
    return _meta[shot]['frames']
_img={}
def src(shot,i):
    i=max(0,min(nframes(shot)-1,int(round(i))))
    k=(shot,i)
    if k not in _img:
        if len(_img)>400:_img.clear()
        _img[k]=Image.open(os.path.join(RAW,shot,'%05d.jpg'%i)).convert('RGB')
    return _img[k]
def ramp(keys):
    """keys: [(out_t, src_frame), ...] -> f(t) piecewise linear"""
    def f(t):
        if t<=keys[0][0]:return keys[0][1]
        for (t0,s0),(t1,s1) in zip(keys,keys[1:]):
            if t<=t1:return s0+(s1-s0)*(t-t0)/max(1e-6,t1-t0)
        return keys[-1][1]
    return f
def lin(s0,fps_src,speed=1.0):
    return lambda t:s0+t*fps_src*speed

# ---------------- text ----------------
def text_img(txt,sz,fill=WHITE,bold=True,stroke=0,shadow=True,track=0,maxw=None):
    f=font(sz,bold)
    if maxw:
        while f.getlength(txt)+track*len(txt)>maxw and sz>20:sz-=4;f=font(sz,bold)
    w=int(f.getlength(txt)+track*max(0,len(txt)-1))+stroke*2+40;h=int(sz*1.45)+stroke*2+40
    im=Image.new('RGBA',(w,h),(0,0,0,0));d=ImageDraw.Draw(im)
    x=20+stroke;y=20+stroke
    def draw(dd,col,sw,ox=0,oy=0):
        cx=x+ox
        for ch in txt:
            dd.text((cx,y+oy),ch,font=f,fill=col,stroke_width=sw,stroke_fill=(0,0,0,255) if sw else None);cx+=f.getlength(ch)+track
    if shadow:
        sh=Image.new('RGBA',(w,h),(0,0,0,0));draw(ImageDraw.Draw(sh),(0,0,0,200),max(stroke,4),0,int(sz*0.06))
        sh=sh.filter(ImageFilter.GaussianBlur(max(4,sz//14)));im=Image.alpha_composite(im,sh)
    d=ImageDraw.Draw(im);draw(d,fill+(255,) if len(fill)==3 else fill,stroke)
    return im.crop(im.getbbox())
_tc={}
def T(txt,sz,fill=WHITE,**kw):
    k=(txt,sz,fill,tuple(sorted(kw.items())))
    if k not in _tc:_tc[k]=text_img(txt,sz,fill,**kw)
    return _tc[k]

def ease_out(x):x=max(0,min(1,x));return 1-(1-x)**3
def paste_center(base,im,cx,cy,scale=1.0,alpha=1.0):
    if alpha<=0.01:return
    if abs(scale-1)>0.01:im=im.resize((max(1,int(im.width*scale)),max(1,int(im.height*scale))),Image.BICUBIC)
    if alpha<0.999:a=im.split()[3].point(lambda v:int(v*alpha));im=im.copy();im.putalpha(a)
    base.alpha_composite(im,(int(cx-im.width/2),int(cy-im.height/2)))

class Txt:
    """an animated title: kinds 'pop' (scale-in), 'slide' (from left), 'type' (typewriter), 'fade'"""
    def __init__(s,txt,sz,y,t0=0.0,t1=None,fill=WHITE,kind='pop',x=None,bold=True,stroke=0,track=0,maxw=980):
        s.txt,s.sz,s.y,s.t0,s.t1,s.fill,s.kind,s.x,s.bold,s.stroke,s.track,s.maxw=txt,sz,y,t0,t1,fill,kind,x,bold,stroke,track,maxw
    def draw(s,base,t,dur):
        t1=s.t1 if s.t1 is not None else dur
        if t<s.t0 or t>t1:return
        a=1.0;sc=1.0;dx=0;txt=s.txt
        k=(t-s.t0)/0.22
        if s.kind=='pop':sc=1.35-0.35*ease_out(k);a=min(1,k*1.6)
        elif s.kind=='slide':dx=-140*(1-ease_out(k));a=min(1,k*1.5)
        elif s.kind=='fade':a=min(1,(t-s.t0)/0.35)
        elif s.kind=='type':
            n=int(len(s.txt)*min(1,(t-s.t0)/max(0.3,0.045*len(s.txt))));txt=s.txt[:n]
            if not txt:return
        out=(t1-t)/0.14
        if out<1 and t1<dur-0.01:a*=max(0,out)
        if s.kind=='type':
            full=T(s.txt,s.sz,s.fill,bold=s.bold,stroke=s.stroke,track=s.track,maxw=s.maxw)
            im=T(txt,s.sz,s.fill,bold=s.bold,stroke=s.stroke,track=s.track,maxw=s.maxw)
            x0=(W-full.width)/2 if s.x is None else s.x
            paste_center(base,im,x0+im.width/2,s.y,1.0,a);return
        im=T(s.txt,s.sz,s.fill,bold=s.bold,stroke=s.stroke,track=s.track,maxw=s.maxw)
        cx=W/2 if s.x is None else s.x+im.width/2
        paste_center(base,im,cx+dx,s.y,sc,a)

# ---------------- frame effects ----------------
def zoom_crop(im,z,cx=0.5,cy=0.5,shx=0,shy=0):
    if z<=1.001 and not shx and not shy:return im
    w,h=im.size;cw,ch=w/z,h/z
    x0=max(0,min(w-cw,cx*w-cw/2+shx));y0=max(0,min(h-ch,cy*h-ch/2+shy))
    return im.resize((W,H),Image.BICUBIC,box=(x0,y0,x0+cw,y0+ch))
_vig=None
def vignette(strength=0.55):
    global _vig
    if _vig is None:
        y,x=np.mgrid[0:H,0:W];d=np.sqrt(((x-W/2)/(W*0.62))**2+((y-H/2)/(H*0.62))**2)
        v=np.clip(1-(d**2.2)*strength,0,1);_vig=Image.fromarray((v*255).astype('uint8'),'L')
    return _vig
def darken(im,k):
    if k<=0:return im
    return Image.blend(im,Image.new('RGB',im.size,INK),k)
def grade(im):   # moon/gold grade: lift contrast slightly, warm highlights
    return Image.composite(im,Image.new('RGB',im.size,INK),vignette())
def letterbox(base,h=260,a=1.0):
    d=ImageDraw.Draw(base);c=(0,0,0,int(255*a))
    d.rectangle((0,0,W,h),fill=c);d.rectangle((0,H-h,W,H),fill=c)
def flash(base,a,col=(255,255,255)):
    if a<=0:return
    base.alpha_composite(Image.new('RGBA',(W,H),col+(int(255*min(1,a)),)))
def round_mask(w,h,r):
    m=Image.new('L',(w,h),0);ImageDraw.Draw(m).rounded_rectangle((0,0,w-1,h-1),r,fill=255);return m
_rm={}
def phone_card(base,im,t,dur,y=1110,scale=0.74,push=0.03):
    s=scale*(1+push*t/max(dur,0.1))
    w,h=int(W*s),int(H*s)
    if (w,h) not in _rm:_rm[(w,h)]=round_mask(w,h,int(54*s/0.74))
    fg=im.resize((w,h),Image.BICUBIC).convert('RGBA');fg.putalpha(_rm[(w,h)])
    # glow + border
    gl=Image.new('RGBA',(w+120,h+120),(0,0,0,0));ImageDraw.Draw(gl).rounded_rectangle((60,60,w+59,h+59),int(60*s/0.74),fill=GOLD+(150,))
    gl=gl.filter(ImageFilter.GaussianBlur(28))
    x0=int(W/2-w/2);y0=int(y-h/2)
    base.alpha_composite(gl,(x0-60,y0-60))
    bd=Image.new('RGBA',(w+12,h+12),(0,0,0,0));ImageDraw.Draw(bd).rounded_rectangle((0,0,w+11,h+11),int(58*s/0.74),fill=GOLD+(255,))
    base.alpha_composite(bd,(x0-6,y0-6));base.alpha_composite(fg,(x0,y0))
_bl={}
def blurred(shot,i):
    k=(shot,int(i)//2)
    if k not in _bl:
        if len(_bl)>200:_bl.clear()
        im=src(shot,i).resize((270,480),Image.BILINEAR).filter(ImageFilter.GaussianBlur(7)).resize((W,H),Image.BILINEAR)
        _bl[k]=darken(im,0.55)
    return _bl[k]

_bands={}
def band(base,y0,y1,a=0.78):
    """dark gradient band behind lower titles (fades in from y0, solid from the middle)"""
    k=(y0,y1,a)
    if k not in _bands:
        h=y1-y0;g=np.clip(np.linspace(0,1.8,h),0,1)*a*255
        m=Image.fromarray(np.repeat(g[:,None],W,1).astype('uint8'),'L');b=Image.new('RGBA',(W,h),INK+(0,));b.putalpha(m);_bands[k]=b
    base.alpha_composite(_bands[k],(0,y0))

# ---------------- segments ----------------
class Seg:
    def __init__(s,dur,shot=None,fmap=None,zoom=None,center=(0.5,0.5),shake=None,texts=(),letter=False,flash_in=0.0,
                 dim=0.0,card=None,bg=None,cues=(),extra=None,menu=None,menu_map=None,fade_in=0.0,card_y=1110):
        s.dur,s.shot,s.fmap,s.zoom,s.center,s.shake,s.texts,s.letter,s.flash_in,s.dim=dur,shot,fmap,zoom,center,shake,list(texts),letter,flash_in,dim
        s.card,s.bg,s.cues,s.extra,s.menu,s.menu_map,s.fade_in,s.card_y=card,bg,list(cues),extra,menu,menu_map,fade_in,card_y
    def frame(s,t):
        if s.menu:   # a menu screen framed like a phone over blurred gameplay
            bgshot,bgmap=s.bg;base=blurred(bgshot,bgmap(t)).convert('RGBA')
            mi=src(s.menu,s.menu_map(t) if s.menu_map else 0)
            phone_card(base,mi,t,s.dur,y=s.card_y)
        elif s.card:base=s.card(t).convert('RGBA')
        else:
            i=s.fmap(t);im=src(s.shot,i)
            z=s.zoom(t) if s.zoom else 1.0;shx=shy=0
            if s.shake:m=s.shake(t);shx=random.uniform(-m,m);shy=random.uniform(-m,m);z=max(z,1+2.2*m/W+0.01)
            im=zoom_crop(im,z,s.center[0],s.center[1],shx,shy)
            im=grade(im)
            if s.dim:im=darken(im,s.dim(t) if callable(s.dim) else s.dim)
            base=im.convert('RGBA')
        if s.extra:s.extra(base,t)
        if s.letter:letterbox(base,a=1.0)
        for x in s.texts:x.draw(base,t,s.dur)
        if s.flash_in and t<s.flash_in:flash(base,1-t/s.flash_in)
        if s.fade_in and t<s.fade_in:flash(base,1-t/s.fade_in,(0,0,0))
        return base.convert('RGB')

def boom_shake(t0,m=34,decay=5.0):
    return lambda t:0 if t<t0 else m*math.exp(-(t-t0)*decay)

# ---------------- generated cards ----------------
_stars=None
def starfield(t):
    global _stars
    if _stars is None:
        r=random.Random(3);_stars=[(r.random()*W,r.random()*H,r.random()*2.4+0.6,r.random()*6.28) for _ in range(260)]
    im=Image.new('RGB',(W,H),(6,9,18));d=ImageDraw.Draw(im)
    for x,y,rr,ph in _stars:
        a=0.35+0.65*abs(math.sin(t*0.9+ph));c=int(200*a)+40
        y2=(y+t*6)%H;d.ellipse((x-rr,y2-rr,x+rr,y2+rr),fill=(c,c,min(255,c+20)))
    return im
_moon=None
def moon_icon(sz):
    global _moon
    if _moon is None:
        ic=Image.open(os.path.join(ROOT,'icon.png')).convert('RGBA');w=ic.width
        m=Image.new('L',(w,w),0);r=w*0.452;ImageDraw.Draw(m).ellipse((w/2-r,w/2-r,w/2+r,w/2+r),fill=255)
        m=m.filter(ImageFilter.GaussianBlur(1.5));ic.putalpha(m);_moon=ic.crop((int(w/2-r-4),int(w/2-r-4),int(w/2+r+4),int(w/2+r+4)))
    return _moon.resize((sz,sz),Image.LANCZOS)
def glow(base,cx,cy,r,col,a=0.55):
    g=Image.new('RGBA',(int(r*2.6),int(r*2.6)),(0,0,0,0));c=g.width/2
    ImageDraw.Draw(g).ellipse((c-r,c-r,c+r,c+r),fill=col+(int(255*a),));g=g.filter(ImageFilter.GaussianBlur(r*0.35))
    base.alpha_composite(g,(int(cx-c),int(cy-c)))

def end_card(t,short=False):
    base=starfield(t).convert('RGBA')
    k=ease_out(t/0.5);sz=int(560*(0.8+0.2*k))
    glow(base,W/2,700,330,(255,214,120),0.35*k)
    mi=moon_icon(sz);
    if k<1:a=mi.split()[3].point(lambda v:int(v*k));mi.putalpha(a)
    base.alpha_composite(mi,(int(W/2-sz/2),int(700-sz/2+math.sin(t*1.6)*8)))
    Txt('LUNAR',170,1150,0.25,fill=GOLD,track=10).draw(base,t,99)
    Txt('WAR MACHINES',84,1290,0.4,fill=WHITE,track=14).draw(base,t,99)
    Txt('enlist on telegram',64,1480,0.75,fill=MOON,bold=False,kind='fade').draw(base,t,99)
    Txt('t.me/LunarWarMachinesBot/play',50,1580,0.95,fill=GOLD,bold=False,kind='fade').draw(base,t,99)
    return base.convert('RGB')

def title_extra(base,t):
    k=ease_out(t/0.35)
    glow(base,W/2,860,300,(255,200,90),0.3*k)
    mi=moon_icon(int(340*(1.25-0.25*k)));base.alpha_composite(mi,(int(W/2-mi.width/2),int(700-mi.height/2)))

# ---------------- render ----------------
def render(segs,name,out,music_sections,extra_cues=()):
    fd=os.path.join(out,'_frames_'+name)
    if os.path.isdir(fd):shutil.rmtree(fd)
    os.makedirs(fd)
    n=0;t0=0.0;cues=list(extra_cues);marks=[]
    for s in segs:
        k=int(round(s.dur*FPS));marks.append((round(t0,2),s.shot or s.menu or 'card'))
        for c in s.cues:cues.append((t0+c[0],c[1]))
        for i in range(k):
            s.frame(i/FPS).save(os.path.join(fd,'%05d.jpg'%n),quality=93);n+=1
        t0+=k/FPS
    dur=n/FPS
    wav=os.path.join(out,name+'.wav')
    MU.write_wav(wav,MU.music(dur,music_sections(dur),cues))
    mp4=os.path.join(out,name+'.mp4')
    subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate',str(FPS),'-i',os.path.join(fd,'%05d.jpg'),'-i',wav,
        '-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-profile:v','high','-movflags','+faststart',
        '-c:a','aac','-b:a','192k','-shortest',mp4],check=True)
    print(name,round(dur,2),'s',n,'frames',marks,flush=True)
    return mp4,fd,dur

if __name__=='__main__':
    import edit as E
    E.RAW=sys.argv[1];OUT=sys.argv[2];os.makedirs(OUT,exist_ok=True)
    import timeline
    timeline.run(sys.argv[3:] or ['main','short','previews','thumb'],OUT)
