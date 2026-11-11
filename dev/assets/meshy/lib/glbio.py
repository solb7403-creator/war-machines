import json, struct, numpy as np
CT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def read_glb(path):
    with open(path,'rb') as f: data=f.read()
    magic,ver,length=struct.unpack_from('<III',data,0); assert magic==0x46546c67
    off=12; js=None; bin_=None
    while off<length:
        n,t=struct.unpack_from('<II',data,off); off+=8
        if t==0x4e4f534a: js=json.loads(data[off:off+n])
        elif t==0x004e4942: bin_=memoryview(data)[off:off+n]
        off+=n
    return js,bin_
def accessor(js,bin_,i):
    a=js['accessors'][i]; bv=js['bufferViews'][a['bufferView']]
    dt=CT[a['componentType']]; nc=NC[a['type']]
    o=bv.get('byteOffset',0)+a.get('byteOffset',0); stride=bv.get('byteStride',0)
    if stride and stride!=np.dtype(dt).itemsize*nc:
        raw=np.frombuffer(bin_,dtype=np.uint8,count=stride*a['count'],offset=o).reshape(a['count'],stride)
        arr=raw[:,:np.dtype(dt).itemsize*nc].copy().view(dt).reshape(a['count'],nc)
    else:
        arr=np.frombuffer(bin_,dtype=dt,count=a['count']*nc,offset=o).reshape(a['count'],nc)
    return arr
def node_matrix(n):
    if 'matrix' in n: return np.array(n['matrix'],dtype=np.float64).reshape(4,4).T
    M=np.eye(4)
    if 'scale' in n: M=np.diag(list(n['scale'])+[1.0])
    if 'rotation' in n:
        x,y,z,w=n['rotation']; R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]); R4=np.eye(4); R4[:3,:3]=R; M=R4@M
    if 'translation' in n: T=np.eye(4); T[:3,3]=n['translation']; M=T@M
    return M
def load_mesh(path, want_uv=False):
    """Returns V (n,3 float64), F (m,3 int64), extras dict. Flattens scene with node transforms."""
    js,bin_=read_glb(path)
    Vs=[];Fs=[];UVs=[];base=0; info={'json':js,'bin':bin_,'prims':[]}
    def walk(i,M):
        n=js['nodes'][i]; M2=M@node_matrix(n)
        if 'mesh' in n:
            for p in js['meshes'][n['mesh']]['primitives']:
                P=accessor(js,bin_,p['attributes']['POSITION']).astype(np.float64)
                P=(np.c_[P,np.ones(len(P))]@M2.T)[:,:3]
                I=accessor(js,bin_,p['indices']).astype(np.int64).reshape(-1,3) if 'indices' in p else np.arange(len(P)).reshape(-1,3)
                nonlocal base
                Vs.append(P);Fs.append(I+base)
                if want_uv and 'TEXCOORD_0' in p['attributes']: UVs.append(accessor(js,bin_,p['attributes']['TEXCOORD_0']).astype(np.float64))
                info['prims'].append(dict(attrs=list(p['attributes'].keys()),material=p.get('material'),nv=len(P),nf=len(I)))
                base+=len(P)
        for c in n.get('children',[]): walk(c,M2)
    sc=js['scenes'][js.get('scene',0)]
    for r in sc['nodes']: walk(r,np.eye(4))
    V=np.vstack(Vs);F=np.vstack(Fs)
    if want_uv and UVs: info['uv']=np.vstack(UVs)
    return V,F,info


def load_textures(path):
    """Base colour (sRGB->linear float), metallic-roughness and normal images of the first material, or None each."""
    import io
    from PIL import Image
    js, bin_ = read_glb(path)
    out = {'base': None, 'mr': None, 'normal': None}
    mats = js.get('materials') or []
    if not mats:
        return out
    m = mats[0]; pbr = m.get('pbrMetallicRoughness', {})
    slots = {'base': pbr.get('baseColorTexture'), 'mr': pbr.get('metallicRoughnessTexture'), 'normal': m.get('normalTexture')}
    for key, ref in slots.items():
        if not ref:
            continue
        tex = js['textures'][ref['index']]
        src = tex.get('source', tex.get('extensions', {}).get('EXT_texture_webp', {}).get('source'))
        bv = js['bufferViews'][js['images'][src]['bufferView']]
        raw = bytes(bin_[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])
        a = np.asarray(Image.open(io.BytesIO(raw)).convert('RGB')).astype(np.float32) / 255.0
        if key == 'base':
            a = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
        out[key] = a
    out['factors'] = dict(base=pbr.get('baseColorFactor', [1, 1, 1, 1]), metallic=pbr.get('metallicFactor', 1.0), roughness=pbr.get('roughnessFactor', 1.0))
    return out


def sample(img, uv):
    """Bilinear sample of an HxWx3 image at glTF uv (origin top-left), clamped."""
    h, w = img.shape[:2]
    x = np.clip(uv[:, 0], 0, 1) * w - 0.5; y = np.clip(uv[:, 1], 0, 1) * h - 0.5
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    xa = np.clip(x0, 0, w - 1); xb = np.clip(x0 + 1, 0, w - 1); ya = np.clip(y0, 0, h - 1); yb = np.clip(y0 + 1, 0, h - 1)
    return (img[ya, xa] * (1 - fx) + img[ya, xb] * fx) * (1 - fy) + (img[yb, xa] * (1 - fx) + img[yb, xb] * fx) * fy
