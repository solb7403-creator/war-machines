# contact sheet of a raw shot: python3 sheet.py RAWDIR shot [step] -> RAWDIR/sheet_<shot>.jpg (frame numbers stamped)
import sys,os,json
from PIL import Image,ImageDraw
raw,shot=sys.argv[1],sys.argv[2];step=int(sys.argv[3]) if len(sys.argv)>3 else 10
n=json.load(open(os.path.join(raw,shot,'meta.json')))['frames'] if os.path.exists(os.path.join(raw,shot,'meta.json')) else len([f for f in os.listdir(os.path.join(raw,shot)) if f.endswith('.jpg')])
idx=list(range(0,n,step));cols=8;tw,th=180,320;rows=(len(idx)+cols-1)//cols
S=Image.new('RGB',(cols*tw,rows*th));d=ImageDraw.Draw(S)
for k,i in enumerate(idx):
    im=Image.open(os.path.join(raw,shot,'%05d.jpg'%i)).resize((tw,th));S.paste(im,((k%cols)*tw,(k//cols)*th))
    d.rectangle(((k%cols)*tw,(k//cols)*th,(k%cols)*tw+44,(k//cols)*th+18),fill=(0,0,0));d.text(((k%cols)*tw+3,(k//cols)*th+3),str(i),fill=(255,255,0))
S.save(os.path.join(raw,'sheet_'+shot+'.jpg'),quality=85)
