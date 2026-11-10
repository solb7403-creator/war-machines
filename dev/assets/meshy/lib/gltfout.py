"""Write a compact, standard GLB: KHR_mesh_quantization + EXT_meshopt_compression geometry, embedded WebP textures
(EXT_texture_webp) and a `_MOT` vertex attribute + `extras.lunar` block the game's Meshy3D loader reads for moving parts."""
import io
import json
import struct
import numpy as np
import meshoptimizer as mo
from PIL import Image


def _pad4(b, fill=b'\0'):
    return b + fill * ((4 - len(b) % 4) % 4)


def encode_image(arr, quality, lossless=False, fmt='WEBP'):
    """arr: HxWx3 uint8. Returns bytes."""
    im = Image.fromarray(arr, 'RGB')
    bio = io.BytesIO()
    if fmt == 'PNG':
        im.save(bio, 'PNG', optimize=True)
    else:
        im.save(bio, 'WEBP', quality=int(quality), method=6, lossless=bool(lossless), exact=True)
    return bio.getvalue()


def write_glb(path, V, N, UV, F, mot=None, textures=None, material=None, extras=None, name='meshy', compress=True):
    """V (n,3) float, N (n,3) unit, UV (n,2) in 0..1, F (m,3) int, mot (n,4) uint16 or None.
    textures: dict name -> (bytes, mime) for 'base','normal','orm','mask'. Returns stats dict."""
    V = np.asarray(V, np.float64); F = np.asarray(F, np.int64)
    n = len(V)
    # vertex cache + fetch order (also improves the meshopt codec)
    idx = F.astype(np.uint32).ravel().copy()
    out = np.zeros_like(idx); mo.optimize_vertex_cache(out, idx, len(idx), n); idx = out
    remap = np.zeros(n, np.uint32); nuniq = mo.optimize_vertex_fetch_remap(remap, idx, len(idx), n)
    order = np.zeros(nuniq, np.int64); order[remap[remap != 0xffffffff]] = np.flatnonzero(remap != 0xffffffff)
    idx = remap[idx]
    V = V[order]; N = N[order]; UV = UV[order]
    if mot is not None:
        mot = mot[order]
    n = len(V)
    # quantize
    mn = V.min(0); mx = V.max(0); ext = np.maximum(mx - mn, 1e-9)
    qp = np.zeros((n, 4), np.uint16); qp[:, :3] = np.round((V - mn) / ext * 65535).astype(np.uint16)
    qn = np.zeros((n, 4), np.int8); qn[:, :3] = np.round(np.clip(N, -1, 1) * 127).astype(np.int8)
    qt = np.round(np.clip(UV, 0, 1) * 65535).astype(np.uint16)
    big = n > 65535
    qi = idx.astype(np.uint32 if big else np.uint16)
    mo.encode_vertex_version(0); mo.encode_index_version(1)
    views = []; bin_ = b''; accessors = []; fallback = 0

    def add_view(raw, stride, count, mode, target):
        nonlocal bin_, fallback
        comp = mo.encode_vertex_buffer(raw.reshape(count, -1), count, stride) if mode == 'ATTRIBUTES' else mo.encode_index_buffer(raw, count, n)
        if not compress:
            off = len(bin_); bin_ += _pad4(raw.tobytes())
            v = {'buffer': 0, 'byteOffset': off, 'byteLength': raw.nbytes, 'target': target}
            if mode == 'ATTRIBUTES':
                v['byteStride'] = stride
        else:
            off = len(bin_); bin_ += _pad4(comp)
            v = {'buffer': 1, 'byteOffset': fallback, 'byteLength': raw.nbytes, 'target': target,
                 'extensions': {'EXT_meshopt_compression': {'buffer': 0, 'byteOffset': off, 'byteLength': len(comp), 'byteStride': stride, 'count': count, 'mode': mode}}}
            if mode == 'ATTRIBUTES':
                v['byteStride'] = stride
            fallback += raw.nbytes + (4 - raw.nbytes % 4) % 4
        views.append(v)
        return len(views) - 1

    attrs = {}
    bv = add_view(qp, 8, n, 'ATTRIBUTES', 34962)
    accessors.append({'bufferView': bv, 'componentType': 5123, 'normalized': True, 'count': n, 'type': 'VEC3', 'min': [0, 0, 0], 'max': [1, 1, 1]})
    attrs['POSITION'] = len(accessors) - 1
    bv = add_view(qn, 4, n, 'ATTRIBUTES', 34962)
    accessors.append({'bufferView': bv, 'componentType': 5120, 'normalized': True, 'count': n, 'type': 'VEC3'})
    attrs['NORMAL'] = len(accessors) - 1
    bv = add_view(qt, 4, n, 'ATTRIBUTES', 34962)
    accessors.append({'bufferView': bv, 'componentType': 5123, 'normalized': True, 'count': n, 'type': 'VEC2'})
    attrs['TEXCOORD_0'] = len(accessors) - 1
    if mot is not None:
        bv = add_view(np.ascontiguousarray(mot, np.uint16), 8, n, 'ATTRIBUTES', 34962)
        accessors.append({'bufferView': bv, 'componentType': 5123, 'count': n, 'type': 'VEC4'})
        attrs['_MOT'] = len(accessors) - 1
    bv = add_view(qi, 4 if big else 2, len(qi), 'TRIANGLES', 34963)
    accessors.append({'bufferView': bv, 'componentType': 5125 if big else 5123, 'count': len(qi), 'type': 'SCALAR'})
    ind = len(accessors) - 1
    geo_bytes = len(bin_)
    images = []; tex = []; tex_bytes = {}
    mat = {'name': name, 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 1.0, 'roughnessFactor': 1.0}}
    if material:
        mat['pbrMetallicRoughness'].update(material)
    for key in ('base', 'normal', 'orm', 'mask'):
        if not textures or key not in textures:
            continue
        data, mime = textures[key]
        off = len(bin_); bin_ += _pad4(data)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data)})
        images.append({'bufferView': len(views) - 1, 'mimeType': mime, 'name': key})
        t = {'sampler': 0, 'name': key}
        if mime == 'image/webp':
            t['extensions'] = {'EXT_texture_webp': {'source': len(images) - 1}}
        else:
            t['source'] = len(images) - 1
        tex.append(t); ti = len(tex) - 1; tex_bytes[key] = len(data)
        if key == 'base':
            mat['pbrMetallicRoughness']['baseColorTexture'] = {'index': ti}
        elif key == 'normal':
            mat['normalTexture'] = {'index': ti}
        elif key == 'orm':
            mat['pbrMetallicRoughness']['metallicRoughnessTexture'] = {'index': ti}; mat['occlusionTexture'] = {'index': ti}
        else:
            mat.setdefault('extras', {})['lunarMask'] = ti
    used = ['KHR_mesh_quantization']
    if compress:
        used.append('EXT_meshopt_compression')
    if any('extensions' in t for t in tex):
        used.append('EXT_texture_webp')
    js = {
        'asset': {'version': '2.0', 'generator': 'LUNAR meshy pipeline'},
        'extensionsUsed': used, 'extensionsRequired': used,
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'name': name, 'mesh': 0, 'translation': [float(x) for x in mn], 'scale': [float(x) for x in ext]}],
        'meshes': [{'name': name, 'primitives': [{'attributes': attrs, 'indices': ind, 'material': 0, 'mode': 4}]}],
        'materials': [mat], 'accessors': accessors, 'bufferViews': views,
        'buffers': [{'byteLength': len(bin_)}] + ([{'byteLength': fallback, 'extensions': {'EXT_meshopt_compression': {'fallback': True}}}] if compress else []),
    }
    if tex:
        js['textures'] = tex; js['images'] = images
        js['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}]
    if extras:
        js['extras'] = {'lunar': extras}
    jb = _pad4(json.dumps(js, separators=(',', ':')).encode(), b' ')
    total = 12 + 8 + len(jb) + 8 + len(bin_)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546c67, 2, total))
        f.write(struct.pack('<II', len(jb), 0x4e4f534a)); f.write(jb)
        f.write(struct.pack('<II', len(bin_), 0x004e4942)); f.write(bin_)
    return {'bytes': total, 'geometryBytes': geo_bytes, 'textureBytes': tex_bytes, 'verts': int(n), 'tris': int(len(qi) // 3)}
