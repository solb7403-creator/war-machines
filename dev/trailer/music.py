# Original trailer soundtrack, synthesized from scratch (numpy): no samples, no third-party music.
# music(dur, cues) -> float32 stereo array at SR. cues: list of (time_s, kind) for hits synced to the edit:
#   'slam' big impact, 'boom' super impact, 'whoosh' transition, 'tick' cut accent, 'riser' (starts a 2 s riser ending at t)
# Sections are given in bars (120 BPM, 2 s per bar).
import numpy as np
SR=48000
BPM=120;BEAT=60/BPM;BAR=BEAT*4
rng=np.random.default_rng(7)

def env(n,a,d,curve=4.0):
    t=np.arange(n)/SR;e=np.minimum(1,t/max(a,1e-4))*np.exp(-curve*np.maximum(0,t-a)/max(d,1e-4));return e
def lp(x,k):   # one-pole low-pass, k in 0..1 (bigger = brighter)
    y=np.empty_like(x);acc=0.0
    for i in range(len(x)):acc+=k*(x[i]-acc);y[i]=acc
    return y
def lpf(x,fc):  # fast FFT low-pass
    X=np.fft.rfft(x);f=np.fft.rfftfreq(len(x),1/SR);X*=1/(1+(f/fc)**4);return np.fft.irfft(X,len(x))
def hpf(x,fc):
    X=np.fft.rfft(x);f=np.fft.rfftfreq(len(x),1/SR);X*=1-1/(1+(f/fc)**4);return np.fft.irfft(X,len(x))
def saw(f,n,ph=0):t=np.arange(n)/SR;return 2*((t*f+ph)%1)-1
def sq(f,n):t=np.arange(n)/SR;return np.sign(np.sin(2*np.pi*f*t))
def nf(note):return 440*2**((note-69)/12)   # midi -> Hz

def kick(n=int(0.45*SR)):
    t=np.arange(n)/SR;f=45+120*np.exp(-t*28);ph=2*np.pi*np.cumsum(f)/SR
    return (np.sin(ph)*np.exp(-t*7.5)+0.25*np.tanh(4*np.sin(ph))*np.exp(-t*30))*0.95
def clap(n=int(0.3*SR)):
    x=rng.standard_normal(n);x=hpf(lpf(x,4200),900);e=np.zeros(n)
    for o in (0,0.011,0.022):i=int(o*SR);e[i:]+=env(n-i,0.001,0.09,6)
    return x*e*0.55
def hat(n=int(0.07*SR),open_=False):
    if open_:n=int(0.25*SR)
    x=hpf(rng.standard_normal(n),7000);return x*env(n,0.001,0.04 if not open_ else 0.15,5)*0.28
def boom(n=int(2.4*SR),big=False):
    t=np.arange(n)/SR;f=38+70*np.exp(-t*6);ph=2*np.pi*np.cumsum(f)/SR
    sub=np.sin(ph)*np.exp(-t*(1.6 if big else 2.4))
    nz=lpf(rng.standard_normal(n),1800 if big else 2600)*np.exp(-t*(3.0 if big else 4.5))
    crack=hpf(rng.standard_normal(n),2000)*np.exp(-t*30)
    return np.tanh(1.6*(sub*1.0+nz*0.7+crack*0.35))*(1.0 if big else 0.8)
def whoosh(n=int(0.6*SR)):
    t=np.arange(n)/SR;x=rng.standard_normal(n);e=np.sin(np.pi*t/t[-1])**2
    # sweep: blend from dark to bright
    a=lpf(x,900);b=lpf(x,5000);k=t/t[-1];return (a*(1-k)+b*k)*e*0.45
def riser(n=int(2.0*SR)):
    t=np.arange(n)/SR;k=t/t[-1];x=rng.standard_normal(n)
    nz=(lpf(x,600)*(1-k)+hpf(x,1500)*k)*k**2
    f=110*2**(k*3);tone=saw(1,n)*0;ph=2*np.pi*np.cumsum(f)/SR;tone=np.sin(ph)*k**2*0.35
    return (nz*0.5+tone)
def tick(n=int(0.12*SR)):
    t=np.arange(n)/SR;return (np.sin(2*np.pi*1800*t)*np.exp(-t*60)*0.25+hpf(rng.standard_normal(n),4000)*np.exp(-t*80)*0.2)

def place(buf,x,t,g=1.0,pan=0.0):
    i=int(t*SR)
    if i>=len(buf) or i+len(x)<=0:return
    j=max(0,-i);x=x[j:];i=max(0,i);m=min(len(x),len(buf)-i)
    l=g*np.sqrt(0.5*(1-pan));r=g*np.sqrt(0.5*(1+pan))
    buf[i:i+m,0]+=x[:m]*l*1.41;buf[i:i+m,1]+=x[:m]*r*1.41

# A minor: Am - F - C - G (i - VI - III - VII), one chord per bar
PROG=[(57,60,64),(53,57,60),(48,52,55),(55,59,62)]
ROOT=[45,41,48,43]

def pad_bar(chord,n):
    x=np.zeros(n)
    for m in chord:
        for d in (-0.08,0.0,0.08):x+=saw(nf(m+12)*(1+d/100),n,rng.random())
    x=lpf(x/9,1400);e=np.minimum(1,np.arange(n)/(0.3*SR))*np.minimum(1,(n-np.arange(n))/(0.2*SR));return x*e*0.22
def bass_bar(root,n,drive=True):
    x=np.zeros(n);step=int(BEAT/2*SR)
    for k in range(8):
        s=k*step;m=min(step,n-s);note=root+(12 if k in (3,7) else 0)
        v=saw(nf(note),m)+0.5*sq(nf(note-12),m);x[s:s+m]+=v*env(m,0.003,0.18,3)
    return lpf(np.tanh(x*(1.6 if drive else 0.8)),700)*0.42
def arp_bar(chord,n):
    x=np.zeros(n);step=int(BEAT/4*SR);seq=[0,1,2,1,0,2,1,2]
    for k in range(16):
        s=k*step;m=min(step,n-s);note=chord[seq[k%8]]+24
        x[s:s+m]+=sq(nf(note),m)*env(m,0.002,0.09,5)
    return lpf(x,3200)*0.09

def music(dur,sections,cues):
    """sections: list of (start_s, end_s, set_of_layers) with layers in {'pad','bass','kick','clap','hats','arp','drone'}"""
    n=int(dur*SR);out=np.zeros((n,2))
    nb=int(np.ceil(dur/BAR))+1
    for b in range(nb):
        t0=b*BAR
        lay=set()
        for s0,s1,L in sections:
            if s0<=t0+0.01<s1:lay|=L
        if not lay:continue
        ci=b%4;bn=int(BAR*SR)
        if 'drone' in lay:
            t=np.arange(bn)/SR;d=np.sin(2*np.pi*nf(33)*t)*0.25+lpf(saw(nf(45),bn),300)*0.15;place(out,d*np.minimum(1,(bn-np.arange(bn))/(0.05*SR)),t0,0.6)
        if 'pad' in lay:place(out,pad_bar(PROG[ci],bn),t0,0.9,-0.2);place(out,pad_bar(PROG[ci],bn),t0,0.9,0.2)
        if 'bass' in lay:place(out,bass_bar(ROOT[ci],bn),t0,1.0)
        if 'arp' in lay:place(out,arp_bar(PROG[ci],bn),t0,0.9,0.35)
        for k in range(4):
            tb=t0+k*BEAT
            if tb>=dur:break
            if 'kick' in lay:place(out,kick(),tb,1.0)
            if 'clap' in lay and k in (1,3):place(out,clap(),tb,0.9)
            if 'hats' in lay:
                place(out,hat(),tb+BEAT/2,0.8,0.3);place(out,hat(),tb+BEAT/4*3,0.45,-0.3) if 'arp' in lay else None
    for t,kind in cues:
        if kind=='slam':place(out,boom(big=True),t,1.15);place(out,kick(),t,1.0)
        elif kind=='boom':place(out,boom(),t,0.95)
        elif kind=='whoosh':place(out,whoosh(),t-0.3,0.8)
        elif kind=='tick':place(out,tick(),t,0.9)
        elif kind=='riser':r=riser();place(out,r,t-len(r)/SR,0.8)
    # gentle bus compression + limiter
    out=np.tanh(out*1.1)*0.92
    pk=np.max(np.abs(out));out*=0.95/max(pk,1e-6)
    fade=int(0.6*SR);out[-fade:]*=np.linspace(1,0,fade)[:,None]
    return out.astype(np.float32)

def write_wav(path,x):
    import wave
    y=(np.clip(x,-1,1)*32767).astype('<i2')
    with wave.open(path,'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(y.tobytes())
